import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import {
  AuthenticatedContext,
  type AuthenticatedContextValue,
} from "../../../auth/AuthenticatedContext";
import {
  AnalyticsContext,
  noopAnalyticsContext,
} from "../../../hooks/AnalyticsContext";
import {
  AnsibleContext,
  type AnsibleContextType,
} from "../../../hooks/AnsibleContext";
import { NotificationProvider } from "../../../hooks/NotificationProvider";
import type { OpenClawContextType } from "../../../hooks/OpenClawContext";
import { OpenClawContext } from "../../../hooks/OpenClawContext";
import { PhoneVerificationContext } from "../../../hooks/PhoneVerificationContext";
import type { PublicConfigurationContextType } from "../../../hooks/PublicConfigurationContext";
import { PublicConfigurationContext } from "../../../hooks/PublicConfigurationContext";
import { SIGNUP_WATCHER_INTERVAL_MS } from "../../../hooks/signupAction/signupActionUtils";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext } from "../../../hooks/UserContext";
import { UserSignupPhase } from "../../../hooks/userSignupPhase";
import { readyUserFixture } from "../../../mocks/fixtures";
import { ProductType } from "../../../types/product";
import { OpenClawStatus } from "../../../utils/openclaw-utils";
import { RHDH_READY_DELAY_MS } from "../../../utils/rhdh-utils";
import { CatalogGrid } from "../CatalogGrid";
import { Intcmp, products } from "../productData";
import { makeOpenClawContext } from "./openClawTestHelpers";

vi.mock("../../../hooks/AnsibleProvider", () => ({
  AnsibleProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../../../hooks/OpenClawProvider", () => ({
  OpenClawProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function makeContext(
  overrides: Partial<UserContextType> = {},
): UserContextType {
  return {
    user: readyUserFixture,
    userSignupPhase: UserSignupPhase.READY,
    refetchUserData: vi.fn(),
    signupUser: vi.fn(),
    ...overrides,
  };
}

const trackProductAction = vi.fn();

const authenticatedUser: AuthenticatedContextValue = {
  email: "johndoe@redhat.com",
  familyName: "Doe",
  givenName: "John",
  logout: vi.fn(),
  token: "mock-token",
  username: "johndoe",
};

function makeUIConfigContext(
  overrides: Partial<PublicConfigurationContextType> = {},
): PublicConfigurationContextType {
  return {
    disabledIntegrations: new Set<ProductType>(),
    isLoading: false,
    ...overrides,
  };
}

function makeAnsibleContext(
  overrides: Partial<AnsibleContextType> = {},
): AnsibleContextType {
  return {
    deleteInstance: vi.fn(),
    fetchInstanceCredentials: vi.fn().mockResolvedValue({
      username: "admin",
      password: "secret",
      url: "https://aap.example.com",
    }),
    instanceStatus: { kind: "new" },
    provisionInstance: vi.fn().mockResolvedValue(undefined),
    unidleInstance: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderGridTree(
  ctx: UserContextType,
  ansibleCtx: AnsibleContextType,
  openClawCtx: OpenClawContextType,
  uiConfigCtx: PublicConfigurationContextType,
) {
  return (
    <AuthenticatedContext.Provider value={authenticatedUser}>
      <NotificationProvider>
        <PublicConfigurationContext.Provider value={uiConfigCtx}>
          <AnalyticsContext.Provider
            value={{ ...noopAnalyticsContext, trackProductAction }}
          >
            <PhoneVerificationContext.Provider
              value={{
                openPhoneVerificationModal: vi.fn(),
              }}
            >
              <AnsibleContext.Provider value={ansibleCtx}>
                <OpenClawContext.Provider value={openClawCtx}>
                  <UserContext.Provider value={ctx}>
                    <CatalogGrid />
                  </UserContext.Provider>
                </OpenClawContext.Provider>
              </AnsibleContext.Provider>
            </PhoneVerificationContext.Provider>
          </AnalyticsContext.Provider>
        </PublicConfigurationContext.Provider>
      </NotificationProvider>
    </AuthenticatedContext.Provider>
  );
}

function renderGrid(
  ctx: UserContextType,
  ansibleOverrides: Partial<AnsibleContextType> = {},
  openClawOverrides: Partial<OpenClawContextType> = {},
  uiConfigOverrides: Partial<PublicConfigurationContextType> = {},
) {
  const ansibleCtx = makeAnsibleContext(ansibleOverrides);
  const openClawCtx = makeOpenClawContext(openClawOverrides);
  const uiConfigCtx = makeUIConfigContext(uiConfigOverrides);
  const view = render(
    renderGridTree(ctx, ansibleCtx, openClawCtx, uiConfigCtx),
  );
  return {
    ansibleCtx,
    openClawCtx,
    unmount: view.unmount,
    rerenderGrid: (nextCtx: UserContextType) => {
      view.rerender(
        renderGridTree(nextCtx, ansibleCtx, openClawCtx, uiConfigCtx),
      );
    },
  };
}

function getOpenShiftCard(): HTMLElement {
  const cards = screen.getAllByRole("article");
  const card = cards.find(
    (c) =>
      c.textContent?.includes("OpenShift") &&
      !c.textContent?.includes("OpenShift AI") &&
      !c.textContent?.includes("OpenShift Virtualization"),
  );
  expect(card).toBeDefined();
  return card!;
}

function getOpenShiftTryItButton(): HTMLElement {
  return within(getOpenShiftCard()).getByRole("button", { name: "Try it" });
}

/**
 * Forces the signup slow path so the continuation modal opens
 * instead of `window.open`.
 */
function mockInactiveUserGesture(): void {
  Object.defineProperty(navigator, "userActivation", {
    configurable: true,
    value: { isActive: false, hasBeenActive: false },
  });
}

/** Restores the jsdom default, which has no User Activation API. */
function restoreUserGesture(): void {
  Object.defineProperty(navigator, "userActivation", {
    configurable: true,
    value: undefined,
  });
}

function getRhdhCard(): HTMLElement {
  return screen.getByRole("article", {
    name: "Red Hat Developer Hub product card",
  });
}

describe("CatalogGrid", () => {
  afterEach(() => {
    vi.useRealTimers();
    trackProductAction.mockClear();
  });

  it("tracks an open when a provisioned product is started", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderGrid(makeContext());

    const button = getOpenShiftTryItButton();
    expect(button).toHaveAttribute("data-analytics-text", "OpenShift");
    expect(button).toHaveAttribute(
      "data-analytics-offerid",
      Intcmp[ProductType.OPENSHIFT_CONSOLE],
    );
    expect(
      within(
        screen.getByRole("article", {
          name: "Ansible Automation Platform product card",
        }),
      ).getByRole("button", { name: "Set up" }),
    ).not.toHaveAttribute("data-analytics-text");

    await userEvent.click(button);

    expect(trackProductAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ProductType.OPENSHIFT_CONSOLE,
        title: "OpenShift",
      }),
      "opened",
      expect.stringContaining("console.apps.example.com"),
    );
    expect(open).toHaveBeenCalled();
    open.mockRestore();
  });

  it("does not decorate a ready product that has no URL", () => {
    renderGrid(
      makeContext({
        user: {
          ...readyUserFixture,
          consoleURL: "",
          cheDashboardURL: "",
          rhodsMemberURL: "",
        },
      }),
    );

    expect(
      within(
        screen.getByRole("article", { name: "OpenShift AI product card" }),
      ).getByRole("button", { name: "Try it" }),
    ).not.toHaveAttribute("data-analytics-text");
    expect(
      within(getRhdhCard()).getByRole("button", { name: "Try it" }),
    ).not.toHaveAttribute("data-analytics-text");
  });

  it("does not decorate a signup click for Adobe", () => {
    renderGrid(makeContext({ userSignupPhase: UserSignupPhase.NOT_STARTED }));

    expect(getOpenShiftTryItButton()).not.toHaveAttribute(
      "data-analytics-text",
    );
  });

  it("tags the signup continuation button when the product URL is valid", async () => {
    mockInactiveUserGesture();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    try {
      const { rerenderGrid } = renderGrid(
        makeContext({ userSignupPhase: UserSignupPhase.NOT_STARTED }),
      );

      await user.click(getOpenShiftTryItButton());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(
        within(
          screen.getByRole("dialog", { name: "Signup in progress" }),
        ).getByRole("button", { name: /Try OpenShift$/ }),
      ).not.toHaveAttribute("data-analytics-text");

      rerenderGrid(makeContext());

      await waitFor(() => {
        const continueButton = within(
          screen.getByRole("dialog", { name: "Signup completed" }),
        ).getByRole("button", { name: /Try OpenShift$/ });
        expect(continueButton).toBeEnabled();
        expect(continueButton).toHaveAttribute(
          "data-analytics-text",
          "OpenShift",
        );
        expect(continueButton).toHaveAttribute(
          "data-analytics-offerid",
          Intcmp[ProductType.OPENSHIFT_CONSOLE],
        );
      });

      // The modal hides the catalog from the accessibility tree.
      // The ready card button still carries the same open attributes.
      expect(
        within(
          screen.getByRole("article", {
            name: "OpenShift product card",
            hidden: true,
          }),
        ).getByRole("button", { name: "Try it", hidden: true }),
      ).toHaveAttribute("data-analytics-text", "OpenShift");
    } finally {
      restoreUserGesture();
      vi.useRealTimers();
    }
  });

  it("does not tag the continuation button when the product URL is empty", async () => {
    mockInactiveUserGesture();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    try {
      const { rerenderGrid } = renderGrid(
        makeContext({ userSignupPhase: UserSignupPhase.NOT_STARTED }),
      );

      await user.click(
        within(
          screen.getByRole("article", { name: "OpenShift AI product card" }),
        ).getByRole("button", { name: "Try it" }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      rerenderGrid(
        makeContext({
          user: {
            ...readyUserFixture,
            consoleURL: "",
            cheDashboardURL: "",
            rhodsMemberURL: "",
          },
        }),
      );

      await waitFor(() => {
        expect(
          within(
            screen.getByRole("dialog", { name: "Signup completed" }),
          ).getByRole("button", { name: /Try OpenShift AI/ }),
        ).toBeEnabled();
      });

      expect(
        within(
          screen.getByRole("dialog", { name: "Signup completed" }),
        ).getByRole("button", { name: /Try OpenShift AI/ }),
      ).not.toHaveAttribute("data-analytics-text");
      expect(
        within(
          screen.getByRole("article", {
            name: "OpenShift AI product card",
            hidden: true,
          }),
        ).getByRole("button", { name: "Try it", hidden: true }),
      ).not.toHaveAttribute("data-analytics-text");
    } finally {
      restoreUserGesture();
      vi.useRealTimers();
    }
  });

  it("renders all product cards when no integrations are disabled", () => {
    renderGrid(makeContext());
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(products.length);
  });

  it("filters out disabled integrations", () => {
    renderGrid(
      makeContext(),
      {},
      {},
      {
        disabledIntegrations: new Set([products[0].type]),
      },
    );
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(products.length - 1);
  });

  it("shows default 'Try it' button on non-AAP/non-OpenClaw products regardless of statuses", () => {
    renderGrid(
      makeContext(),
      { instanceStatus: { kind: "ready" } },
      { status: OpenClawStatus.READY },
    );

    const openshiftCard = getOpenShiftCard();
    const mainButton = within(openshiftCard).getByRole("button", {
      name: "Try it",
    });
    expect(mainButton.textContent).toContain("Try it");

    expect(
      within(openshiftCard).queryByRole("button", { name: "Delete instance" }),
    ).not.toBeInTheDocument();

    expect(openshiftCard.textContent).not.toContain("Ready");
    expect(openshiftCard.textContent).not.toContain("Provisioning");
  });

  it("opens product URL for simple cards directly", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    renderGrid(makeContext());

    await userEvent.click(getOpenShiftTryItButton());

    expect(windowOpenSpy).toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });

  it("does not disable simple card primary buttons", () => {
    renderGrid(makeContext());

    const openshiftCard = getOpenShiftCard();
    const button = within(openshiftCard).getByRole("button", {
      name: "Try it",
    });
    expect(button).toBeEnabled();
  });

  it("renders AAP card with the correct product type", () => {
    renderGrid(makeContext());

    const aapCard = products.find((p) => p.type === ProductType.AAP);
    expect(aapCard).toBeDefined();

    expect(
      screen.getByRole("article", {
        name: `${aapCard!.title} product card`,
      }),
    ).toBeInTheDocument();
  });

  it("renders OpenClaw card with the correct product type", () => {
    renderGrid(makeContext());

    const openClawCard = products.find((p) => p.type === ProductType.OPENCLAW);
    expect(openClawCard).toBeDefined();

    expect(
      screen.getByRole("article", {
        name: `${openClawCard!.title} product card`,
      }),
    ).toBeInTheDocument();
  });

  describe("RHDH card", () => {
    it("opens the product URL when the account is ready and startDate is old enough", async () => {
      const windowOpenSpy = vi
        .spyOn(window, "open")
        .mockImplementation(() => null);

      renderGrid(makeContext());

      const tryItButton = within(getRhdhCard()).getByRole("button", {
        name: "Try it",
      });
      expect(tryItButton).toBeEnabled();
      expect(
        within(getRhdhCard()).queryByRole("progressbar"),
      ).not.toBeInTheDocument();
      expect(
        within(getRhdhCard()).queryByRole("button", {
          name: "Delete instance",
        }),
      ).not.toBeInTheDocument();

      await userEvent.click(tryItButton);

      expect(windowOpenSpy).toHaveBeenCalled();
      windowOpenSpy.mockRestore();
    });

    it("shows a disabled provisioning button when startDate is recent", () => {
      const windowOpenSpy = vi
        .spyOn(window, "open")
        .mockImplementation(() => null);

      renderGrid(
        makeContext({
          user: {
            ...readyUserFixture,
            startDate: new Date().toISOString(),
          },
        }),
      );

      const provisioningButton = within(getRhdhCard()).getByRole("button", {
        name: /Provisioning/,
      });
      expect(provisioningButton).toBeDisabled();
      expect(provisioningButton.textContent).toContain("Provisioning...");
      expect(
        within(getRhdhCard()).getByRole("progressbar"),
      ).toBeInTheDocument();
      expect(windowOpenSpy).not.toHaveBeenCalled();
      windowOpenSpy.mockRestore();
    });

    it("enables the Try it button after the RHDH grace period elapses", async () => {
      vi.useFakeTimers();
      try {
        const startDate = "2026-01-01T00:00:00.000Z";
        vi.setSystemTime(new Date(startDate));

        renderGrid(
          makeContext({
            user: {
              ...readyUserFixture,
              startDate,
            },
          }),
        );

        expect(
          within(getRhdhCard()).getByRole("button", { name: /Provisioning/ }),
        ).toBeDisabled();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(RHDH_READY_DELAY_MS);
        });

        expect(
          within(getRhdhCard()).getByRole("button", { name: /Provisioning/ }),
        ).toBeDisabled();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1);
        });

        expect(
          within(getRhdhCard()).getByRole("button", { name: "Try it" }),
        ).toBeEnabled();
        expect(
          within(getRhdhCard()).queryByRole("progressbar"),
        ).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not enable RHDH after the grace period when startDate is missing", async () => {
      vi.useFakeTimers();
      try {
        renderGrid(
          makeContext({
            user: {
              ...readyUserFixture,
              startDate: undefined,
            },
          }),
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(RHDH_READY_DELAY_MS + 1_000);
        });

        expect(
          within(getRhdhCard()).getByRole("button", { name: /Provisioning/ }),
        ).toBeDisabled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("shows a disabled provisioning button when startDate is missing", () => {
      renderGrid(
        makeContext({
          user: {
            ...readyUserFixture,
            startDate: undefined,
          },
        }),
      );

      const provisioningButton = within(getRhdhCard()).getByRole("button", {
        name: /Provisioning/,
      });
      expect(provisioningButton).toBeDisabled();
      expect(
        within(getRhdhCard()).getByRole("progressbar"),
      ).toBeInTheDocument();
    });

    it("keeps other simple cards enabled while RHDH is provisioning", () => {
      renderGrid(
        makeContext({
          user: {
            ...readyUserFixture,
            startDate: new Date().toISOString(),
          },
        }),
      );

      expect(getOpenShiftTryItButton()).toBeEnabled();
      expect(
        within(getRhdhCard()).getByRole("button", { name: /Provisioning/ }),
      ).toBeDisabled();
    });

    it("hides the card when rhdh is disabled", () => {
      renderGrid(
        makeContext(),
        {},
        {},
        { disabledIntegrations: new Set([ProductType.RHDH]) },
      );

      expect(
        screen.queryByRole("article", {
          name: "Red Hat Developer Hub product card",
        }),
      ).not.toBeInTheDocument();
      expect(getOpenShiftCard()).toBeInTheDocument();
    });
  });
});
