import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  AuthenticatedContext,
  type AuthenticatedContextValue,
} from "../../../auth/AuthenticatedContext";
import { UserFacingError } from "../../../error/UserFacingError";
import {
  AnalyticsContext,
  noopAnalyticsContext,
} from "../../../hooks/AnalyticsContext";
import {
  AnsibleContext,
  type AnsibleContextType,
} from "../../../hooks/AnsibleContext";
import { NotificationProvider } from "../../../hooks/NotificationProvider";
import { PhoneVerificationContext } from "../../../hooks/PhoneVerificationContext";
import {
  SignupActionContext,
  type SignupActionContextType,
} from "../../../hooks/signupAction/SignupActionContext";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext } from "../../../hooks/UserContext";
import { UserSignupPhase } from "../../../hooks/userSignupPhase";
import { readyUserFixture } from "../../../mocks/fixtures";
import { type Product, ProductType } from "../../../types/product";
import { AAPInstanceErrorType } from "../../../utils/aap-utils";
import { AnsibleCatalogCard } from "../AnsibleCatalogCard";
import { products } from "../productData";

const aapProduct = products.find((p) => p.type === ProductType.AAP)!;
const trackProductAction = vi.fn();

const authenticatedUser: AuthenticatedContextValue = {
  email: "johndoe@redhat.com",
  familyName: "Doe",
  givenName: "John",
  logout: vi.fn(),
  token: "mock-token",
  username: "johndoe",
};

function makeSignupActionContext(
  overrides: Partial<SignupActionContextType> = {},
): SignupActionContextType {
  return {
    isSignupInProgress: false,
    signupAndRun: vi.fn(),
    registerAction: vi.fn(),
    ...overrides,
  };
}

function makeSandboxContext(
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

function renderCardTree(
  sandboxCtx: UserContextType,
  ansibleCtx: AnsibleContextType,
  signupActionCtx: SignupActionContextType,
  markProductAsTried: (product: Product) => void,
) {
  return (
    <AuthenticatedContext.Provider value={authenticatedUser}>
      <NotificationProvider>
        <UserContext.Provider value={sandboxCtx}>
          <PhoneVerificationContext.Provider
            value={{ openPhoneVerificationModal: vi.fn() }}
          >
            <SignupActionContext.Provider value={signupActionCtx}>
              <AnalyticsContext.Provider
                value={{ ...noopAnalyticsContext, trackProductAction }}
              >
                <AnsibleContext.Provider value={ansibleCtx}>
                  <AnsibleCatalogCard
                    product={aapProduct}
                    isTriedProductHintVisible={false}
                    markProductAsTried={markProductAsTried}
                  />
                </AnsibleContext.Provider>
              </AnalyticsContext.Provider>
            </SignupActionContext.Provider>
          </PhoneVerificationContext.Provider>
        </UserContext.Provider>
      </NotificationProvider>
    </AuthenticatedContext.Provider>
  );
}

function renderCard(
  sandboxOverrides: Partial<UserContextType> = {},
  ansibleOverrides: Partial<AnsibleContextType> = {},
  markProductAsTried?: (product: Product) => void,
  signupActionOverrides: Partial<SignupActionContextType> = {},
) {
  const sandboxCtx = makeSandboxContext(sandboxOverrides);
  const ansibleCtx = makeAnsibleContext(ansibleOverrides);
  const signupActionCtx = makeSignupActionContext(signupActionOverrides);
  const defaultMarkTried = markProductAsTried ?? vi.fn();

  const view = render(
    renderCardTree(sandboxCtx, ansibleCtx, signupActionCtx, defaultMarkTried),
  );

  return {
    sandboxCtx,
    ansibleCtx,
    markProductAsTried: defaultMarkTried,
    rerenderCard: (
      nextSandbox: Partial<UserContextType> = {},
      nextAnsible: Partial<AnsibleContextType> = {},
    ) => {
      view.rerender(
        renderCardTree(
          makeSandboxContext({
            ...sandboxOverrides,
            ...nextSandbox,
          }),
          makeAnsibleContext({
            ...ansibleOverrides,
            ...nextAnsible,
          }),
          signupActionCtx,
          defaultMarkTried,
        ),
      );
    },
  };
}

/**
 * Returns the rendered product card article element.
 */
function getCard() {
  return screen.getByRole("article", {
    name: "Ansible Automation Platform product card",
  });
}

/**
 * Returns the primary action button inside the card by matching its
 * accessible name against the provided label text.
 */
function getPrimaryButton(name: RegExp | string) {
  return within(getCard()).getByRole("button", { name });
}

describe("AnsibleCatalogCard", () => {
  afterEach(() => {
    trackProductAction.mockClear();
    vi.useRealTimers();
  });

  it("calls provisionInstance and opens info modal on primary button click when user is ready", async () => {
    const provisionInstance = vi.fn().mockResolvedValue(undefined);
    const markProductAsTried = vi.fn();

    renderCard(
      {},
      { provisionInstance, instanceStatus: { kind: "new" } },
      markProductAsTried,
    );

    await userEvent.click(getPrimaryButton("Set up"));

    expect(provisionInstance).toHaveBeenCalled();
    expect(trackProductAction).toHaveBeenCalledWith(aapProduct, "set-up");
    expect(markProductAsTried).toHaveBeenCalledWith(aapProduct);
    expect(
      screen.getByRole("dialog", { name: "Ansible Automation Platform" }),
    ).toBeInTheDocument();
  });

  it("opens the delete confirmation modal when delete button is clicked", async () => {
    renderCard({}, { instanceStatus: { kind: "ready" } });

    await userEvent.click(
      screen.getByRole("button", { name: "Delete instance" }),
    );

    expect(
      screen.getByRole("dialog", {
        name: "Delete Ansible Automation Platform instance",
      }),
    ).toBeInTheDocument();
  });

  it("does not render delete button when instanceStatus is 'userNotReady' (NOOP provider when proxyURL is missing)", () => {
    renderCard(
      { user: { ...readyUserFixture, proxyURL: "" } },
      { instanceStatus: { kind: "userNotReady" } },
    );

    expect(
      screen.queryByRole("button", { name: "Delete instance" }),
    ).not.toBeInTheDocument();
  });

  it("shows 'Loading' button when instanceStatus is 'initialFetch'", () => {
    renderCard({}, { instanceStatus: { kind: "initialFetch" } });

    const button = getPrimaryButton(/Loading/);
    expect(button).toBeDisabled();
  });

  it("does not render delete button when instanceStatus is 'initialFetch'", () => {
    renderCard({}, { instanceStatus: { kind: "initialFetch" } });

    expect(
      screen.queryByRole("button", { name: "Delete instance" }),
    ).not.toBeInTheDocument();
  });

  it("renders 'Loading' status label when instanceStatus is 'initialFetch'", () => {
    renderCard({}, { instanceStatus: { kind: "initialFetch" } });

    const card = getCard();
    expect(card.textContent).toContain("Loading");
    expect(card.textContent).not.toContain("Ready");
    expect(card.textContent).not.toContain("Setting up");
    expect(card.textContent).not.toContain("Stopped");
    expect(card.textContent).not.toContain("Failed");
  });

  it("shows 'Set up' button when instanceStatus is 'userNotReady'", () => {
    renderCard({}, { instanceStatus: { kind: "userNotReady" } });

    const button = getPrimaryButton("Set up");
    expect(button.textContent).toContain("Set up");
    expect(button.textContent).not.toContain("Setting up");
  });

  it("does not call provisionInstance or open modal when instanceStatus is 'userNotReady'", async () => {
    const provisionInstance = vi.fn().mockResolvedValue(undefined);
    const markProductAsTried = vi.fn();

    renderCard(
      {},
      { provisionInstance, instanceStatus: { kind: "userNotReady" } },
      markProductAsTried,
    );

    await userEvent.click(getPrimaryButton("Set up"));

    expect(provisionInstance).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Ansible Automation Platform" }),
    ).not.toBeInTheDocument();
  });

  it("does not render a status label when instanceStatus is 'userNotReady'", () => {
    renderCard({}, { instanceStatus: { kind: "userNotReady" } });

    const card = getCard();
    expect(card.textContent).not.toContain("Ready");
    expect(card.textContent).not.toContain("Setting up");
    expect(card.textContent).not.toContain("Stopped");
    expect(card.textContent).not.toContain("Failed");
  });

  it("shows 'Set up' button when instanceStatus is 'new'", () => {
    renderCard({}, { instanceStatus: { kind: "new" } });

    const button = getPrimaryButton("Set up");
    expect(button.textContent).toContain("Set up");
    expect(button.textContent).not.toContain("Setting up");
  });

  it("shows 'Setting up...' button when instanceStatus is 'provisioning'", () => {
    renderCard({}, { instanceStatus: { kind: "provisioning" } });

    expect(getPrimaryButton(/Setting up/).textContent).toContain(
      "Setting up...",
    );
  });

  it("shows 'Launch' button when instanceStatus is 'ready'", async () => {
    renderCard({}, { instanceStatus: { kind: "ready" } });

    expect(getPrimaryButton("Launch").textContent).toContain("Launch");
    await userEvent.click(getPrimaryButton("Launch"));
    expect(trackProductAction).not.toHaveBeenCalled();
  });

  it("shows 'Resume' button when instanceStatus is 'idled'", () => {
    renderCard({}, { instanceStatus: { kind: "idled" } });

    expect(getPrimaryButton("Resume").textContent).toContain("Resume");
  });

  it("hides delete button when instanceStatus is 'new'", () => {
    renderCard({}, { instanceStatus: { kind: "new" } });

    expect(
      screen.queryByRole("button", { name: "Delete instance" }),
    ).not.toBeInTheDocument();
  });

  it("hides delete button when instanceStatus is 'notDeployed'", () => {
    renderCard({}, { instanceStatus: { kind: "notDeployed" } });

    expect(
      screen.queryByRole("button", { name: "Delete instance" }),
    ).not.toBeInTheDocument();
  });

  it("hides delete button when instanceStatus is 'unknown'", () => {
    renderCard({}, { instanceStatus: { kind: "unknown" } });

    expect(
      screen.queryByRole("button", { name: "Delete instance" }),
    ).not.toBeInTheDocument();
  });

  it("hides delete button when instanceStatus is 'deleted'", () => {
    renderCard({}, { instanceStatus: { kind: "deleted" } });

    expect(
      screen.queryByRole("button", { name: "Delete instance" }),
    ).not.toBeInTheDocument();
  });

  it("shows delete button when instanceStatus is 'ready'", () => {
    renderCard({}, { instanceStatus: { kind: "ready" } });

    expect(
      screen.getByRole("button", { name: "Delete instance" }),
    ).toBeInTheDocument();
  });

  it("shows delete button when instanceStatus is 'provisioning'", () => {
    renderCard({}, { instanceStatus: { kind: "provisioning" } });

    expect(
      screen.getByRole("button", { name: "Delete instance" }),
    ).toBeInTheDocument();
  });

  it("shows delete button when instanceStatus is 'idled'", () => {
    renderCard({}, { instanceStatus: { kind: "idled" } });

    expect(
      screen.getByRole("button", { name: "Delete instance" }),
    ).toBeInTheDocument();
  });

  it("renders 'Ready' status label when instanceStatus is 'ready'", () => {
    renderCard({}, { instanceStatus: { kind: "ready" } });

    expect(getCard().textContent).toContain("Ready");
  });

  it("renders 'Setting up' status label when instanceStatus is 'provisioning'", () => {
    renderCard({}, { instanceStatus: { kind: "provisioning" } });

    expect(getCard().textContent).toContain("Setting up");
  });

  it("renders 'Stopped' status label when instanceStatus is 'idled'", () => {
    renderCard({}, { instanceStatus: { kind: "idled" } });

    expect(getCard().textContent).toContain("Stopped");
  });

  it("does not render a status label when instanceStatus is 'new'", () => {
    renderCard({}, { instanceStatus: { kind: "new" } });

    const card = getCard();
    expect(card.textContent).not.toContain("Ready");
    expect(card.textContent).not.toContain("Setting up");
    expect(card.textContent).not.toContain("Stopped");
  });

  it("shows 'Set up' button for 'notDeployed' status", () => {
    renderCard({}, { instanceStatus: { kind: "notDeployed" } });

    expect(getPrimaryButton("Set up").textContent).toContain("Set up");
  });

  it("shows 'Set up' button for 'unknown' status", () => {
    renderCard({}, { instanceStatus: { kind: "unknown" } });

    expect(getPrimaryButton("Set up").textContent).toContain("Set up");
  });

  it("shows a generic alert when provisionInstance throws a non-UserFacingError", async () => {
    const provisionInstance = vi
      .fn()
      .mockRejectedValue(new Error("unexpected"));

    renderCard({}, { provisionInstance, instanceStatus: { kind: "new" } });

    await userEvent.click(getPrimaryButton("Set up"));

    expect(provisionInstance).toHaveBeenCalled();
    expect(
      screen.getByText("Unable to set up your instance"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We were unable to set up your instance/),
    ).toBeInTheDocument();
  });

  it("shows a user-facing alert when provisionInstance throws a UserFacingError", async () => {
    const provisionInstance = vi
      .fn()
      .mockRejectedValue(
        new UserFacingError("Provision failed", "Something went wrong"),
      );

    renderCard({}, { provisionInstance, instanceStatus: { kind: "new" } });

    await userEvent.click(getPrimaryButton("Set up"));

    expect(provisionInstance).toHaveBeenCalled();
    expect(screen.getByText("Provision failed")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("prevents double-click on provision button via in-flight guard", async () => {
    let resolveProvision: () => void;
    const provisionInstance = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveProvision = resolve;
        }),
    );

    renderCard({}, { provisionInstance, instanceStatus: { kind: "new" } });

    const button = getPrimaryButton("Set up");

    await userEvent.click(button);
    await userEvent.click(button);

    expect(provisionInstance).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveProvision!();
    });
  });

  it("shows 'Set up' button for 'error' status", () => {
    renderCard(
      {},
      {
        instanceStatus: {
          kind: "error",
          errorType: AAPInstanceErrorType.INITIAL_FETCH_FAILED,
        },
      },
    );

    expect(getPrimaryButton("Set up").textContent).toContain("Set up");
  });

  it("shows delete button when instanceStatus is 'error'", () => {
    renderCard(
      {},
      {
        instanceStatus: {
          kind: "error",
          errorType: AAPInstanceErrorType.INITIAL_FETCH_FAILED,
        },
      },
    );

    expect(
      screen.getByRole("button", { name: "Delete instance" }),
    ).toBeInTheDocument();
  });

  it("shows 'Deleting...' button for 'deleting' status", () => {
    renderCard({}, { instanceStatus: { kind: "deleting" } });

    expect(getPrimaryButton(/Deleting/).textContent).toContain("Deleting...");
  });

  it("shows delete button when instanceStatus is 'deleting'", () => {
    renderCard({}, { instanceStatus: { kind: "deleting" } });

    expect(
      screen.getByRole("button", { name: "Delete instance" }),
    ).toBeInTheDocument();
  });

  it("shows 'Resuming...' button for 'unidling' status", () => {
    renderCard({}, { instanceStatus: { kind: "unidling" } });

    expect(getPrimaryButton(/Resuming/).textContent).toContain("Resuming...");
  });

  it("shows delete button when instanceStatus is 'unidling'", () => {
    renderCard({}, { instanceStatus: { kind: "unidling" } });

    expect(
      screen.getByRole("button", { name: "Delete instance" }),
    ).toBeInTheDocument();
  });

  it("does not call provisionInstance when clicking during provisioning", async () => {
    const provisionInstance = vi.fn().mockResolvedValue(undefined);

    renderCard(
      {},
      { provisionInstance, instanceStatus: { kind: "provisioning" } },
    );

    await userEvent.click(getPrimaryButton(/Setting up/));

    expect(provisionInstance).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Ansible Automation Platform" }),
    ).toBeInTheDocument();
  });

  it("does not call unidleInstance when clicking during unidling", async () => {
    const unidleInstance = vi.fn().mockResolvedValue(undefined);

    renderCard({}, { unidleInstance, instanceStatus: { kind: "unidling" } });

    await userEvent.click(getPrimaryButton(/Resuming/));

    expect(unidleInstance).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Ansible Automation Platform" }),
    ).toBeInTheDocument();
  });

  it("shows a toast when unidleInstance throws a UserFacingError", async () => {
    const unidleInstance = vi
      .fn()
      .mockRejectedValue(
        new UserFacingError("Reprovision failed", "Could not unidle"),
      );

    renderCard({}, { unidleInstance, instanceStatus: { kind: "idled" } });

    await userEvent.click(getPrimaryButton("Resume"));

    expect(unidleInstance).toHaveBeenCalled();
    expect(screen.getByText("Reprovision failed")).toBeInTheDocument();
    expect(screen.getByText("Could not unidle")).toBeInTheDocument();
  });

  it("stores provisioningError when unidleInstance throws a non-UserFacingError", async () => {
    const unidleInstance = vi
      .fn()
      .mockRejectedValue(new Error("network failure"));

    renderCard({}, { unidleInstance, instanceStatus: { kind: "idled" } });

    await userEvent.click(getPrimaryButton("Resume"));

    expect(unidleInstance).toHaveBeenCalled();
    expect(
      screen.getByText("Unable to resume your instance"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We were unable to resume your instance/),
    ).toBeInTheDocument();
  });

  it("blocks primary button click during deletion", async () => {
    const provisionInstance = vi.fn().mockResolvedValue(undefined);

    renderCard({}, { provisionInstance, instanceStatus: { kind: "deleting" } });

    await userEvent.click(getPrimaryButton(/Deleting/));

    expect(provisionInstance).not.toHaveBeenCalled();
  });

  it("renders 'Failed' status label for 'error' status", () => {
    renderCard(
      {},
      {
        instanceStatus: {
          kind: "error",
          errorType: AAPInstanceErrorType.INITIAL_FETCH_FAILED,
        },
      },
    );

    expect(getCard().textContent).toContain("Failed");
  });

  it("renders 'Deleting' status label for 'deleting' status", () => {
    renderCard({}, { instanceStatus: { kind: "deleting" } });

    expect(getCard().textContent).toContain("Deleting");
  });

  it("renders 'Resuming' status label for 'unidling' status", () => {
    renderCard({}, { instanceStatus: { kind: "unidling" } });

    expect(getCard().textContent).toContain("Resuming");
  });

  it("calls deleteInstance when delete is confirmed and dismisses the modal", async () => {
    const deleteInstance = vi.fn().mockResolvedValue(undefined);

    renderCard({}, { deleteInstance, instanceStatus: { kind: "ready" } });

    await userEvent.click(
      screen.getByRole("button", { name: "Delete instance" }),
    );

    const deleteModal = screen.getByRole("dialog", {
      name: "Delete Ansible Automation Platform instance",
    });
    expect(deleteModal).toBeInTheDocument();

    await userEvent.click(
      within(deleteModal).getByRole("button", { name: "Delete" }),
    );

    expect(deleteInstance).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("dialog", {
        name: "Delete Ansible Automation Platform instance",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows alert when deleteInstance throws a UserFacingError", async () => {
    const deleteInstance = vi
      .fn()
      .mockRejectedValue(
        new UserFacingError(
          "Unable to delete",
          "Deletion failed",
          undefined,
          "Tech details",
        ),
      );

    renderCard({}, { deleteInstance, instanceStatus: { kind: "ready" } });

    await userEvent.click(
      screen.getByRole("button", { name: "Delete instance" }),
    );
    const deleteModal = screen.getByRole("dialog", {
      name: "Delete Ansible Automation Platform instance",
    });
    await userEvent.click(
      within(deleteModal).getByRole("button", { name: "Delete" }),
    );

    expect(deleteInstance).toHaveBeenCalledTimes(1);
    const errorAlert = screen.getByTestId("ansible-automation-platform-error");
    expect(
      within(errorAlert).getByText("Unable to delete"),
    ).toBeInTheDocument();
    expect(within(errorAlert).getByText(/Deletion failed/)).toBeInTheDocument();
  });

  it("shows generic alert when deleteInstance throws a non-UserFacingError", async () => {
    const deleteInstance = vi
      .fn()
      .mockRejectedValue(new Error("network error"));

    renderCard({}, { deleteInstance, instanceStatus: { kind: "ready" } });

    await userEvent.click(
      screen.getByRole("button", { name: "Delete instance" }),
    );
    const deleteModal = screen.getByRole("dialog", {
      name: "Delete Ansible Automation Platform instance",
    });
    await userEvent.click(
      within(deleteModal).getByRole("button", { name: "Delete" }),
    );

    expect(deleteInstance).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("Unable to delete your instance"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /An unexpected error occurred while deleting your AAP instance/,
      ),
    ).toBeInTheDocument();
  });

  it("prevents double-click on delete button via in-flight guard", async () => {
    let resolveDelete: () => void;
    const deleteInstance = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    renderCard({}, { deleteInstance, instanceStatus: { kind: "ready" } });

    await userEvent.click(
      screen.getByRole("button", { name: "Delete instance" }),
    );

    const deleteModal = screen.getByRole("dialog", {
      name: "Delete Ansible Automation Platform instance",
    });
    const confirmButton = within(deleteModal).getByRole("button", {
      name: "Delete",
    });
    await userEvent.click(confirmButton);
    await userEvent.click(confirmButton);

    expect(deleteInstance).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDelete!();
    });
  });

  it("clears deletionError when delete modal is closed and instance is ready", async () => {
    const deleteInstance = vi
      .fn()
      .mockRejectedValueOnce(
        new UserFacingError(
          "Unable to delete",
          "Deletion failed",
          undefined,
          "Tech details",
        ),
      )
      .mockResolvedValueOnce(undefined);

    renderCard({}, { deleteInstance, instanceStatus: { kind: "ready" } });

    await userEvent.click(
      screen.getByRole("button", { name: "Delete instance" }),
    );
    const deleteModal = screen.getByRole("dialog", {
      name: "Delete Ansible Automation Platform instance",
    });
    await userEvent.click(
      within(deleteModal).getByRole("button", { name: "Delete" }),
    );

    expect(
      screen.getByTestId("ansible-automation-platform-error"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(
      screen.queryByTestId("ansible-automation-platform-error"),
    ).not.toBeInTheDocument();
  });

  it("disables primary button during INITIAL_FETCH", () => {
    renderCard(
      { userSignupPhase: UserSignupPhase.INITIAL_FETCH },
      { instanceStatus: { kind: "new" } },
    );

    // The spinner is shown, making the accessible name include
    // "Loading...".
    expect(getPrimaryButton(/Set up/)).toBeDisabled();
  });
});
