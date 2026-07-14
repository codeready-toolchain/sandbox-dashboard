import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  AnsibleContext,
  type AnsibleContextType,
} from "../../../hooks/AnsibleContext";
import type { OpenClawContextType } from "../../../hooks/OpenClawContext";
import { OpenClawContext } from "../../../hooks/OpenClawContext";
import { PhoneVerificationContext } from "../../../hooks/PhoneVerificationContext";
import type { UIConfigurationContextType } from "../../../hooks/UIConfigurationContext";
import { UIConfigurationContext } from "../../../hooks/UIConfigurationContext";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext, UserSignupPhase } from "../../../hooks/UserContext";
import { readyUserFixture } from "../../../mocks/fixtures";
import { NotificationProvider } from "../../../notifications/NotificationProvider";
import { ProductType } from "../../../types/product";
import { AnsibleStatus } from "../../../utils/aap-utils";
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
    ansibleData: undefined,
    ansibleProvisioningErrorDetails: null,
    ansibleStatus: AnsibleStatus.NEW,
    ansibleUILink: undefined,
    ansibleUIPassword: "",
    ansibleUIUser: undefined,
    handleAAPInstance: vi.fn(),
    refetchAAP: vi.fn(),
    resetAnsibleProvisioningErrorDetails: vi.fn(),
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
      </UIConfigurationContext.Provider>
    </NotificationProvider>,
  );
  return { ansibleCtx, openClawCtx };
}

function getOpenShiftCardWithButton(): {
  card: HTMLElement;
  tryItButton: HTMLButtonElement;
} {
  const card = screen
    .getAllByTestId("catalog-card")
    .find(
      (c) =>
        c.textContent?.includes("OpenShift") &&
        !c.textContent?.includes("OpenShift AI") &&
        !c.textContent?.includes("OpenShift Virtualization"),
    );
  expect(card).toBeDefined();

  const tryItButton = card!.querySelector("[data-testid='try-it-button']");
  expect(tryItButton).not.toBeNull();

  return { card: card!, tryItButton: tryItButton as HTMLButtonElement };
}

describe("CatalogGrid", () => {
  beforeEach(() => {
    mockOpenPhoneVerificationModal.mockClear();
  });

  it("renders nothing while disabledIntegrations is undefined", () => {
    renderGrid(makeContext(), {}, {}, { disabledIntegrations: undefined });
    expect(screen.queryAllByTestId("catalog-card")).toHaveLength(0);
    expect(screen.queryByTestId("sandbox-catalog-grid")).toBeNull();
  });

  it("renders all product cards when no integrations are disabled", () => {
    renderGrid(makeContext());
    const cards = screen.getAllByTestId("catalog-card");
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
    const cards = screen.getAllByTestId("catalog-card");
    expect(cards).toHaveLength(products.length - 1);
  });

  it("shows default 'Try it' button on non-AAP/non-OpenClaw products regardless of statuses", () => {
    renderGrid(
      makeContext(),
      { ansibleStatus: AnsibleStatus.READY },
      { openclawStatus: OpenClawStatus.READY },
    );

    const { card: openshiftCard, tryItButton: mainButton } =
      getOpenShiftCardWithButton();
    expect(mainButton.textContent).toContain("Try it");

    expect(
      openshiftCard.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();

    expect(openshiftCard.textContent).not.toContain("Ready");
    expect(openshiftCard.textContent).not.toContain("Provisioning");
  });

  it("opens product URL for simple cards when user signup phase is READY", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    renderGrid(makeContext());

    const { tryItButton } = getOpenShiftCardWithButton();

    await userEvent.click(tryItButton);

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

    const { tryItButton } = getOpenShiftCardWithButton();

    await userEvent.click(tryItButton);

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

    const { tryItButton } = getOpenShiftCardWithButton();

    await userEvent.click(tryItButton);

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

    const { tryItButton } = getOpenShiftCardWithButton();

    await userEvent.click(tryItButton);

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

    const { tryItButton } = getOpenShiftCardWithButton();

    await userEvent.click(tryItButton);

    expect(windowOpenSpy).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });

  it("renders AAP card with the correct product type", () => {
    renderGrid(makeContext());

    const aapCard = products.find((p) => p.type === ProductType.AAP);
    expect(aapCard).toBeDefined();

    const cards = screen.getAllByTestId("catalog-card");
    const aapCardEl = cards.find((c) =>
      c.textContent?.includes(aapCard!.title),
    );
    expect(aapCardEl).toBeDefined();
  });

  it("renders OpenClaw card with the correct product type", () => {
    renderGrid(makeContext());

    const openClawCard = products.find((p) => p.type === ProductType.OPENCLAW);
    expect(openClawCard).toBeDefined();

    const cards = screen.getAllByTestId("catalog-card");
    const openClawCardEl = cards.find((c) =>
      c.textContent?.includes(openClawCard!.title),
    );
    expect(openClawCardEl).toBeDefined();
  });

  it("opens phone verification modal for simple cards when signup phase is PENDING_PHONE_VERIFICATION", async () => {
    renderGrid(
      makeContext({
        userSignupPhase: UserSignupPhase.PENDING_PHONE_VERIFICATION,
      }),
    );

    const { tryItButton } = getOpenShiftCardWithButton();
    await userEvent.click(tryItButton);

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

    const { tryItButton } = getOpenShiftCardWithButton();
    await userEvent.click(tryItButton);

    expect(windowOpenSpy).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });
});
