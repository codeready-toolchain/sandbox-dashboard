import type { AnalyticsBrowser } from "@segment/analytics-next";

import type { User } from "../types";
import { getCookie } from "./cookie-utils";

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
 * Named Segment events for outcomes, and for clicks that are not a
 * product open or setup.
 */
export const IntentEvent = {
  themeChanged: "Theme changed",
  phoneVerified: "Phone verified",
  workspacesReset: "Workspaces reset",
  contactSalesClicked: "Contact sales clicked",
  activationCodeAccepted: "Activation code accepted",
  supportQuestionOpened: "Support question opened",
  supportEmailClicked: "Support email clicked",
} as const;

/** A {@link IntentEvent} name. */
export type IntentEventName = (typeof IntentEvent)[keyof typeof IntentEvent];

/**
 * Dashboard area stored on an intent event. This becomes the Segment
 * category (`Developer Sandbox|{section}`) and region
 * (`sandbox-{section}`).
 */
export type IntentSection =
  | "Account"
  | "Catalog"
  | "Footer"
  | "Support"
  | "Theme"
  | "Verification";

/**
 * A provisioned product trial was opened, or the user successfully
 * asked for a product instance to be set up.
 */
export type ProductAnalyticsAction = "opened" | "set-up";

/** Segment event names for {@link ProductAnalyticsAction}. */
export const ProductEvent = {
  opened: "Product opened",
  setUp: "Product set up",
} as const;

/**
 * Returns the Segment event name for a product open or setup.
 * @param action the product action that succeeded.
 */
export function productAnalyticsEventName(
  action: ProductAnalyticsAction,
): string {
  return action === "opened" ? ProductEvent.opened : ProductEvent.setUp;
}

/**
 * Shared Segment properties that place an event in a dashboard area.
 * @param section the dashboard area, such as `"Catalog"` or `"Theme"`.
 * @param properties extra properties merged after the area fields.
 */
export function sandboxAnalyticsProperties(
  section: string,
  properties: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    category: `Developer Sandbox|${section}`,
    regions: `sandbox-${section.toLocaleLowerCase("en-US")}`,
    ...properties,
  };
}

/**
 * Fires a Segment event with an explicit name.
 *
 * Outcome events such as "Phone verified" use this. Click events that
 * should be named "{item} clicked" or "{item} launched" use
 * {@link segmentTrackClick}.
 *
 * @param analytics the initialized Segment browser client.
 * @param eventName the event name sent to Segment.
 * @param properties the event properties.
 */
export function segmentTrackEvent(
  analytics: AnalyticsBrowser,
  eventName: string,
  properties: Record<string, unknown>,
): void {
  analytics.track(eventName, properties);
}

/**
 * Adobe Analytics (`dpal.js`) click attributes.
 *
 * The script records a click on the element that carries these
 * attributes. It does not see Segment calls, so only the control whose
 * click is the interaction itself should be decorated.
 */
export interface DpalClickAttributes {
  "data-analytics-linktype": "cta" | "default";
  "data-analytics-text": string;
  "data-analytics-category": string;
  "data-analytics-region": string;
  "data-analytics-offerid"?: string;
}

/**
 * Builds the Adobe click attributes for one interaction.
 * @param options text, dashboard area, and optional campaign id.
 */
export function dpalClickAttributes(options: {
  /** The label Adobe should store for the click. */
  text: string;
  /** Dashboard area, such as `"Catalog"` or `"Support"`. */
  section: string;
  /** Extra category segment, such as a product title. */
  detail?: string;
  /** `"cta"` for a primary action, `"default"` for a secondary one. */
  linkType?: "cta" | "default";
  /** Marketo offer id. Omitted when the product has no campaign. */
  offerId?: string;
}): DpalClickAttributes {
  const category = options.detail
    ? `Developer Sandbox|${options.section}|${options.detail}`
    : `Developer Sandbox|${options.section}`;
  const region = `sandbox-${options.section.toLocaleLowerCase("en-US")}`;
  const attributes: DpalClickAttributes = {
    "data-analytics-linktype": options.linkType ?? "cta",
    "data-analytics-text": options.text,
    "data-analytics-category": category,
    "data-analytics-region": region,
  };
  if (options.offerId) {
    attributes["data-analytics-offerid"] = options.offerId;
  }
  return attributes;
}

/**
 * Adobe click attributes for opening a provisioned product.
 * @param title the product title shown to the user.
 * @param offerId the Marketo campaign id, when the product has one.
 */
export function productOpenDpalAttributes(
  title: string,
  offerId?: string,
): DpalClickAttributes {
  return dpalClickAttributes({
    text: title,
    section: "Catalog",
    detail: title,
    linkType: "cta",
    offerId: offerId || undefined,
  });
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
