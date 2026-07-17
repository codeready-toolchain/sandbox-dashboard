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
    if (!isProd || consentGranted) return;

    const checkConsent = () => {
      if (hasAnalyticsConsent()) {
        setConsentGranted(true);
      }
    };

    window.addEventListener("message", checkConsent);
    return () => window.removeEventListener("message", checkConsent);
  }, [isProd, consentGranted]);

  // Fetch the Segment key only in production after consent is granted.
  useEffect(() => {
    if (!isProd || !consentGranted) return;
    const fetchKey = async () => {
      try {
        const writeKey = await getSegmentWriteKey();
        setSegmentWriteKey(writeKey);
      } catch {
        // Continue without Segment tracking
      }
    };
    fetchKey();
  }, [isProd, consentGranted]);

  // Initialize Segment when write key arrives
  useEffect(() => {
    if (!segmentWriteKey) return;
    try {
      analyticsRef.current = AnalyticsBrowser.load({
        writeKey: segmentWriteKey,
      });
    } catch {
      // Initialization failed — continue without Segment
    }
  }, [segmentWriteKey]);

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
  }, [segmentWriteKey, user]);

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
    [marketoWebhookURL, user],
  );

  return (
    <AnalyticsContext.Provider value={{ trackAnalytics }}>
      {children}
    </AnalyticsContext.Provider>
  );
}
