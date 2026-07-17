import type { AnalyticsBrowser } from "@segment/analytics-next";
import { getCookie } from "./cookie-utils";
import type { User } from "../types";

/**
 * The data required to fire a Segment tracking event.
 */
export interface SegmentTrackingData {
  /** The display name of the item the user interacted with. */
  itemName: string;
  /** The dashboard section where the interaction took place. */
  section: string;
  /** The destination URL, if the interaction opens a link. */
  href?: string;
  /** The Marketo campaign / offer ID associated with this interaction. */
  internalCampaign?: string;
  /**
   * `"cta"` for primary call-to-action buttons, `"default"` for secondary
   * links. Controls the Segment event verb: `"cta"` produces
   * `"{itemName} launched"`, `"default"` produces `"{itemName} clicked"`.
   */
  linkType?: "cta" | "default";
}

/**
 * Fires a Segment `track` event for a user click interaction.
 *
 * The event name is derived from the item name and link type:
 * - CTA links produce `"{itemName} launched"`
 * - Default links produce `"{itemName} clicked"`
 *
 * @param analytics - The initialized Segment `AnalyticsBrowser` instance.
 * @param data - The tracking data describing the interaction.
 */
export function segmentTrackClick(
  analytics: AnalyticsBrowser,
  data: SegmentTrackingData,
): void {
  const verb = data.linkType === "cta" ? "launched" : "clicked";
  const eventName = `${data.itemName} ${verb}`;

  const trackingPayload: Record<string, unknown> = {
    category: `Developer Sandbox|${data.section}`,
    regions: `sandbox-${data.section.toLocaleLowerCase("en-US")}`,
    text: data.itemName,
    href: data.href,
    linkType: data.linkType || "default",
    ...(data.internalCampaign && { internalCampaign: data.internalCampaign }),
  };

  analytics.track(eventName, trackingPayload);
}

/**
 * The payload structure expected by the Workato webhook that feeds Marketo.
 */
interface MarketoTrackingData {
  C_FirstName: string;
  C_LastName: string;
  C_EmailAddress: string;
  C_Company: string;
  A_Timestamp: string;
  F_FormData_Source: string;
  A_OfferID: string;
  A_TacticID_External: string;
  A_TacticID_Internal: string;
  Status: string;
}

/**
 * Returns the current UTC time formatted as `YYYY/MM/DD HH:mm:ss`, which is
 * the timestamp format Marketo expects.
 */
function getMarketoTimestamp(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const seconds = String(now.getUTCSeconds()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Posts a tracking event to the Workato webhook that feeds Marketo.
 *
 * The payload includes user identity fields, a campaign offer ID, and tactic
 * IDs read from the `rh_omni_tc` and `rh_omni_itc` cookies. Silently skips
 * the request when user data, the user's email, or the webhook URL is missing.
 * Errors are swallowed so tracking never blocks the user experience.
 *
 * @param userData - The current user's signup data.
 * @param offerID - The Marketo campaign / offer ID (Intcmp value).
 * @param webhookURL - The Workato webhook URL obtained from `/api/v1/uiconfig`.
 */
export async function trackMarketoEvent(
  userData: User | undefined,
  offerID?: string,
  webhookURL?: string,
): Promise<void> {
  if (!userData || !userData.email || !webhookURL) {
    return;
  }

  try {
    const tacticIdExternal = getCookie("rh_omni_tc") || "";
    const tacticIdInternal = getCookie("rh_omni_itc") || "";

    const payload: MarketoTrackingData = {
      C_FirstName: userData.givenName || "",
      C_LastName: userData.familyName || "",
      C_EmailAddress: userData.email || "",
      C_Company: userData.company || "",
      A_Timestamp: getMarketoTimestamp(),
      F_FormData_Source: "sandbox-redhat-com-integration",
      A_OfferID: offerID || "",
      A_TacticID_External: tacticIdExternal,
      A_TacticID_Internal: tacticIdInternal,
      Status: "Engaged",
    };

    await fetch(webhookURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silently fail — don't block user experience
  }
}
