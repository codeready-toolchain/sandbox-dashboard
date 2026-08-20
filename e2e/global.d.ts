import type { PlaywrightOverrides } from "../src/config/config";

declare global {
  interface Window {
    /**
     * Defines a set of functions that can be used to override certain
     * behaviors from the mocked MSW back end in order to be able to test the
     * different scenarios with Playwright.
     */
    __playwrightOverrides__?: PlaywrightOverrides;
  }
}
