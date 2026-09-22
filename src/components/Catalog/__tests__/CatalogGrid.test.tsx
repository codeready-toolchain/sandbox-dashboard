import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { AnalyticsContext } from "../../../hooks/AnalyticsContext";
import {
  AnsibleContext,
  type AnsibleContextType,
} from "../../../hooks/AnsibleContext";
import { NotificationProvider } from "../../../hooks/NotificationProvider";
import type { OpenClawContextType } from "../../../hooks/OpenClawContext";
import { OpenClawContext } from "../../../hooks/OpenClawContext";
import { PhoneVerificationContext } from "../../../hooks/PhoneVerificationContext";
import { mockUserActivation } from "../../../hooks/signupAction/__tests__/userActivationTestHelpers";
import { SIGNUP_WATCHER_INTERVAL_MS } from "../../../hooks/signupAction/signupActionUtils";
import type { UIConfigurationContextType } from "../../../hooks/UIConfigurationContext";
import { UIConfigurationContext } from "../../../hooks/UIConfigurationContext";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext } from "../../../hooks/UserContext";
import { UserSignupPhase } from "../../../hooks/userSignupPhase";
import { readyUserFixture } from "../../../mocks/fixtures";
import { ProductType } from "../../../types/product";
import { OpenClawStatus } from "../../../utils/openclaw-utils";
import { RHDH_READY_DELAY_MS } from "../../../utils/rhdh-utils";
import { CatalogGrid } from "../CatalogGrid";
import { products } from "../productData";
import { makeOpenClawContext } from "./openClawTestHelpers";

vi.mock("../../../hooks/AnsibleProvider", () => ({
  AnsibleProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../../../hooks/OpenClawProvider", () => ({
  OpenClawProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const mockOpenPhoneVerificationModal = vi.fn();

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

function makeUIConfigContext(
  overrides: Partial<UIConfigurationContextType> = {},
): UIConfigurationContextType {
  return {
    disabledIntegrations: [],
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
  uiConfigCtx: UIConfigurationContextType,
) {
  return (
    <NotificationProvider>
      <UIConfigurationContext.Provider value={uiConfigCtx}>
        <AnalyticsContext.Provider value={{ trackAnalytics: vi.fn() }}>
          <AnsibleContext.Provider value={ansibleCtx}>
            <OpenClawContext.Provider value={openClawCtx}>
              <UserContext.Provider value={ctx}>
                <PhoneVerificationContext.Provider
                  value={{
                    openPhoneVerificationModal: mockOpenPhoneVerificationModal,
                  }}
                >
                  <CatalogGrid />
                </PhoneVerificationContext.Provider>
              </UserContext.Provider>
            </OpenClawContext.Provider>
          </AnsibleContext.Provider>
        </AnalyticsContext.Provider>
      </UIConfigurationContext.Provider>
    </NotificationProvider>
  );
}

function renderGrid(
  ctx: UserContextType,
  ansibleOverrides: Partial<AnsibleContextType> = {},
  openClawOverrides: Partial<OpenClawContextType> = {},
  uiConfigOverrides: Partial<UIConfigurationContextType> = {},
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

function getRhdhCard(): HTMLElement {
  return screen.getByRole("article", {
    name: "Red Hat Developer Hub product card",
  });
}

const rhdhProductUrl =
  "https://backstage-developer-hub-rhdh-operator.apps.example.com";

function getSignupModal() {
  return screen.getByRole("dialog", { name: "User signup is in progress" });
}

describe("CatalogGrid", () => {
  beforeEach(() => {
    mockOpenPhoneVerificationModal.mockClear();
    mockUserActivation(undefined);
  });

  afterEach(() => {
    mockUserActivation(undefined);
    vi.useRealTimers();
  });

  it("renders nothing while disabledIntegrations is undefined", () => {
    renderGrid(makeContext(), {}, {}, { disabledIntegrations: undefined });
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(
      screen.queryByRole("region", { name: "Product catalog" }),
    ).toBeNull();
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
        disabledIntegrations: [products[0].type],
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

  it("opens product URL for simple cards when user signup phase is READY", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    renderGrid(makeContext());

    await userEvent.click(getOpenShiftTryItButton());

    expect(windowOpenSpy).toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });

  it("calls signupUser and shows a disabled continuation modal when signup phase is NOT_STARTED", async () => {
    const signupUser = vi.fn();
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    renderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.NOT_STARTED,
        user: undefined,
        signupUser,
      }),
    );

    await userEvent.click(getOpenShiftTryItButton());

    expect(signupUser).toHaveBeenCalledTimes(1);
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(getSignupModal()).toBeInTheDocument();
    expect(
      within(getSignupModal()).getByRole("button", { name: /Try it/ }),
    ).toBeDisabled();
    windowOpenSpy.mockRestore();
  });

  it("opens the product URL from the continuation modal after signup becomes READY", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const signupUser = vi.fn();

    const { rerenderGrid } = renderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.NOT_STARTED,
        user: undefined,
        signupUser,
      }),
    );

    await userEvent.click(getOpenShiftTryItButton());
    expect(getSignupModal()).toBeInTheDocument();

    rerenderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.READY,
        signupUser,
      }),
    );

    const continueButton = within(getSignupModal()).getByRole("button", {
      name: "Try it",
    });
    expect(continueButton).toBeEnabled();
    await userEvent.click(continueButton);

    expect(windowOpenSpy).toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "User signup is in progress" }),
    ).not.toBeInTheDocument();
    windowOpenSpy.mockRestore();
  });

  it("opens the product URL on the fast path when activation is still active at READY", () => {
    mockUserActivation(true);
    vi.useFakeTimers();
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const signupUser = vi.fn();

    const { rerenderGrid } = renderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.NOT_STARTED,
        user: undefined,
        signupUser,
      }),
    );

    fireEvent.click(getOpenShiftTryItButton());
    expect(signupUser).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("dialog", { name: "User signup is in progress" }),
    ).not.toBeInTheDocument();

    rerenderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.READY,
        signupUser,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(SIGNUP_WATCHER_INTERVAL_MS);
    });

    expect(windowOpenSpy).toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "User signup is in progress" }),
    ).not.toBeInTheDocument();
    windowOpenSpy.mockRestore();
  });

  it("closes the continuation modal when signup requires phone verification", async () => {
    const signupUser = vi.fn();
    const { rerenderGrid } = renderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.NOT_STARTED,
        user: undefined,
        signupUser,
      }),
    );

    await userEvent.click(getOpenShiftTryItButton());
    expect(getSignupModal()).toBeInTheDocument();

    rerenderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.PENDING_PHONE_VERIFICATION,
        signupUser,
      }),
    );

    expect(
      screen.queryByRole("dialog", { name: "User signup is in progress" }),
    ).not.toBeInTheDocument();
    expect(mockOpenPhoneVerificationModal).not.toHaveBeenCalled();
  });

  it("does not open product URL or call signupUser when signup phase is PENDING_PHONE_VERIFICATION", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const signupUser = vi.fn();

    renderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.PENDING_PHONE_VERIFICATION,
        signupUser,
      }),
    );

    await userEvent.click(getOpenShiftTryItButton());

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(signupUser).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });

  it("shows the continuation modal without opening the product URL when signup phase is PROVISIONING", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    renderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.PROVISIONING,
      }),
    );

    await userEvent.click(getOpenShiftTryItButton());

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(getSignupModal()).toBeInTheDocument();
    windowOpenSpy.mockRestore();
  });

  it("shows the continuation modal without opening the product URL when signup phase is SIGNING_UP", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    renderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.SIGNING_UP,
      }),
    );

    await userEvent.click(getOpenShiftTryItButton());

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(getSignupModal()).toBeInTheDocument();
    windowOpenSpy.mockRestore();
  });

  it("disables other card buttons while signup is in progress", async () => {
    renderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.NOT_STARTED,
        user: undefined,
        signupUser: vi.fn(),
      }),
    );

    // Grab all primary buttons before the modal opens, since
    // PatternFly sets aria-hidden on the page behind the modal.
    const catalogSection = screen.getByRole("region", {
      name: "Product catalog",
    });
    const buttons = within(catalogSection).getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(1);

    await userEvent.click(getOpenShiftTryItButton());
    expect(getSignupModal()).toBeInTheDocument();

    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });

  it("disables the primary button on simple cards when signup phase is INITIAL_FETCH", () => {
    renderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.INITIAL_FETCH,
      }),
    );

    const openshiftCard = getOpenShiftCard();
    const button = within(openshiftCard).getByRole("button", {
      name: /Try it/,
    });
    expect(button).toBeDisabled();
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

  it("opens phone verification modal for simple cards when signup phase is PENDING_PHONE_VERIFICATION", async () => {
    renderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.PENDING_PHONE_VERIFICATION,
      }),
    );

    await userEvent.click(getOpenShiftTryItButton());

    expect(mockOpenPhoneVerificationModal).toHaveBeenCalledTimes(1);
  });

  it("does not open product URL when signup phase is PENDING_MANUAL_APPROVAL", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    renderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.PENDING_MANUAL_APPROVAL,
      }),
    );

    await userEvent.click(getOpenShiftTryItButton());

    expect(windowOpenSpy).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
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

      expect(windowOpenSpy).toHaveBeenCalledWith(
        rhdhProductUrl,
        "_blank",
        "noopener,noreferrer",
      );
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

    it("disables the primary button before the account is READY", () => {
      const preReadyPhases = [
        UserSignupPhase.INITIAL_FETCH,
        UserSignupPhase.NOT_STARTED,
        UserSignupPhase.PENDING_PHONE_VERIFICATION,
        UserSignupPhase.PENDING_MANUAL_APPROVAL,
        UserSignupPhase.SIGNING_UP,
        UserSignupPhase.PROVISIONING,
        UserSignupPhase.BLOCKED,
      ];

      for (const userSignupPhase of preReadyPhases) {
        const { unmount } = renderGrid(
          makeContext({
            userSignupPhase,
            user:
              userSignupPhase === UserSignupPhase.NOT_STARTED
                ? undefined
                : readyUserFixture,
          }),
        );

        expect(
          within(getRhdhCard()).getByRole("button", { name: /Try it/ }),
        ).toBeDisabled();
        expect(
          within(getRhdhCard()).queryByRole("progressbar"),
        ).not.toBeInTheDocument();
        unmount();
      }
    });

    it("hides the card when rhdh is disabled", () => {
      renderGrid(
        makeContext(),
        {},
        {},
        { disabledIntegrations: [ProductType.RHDH] },
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
