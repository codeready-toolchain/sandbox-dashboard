import test, { expect } from "@playwright/test";

import { UserSignupPhase } from "../../src/hooks/userSignupPhase";

test.describe("Catalog page", () => {
  test.describe("Banner", () => {
    test("displays Red Hat trial and contact sales images", async ({
      page,
    }) => {
      await page.goto("/");

      await expect(
        page.getByRole("img", { name: "Red Hat Trial" }),
      ).toBeVisible();
      await expect(
        page.getByRole("img", { name: "Contact sales" }),
      ).toBeVisible();
    });

    test("displays a welcome message", async ({ page }) => {
      await page.goto("/");

      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Welcome,",
        }),
      ).toBeVisible();
    });

    test("displays a contact sales link", async ({ page }) => {
      await page.goto("/");

      const contactSalesLink = page.locator("a", {
        has: page.getByRole("button", { name: "Contact sales" }),
      });

      await expect(contactSalesLink).toBeVisible();
      await expect(contactSalesLink).toHaveAttribute(
        "href",
        "https://redhat.com/en/contact",
      );
    });
  });

  test.describe("Not signed up", { tag: "@mock-only" }, () => {
    test("displays a generic banner and pre-signup card actions", async ({
      page,
    }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.NOT_STARTED);
      await page.goto("/");

      // The banner should show the generic "Try Red Hat products" heading
      // instead of "Welcome, John".
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Try Red Hat products",
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Explore, experiment, and see what"),
      ).toBeVisible();

      // The product cards should still be visible.
      const aapProductCard = page.getByRole("article", {
        name: "Ansible Automation Platform product card",
      });
      await expect(aapProductCard).toBeVisible();

      // The AAP card should show "Provision" but no status label or
      // delete button (since there's no instance).
      await expect(
        aapProductCard.getByRole("button", { name: "Provision" }),
      ).toBeVisible();
      await expect(
        aapProductCard.getByRole("button", { name: "Delete instance" }),
      ).not.toBeVisible();

      // The "Try it" cards should still be visible.
      const openshiftCard = page.getByRole("article", {
        name: "OpenShift product card",
      });
      await expect(
        openshiftCard.getByRole("button", { name: "Try it" }),
      ).toBeVisible();
    });
  });

  test.describe("Welcome subtitle", { tag: "@mock-only" }, () => {
    test("displays a blocked message when the user is blocked", async ({
      page,
    }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.BLOCKED);

      await page.goto("/");

      await expect(
        page.getByRole("heading", {
          level: 4,
          name: "Danger alert: The account is",
        }),
      ).toBeVisible();
      await expect(page.getByText("Your account is not ready")).toBeVisible();
    });

    test("does not launch a product when the user is blocked", async ({
      page,
    }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.BLOCKED);

      await page.goto("/");

      const tryItButton = page
        .getByRole("article", { name: "OpenShift product card" })
        .getByRole("button", { name: "Try it" });
      await expect(tryItButton).toBeVisible();

      // We are expecting the button to be a "no-op", so no new pages should
      // have been opened.
      const pageCountBefore = page.context().pages().length;
      await tryItButton.click();
      expect(page.context().pages()).toHaveLength(pageCountBefore);
    });

    test("displays a phone verification message when verification is pending", async ({
      page,
    }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.PENDING_PHONE_VERIFICATION);

      await page.goto("/");

      await expect(
        page.getByText('Click on "Try it" to initiate'),
      ).toBeVisible();
    });

    test("displays a manual approval message when approval is pending", async ({
      page,
    }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.PENDING_MANUAL_APPROVAL);

      await page.goto("/");

      await expect(page.getByText("Please wait for")).toBeVisible();
    });

    test("does not launch a product when manual approval is pending", async ({
      page,
    }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.PENDING_MANUAL_APPROVAL);

      await page.goto("/");

      const tryItButton = page
        .getByRole("article", { name: "OpenShift product card" })
        .getByRole("button", { name: "Try it" });
      await expect(tryItButton).toBeVisible();

      // A successful launch opens a new page. Compare the context page
      // count instead of waiting for a popup that must not appear.
      const pageCountBefore = page.context().pages().length;
      await tryItButton.click();
      expect(page.context().pages()).toHaveLength(pageCountBefore);
    });

    test("displays the trial expiration date and information", async ({
      page,
    }) => {
      await page.addInitScript((phase) => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__signup__ ??= {};
        window.__playwrightOverrides__.__signup__.__initialState__ = phase;
      }, UserSignupPhase.READY);

      await page.goto("/");

      await expect(page.getByText("Your free trial expires in")).toBeVisible();

      await page
        .getByRole("button", { name: "Show trial information" })
        .click();

      await expect(
        page.getByRole("heading", { name: "Trial expiration" }),
      ).toBeVisible();
      await expect(
        page.getByText("Once this trial expires, you"),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "View documentation" }),
      ).toHaveAttribute(
        "href",
        "https://developers.redhat.com/learn/openshift/move-your-developer-sandbox-objects-another-cluster",
      );
    });
  });

  test.describe("Product catalog", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
    });

    test("displays the product catalog region", async ({ page }) => {
      await expect(
        page.getByRole("region", { name: "Product catalog" }),
      ).toBeVisible();
    });

    test("displays six product cards with their action buttons", async ({
      page,
    }) => {
      const expectedPairs: { productTitle: string; buttonTitle: string }[] = [
        {
          productTitle: "OpenShift",
          buttonTitle: "Try it",
        },
        { productTitle: "OpenShift AI", buttonTitle: "Try it" },
        { productTitle: "Dev Spaces", buttonTitle: "Try it" },
        {
          productTitle: "Ansible Automation Platform",
          buttonTitle: "Provision",
        },
        { productTitle: "OpenShift Virtualization", buttonTitle: "Try it" },
        { productTitle: "OpenClaw", buttonTitle: "Provision" },
      ];

      for (const pair of expectedPairs) {
        const productCard = page.getByRole("article", {
          name: `${pair.productTitle} product card`,
        });

        await expect(productCard).toBeVisible();
        await expect(
          productCard.getByRole("button", { name: pair.buttonTitle }),
        ).toBeVisible();
      }
    });
  });

  test.describe("Disabled integrations", { tag: "@mock-only" }, () => {
    test("hides the AAP card when ansible is disabled in UI config", async ({
      page,
    }) => {
      await page.addInitScript(() => {
        window.__playwrightOverrides__ ??= {};
        window.__playwrightOverrides__.__uiconfig__ ??= {};
        window.__playwrightOverrides__.__uiconfig__.__disabledIntegrations__ = [
          "ansible-automation-platform",
        ];
      });

      await page.goto("/");

      const openshiftCard = page.getByRole("article", {
        name: "OpenShift product card",
      });
      await expect(
        openshiftCard.getByRole("button", { name: "Try it" }),
      ).toBeVisible();

      await expect(
        page.getByRole("article", {
          name: "Ansible Automation Platform product card",
        }),
      ).not.toBeVisible();
    });
  });
});
