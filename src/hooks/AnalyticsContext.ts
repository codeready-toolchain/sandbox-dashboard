import { createContext, useContext } from "react";

import type { Product } from "../types/product";
import type {
  IntentEventName,
  IntentSection,
  ProductAnalyticsAction,
} from "../utils/analytics";

export interface AnalyticsContextType {
  /**
   * Tracks a named click in Segment, such as opening an activity.
   *
   * The event name is `"{itemName} launched"` for a primary action and
   * `"{itemName} clicked"` otherwise. Marketo is not notified. Product
   * opens and setups use {@link trackProductAction}. Outcomes such as
   * a verified phone use {@link trackIntent}.
   *
   * @param itemName the label of the control the user activated.
   * @param section the dashboard area where the click happened.
   * @param href the destination URL, when the click opens a link.
   * @param linkType `"cta"` for a primary action, `"default"` for a
   *   secondary one. Defaults to `"default"`.
   */
  trackAnalytics: (
    itemName: string,
    section: "Catalog" | "Activities" | "Support" | "Verification",
    href?: string,
    linkType?: "cta" | "default",
  ) => void;
  /**
   * Tracks a product open or a successful product setup.
   *
   * Segment always receives the event. Marketo receives it only when
   * the product has a campaign id.
   *
   * @param product the catalog product the user opened or set up.
   * @param action `"opened"` when a provisioned trial is started,
   *   `"set-up"` when instance creation was accepted.
   * @param href the product URL, when the action opens one.
   */
  trackProductAction: (
    product: Product,
    action: ProductAnalyticsAction,
    href?: string,
  ) => void;
  /**
   * Tracks a named intent event in Segment. Marketo is not notified.
   *
   * Use this for outcomes and for clicks that should keep a stable
   * event name, with the details in properties.
   *
   * @param eventName the Segment event name.
   * @param section the dashboard area stored on the event.
   * @param properties extra string properties, such as the theme
   *   settings or the support question text.
   */
  trackIntent: (
    eventName: IntentEventName,
    section: IntentSection,
    properties?: Record<string, string>,
  ) => void;
}

export const AnalyticsContext = createContext<AnalyticsContextType | undefined>(
  undefined,
);

/**
 * Analytics callbacks that record nothing.
 *
 * Tests render this when a component calls the analytics hooks and the
 * test is not asserting on those calls. The application mounts
 * {@link AnalyticsProvider} instead.
 */
export const noopAnalyticsContext: AnalyticsContextType = {
  trackAnalytics: () => undefined,
  trackProductAction: () => undefined,
  trackIntent: () => undefined,
};

export const useAnalyticsContext = (): AnalyticsContextType => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("Context useAnalyticsContext is not defined");
  }
  return context;
};
