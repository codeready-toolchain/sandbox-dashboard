import test, { expect } from "@playwright/test";

import { UserSignupPhase } from "../../src/hooks/userSignupPhase";

test.describe("Support page", { tag: "@mock-only" }, () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((phase) => {
      window.__playwrightOverrides__ ??= {};
      window.__playwrightOverrides__.__signup__ ??= {};
      window.__playwrightOverrides__.__signup__.__initialState__ = phase;
    }, UserSignupPhase.READY);
    await page.goto("/");
  });

  test("navigates to the support page via the nav link", async ({ page }) => {
    await page.getByRole("link", { name: "Support", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Need help?" }),
    ).toBeVisible();
  });

  test("loads the support page directly from the URL", async ({ page }) => {
    await page.goto("/support");

    await expect(
      page.getByRole("heading", { name: "Need help?" }),
    ).toBeVisible();
  });

  test("displays the support email link", async ({ page }) => {
    await page.goto("/support");

    const emailLink = page.getByRole("link", {
      name: "devsandbox@redhat.com",
    });
    await expect(emailLink).toBeVisible();
    await expect(emailLink).toHaveAttribute(
      "href",
      "mailto:devsandbox@redhat.com",
    );
  });

  test("displays the banner images", async ({ page }) => {
    await page.goto("/support");

    await expect(page.getByRole("img", { name: "Book shelf" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Chat bubbles" })).toBeVisible();
  });

  test("displays FAQ questions and allows toggling", async ({ page }) => {
    await page.goto("/support");

    // Verify the first FAQ question is visible.
    const firstToggle = page.getByRole("button", {
      name: "What is the Developer Sandbox?",
    });
    await expect(firstToggle).toBeVisible();

    // Expand the first question.
    await firstToggle.click();
    await expect(
      page.getByText(/free, no-commitment trial environment/),
    ).toBeVisible();

    // Collapse it by clicking again.
    await firstToggle.click();
    await expect(firstToggle).toHaveAttribute("aria-expanded", "false");
  });

  test("returns to the catalog from the support page", async ({ page }) => {
    await page.getByRole("link", { name: "Support", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Need help?" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Catalog", exact: true }).click();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Welcome,",
      }),
    ).toBeVisible();
  });
});
