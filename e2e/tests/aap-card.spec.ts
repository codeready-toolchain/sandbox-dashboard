import test, { expect } from "@playwright/test";

import { AAPMockPhase } from "../../src/mocks/handlers/aap-mock-phase";

test.describe(
  "Ansible Automation Platform product card",
  { tag: "@mock-only" },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await expect(
        page.getByRole("article", {
          name: "Ansible Automation Platform product card",
        }),
      ).toBeVisible();
    });

    test("opens a closable provisioning modal and shows a provisioning card state", async ({
      page,
    }) => {
      const aapProductCard = page.getByRole("article", {
        name: "Ansible Automation Platform product card",
      });

      // Click on the "Provision" button.
      await aapProductCard.getByRole("button", { name: "Provision" }).click();

      const aapModal = page.getByRole("dialog", {
        name: "Ansible Automation Platform",
      });
      const spinner = aapModal.getByRole("progressbar", { name: "Contents" });
      const provisioningText = aapModal.getByText(
        "Your Ansible Automation Platform instance is being provisioned",
      );

      await expect(aapModal).toBeVisible();
      await expect(spinner).toBeVisible();
      await expect(provisioningText).toBeVisible();

      // Close by hitting the "X" button.
      await aapModal.getByLabel("Close").click();
      await expect(aapModal).not.toBeVisible();

      // Open the modal again.
      await aapProductCard
        .getByRole("button", { name: "Loading... Provisioning..." })
        .click();
      await expect(aapModal).toBeVisible();
      await expect(spinner).toBeVisible();
      await expect(provisioningText).toBeVisible();

      // Close via the "Close" button.
      await aapModal
        .locator("footer")
        .getByRole("button", { name: "Close" })
        .click();
      await expect(aapModal).not.toBeVisible();

      await aapProductCard
        .getByRole("button", { name: "Loading... Provisioning..." })
        .click();
      await expect(aapModal).toBeVisible();
      await expect(spinner).toBeVisible();
      await expect(provisioningText).toBeVisible();

      await aapModal.getByLabel("Close").click();

      // The mock auto-transitions to READY after 3s. Pin PROVISIONING so
      // the card-state assertion does not race that timer.
      await page.evaluate((phase) => {
        window.__playwrightOverrides__!.__aap__!.__stateMachine__!.setPhase(
          phase,
        );
      }, AAPMockPhase.PROVISIONING);

      await expect(
        aapProductCard.getByText("Provisioning", { exact: true }),
      ).toBeVisible();
    });

    test("cancels instance deletion and keeps the ready state", async ({
      page,
    }) => {
      const aapProductCard = page.getByRole("article", {
        name: "Ansible Automation Platform product card",
      });

      // Provision the instance.
      await aapProductCard.getByRole("button", { name: "Provision" }).click();
      await page
        .getByRole("dialog", { name: "Ansible Automation Platform" })
        .getByLabel("Close")
        .click();

      // Set the instance in a ready state.
      await page.evaluate((phase) => {
        window.__playwrightOverrides__!.__aap__!.__stateMachine__!.setPhase(
          phase,
        );
      }, AAPMockPhase.READY);

      await expect(aapProductCard.getByText("Ready")).toBeVisible();

      // Open the delete confirmation modal.
      await aapProductCard
        .getByRole("button", { name: "Delete instance" })
        .click();

      const deleteModal = page.getByRole("dialog", {
        name: "Delete Ansible Automation Platform instance",
      });
      await expect(deleteModal).toBeVisible();
      await expect(
        deleteModal.getByText("Are you sure you want to delete"),
      ).toBeVisible();

      // Click "Cancel".
      await deleteModal.getByRole("button", { name: "Cancel" }).click();
      await expect(deleteModal).not.toBeVisible();

      // The card should still show "Ready".
      await expect(aapProductCard.getByText("Ready")).toBeVisible();
      await expect(
        aapProductCard.getByRole("button", { name: "Launch" }),
      ).toBeVisible();
      await expect(
        aapProductCard.getByRole("button", { name: "Delete instance" }),
      ).toBeVisible();
    });

    test("deletes the instance while it is provisioning", async ({ page }) => {
      const aapProductCard = page.getByRole("article", {
        name: "Ansible Automation Platform product card",
      });
      const aapModal = page.getByRole("dialog", {
        name: "Ansible Automation Platform",
      });

      // Click on the "Provision" button and close the modal.
      await aapProductCard.getByRole("button", { name: "Provision" }).click();
      await aapModal.getByLabel("Close").click();

      // Click on "Delete instance".
      await aapProductCard
        .getByRole("button", { name: "Delete instance" })
        .click();

      await page
        .getByRole("dialog", {
          name: "Delete Ansible Automation Platform instance",
        })
        .getByRole("button", { name: "Delete" })
        .click();

      // Expect the "success" toast to show up.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Success alert: Ansible",
        }),
      ).toBeVisible();

      // The card should return to the pre-instance state.
      await expect(
        aapProductCard.getByRole("button", { name: "Provision" }),
      ).toBeVisible();
      await expect(
        aapProductCard.getByRole("button", { name: "Delete instance" }),
      ).not.toBeVisible();
    });

    test("shows launch credentials after the instance becomes ready", async ({
      page,
    }) => {
      const aapProductCard = page.getByRole("article", {
        name: "Ansible Automation Platform product card",
      });
      const aapModal = page.getByRole("dialog", {
        name: "Ansible Automation Platform",
      });

      await aapProductCard.getByRole("button", { name: "Provision" }).click();
      await expect(aapModal).toBeVisible();

      await aapModal.getByLabel("Close").click();
      await expect(aapModal).not.toBeVisible();

      // Set the instance in a ready state.
      await page.evaluate((phase) => {
        window.__playwrightOverrides__!.__aap__!.__stateMachine__!.setPhase(
          phase,
        );
      }, AAPMockPhase.READY);

      // Check that the label is visible.
      await expect(aapProductCard.getByText("Ready")).toBeVisible();

      // Open the modal again.
      await aapProductCard.getByRole("button", { name: "Launch" }).click();

      // Verify that the modal shows the steps, fields and stuff.
      await aapModal.getByText("1.AAP admin account").click();

      // Verify the username is populated with the mock value.
      await expect(
        aapModal.getByRole("textbox", { name: "Copyable input" }),
      ).toHaveValue("admin");

      // Verify the password is hidden by default, then revealed.
      await aapModal.getByRole("button", { name: "Show password" }).click();
      await expect(
        aapModal.getByRole("textbox", { name: "Password" }),
      ).not.toHaveValue("");

      // Verify the link points to the AAP URL.
      await expect(
        aapModal.getByRole("link", { name: "Get started" }),
      ).toHaveAttribute("href", "https://aap.apps.example.com");

      await aapModal.getByLabel("Close").click();

      // Delete the instance.
      await aapProductCard
        .getByRole("button", { name: "Delete instance" })
        .click();

      await page
        .getByRole("dialog", {
          name: "Delete Ansible Automation Platform instance",
        })
        .getByRole("button", { name: "Delete" })
        .click();

      // Expect the "success" toast to show up.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Success alert: Ansible",
        }),
      ).toBeVisible();

      // The card should return to the pre-instance state.
      await expect(
        aapProductCard.getByRole("button", { name: "Provision" }),
      ).toBeVisible();
      await expect(
        aapProductCard.getByRole("button", { name: "Delete instance" }),
      ).not.toBeVisible();
    });

    test("reprovisions an idled instance", async ({ page }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__aap__ ??= {};
        window.__playwrightOverrides__.__aap__.__initialState__ = phase;
      }, AAPMockPhase.IDLED);
      await page.goto("/");

      const aapProductCard = page.getByRole("article", {
        name: "Ansible Automation Platform product card",
      });

      // The card should show "Idled" label and "Reprovision" button.
      await expect(aapProductCard.getByText("Idled")).toBeVisible();
      await expect(
        aapProductCard.getByRole("button", { name: "Re-provision" }),
      ).toBeVisible();
      await expect(
        aapProductCard.getByRole("button", { name: "Delete instance" }),
      ).toBeVisible();

      // Reprovision the instance.
      await aapProductCard
        .getByRole("button", { name: "Re-provision" })
        .click();

      // The provisioning modal should open.
      const aapModal = page.getByRole("dialog", {
        name: "Ansible Automation Platform",
      });
      await expect(aapModal).toBeVisible();
      await aapModal.getByLabel("Close").click();

      // The card should show "Provisioning" while the transition is in flight.
      await expect(
        aapProductCard.getByText("Provisioning", { exact: true }),
      ).toBeVisible();

      // Set the instance in a ready state.
      await page.evaluate((phase) => {
        window.__playwrightOverrides__!.__aap__!.__stateMachine__!.setPhase(
          phase,
        );
      }, AAPMockPhase.READY);

      await expect(aapProductCard.getByText("Ready")).toBeVisible();

      // The button should now be "Launch".
      await expect(
        aapProductCard.getByRole("button", { name: "Launch" }),
      ).toBeVisible();
    });

    test("shows an error when reprovisioning an idled instance fails", async ({
      page,
    }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__aap__ ??= {};
        window.__playwrightOverrides__.__aap__.__initialState__ = phase;
      }, AAPMockPhase.IDLED);
      await page.goto("/");

      const aapProductCard = page.getByRole("article", {
        name: "Ansible Automation Platform product card",
      });

      // Verify the card is in idled state.
      await expect(aapProductCard.getByText("Idled")).toBeVisible();

      // Force the the reprovisioning to fail.
      await page.evaluate(() => {
        window.__playwrightOverrides__!.__aap__!.__forceUnidleError__ = true;
      });

      // Reprovision the instance.
      await aapProductCard
        .getByRole("button", { name: "Re-provision" })
        .click();

      // The error toast should appear.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Danger alert: Unable to reprovision",
        }),
      ).toBeVisible();

      // Close the modal and verify that the card still shows as "idled".
      await expect(aapProductCard.getByText("Idled")).toBeVisible();
    });

    test("shows an error toast and failed card state when provisioning fails", async ({
      page,
    }) => {
      const aapProductCard = page.getByRole("article", {
        name: "Ansible Automation Platform product card",
      });
      // Provision the instance.
      await aapProductCard.getByRole("button", { name: "Provision" }).click();

      // Close the provisioning modal.
      await page
        .getByRole("dialog", { name: "Ansible Automation Platform" })
        .getByLabel("Close")
        .click();

      // Force the state machine into a failed state.
      await page.evaluate((phase) => {
        window.__playwrightOverrides__!.__aap__!.__stateMachine__!.setPhase(
          phase,
        );
      }, AAPMockPhase.FAILED);

      // Verify the error toast appears.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Danger alert: Unable to provision",
        }),
      ).toBeVisible();

      // Verify the card shows the failed state.
      await expect(aapProductCard.getByText("Failed")).toBeVisible();
      await expect(
        aapProductCard.getByRole("button", { name: "Provision" }),
      ).toBeVisible();
      await expect(
        aapProductCard.getByRole("button", { name: "Delete instance" }),
      ).toBeVisible();
    });

    test("shows an error toast and failed card state when a failed instance is loaded", async ({
      page,
    }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__aap__ ??= {};
        window.__playwrightOverrides__.__aap__.__initialState__ = phase;
      }, AAPMockPhase.FAILED);

      await page.goto("/");

      const aapProductCard = page.getByRole("article", {
        name: "Ansible Automation Platform product card",
      });

      // The error toast should appear from the initial fetch.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Danger alert: Ansible Automation Platform instance is not properly provisioned",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Copy technical details" }),
      ).toBeVisible();

      // The card should show a "Failed" label.
      await expect(aapProductCard.getByText("Failed")).toBeVisible();

      // The card should show "Provision" and "Delete instance" buttons.
      await expect(
        aapProductCard.getByRole("button", { name: "Provision" }),
      ).toBeVisible();
      await expect(
        aapProductCard.getByRole("button", { name: "Delete instance" }),
      ).toBeVisible();
    });

    test("retries provisioning from a failed instance until it is ready", async ({
      page,
    }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__aap__ ??= {};
        window.__playwrightOverrides__.__aap__.__initialState__ = phase;
      }, AAPMockPhase.FAILED);

      await page.goto("/");

      // The error toast should appear from the initial fetch.
      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Danger alert: Ansible Automation Platform instance is not properly provisioned",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Copy technical details" }),
      ).toBeVisible();
      await page.getByLabel("Close").click();

      const aapProductCard = page.getByRole("article", {
        name: "Ansible Automation Platform product card",
      });

      await expect(aapProductCard.getByText("Failed")).toBeVisible();
      await expect(
        aapProductCard.getByRole("button", { name: "Provision" }),
      ).toBeVisible();

      // Error state does not poll. Advance the CR to READY first, as
      // otherwise the first poll after retry still sees Failure and treats it
      // as an error.
      await page.evaluate((phase) => {
        window.__playwrightOverrides__!.__aap__!.__stateMachine__!.setPhase(
          phase,
        );
      }, AAPMockPhase.READY);

      // Retrying a failed instance does not create a new CR, it just resumes
      // polling. The card still shows Failed until that poll completes.
      await aapProductCard.getByRole("button", { name: "Provision" }).click();

      // Verify that the modal opens and that it shows the instance as
      // "provisioned".
      await expect(
        page.getByRole("dialog", {
          name: "Ansible Automation Platform",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Ansible Automation Platform instance provisioned",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Get started" }),
      ).toHaveAttribute("href", "https://aap.apps.example.com");

      // Close the modal and check that it shows as "ready" in the card.
      await page.getByLabel("Close").click();

      await expect(aapProductCard.getByText("Ready")).toBeVisible();
      await expect(aapProductCard.getByText("Failed")).not.toBeVisible();
      await expect(
        aapProductCard.getByRole("button", { name: "Launch" }),
      ).toBeVisible();
    });
  },
);
