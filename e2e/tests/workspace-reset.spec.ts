import test, { expect } from "@playwright/test";

test.describe("Reset workspaces modal", () => {
  test.describe("opened from the user menu", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "User menu" }).click();
      await page.getByRole("menuitem", { name: "Reset Workspaces" }).click();
      await expect(
        page.getByRole("dialog", { name: "Reset workspaces" }),
      ).toBeVisible();
    });

    test("opens with confirm and cancel buttons", async ({ page }) => {
      const modal = page.getByRole("dialog", { name: "Reset workspaces" });

      await expect(
        modal.getByRole("button", { name: "I understand and I want to reset" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    });

    test("closes when the close button is clicked", async ({ page }) => {
      const modal = page.getByRole("dialog", { name: "Reset workspaces" });
      await expect(modal).toBeVisible();

      await page.getByRole("button", { name: "Close" }).click();
      await expect(modal).not.toBeVisible();
    });

    test("shows a warning and changes the primary button after the first confirm click", async ({
      page,
    }) => {
      const modal = page.getByRole("dialog", { name: "Reset workspaces" });

      await modal
        .getByRole("button", {
          name: "I understand and I want to reset",
        })
        .click();

      // The alert should be visible.
      await expect(
        modal.getByRole("heading", { name: "Warning alert: You are about" }),
      ).toBeVisible();
      await expect(
        modal.getByText("All projects and resources in"),
      ).toBeVisible();

      // The primary button should have changed the text.
      await expect(
        modal.getByRole("button", { name: "Reset my workspaces" }),
      ).toBeVisible();
    });

    test("closes via the close button after the first confirm click", async ({
      page,
    }) => {
      const modal = page.getByRole("dialog", { name: "Reset workspaces" });
      await expect(modal).toBeVisible();

      // Click the primary button.
      await modal
        .getByRole("button", { name: "I understand and I want to reset" })
        .click();

      // We changed our mind, so let's cancel the operation.
      await modal.getByRole("button", { name: "Close" }).click();

      await expect(modal).not.toBeVisible();
    });

    test("closes via Cancel after the first confirm click", async ({
      page,
    }) => {
      const modal = page.getByRole("dialog", { name: "Reset workspaces" });

      // Click the primary button.
      await modal
        .getByRole("button", { name: "I understand and I want to reset" })
        .click();

      // We changed our mind, so let's cancel the operation.
      await modal.getByRole("button", { name: "Cancel" }).click();

      await expect(modal).not.toBeVisible();
    });

    test(
      "shows the initial confirm button when reopened after cancelling",
      { tag: "@mock-only" },
      async ({ page }) => {
        const modal = page.getByRole("dialog", { name: "Reset workspaces" });
        await expect(modal).toBeVisible();

        // Click the primary button.
        await page
          .getByRole("button", { name: "I understand and I want to reset" })
          .click();

        // Close the modal.
        await page.getByRole("button", { name: "Cancel" }).click();

        // Reopen the modal.
        await page.getByRole("button", { name: "User menu" }).click();
        await page.getByRole("menuitem", { name: "Reset Workspaces" }).click();

        // The main button should be back to the initial state, not "confirmed".
        await expect(
          page.getByRole("button", {
            name: "I understand and I want to reset",
          }),
        ).toBeVisible();
      },
    );

    test(
      "closes the modal after a successful reset",
      { tag: "@mock-only" },
      async ({ page }) => {
        const modal = page.getByRole("dialog", { name: "Reset workspaces" });

        // Click the primary button.
        await modal
          .getByRole("button", { name: "I understand and I want to reset" })
          .click();

        // Confirm the operation
        await modal
          .getByRole("button", { name: "Reset my workspaces" })
          .click();

        // Confirm that the modal does not show up anymore.
        await expect(modal).not.toBeVisible();
      },
    );
  });

  test(
    "shows an error when reset fails",
    { tag: "@mock-only" },
    async ({ page }) => {
      await page.addInitScript(() => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__workspaces__ ??= {};
        window.__playwrightOverrides__.__workspaces__.__forceError__ = true;
      });

      await page.goto("/");

      await page.getByRole("button", { name: "User menu" }).click();
      await page.getByRole("menuitem", { name: "Reset Workspaces" }).click();

      const modal = page.getByRole("dialog", { name: "Reset workspaces" });

      // Click the primary button.
      await modal
        .getByRole("button", { name: "I understand and I want to reset" })
        .click();

      // Confirm the operation
      await modal.getByRole("button", { name: "Reset my workspaces" }).click();

      // Check that the alert shows.
      await expect(
        modal.getByRole("heading", {
          level: 4,
          name: "Danger alert: Unable to reset your workspaces",
        }),
      ).toBeVisible();
      await expect(
        modal.getByRole("button", { name: "Copy technical details" }),
      ).toBeVisible();
    },
  );
});
