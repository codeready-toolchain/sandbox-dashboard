import { AnalyticsBrowser } from "@segment/analytics-next";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { getSegmentWriteKey, getUIConfig } from "../api/registration";
import { Intcmp } from "../components/Catalog/productData";
import { Environment, getConfig } from "../config/config";
import type { Product } from "../types/product";
import {
  type IntentEventName,
  type IntentSection,
  type ProductAnalyticsAction,
  productAnalyticsEventName,
  sandboxAnalyticsProperties,
  segmentTrackClick,
  segmentTrackEvent,
  trackMarketoEvent,
} from "../utils/analytics";
import {
  CONSENT_POLL_DELAY_MS,
  hasAnalyticsConsent,
} from "../utils/analytics-consent";
import { AnalyticsContext } from "./AnalyticsContext";
import { useUserContext } from "./UserContext";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [marketoWebhookURL, setMarketoWebhookURL] = useState<
    string | undefined
  >();
  const [segmentWriteKey, setSegmentWriteKey] = useState<string>();
  const analyticsRef = useRef<AnalyticsBrowser | null>(null);
  const hasIdentifiedRef = useRef(false);
  const hasGroupedRef = useRef(false);
  const lastIdentifiedUserIdRef = useRef<string | undefined>(undefined);

  const isProd = getConfig().environment === Environment.PRODUCTION;
  const { user } = useUserContext();

  const [consentGranted, setConsentGranted] = useState(() =>
    isProd ? hasAnalyticsConsent() : false,
  );

  // Keep analytics consent in sync with TrustArc. The
  // `cmapi_cookie_privacy` cookie is the source of truth, but React will
  // not re-read it unless something asks it to.
  //
  // TrustArc's banner can:
  // - fire `window.postMessage` before the cookie is readable
  // - write the cookie without a message we can use
  // - take focus while the visitor decides
  //
  // So we re-check on `message` (banner decision), `focus` and
  // `visibilitychange` (banner or tab interaction), and we also poll
  // until category 2 is granted. We cannot treat a missing cookie as
  // "the user rejected analytics": TrustArc does not persist a denial
  // flag we can read, so a missing cookie only means "not granted yet".
  // Polling therefore continues until consent appears, then stops. If
  // the visitor later revokes analytics, polling starts again in case
  // they accept on a later visit to the preference centre.
  //
  // The poll uses a recursive timeout rather than an interval: the next
  // check is only scheduled after the current one finishes, so two
  // cookie reads cannot overlap. `timeoutId` also prevents listeners
  // from queuing a second pending check while one is already waiting.
  useEffect(() => {
    if (!isProd) {
      return;
    }

    let timeoutId: number | undefined;

    const stopPolling = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    };

    const scheduleNextCheck = () => {
      if (timeoutId !== undefined) {
        return;
      }
      timeoutId = window.setTimeout(() => {
        timeoutId = undefined;
        checkConsent();
      }, CONSENT_POLL_DELAY_MS);
    };

    const checkConsent = (): boolean => {
      const granted = hasAnalyticsConsent();
      setConsentGranted((prev) => (prev !== granted ? granted : prev));
      if (granted) {
        stopPolling();
      } else {
        scheduleNextCheck();
      }
      return granted;
    };

    checkConsent();

    window.addEventListener("message", checkConsent);
    window.addEventListener("focus", checkConsent);
    document.addEventListener("visibilitychange", checkConsent);

    return () => {
      window.removeEventListener("message", checkConsent);
      window.removeEventListener("focus", checkConsent);
      document.removeEventListener("visibilitychange", checkConsent);
      stopPolling();
    };
  }, [isProd]);

  // Include the Adobe Analytics in the page if we have permission for it.
  useEffect(() => {
    // Is the consent revoked or not granted? Invoke the Adobe Analyitics
    // teardown and attempt removing the script.
    if (!consentGranted) {
      // Adobe Analytics global tracker, injected at runtime by dpal.js.
      const s = window.s;
      if (s) {
        s.abort = true;
      }

      const existing = document.getElementById("dpal");
      if (existing) {
        existing.remove();
      }
      return;
    }

    // Guard to avoid injecting it twice, just in case.
    if (document.getElementById("dpal")) {
      return;
    }

    const script = document.createElement("script");
    script.id = "dpal";
    script.src = "https://www.redhat.com/ma/dpal.js";
    document.body.appendChild(script);

    return () => {
      const s = window.s;
      if (s) {
        s.abort = true;
      }
      const el = document.getElementById("dpal");
      if (el) {
        el.remove();
      }
    };
  }, [consentGranted]);

  // Tear down Segment when consent is revoked.
  useEffect(() => {
    if (consentGranted) {
      return;
    }
    if (analyticsRef.current) {
      analyticsRef.current.reset();
      analyticsRef.current = null;
    }
    hasIdentifiedRef.current = false;
    hasGroupedRef.current = false;
    lastIdentifiedUserIdRef.current = undefined;
  }, [consentGranted]);

  // Fetch the Segment key and the Marketo webhook URL in production after
  // consent is granted.
  useEffect(() => {
    if (!isProd || !consentGranted) {
      return;
    }
    // The stale flag is needed because the "fetchSegmentKey" and
    // "fetchMarketoWebhookURL" are async. If consent is revoked while there
    // is a network request in-flight, React will run the effect's cleanup but
    // the "await" could resolve afterwards.
    let stale = false;
    const fetchSegmentKey = async () => {
      try {
        const writeKey = await getSegmentWriteKey();
        if (!stale) {
          setSegmentWriteKey(writeKey);
        }
      } catch {
        // Continue without Segment tracking
      }
    };
    fetchSegmentKey();

    const fetchMarketoWebhookURL = async () => {
      try {
        const workatoWebHookURL = (await getUIConfig()).workatoWebHookURL;
        if (!stale) {
          setMarketoWebhookURL(workatoWebHookURL);
        }
      } catch {
        // Continue without Marketo analytics
      }
    };
    fetchMarketoWebhookURL();

    return () => {
      stale = true;
    };
  }, [isProd, consentGranted]);

  // Initialize Segment when write key arrives (only while consent holds).
  useEffect(() => {
    if (!segmentWriteKey || !consentGranted) {
      return;
    }
    try {
      analyticsRef.current = AnalyticsBrowser.load({
        writeKey: segmentWriteKey,
      });
    } catch {
      // Initialization failed — continue without Segment
    }
  }, [segmentWriteKey, consentGranted]);

  // Segment's identify() and group() associate all subsequent track() calls
  // with the current user and their Red Hat account. We only need to call
  // them once per session because the Segment SDK caches the identity
  // client-side and because repeating the calls would just generate redundant
  // network requests. The refs reset when the userID changes so that a
  // different user (e.g. after logout/login) gets properly re-identified.
  useEffect(() => {
    if (!analyticsRef.current) {
      return;
    }

    const currentUserId = user?.userID;

    if (currentUserId && lastIdentifiedUserIdRef.current !== currentUserId) {
      hasIdentifiedRef.current = false;
      hasGroupedRef.current = false;
    }

    if (currentUserId && !hasIdentifiedRef.current) {
      try {
        const traits: Record<string, string> = { company: user.company };
        if (user.email) {
          const emailDomain = user.email.split("@")[1];
          if (emailDomain) {
            traits.email_domain = emailDomain;
          }
        }
        analyticsRef.current.identify(currentUserId, traits);
        hasIdentifiedRef.current = true;
        lastIdentifiedUserIdRef.current = currentUserId;
      } catch {
        // ignore identify errors
      }
    }

    if (user?.accountID && !hasGroupedRef.current) {
      try {
        const groupTraits: Record<string, string> = {};
        if (user.accountNumber) {
          groupTraits.ebs = user.accountNumber;
        }
        analyticsRef.current.group(user.accountID, groupTraits);
        hasGroupedRef.current = true;
      } catch {
        // ignore group errors
      }
    }
  }, [consentGranted, segmentWriteKey, user]);

  // Named clicks, such as opening an activity. Segment only.
  const trackAnalytics = useCallback(
    (
      itemName: string,
      section: "Catalog" | "Activities" | "Support" | "Verification",
      href?: string,
      linkType: "cta" | "default" = "default",
    ) => {
      if (!consentGranted || !analyticsRef.current) {
        return;
      }

      segmentTrackClick(analyticsRef.current, {
        itemName,
        section,
        href,
        linkType,
      });
    },
    [consentGranted],
  );

  // Product open and setup. Segment always, Marketo only with a campaign.
  const trackProductAction = useCallback(
    (product: Product, action: ProductAnalyticsAction, href?: string) => {
      if (!consentGranted) {
        return;
      }

      const internalCampaign = Intcmp[product.type] || undefined;
      const properties: Record<string, unknown> = {
        ...sandboxAnalyticsProperties("Catalog", {
          text: product.title,
          productType: product.type,
          action,
          linkType: "cta",
        }),
      };
      if (href) {
        properties.href = href;
      }
      if (internalCampaign) {
        properties.internalCampaign = internalCampaign;
      }

      if (analyticsRef.current) {
        segmentTrackEvent(
          analyticsRef.current,
          productAnalyticsEventName(action),
          properties,
        );
      }

      if (internalCampaign) {
        trackMarketoEvent(user, internalCampaign, marketoWebhookURL);
      }
    },
    [consentGranted, marketoWebhookURL, user],
  );

  // Outcomes and other named intent events. Segment only.
  const trackIntent = useCallback(
    (
      eventName: IntentEventName,
      section: IntentSection,
      properties?: Record<string, string>,
    ) => {
      if (!consentGranted || !analyticsRef.current) {
        return;
      }

      segmentTrackEvent(
        analyticsRef.current,
        eventName,
        sandboxAnalyticsProperties(section, properties),
      );
    },
    [consentGranted],
  );

  return (
    <AnalyticsContext.Provider
      value={{ trackAnalytics, trackProductAction, trackIntent }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}
