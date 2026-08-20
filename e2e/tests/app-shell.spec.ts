import test, { expect } from "@playwright/test";

test.describe("App shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("serves the Red Hat logo as the favicon", async ({ page, request }) => {
    const favicon = page.locator('link[rel="icon"]');
    const href = await favicon.getAttribute("href");
    expect(href).toBeTruthy();

    const response = await request.get(new URL(href!, page.url()).toString());
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toMatch(/image\/svg\+xml/);
  });

  test("shows Developer Sandbox and Red Hat in the page title", async ({
    page,
  }) => {
    await expect(page).toHaveTitle("Developer Sandbox | Red Hat");
  });

  test("shows activity links and returns to the catalog", async ({ page }) => {
    await page.getByRole("link", { name: "Activities" }).click();

    await expect(
      page.getByRole("link", { name: "Get started with your" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Streamline automation in" }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: "How to deploy a Java" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Foundations of OpenShift" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Using OpenShift Pipelines" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "OpenShift virtualization and" }),
    ).toBeVisible();

    // Go back to the product catalog.
    await page.getByRole("link", { name: "Catalog", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Welcome,",
      }),
    ).toBeVisible();
  });

  test("loads activities from the URL and returns to the catalog via the logo", async ({
    page,
  }) => {
    await page.goto("/activities");

    await expect(
      page.getByRole("link", { name: "Get started with your" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Red Hat Developer Sandbox" }).click();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Welcome,",
      }),
    ).toBeVisible();
  });
});
