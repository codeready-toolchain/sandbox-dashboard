import test, { expect, type Locator } from "@playwright/test";

import { UserSignupPhase } from "../../src/hooks/userSignupPhase";

/**
 * Commits a country by typing a dial code and pressing Enter so the
 * typeahead auto-selects. Prefer this over clicking filtered options,
 * which is flaky with Playwright's fill() against PatternFly Select.
 */
async function selectCountryByDialCode(
  modal: Locator,
  dialCode = "+1",
  expectedLabel = "United States (+1)",
) {
  const countryCodeInput = modal.getByRole("combobox", {
    name: "Country code",
  });
  await countryCodeInput.click();
  await countryCodeInput.fill(dialCode);
  await countryCodeInput.press("Enter");
  await expect(countryCodeInput).toHaveValue(expectedLabel);
}

test.describe("Signup flow", { tag: "@mock-only" }, () => {
  test.describe("Product card signup", () => {
    test("triggers signup when clicking a product Try it button", async ({
      page,
    }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.NOT_STARTED);

      await page.goto("/");

      // The banner should show the non-signed-up content.
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Try Red Hat products",
        }),
      ).toBeVisible();

      // Click "Try it" on the OpenShift card to start signup.
      const openshiftCard = page.getByRole("article", {
        name: "OpenShift product card",
      });
      await openshiftCard.getByRole("button", { name: "Try it" }).click();

      // Once the signup finishes and the user becomes READY, the banner
      // should show the welcome message.
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Welcome,",
        }),
      ).toBeVisible({ timeout: 30_000 });
    });

    test("shows an error when signup fails", async ({ page }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
        window.__playwrightOverrides__.__signup__.__forceSignupError__ = true;
      }, UserSignupPhase.NOT_STARTED);

      await page.goto("/");

      // Click "Try it" on the OpenShift card to start signup.
      await page
        .getByRole("article", { name: "OpenShift product card" })
        .getByRole("button", { name: "Try it" })
        .click();

      // Verify that the error toast appears.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: /Danger alert:.*Unable to sign you up/,
        }),
      ).toBeVisible();
    });

    test("shows phone verification info when needed", async ({ page }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.PENDING_PHONE_VERIFICATION);

      await page.goto("/");

      // The banner should show a welcome and phone verification info.
      await expect(
        page.getByRole("heading", { level: 1, name: /Welcome/ }),
      ).toBeVisible();
      await expect(page.getByText("verify your phone")).toBeVisible();
    });

    test("shows manual approval info when needed", async ({ page }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.PENDING_MANUAL_APPROVAL);

      await page.goto("/");

      // The banner should show a welcome and manual approval info.
      await expect(
        page.getByRole("heading", { level: 1, name: /Welcome/ }),
      ).toBeVisible();
      await expect(page.getByText("manual verification")).toBeVisible();
    });
  });

  test.describe("Phone verification modal", () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.PENDING_PHONE_VERIFICATION);

      await page.goto("/");
    });

    test("opens from a product card button and closes via Cancel", async ({
      page,
    }) => {
      // Click "Try it" on a product card to trigger the phone
      // verification modal.
      await page
        .getByRole("article", { name: "OpenShift product card" })
        .getByRole("button", { name: "Try it" })
        .click();

      const phoneVerificationModal = page.getByRole("dialog", {
        name: "Phone verification",
      });
      await expect(phoneVerificationModal).toBeVisible();

      // Close via Cancel.
      await phoneVerificationModal
        .getByRole("button", { name: "Cancel" })
        .click();

      // The modal should be closed.
      await expect(phoneVerificationModal).not.toBeVisible();
    });

    test("keeps Send code disabled for incomplete input and validates phone on submit", async ({
      page,
    }) => {
      // Click a product card to open the modal.
      await page
        .getByRole("article", { name: "OpenShift product card" })
        .getByRole("button", { name: "Try it" })
        .click();

      const phoneVerificationModal = page.getByRole("dialog", {
        name: "Phone verification",
      });

      const submitButton = phoneVerificationModal.getByRole("button", {
        name: "Send code",
      });
      await expect(submitButton).toBeDisabled();

      const countryCodeInput = phoneVerificationModal.getByRole("combobox", {
        name: "Country code",
      });
      const phoneInput = phoneVerificationModal.getByRole("textbox", {
        name: "Phone number",
      });

      // With only an uncommitted country filter, Send stays disabled.
      await countryCodeInput.click();
      await countryCodeInput.fill("Invalid country code");
      await phoneInput.click();
      await expect(submitButton).toBeDisabled();

      // Select a valid country code but enter an invalid phone number,
      // then submit to reveal the validation alert.
      await selectCountryByDialCode(phoneVerificationModal);
      await phoneInput.fill("Invalid phone number");
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      await expect(
        phoneVerificationModal.getByRole("heading", {
          level: 4,
          name: "Danger alert: Please enter a valid phone",
        }),
      ).toBeVisible();
    });

    test("auto-selects a typed dial code and continues verification", async ({
      page,
    }) => {
      await page
        .getByRole("article", { name: "OpenShift product card" })
        .getByRole("button", { name: "Try it" })
        .click();

      const phoneVerificationModal = page.getByRole("dialog", {
        name: "Phone verification",
      });

      const phoneInput = phoneVerificationModal.getByRole("textbox", {
        name: "Phone number",
      });
      const submitButton = phoneVerificationModal.getByRole("button", {
        name: "Send code",
      });

      // Type a known dial code and dismiss the menu to auto-select.
      await selectCountryByDialCode(
        phoneVerificationModal,
        "+34",
        "Spain (+34)",
      );
      await expect(submitButton).toBeDisabled();

      await phoneInput.fill("612345678");
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      await expect(
        phoneVerificationModal.getByText("Enter verification code"),
      ).toBeVisible();

      const verifyButton = phoneVerificationModal.getByRole("button", {
        name: "Verify",
      });
      await expect(verifyButton).toBeDisabled();

      await phoneVerificationModal
        .getByRole("textbox", { name: "Verification code" })
        .fill("abcde");
      await expect(verifyButton).toBeEnabled();
      await verifyButton.click();

      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Welcome,",
        }),
      ).toBeVisible({ timeout: 30_000 });
    });

    test("closes the modal after a valid verification code", async ({
      page,
    }) => {
      // Click a product card to open the modal.
      await page
        .getByRole("article", { name: "OpenShift product card" })
        .getByRole("button", { name: "Try it" })
        .click();

      const phoneVerificationModal = page.getByRole("dialog", {
        name: "Phone verification",
      });

      const submitButton = phoneVerificationModal.getByRole("button", {
        name: "Send code",
      });
      const phoneInput = phoneVerificationModal.getByRole("textbox", {
        name: "Phone number",
      });

      // Fill the fields with a valid country code and phone number.
      await selectCountryByDialCode(phoneVerificationModal);
      await phoneInput.fill("1112223333");
      await submitButton.click();

      const verifyButton = phoneVerificationModal.getByRole("button", {
        name: "Verify",
      });
      await expect(verifyButton).toBeDisabled();

      // Submit a valid verification code.
      const verificationCodeInput = phoneVerificationModal.getByRole(
        "textbox",
        {
          name: "Verification code",
        },
      );
      await verificationCodeInput.click();
      await verificationCodeInput.fill("abcde");
      await expect(verifyButton).toBeEnabled();

      await verifyButton.click();

      // After verification, the user's data is refetched and the
      // banner should show the product catalog.
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Welcome,",
        }),
      ).toBeVisible({ timeout: 30_000 });
    });

    test("shows an error when the phone number is already in use", async ({
      page,
    }) => {
      await page
        .getByRole("article", { name: "OpenShift product card" })
        .getByRole("button", { name: "Try it" })
        .click();

      const phoneVerificationModal = page.getByRole("dialog", {
        name: "Phone verification",
      });

      await selectCountryByDialCode(phoneVerificationModal);
      await phoneVerificationModal
        .getByRole("textbox", { name: "Phone number" })
        .fill("1112223333");

      await page.evaluate(() => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__phoneVerification__ ??= {};
        window.__playwrightOverrides__.__phoneVerification__.__initiateError__ =
          "phone number already in use";
      });

      await phoneVerificationModal
        .getByRole("button", { name: "Send code" })
        .click();

      await expect(
        phoneVerificationModal.getByRole("heading", {
          level: 4,
          name: "Danger alert: This phone number is already in use",
        }),
      ).toBeVisible();
      await expect(
        phoneVerificationModal.getByRole("button", { name: "Send code" }),
      ).toBeVisible();
    });

    test("shows an error when the verification code is invalid", async ({
      page,
    }) => {
      await page
        .getByRole("article", { name: "OpenShift product card" })
        .getByRole("button", { name: "Try it" })
        .click();

      const phoneVerificationModal = page.getByRole("dialog", {
        name: "Phone verification",
      });

      await selectCountryByDialCode(phoneVerificationModal);
      await phoneVerificationModal
        .getByRole("textbox", { name: "Phone number" })
        .fill("1112223333");
      await phoneVerificationModal
        .getByRole("button", { name: "Send code" })
        .click();

      const verifyButton = phoneVerificationModal.getByRole("button", {
        name: "Verify",
      });
      await expect(verifyButton).toBeVisible();

      await page.evaluate(() => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__phoneVerification__ ??= {};
        window.__playwrightOverrides__.__phoneVerification__.__completeError__ =
          "the provided code is invalid";
      });

      await phoneVerificationModal
        .getByRole("textbox", { name: "Verification code" })
        .fill("abcde");
      await verifyButton.click();

      await expect(
        phoneVerificationModal.getByRole("heading", {
          level: 4,
          name: "Danger alert: The verification code you entered is incorrect",
        }),
      ).toBeVisible();
      await expect(phoneVerificationModal).toBeVisible();
    });
  });
});
