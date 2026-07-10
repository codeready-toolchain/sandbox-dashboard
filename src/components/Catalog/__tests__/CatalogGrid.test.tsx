import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import type { SandboxContextType } from "../../../hooks/SandboxContext";
import { SandboxContext } from "../../../hooks/SandboxContext";
import { readyUserFixture } from "../../../mocks/fixtures";
import { NotificationProvider } from "../../../notifications/NotificationProvider";
import type { SignupData } from "../../../types";
import { UserStatus } from "../../../types";
import { ProductType } from "../../../types/product";
import { AnsibleStatus } from "../../../utils/aap-utils";
import { OpenClawStatus } from "../../../utils/openclaw-utils";
import { CatalogGrid } from "../CatalogGrid";
import { products } from "../productData";

function makeContext(
  overrides: Partial<SandboxContextType> = {},
): SandboxContextType {
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
    refetchAAP: vi.fn(),
    handleAAPInstance: vi.fn(),
    ansibleData: undefined,
    ansibleUIUser: undefined,
    ansibleUIPassword: "",
    ansibleUILink: undefined,
    ansibleProvisioningErrorDetails: null,
    ansibleStatus: AnsibleStatus.NEW,
    openclawData: undefined,
    openClawDeletionErrorDetails: null,
    resetOpenClawDeletionErrorDetails: vi.fn(),
    openClawProvisioningErrorDetails: null,
    resetOpenClawProvisioningErrorDetails: vi.fn(),
    resetAnsibleProvisioningErrorDetails: vi.fn(),
    openclawStatus: OpenClawStatus.NEW,
    openclawUILink: undefined,
    handleOpenClawInstance: vi.fn(),
    deleteOpenClaw: vi.fn(),
    disabledIntegrations: [],
    ...overrides,
  };
}

function renderGrid(ctx: SandboxContextType) {
  return render(
    <NotificationProvider>
      <SandboxContext.Provider value={ctx}>
        <CatalogGrid />
      </SandboxContext.Provider>
    </NotificationProvider>,
  );
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
    renderGrid(makeContext({ disabledIntegrations: undefined }));
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
      makeContext({
        disabledIntegrations: [products[0].type],
      }),
    );
    const cards = screen.getAllByTestId("catalog-card");
    expect(cards).toHaveLength(products.length - 1);
  });

  it("does not show delete button when OpenClaw status is UNKNOWN", () => {
    renderGrid(makeContext({ openclawStatus: OpenClawStatus.UNKNOWN }));

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();
    expect(
      openclawCard!.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();
  });

  it("hides delete button and shows 'Deleting...' on main button when OpenClaw status is DELETING", () => {
    renderGrid(makeContext({ openclawStatus: OpenClawStatus.DELETING }));

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();

    expect(
      openclawCard!.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton).toBeDefined();
    expect(mainButton.textContent).toContain("Deleting...");
    expect(mainButton).toBeDisabled();
  });

  it("hides delete button and shows 'Deleting...' on main button when OpenClaw status is TERMINATING", () => {
    renderGrid(makeContext({ openclawStatus: OpenClawStatus.TERMINATING }));

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();

    expect(
      openclawCard!.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Deleting...");
    expect(mainButton).toBeDisabled();
  });

  it("shows 'Provisioning...' on main button when OpenClaw status is PROVISIONING", () => {
    renderGrid(makeContext({ openclawStatus: OpenClawStatus.PROVISIONING }));

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provisioning...");
  });

  it("shows 'Provision' on AAP card when ansibleStatus is NEW", () => {
    renderGrid(makeContext({ ansibleStatus: AnsibleStatus.NEW }));

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();

    const mainButton = aapCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provision");
    expect(mainButton.textContent).not.toContain("Provisioning");
  });

  it("shows 'Provisioning...' on AAP card when ansibleStatus is PROVISIONING", () => {
    renderGrid(makeContext({ ansibleStatus: AnsibleStatus.PROVISIONING }));

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();

    const mainButton = aapCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provisioning...");
  });

  it("shows 'Launch' on AAP card when ansibleStatus is READY", () => {
    renderGrid(makeContext({ ansibleStatus: AnsibleStatus.READY }));

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();

    const mainButton = aapCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Launch");
  });

  it("shows 'Re-provision' on AAP card when ansibleStatus is IDLED", () => {
    renderGrid(makeContext({ ansibleStatus: AnsibleStatus.IDLED }));

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();

    const mainButton = aapCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Re-provision");
  });

  it("hides delete button on AAP card when ansibleStatus is NEW", () => {
    renderGrid(makeContext({ ansibleStatus: AnsibleStatus.NEW }));

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();
    expect(
      aapCard!.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();
  });

  it("hides delete button on AAP card when ansibleStatus is NOT_DEPLOYED", () => {
    renderGrid(makeContext({ ansibleStatus: AnsibleStatus.NOT_DEPLOYED }));

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();
    expect(
      aapCard!.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();
  });

  it("shows delete button on AAP card when ansibleStatus is READY", () => {
    renderGrid(makeContext({ ansibleStatus: AnsibleStatus.READY }));

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();
    expect(
      aapCard!.querySelector("[data-testid='delete-instance-button']"),
    ).not.toBeNull();
  });

  it("shows delete button on AAP card when ansibleStatus is PROVISIONING", () => {
    renderGrid(makeContext({ ansibleStatus: AnsibleStatus.PROVISIONING }));

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();
    expect(
      aapCard!.querySelector("[data-testid='delete-instance-button']"),
    ).not.toBeNull();
  });

  it("renders 'Ready' status label on OpenClaw card when status is READY", () => {
    renderGrid(makeContext({ openclawStatus: OpenClawStatus.READY }));

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();
    expect(openclawCard!.textContent).toContain("Ready");

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Launch");
  });

  it("renders 'Idled' status label on OpenClaw card when status is IDLED", () => {
    renderGrid(makeContext({ openclawStatus: OpenClawStatus.IDLED }));

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();
    expect(openclawCard!.textContent).toContain("Idled");

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Re-provision");
  });

  it("renders 'Failed' status label and 'Provision' button on OpenClaw card when status is FAILED", () => {
    renderGrid(makeContext({ openclawStatus: OpenClawStatus.FAILED }));

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();
    expect(openclawCard!.textContent).toContain("Failed");

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provision");
    expect(mainButton.textContent).not.toContain("Provisioning");

    expect(
      openclawCard!.querySelector("[data-testid='delete-instance-button']"),
    ).not.toBeNull();
  });

  it("renders 'Deleting' status label on OpenClaw card when status is DELETING", () => {
    renderGrid(makeContext({ openclawStatus: OpenClawStatus.DELETING }));

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();
    expect(openclawCard!.textContent).toContain("Deleting");
  });

  it("renders 'Ready' status label on AAP card when ansibleStatus is READY", () => {
    renderGrid(makeContext({ ansibleStatus: AnsibleStatus.READY }));

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();
    expect(aapCard!.textContent).toContain("Ready");
  });

  it("renders 'Provisioning' status label on AAP card when ansibleStatus is PROVISIONING", () => {
    renderGrid(makeContext({ ansibleStatus: AnsibleStatus.PROVISIONING }));

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();
    expect(aapCard!.textContent).toContain("Provisioning");
  });

  it("shows default 'Try it' button on non-AAP/non-OpenClaw products regardless of statuses", () => {
    renderGrid(
      makeContext({
        ansibleStatus: AnsibleStatus.READY,
        openclawStatus: OpenClawStatus.READY,
      }),
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

  it("does not disable the main button when OpenClaw status is PROVISIONING", () => {
    renderGrid(makeContext({ openclawStatus: OpenClawStatus.PROVISIONING }));

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton).not.toBeDisabled();
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
        handleAAPInstance,
        disabledIntegrations: [],
      }),
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
        disabledIntegrations: [],
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
        disabledIntegrations: [],
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
        disabledIntegrations: [],
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
        disabledIntegrations: [],
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
        disabledIntegrations: [],
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
        disabledIntegrations: [],
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
