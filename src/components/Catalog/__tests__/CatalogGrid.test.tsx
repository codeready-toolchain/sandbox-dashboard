import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act, type ReactNode } from "react";
import {
  AnsibleContext,
  type AnsibleContextType,
} from "../../../hooks/AnsibleContext";
import type { OpenClawContextType } from "../../../hooks/OpenClawContext";
import { OpenClawContext } from "../../../hooks/OpenClawContext";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext } from "../../../hooks/UserContext";
import type { UIConfigurationContextType } from "../../../hooks/UIConfigurationContext";
import { UIConfigurationContext } from "../../../hooks/UIConfigurationContext";
import { readyUserFixture } from "../../../mocks/fixtures";
import { NotificationProvider } from "../../../notifications/NotificationProvider";
import type { SignupData } from "../../../types";
import { UserStatus } from "../../../types";
import { ProductType } from "../../../types/product";
import { AnsibleStatus } from "../../../utils/aap-utils";
import { OpenClawStatus } from "../../../utils/openclaw-utils";
import { CatalogGrid } from "../CatalogGrid";
import { makeOpenClawContext } from "./openClawTestHelpers";
import { products } from "../productData";

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
    userStatus: UserStatus.READY,
    userFound: true,
    userReady: true,
    verificationRequired: false,
    pendingApproval: false,
    userData: readyUserFixture,
    loading: false,
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
              <CatalogGrid />
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
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("calls ensureUserIsReady and opens product URL for simple cards when user is ready", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    renderGrid(makeContext());

    const { tryItButton } = getOpenShiftCardWithButton();

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(tryItButton);

    expect(windowOpenSpy).toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });

  it("does not open product URL for simple cards when verification is required", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    renderGrid(makeContext({ verificationRequired: true, userReady: false }));

    const { tryItButton } = getOpenShiftCardWithButton();

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(tryItButton);

    expect(windowOpenSpy).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });

  it("passes fresh namespace from refetch to handleAAPInstance after signup", async () => {
    const freshNamespace = "fresh-user-ns";
    const freshUserData: SignupData = {
      ...readyUserFixture,
      defaultUserNamespace: freshNamespace,
    };

    const handleAAPInstance = vi.fn();
    const refetchUserData = vi.fn().mockResolvedValue(freshUserData);
    const signupUser = vi.fn().mockResolvedValue(undefined);

    renderGrid(
      makeContext({
        userStatus: UserStatus.NEW,
        userReady: false,
        userFound: false,
        userData: undefined,
        signupUser,
        refetchUserData,
      }),
      { handleAAPInstance },
    );

    const aapCard = products.find((p) => p.type === ProductType.AAP);
    if (!aapCard) throw new Error("AAP card not found in products");

    const tryItButtons = screen.getAllByText("Provision");
    const aapProvision = tryItButtons.find((btn) =>
      btn
        .closest("[data-testid='catalog-card']")
        ?.textContent?.includes(aapCard.title),
    );
    expect(aapProvision).toBeDefined();

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(aapProvision!);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    await waitFor(() => {
      expect(handleAAPInstance).toHaveBeenCalledWith(freshNamespace);
    });
  });

  it("deduplicates concurrent ensureUserIsReady calls via the useRef in-flight guard", async () => {
    let resolveSignup!: () => void;
    const signupPromise = new Promise<void>((resolve) => {
      resolveSignup = resolve;
    });

    const signupUser = vi.fn().mockReturnValue(signupPromise);
    const refetchUserData = vi.fn().mockResolvedValue({
      ...readyUserFixture,
      status: { ready: true, reason: "", verificationRequired: false },
    });

    renderGrid(
      makeContext({
        userStatus: UserStatus.NEW,
        userReady: false,
        userFound: false,
        userData: undefined,
        signupUser,
        refetchUserData,
      }),
    );

    const { tryItButton } = getOpenShiftCardWithButton();

    await act(async () => {
      fireEvent.click(tryItButton);
      fireEvent.click(tryItButton);
    });

    resolveSignup();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(signupUser).toHaveBeenCalledTimes(1);
  });

  it("resets the in-flight guard after signup completes so subsequent calls work", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    const signupUser = vi.fn().mockResolvedValue(undefined);
    const refetchUserData = vi.fn().mockResolvedValue({
      ...readyUserFixture,
      status: { ready: true, reason: "", verificationRequired: false },
    });

    renderGrid(
      makeContext({
        userStatus: UserStatus.NEW,
        userReady: false,
        userFound: false,
        userData: undefined,
        signupUser,
        refetchUserData,
      }),
    );

    const { tryItButton } = getOpenShiftCardWithButton();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.click(tryItButton);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(signupUser).toHaveBeenCalledTimes(1);

    await user.click(tryItButton);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(signupUser).toHaveBeenCalledTimes(2);

    windowOpenSpy.mockRestore();
  });

  it("shows alert and returns not-ready when polling rejects after signup", async () => {
    const signupUser = vi.fn().mockResolvedValue(undefined);
    const refetchUserData = vi
      .fn()
      .mockRejectedValue(new Error("Network failure"));

    renderGrid(
      makeContext({
        userStatus: UserStatus.NEW,
        userReady: false,
        userFound: false,
        userData: undefined,
        signupUser,
        refetchUserData,
      }),
    );

    const { tryItButton } = getOpenShiftCardWithButton();
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(tryItButton);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(windowOpenSpy).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(
        screen.getByText(
          "We were unable to confirm your Developer Sandbox account status, please try again later.",
        ),
      ).toBeInTheDocument();
    });

    windowOpenSpy.mockRestore();
  });

  it("shows generic alert when signupUser throws a non-UserFacingError", async () => {
    const signupUser = vi
      .fn()
      .mockRejectedValue(new TypeError("unexpected failure"));

    renderGrid(
      makeContext({
        userStatus: UserStatus.NEW,
        userReady: false,
        userFound: false,
        userData: undefined,
        signupUser,
      }),
    );

    const { tryItButton } = getOpenShiftCardWithButton();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(tryItButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          "We were unable to set up your Developer Sandbox account in our systems, please try again later.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows user-facing alert when signupUser throws a UserFacingError", async () => {
    const { UserFacingError } = await import("../../../error/UserFacingError");
    const signupUser = vi
      .fn()
      .mockRejectedValue(
        new UserFacingError("Custom title", "Custom description"),
      );

    renderGrid(
      makeContext({
        userStatus: UserStatus.NEW,
        userReady: false,
        userFound: false,
        userData: undefined,
        signupUser,
      }),
    );

    const { tryItButton } = getOpenShiftCardWithButton();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(tryItButton);

    await waitFor(() => {
      expect(screen.getByText("Custom description")).toBeInTheDocument();
    });
  });

  it("resets the in-flight guard even when signup polling exhausts all attempts", async () => {
    const signupUser = vi.fn().mockResolvedValue(undefined);
    const refetchUserData = vi.fn().mockResolvedValue(null);

    renderGrid(
      makeContext({
        userStatus: UserStatus.NEW,
        userReady: false,
        userFound: false,
        userData: undefined,
        signupUser,
        refetchUserData,
      }),
    );

    const { tryItButton } = getOpenShiftCardWithButton();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.click(tryItButton);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(70000);
    });

    expect(signupUser).toHaveBeenCalledTimes(1);

    await user.click(tryItButton);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(70000);
    });

    expect(signupUser).toHaveBeenCalledTimes(2);
  });
});
