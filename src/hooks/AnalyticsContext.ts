import { createContext, useContext } from "react";
import type { Product } from "../types/product";

export interface AnalyticsContextType {
  /**
   * Tracks a user interaction across Segment and Marketo.
   *
   * When a {@link Product} is passed, the product's title is used as the
   * tracked item name and the Marketo campaign ID (Intcmp) is resolved
   * automatically from the product type. When a plain string is passed, it
   * is used as the item name with no campaign ID.
   *
   * Segment receives every event. Marketo only receives events whose section
   * is `"Catalog"`.
   *
   * @param itemNameOrProduct - The product being interacted with, or a free-form
   *   label for non-product events (e.g. `"Send Code"`, `"Cancel Verification"`).
   * @param section - The area of the dashboard where the interaction occurred.
   * @param href - The destination URL, if the interaction opens a link.
   * @param linkType - `"cta"` for primary call-to-action buttons (tracked as
   *   "{name} launched"), `"default"` for secondary links (tracked as
   *   "{name} clicked"). Defaults to `"default"`.
   */
  trackAnalytics: (
    itemNameOrProduct: string | Product,
    section: "Catalog" | "Activities" | "Support" | "Verification",
    href?: string,
    linkType?: "cta" | "default",
  ) => void;
}

export const AnalyticsContext = createContext<AnalyticsContextType | undefined>(
  undefined,
);

export const useAnalyticsContext = (): AnalyticsContextType => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("Context useAnalyticsContext is not defined");
  }
  return context;
};
