import { AnalyticsBrowser } from "@segment/analytics-next";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getSegmentWriteKey } from "../api/registration";
import { Intcmp } from "../components/Catalog/productData";
import { Environment, getConfig } from "../config/config";
import type { Product } from "../types/product";
import { segmentTrackClick, trackMarketoEvent } from "../utils/analytics";
import { AnalyticsContext } from "./AnalyticsContext";
import { useUIConfigurationContext } from "./UIConfigurationContext";
import { useUserContext } from "./UserContext";

/**
 * Checks TrustArc's preference cookie for analytics consent (category 2).
 * Returns false when the cookie is absent or does not include the category.
 */
function hasAnalyticsConsent(): boolean {
  const match = document.cookie.match(/cmapi_cookie_privacy=([^;]+)/);
  if (!match) return false;
  const value = decodeURIComponent(match[1]);
  return /permit\s+[\d,]*2/.test(value);
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [segmentWriteKey, setSegmentWriteKey] = useState<string>();
  const analyticsRef = useRef<AnalyticsBrowser | null>(null);
  const hasIdentifiedRef = useRef(false);
  const hasGroupedRef = useRef(false);
  const lastIdentifiedUserIdRef = useRef<string | undefined>(undefined);

  const isProd = getConfig().environment === Environment.PRODUCTION;
  const { user } = useUserContext();
  const { marketoWebhookURL } = useUIConfigurationContext();

  const [consentGranted, setConsentGranted] = useState(() =>
    isProd ? hasAnalyticsConsent() : false,
  );

  // Listen for TrustArc consent changes (fires postMessage on decision).
  useEffect(() => {
    if (!isProd) return;

    const checkConsent = () => {
      const granted = hasAnalyticsConsent();
      setConsentGranted((prev) => (prev !== granted ? granted : prev));
    };

    window.addEventListener("message", checkConsent);
    return () => window.removeEventListener("message", checkConsent);
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
    if (document.getElementById("dpal")) return;

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
    if (consentGranted) return;
    if (analyticsRef.current) {
      analyticsRef.current.reset();
      analyticsRef.current = null;
    }
    hasIdentifiedRef.current = false;
    hasGroupedRef.current = false;
    lastIdentifiedUserIdRef.current = undefined;
  }, [consentGranted]);

  // Fetch the Segment key only in production after consent is granted.
  useEffect(() => {
    if (!isProd || !consentGranted) return;
    // The stale flag is needed because the "getSegmentWriteKey" is async. If
    // consent is revoked while there is a network request in-flight, React
    // will run the effect's cleanup but the "await" could resolve afterwards.
    let stale = false;
    const fetchKey = async () => {
      try {
        const writeKey = await getSegmentWriteKey();
        if (!stale) {
          setSegmentWriteKey(writeKey);
        }
      } catch {
        // Continue without Segment tracking
      }
    };
    fetchKey();
    return () => {
      stale = true;
    };
  }, [isProd, consentGranted]);

  // Initialize Segment when write key arrives (only while consent holds).
  useEffect(() => {
    if (!segmentWriteKey || !consentGranted) return;
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
  // them once per session andbecause the Segment SDK caches the identity
  // client-side and because repeating the calls would just generate redundant
  // network requests. The refs reset when the userID changes so that a
  // different user (e.g. after logout/login) gets properly re-identified.
  useEffect(() => {
    if (!analyticsRef.current) return;

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

  // Tracks a user interaction by with both Segment and Marketo.
  //
  // Segment receives every event regardless of section. Marketo only receives
  // Catalog events, since it is used exclusively for product engagement
  // attribution.
  const trackAnalytics = useCallback(
    (
      itemNameOrProduct: string | Product,
      section: "Catalog" | "Activities" | "Support" | "Verification",
      href?: string,
      linkType: "cta" | "default" = "default",
    ) => {
      if (!consentGranted) return;

      const isProduct =
        typeof itemNameOrProduct === "object" && "type" in itemNameOrProduct;
      const itemName = isProduct ? itemNameOrProduct.title : itemNameOrProduct;
      const internalCampaign = isProduct
        ? Intcmp[itemNameOrProduct.type]
        : undefined;

      // Always track for Segment if it is initialized.
      if (analyticsRef.current) {
        segmentTrackClick(analyticsRef.current, {
          itemName,
          section,
          href,
          internalCampaign,
          linkType,
        });
      }

      // Track only catalog clicks with a valid campaign for Marketo.
      if (section === "Catalog" && internalCampaign) {
        trackMarketoEvent(user, internalCampaign, marketoWebhookURL);
      }
    },
    [consentGranted, marketoWebhookURL, user],
  );

  return (
    <AnalyticsContext.Provider value={{ trackAnalytics }}>
      {children}
    </AnalyticsContext.Provider>
  );
}
