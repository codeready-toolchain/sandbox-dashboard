import { render, screen, within } from "@testing-library/react";
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
import type { UIConfigurationContextType } from "../../../hooks/UIConfigurationContext";
import { UIConfigurationContext } from "../../../hooks/UIConfigurationContext";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext } from "../../../hooks/UserContext";
import { UserSignupPhase } from "../../../hooks/userSignupPhase";
import { readyUserFixture } from "../../../mocks/fixtures";
import { ProductType } from "../../../types/product";
import { OpenClawStatus } from "../../../utils/openclaw-utils";
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

function renderGrid(
  ctx: UserContextType,
  ansibleOverrides: Partial<AnsibleContextType> = {},
  openClawOverrides: Partial<OpenClawContextType> = {},
  uiConfigOverrides: Partial<UIConfigurationContextType> = {},
) {
  const ansibleCtx = makeAnsibleContext(ansibleOverrides);
  const openClawCtx = makeOpenClawContext(openClawOverrides);
  const uiConfigCtx = makeUIConfigContext(uiConfigOverrides);
  render(
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
    </NotificationProvider>,
  );
  return { ansibleCtx, openClawCtx };
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

describe("CatalogGrid", () => {
  beforeEach(() => {
    mockOpenPhoneVerificationModal.mockClear();
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

  it("calls signupUser for simple cards when signup phase is NOT_STARTED", async () => {
    const signupUser = vi.fn();

    renderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.NOT_STARTED,
        user: undefined,
        signupUser,
      }),
    );

    await userEvent.click(getOpenShiftTryItButton());

    expect(signupUser).toHaveBeenCalledTimes(1);
  });

  it("does not open product URL or call signupUser when signup phase is not READY or NOT_STARTED", async () => {
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

  it("does not open product URL when signup phase is PROVISIONING", async () => {
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
    windowOpenSpy.mockRestore();
  });

  it("does not open product URL when signup phase is SIGNING_UP", async () => {
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
    windowOpenSpy.mockRestore();
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
});
