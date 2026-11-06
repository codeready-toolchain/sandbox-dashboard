import type { AnalyticsBrowser } from "@segment/analytics-next";

import {
  dpalClickAttributes,
  productAnalyticsEventName,
  productOpenDpalAttributes,
  sandboxAnalyticsProperties,
  segmentTrackClick,
  segmentTrackEvent,
} from "../analytics";

/**
 * Covers Segment event names and the Adobe click attributes used by
 * product opens, activities, and support links.
 */
describe("analytics helpers", () => {
  it("names a primary click as launched and a secondary click as clicked", () => {
    const track = vi.fn();
    const analytics = { track } as unknown as AnalyticsBrowser;

    segmentTrackClick(analytics, {
      itemName: "Getting Started",
      section: "Activities",
      href: "https://example.com/start",
      linkType: "cta",
    });
    segmentTrackClick(analytics, {
      itemName: "Docs",
      section: "Support",
    });

    expect(track).toHaveBeenNthCalledWith(
      1,
      "Getting Started launched",
      expect.objectContaining({
        category: "Developer Sandbox|Activities",
        regions: "sandbox-activities",
        linkType: "cta",
      }),
    );
    expect(track).toHaveBeenNthCalledWith(
      2,
      "Docs clicked",
      expect.objectContaining({
        linkType: "default",
        href: undefined,
      }),
    );
  });

  it("fires an explicit Segment event name for outcomes", () => {
    const track = vi.fn();
    const analytics = { track } as unknown as AnalyticsBrowser;

    segmentTrackEvent(
      analytics,
      "Phone verified",
      sandboxAnalyticsProperties("Verification"),
    );

    expect(track).toHaveBeenCalledWith("Phone verified", {
      category: "Developer Sandbox|Verification",
      regions: "sandbox-verification",
    });
  });

  it("uses distinct product event names for open and setup", () => {
    expect(productAnalyticsEventName("opened")).toBe("Product opened");
    expect(productAnalyticsEventName("set-up")).toBe("Product set up");
  });

  it("builds Adobe attributes and omits an empty offer id", () => {
    expect(
      dpalClickAttributes({
        text: "What is the Developer Sandbox?",
        section: "Support",
        detail: "FAQ",
        linkType: "default",
      }),
    ).toEqual({
      "data-analytics-linktype": "default",
      "data-analytics-text": "What is the Developer Sandbox?",
      "data-analytics-category": "Developer Sandbox|Support|FAQ",
      "data-analytics-region": "sandbox-support",
    });

    expect(productOpenDpalAttributes("OpenShift", "701")).toMatchObject({
      "data-analytics-text": "OpenShift",
      "data-analytics-category": "Developer Sandbox|Catalog|OpenShift",
      "data-analytics-offerid": "701",
    });
    expect(productOpenDpalAttributes("OpenClaw", "")).not.toHaveProperty(
      "data-analytics-offerid",
    );
  });
});
