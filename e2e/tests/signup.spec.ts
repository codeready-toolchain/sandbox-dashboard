import test, { expect } from "@playwright/test";

import { UserSignupPhase } from "../../src/hooks/userSignupPhase";

test.describe("Signup flow", { tag: "@mock-only" }, () => {
  test.describe("Toasts", () => {
    test("completes signup from Try it", async ({ page }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.NOT_STARTED);

      await page.goto("/");

      const tryItButton = page
        .getByRole("article", { name: "OpenShift Product Card" })
        .getByRole("button", { name: "Try it" });

      // Click a "Try it" button to start the user signup.
      await tryItButton.click();

      // Verify that the "info" toast shows up.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Info alert: Setting up your access",
        }),
      ).toBeVisible();

      // Expect the "success" toast to show up.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Success alert: Everything is set!",
        }),
      ).toBeVisible();

      // The banner should switch from the generic pre-signup heading to
      // the signed-in welcome message once polling reaches READY.
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Welcome,",
        }),
      ).toBeVisible();
    });

    test("shows a phone verification toast", async ({ page }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.NOT_STARTED);

      await page.goto("/");

      // Click a "Try it" button to start the user signup.
      await page
        .getByRole("article", { name: "OpenShift Product Card" })
        .getByRole("button", { name: "Try it" })
        .click();

      // Verify that the "info" toast shows up.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Info alert: Setting up your access",
        }),
      ).toBeVisible();

      // Force the the user signup to require manual verification.
      await page.evaluate((phase) => {
        window.__playwrightOverrides__!.__signup__!.__stateMachine__?.setPhase(
          phase,
        );
      }, UserSignupPhase.PENDING_PHONE_VERIFICATION);

      // Expect the "phone verification" toast to show up.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Info alert: Phone verification needed",
        }),
      ).toBeVisible();
    });

    test("shows a manual approval toast", async ({ page }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.NOT_STARTED);

      await page.goto("/");

      // Click a "Try it" button to start the user signup.
      await page
        .getByRole("article", { name: "OpenShift Product Card" })
        .getByRole("button", { name: "Try it" })
        .click();

      // Verify that the "info" toast shows up.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Info alert: Setting up your access",
        }),
      ).toBeVisible();

      // Force the the user signup to require manual verification.
      await page.evaluate((phase) => {
        window.__playwrightOverrides__!.__signup__!.__stateMachine__?.setPhase(
          phase,
        );
      }, UserSignupPhase.PENDING_MANUAL_APPROVAL);

      // Expect the "manual approval" toast to show up.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Info alert: Your account needs manual approval",
        }),
      ).toBeVisible();
    });

    test("shows an error toast when signup fails", async ({ page }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
        window.__playwrightOverrides__.__signup__.__forceSignupError__ = true;
      }, UserSignupPhase.NOT_STARTED);

      await page.goto("/");

      // Click a "Try it" button to start the user signup.
      await page
        .getByRole("article", { name: "OpenShift Product Card" })
        .getByRole("button", { name: "Try it" })
        .click();

      // Verify that the "error" toast shows up.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Danger alert: Unable to sign you up",
        }),
      ).toBeVisible();
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

    test("opens from Try it and closes via Cancel or the close button", async ({
      page,
    }) => {
      // Click a "Try it" button to trigger the opening of the modal.
      const openShiftProductCardButton = page
        .getByRole("article", { name: "OpenShift Product Card" })
        .getByRole("button", { name: "Try it" });
      await openShiftProductCardButton.click();

      const phoneVerificationModal = page.getByRole("dialog", {
        name: "Phone verification",
      });
      await expect(phoneVerificationModal).toBeVisible();

      await phoneVerificationModal
        .getByRole("button", { name: "Cancel" })
        .click();
      await expect(phoneVerificationModal).not.toBeVisible();

      await openShiftProductCardButton.click();
      await expect(phoneVerificationModal).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();
      await expect(phoneVerificationModal).not.toBeVisible();
    });

    test("shows errors for an invalid country code or phone number", async ({
      page,
    }) => {
      // Click a "Try it" button to trigger the opening of the modal.
      const openShiftProductCardButton = page
        .getByRole("article", { name: "OpenShift Product Card" })
        .getByRole("button", { name: "Try it" });
      await openShiftProductCardButton.click();

      const phoneVerificationModal = page.getByRole("dialog", {
        name: "Phone verification",
      });

      const submitButton = phoneVerificationModal.getByRole("button", {
        name: "Send code",
      });

      const countryCodeInput = phoneVerificationModal.getByRole("textbox", {
        name: "Country code",
      });

      // Type an invalid country code.
      await countryCodeInput.click();
      await countryCodeInput.fill("Invalid country code");
      await submitButton.click();

      await expect(
        phoneVerificationModal.getByRole("heading", {
          level: 4,
          name: "Danger alert: Please enter a valid country",
        }),
      ).toBeVisible();

      // Type a valid country code but an invalid phone number.
      await countryCodeInput.click();
      await countryCodeInput.fill("+1");
      await submitButton.click();

      const phoneInput = phoneVerificationModal.getByRole("textbox", {
        name: "Phone number",
      });
      await phoneInput.click();
      await phoneInput.fill("Invalid phone number");
      await submitButton.click();

      await expect(
        phoneVerificationModal.getByRole("heading", {
          level: 4,
          name: "Danger alert: Please enter a valid phone",
        }),
      ).toBeVisible();
    });

    test("closes the modal after a valid verification code", async ({
      page,
    }) => {
      // Click a "Try it" button to trigger the opening of the modal.
      const openShiftProductCardButton = page
        .getByRole("article", { name: "OpenShift Product Card" })
        .getByRole("button", { name: "Try it" });
      await openShiftProductCardButton.click();

      const phoneVerificationModal = page.getByRole("dialog", {
        name: "Phone verification",
      });

      const submitButton = phoneVerificationModal.getByRole("button", {
        name: "Send code",
      });

      const countryCodeInput = phoneVerificationModal.getByRole("textbox", {
        name: "Country code",
      });

      const phoneInput = phoneVerificationModal.getByRole("textbox", {
        name: "Phone number",
      });

      // Fill the fields with a valid country code and phone number.
      await countryCodeInput.click();
      await countryCodeInput.fill("+1");
      await phoneInput.click();
      await phoneInput.fill("1112223333");
      await submitButton.click();

      const verifyButton = phoneVerificationModal.getByRole("button", {
        name: "Verify",
      });

      // Attempt submitting without a verification code.
      await verifyButton.click();
      await expect(
        phoneVerificationModal.getByRole("heading", {
          level: 4,
          name: "Please enter a valid verification code",
        }),
      ).toBeVisible();

      // Submit a valid verification code.
      const verificationCodeInput = phoneVerificationModal.getByRole(
        "textbox",
        {
          name: "Verification code",
        },
      );
      await verificationCodeInput.click();
      await verificationCodeInput.fill("abcde");

      await verifyButton.click();
      await expect(phoneVerificationModal).not.toBeVisible();
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Welcome,",
        }),
      ).toBeVisible();
    });

    test("shows an error when the phone number is already in use", async ({
      page,
    }) => {
      await page
        .getByRole("article", { name: "OpenShift Product Card" })
        .getByRole("button", { name: "Try it" })
        .click();

      const phoneVerificationModal = page.getByRole("dialog", {
        name: "Phone verification",
      });

      await phoneVerificationModal
        .getByRole("textbox", { name: "Country code" })
        .fill("+1");
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
        .getByRole("article", { name: "OpenShift Product Card" })
        .getByRole("button", { name: "Try it" })
        .click();

      const phoneVerificationModal = page.getByRole("dialog", {
        name: "Phone verification",
      });

      await phoneVerificationModal
        .getByRole("textbox", { name: "Country code" })
        .fill("+1");
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
