import { type SetupWorker, setupWorker } from "msw/browser";

import { handlers } from "./handlers";

/**
 * Utility function to mock the back end for the user interface. It allows
 * overriding the signup data for testing with Playwright.
 */
export const setUpMockedBackend = async () => {
  const worker: SetupWorker = setupWorker(...handlers);
  await worker.start({ onUnhandledRequest: "bypass" });
};
