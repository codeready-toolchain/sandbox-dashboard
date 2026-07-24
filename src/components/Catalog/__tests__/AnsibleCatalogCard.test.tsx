import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserFacingError } from "../../../error/UserFacingError";
import { AnalyticsContext } from "../../../hooks/AnalyticsContext";
import {
  AnsibleContext,
  type AnsibleContextType,
} from "../../../hooks/AnsibleContext";
import { PhoneVerificationContext } from "../../../hooks/PhoneVerificationContext";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext, UserSignupPhase } from "../../../hooks/UserContext";
import { readyUserFixture } from "../../../mocks/fixtures";
import { NotificationProvider } from "../../../notifications/NotificationProvider";
import { ProductType, type Product } from "../../../types/product";
import { AAPInstanceErrorType } from "../../../utils/aap-utils";
import { AnsibleCatalogCard } from "../AnsibleCatalogCard";
import { products } from "../productData";

const aapProduct = products.find((p) => p.type === ProductType.AAP)!;

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

function renderCard(
  sandboxOverrides: Partial<UserContextType> = {},
  ansibleOverrides: Partial<AnsibleContextType> = {},
  markProductAsTried?: (product: Product) => void,
) {
  const sandboxCtx = makeSandboxContext(sandboxOverrides);
  const ansibleCtx = makeAnsibleContext(ansibleOverrides);
  const defaultMarkTried = markProductAsTried ?? vi.fn();
  const openPhoneVerificationModal = vi.fn();

  render(
    <NotificationProvider>
      <UserContext.Provider value={sandboxCtx}>
        <AnalyticsContext.Provider value={{ trackAnalytics: vi.fn() }}>
          <AnsibleContext.Provider value={ansibleCtx}>
            <PhoneVerificationContext.Provider
              value={{ openPhoneVerificationModal }}
            >
              <AnsibleCatalogCard
                product={aapProduct}
                isGreenCornerVisible={false}
                markProductAsTried={defaultMarkTried}
              />
            </PhoneVerificationContext.Provider>
          </AnsibleContext.Provider>
        </AnalyticsContext.Provider>
      </UserContext.Provider>
    </NotificationProvider>,
  );

  return {
    sandboxCtx,
    ansibleCtx,
    markProductAsTried: defaultMarkTried,
    openPhoneVerificationModal,
  };
}

describe("AnsibleCatalogCard", () => {
  it("calls provisionInstance and opens info modal on primary button click when user is ready", async () => {
    const provisionInstance = vi.fn().mockResolvedValue(undefined);
    const markProductAsTried = vi.fn();

    renderCard(
      {},
      { provisionInstance, instanceStatus: { kind: "new" } },
      markProductAsTried,
    );

    const button = screen.getByTestId("try-it-button");
    await userEvent.click(button);

    expect(provisionInstance).toHaveBeenCalled();
    expect(markProductAsTried).toHaveBeenCalledWith(aapProduct);
    expect(screen.getByTestId("ansible-launch-info-modal")).toBeInTheDocument();
  });

  it("calls signupUser when signup phase is NOT_STARTED instead of provisioning", async () => {
    const provisionInstance = vi.fn();
    const signupUser = vi.fn();

    renderCard(
      {
        userSignupPhase: UserSignupPhase.NOT_STARTED,
        user: undefined,
        signupUser,
      },
      { provisionInstance, instanceStatus: { kind: "new" } },
    );

    const button = screen.getByTestId("try-it-button");
    await userEvent.click(button);

    expect(signupUser).toHaveBeenCalled();
    expect(provisionInstance).not.toHaveBeenCalled();
  });

  it("opens phone verification modal when signup phase is PENDING_PHONE_VERIFICATION", async () => {
    const provisionInstance = vi.fn();

    const { openPhoneVerificationModal } = renderCard(
      { userSignupPhase: UserSignupPhase.PENDING_PHONE_VERIFICATION },
      { provisionInstance, instanceStatus: { kind: "new" } },
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(openPhoneVerificationModal).toHaveBeenCalledTimes(1);
    expect(provisionInstance).not.toHaveBeenCalled();
  });

  it("does not call provisionInstance when signup phase is not READY", async () => {
    const provisionInstance = vi.fn();
    const markProductAsTried = vi.fn();

    renderCard(
      { userSignupPhase: UserSignupPhase.PROVISIONING },
      { provisionInstance, instanceStatus: { kind: "new" } },
      markProductAsTried,
    );

    const button = screen.getByTestId("try-it-button");
    await userEvent.click(button);

    expect(provisionInstance).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();
  });

  it("opens the delete confirmation modal when delete button is clicked", async () => {
    renderCard({}, { instanceStatus: { kind: "ready" } });

    const deleteButton = screen.getByTestId("delete-instance-button");
    await userEvent.click(deleteButton);

    expect(screen.getByTestId("ansible-delete-modal")).toBeInTheDocument();
  });

  it("does not render delete button when instanceStatus is 'userNotReady' (NOOP provider when proxyURL is missing)", () => {
    renderCard(
      { user: { ...readyUserFixture, proxyURL: "" } },
      { instanceStatus: { kind: "userNotReady" } },
    );

    expect(
      screen.queryByTestId("delete-instance-button"),
    ).not.toBeInTheDocument();
  });

  it("shows 'Provision' button when instanceStatus is 'userNotReady'", () => {
    renderCard({}, { instanceStatus: { kind: "userNotReady" } });

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provision");
    expect(mainButton.textContent).not.toContain("Provisioning");
  });

  it("does not call provisionInstance or open modal when instanceStatus is 'userNotReady'", async () => {
    const provisionInstance = vi.fn().mockResolvedValue(undefined);
    const markProductAsTried = vi.fn();

    renderCard(
      {},
      { provisionInstance, instanceStatus: { kind: "userNotReady" } },
      markProductAsTried,
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(provisionInstance).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("ansible-launch-info-modal"),
    ).not.toBeInTheDocument();
  });

  it("does not render a status label when instanceStatus is 'userNotReady'", () => {
    renderCard({}, { instanceStatus: { kind: "userNotReady" } });

    const card = screen.getByTestId("catalog-card");
    expect(card.textContent).not.toContain("Ready");
    expect(card.textContent).not.toContain("Provisioning");
    expect(card.textContent).not.toContain("Idled");
    expect(card.textContent).not.toContain("Failed");
  });

  it("shows 'Provision' button when instanceStatus is 'new'", () => {
    renderCard({}, { instanceStatus: { kind: "new" } });

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provision");
    expect(mainButton.textContent).not.toContain("Provisioning");
  });

  it("shows 'Provisioning...' button when instanceStatus is 'provisioning'", () => {
    renderCard({}, { instanceStatus: { kind: "provisioning" } });

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provisioning...");
  });

  it("shows 'Launch' button when instanceStatus is 'ready'", () => {
    renderCard({}, { instanceStatus: { kind: "ready" } });

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Launch");
  });

  it("shows 'Re-provision' button when instanceStatus is 'idled'", () => {
    renderCard({}, { instanceStatus: { kind: "idled" } });

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Re-provision");
  });

  it("hides delete button when instanceStatus is 'new'", () => {
    renderCard({}, { instanceStatus: { kind: "new" } });

    expect(
      screen.queryByTestId("delete-instance-button"),
    ).not.toBeInTheDocument();
  });

  it("hides delete button when instanceStatus is 'notDeployed'", () => {
    renderCard({}, { instanceStatus: { kind: "notDeployed" } });

    expect(
      screen.queryByTestId("delete-instance-button"),
    ).not.toBeInTheDocument();
  });

  it("hides delete button when instanceStatus is 'unknown'", () => {
    renderCard({}, { instanceStatus: { kind: "unknown" } });

    expect(
      screen.queryByTestId("delete-instance-button"),
    ).not.toBeInTheDocument();
  });

  it("hides delete button when instanceStatus is 'deleted'", () => {
    renderCard({}, { instanceStatus: { kind: "deleted" } });

    expect(
      screen.queryByTestId("delete-instance-button"),
    ).not.toBeInTheDocument();
  });

  it("shows delete button when instanceStatus is 'ready'", () => {
    renderCard({}, { instanceStatus: { kind: "ready" } });

    expect(screen.getByTestId("delete-instance-button")).toBeInTheDocument();
  });

  it("shows delete button when instanceStatus is 'provisioning'", () => {
    renderCard({}, { instanceStatus: { kind: "provisioning" } });

    expect(screen.getByTestId("delete-instance-button")).toBeInTheDocument();
  });

  it("shows delete button when instanceStatus is 'idled'", () => {
    renderCard({}, { instanceStatus: { kind: "idled" } });

    expect(screen.getByTestId("delete-instance-button")).toBeInTheDocument();
  });

  it("renders 'Ready' status label when instanceStatus is 'ready'", () => {
    renderCard({}, { instanceStatus: { kind: "ready" } });

    const card = screen.getByTestId("catalog-card");
    expect(card.textContent).toContain("Ready");
  });

  it("renders 'Provisioning' status label when instanceStatus is 'provisioning'", () => {
    renderCard({}, { instanceStatus: { kind: "provisioning" } });

    const card = screen.getByTestId("catalog-card");
    expect(card.textContent).toContain("Provisioning");
  });

  it("renders 'Idled' status label when instanceStatus is 'idled'", () => {
    renderCard({}, { instanceStatus: { kind: "idled" } });

    const card = screen.getByTestId("catalog-card");
    expect(card.textContent).toContain("Idled");
  });

  it("does not render a status label when instanceStatus is 'new'", () => {
    renderCard({}, { instanceStatus: { kind: "new" } });

    const card = screen.getByTestId("catalog-card");
    expect(card.textContent).not.toContain("Ready");
    expect(card.textContent).not.toContain("Provisioning");
    expect(card.textContent).not.toContain("Idled");
  });

  it("shows 'Provision' button for 'notDeployed' status", () => {
    renderCard({}, { instanceStatus: { kind: "notDeployed" } });

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provision");
  });

  it("shows 'Provision' button for 'unknown' status", () => {
    renderCard({}, { instanceStatus: { kind: "unknown" } });

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provision");
  });

  it("shows a generic alert when provisionInstance throws a non-UserFacingError", async () => {
    const provisionInstance = vi
      .fn()
      .mockRejectedValue(new Error("unexpected"));

    renderCard({}, { provisionInstance, instanceStatus: { kind: "new" } });

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(provisionInstance).toHaveBeenCalled();
    expect(
      screen.getByText("Unable to provision your instance"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We were unable to provision your instance/),
    ).toBeInTheDocument();
  });

  it("shows a user-facing alert when provisionInstance throws a UserFacingError", async () => {
    const provisionInstance = vi
      .fn()
      .mockRejectedValue(
        new UserFacingError("Provision failed", "Something went wrong"),
      );

    renderCard({}, { provisionInstance, instanceStatus: { kind: "new" } });

    await userEvent.click(screen.getByTestId("try-it-button"));

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

    const button = screen.getByTestId("try-it-button");

    await userEvent.click(button);
    await userEvent.click(button);

    expect(provisionInstance).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveProvision!();
    });
  });

  it("shows 'Provision' button for 'error' status", () => {
    renderCard(
      {},
      {
        instanceStatus: {
          kind: "error",
          errorType: AAPInstanceErrorType.INITIAL_FETCH_FAILED,
        },
      },
    );

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provision");
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

    expect(screen.getByTestId("delete-instance-button")).toBeInTheDocument();
  });

  it("shows 'Deleting...' button for 'deleting' status", () => {
    renderCard({}, { instanceStatus: { kind: "deleting" } });

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Deleting...");
  });

  it("shows delete button when instanceStatus is 'deleting'", () => {
    renderCard({}, { instanceStatus: { kind: "deleting" } });

    expect(screen.getByTestId("delete-instance-button")).toBeInTheDocument();
  });

  it("shows 'Provisioning...' button for 'unidling' status", () => {
    renderCard({}, { instanceStatus: { kind: "unidling" } });

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provisioning...");
  });

  it("shows delete button when instanceStatus is 'unidling'", () => {
    renderCard({}, { instanceStatus: { kind: "unidling" } });

    expect(screen.getByTestId("delete-instance-button")).toBeInTheDocument();
  });

  it("does not call provisionInstance when clicking during provisioning", async () => {
    const provisionInstance = vi.fn().mockResolvedValue(undefined);

    renderCard(
      {},
      { provisionInstance, instanceStatus: { kind: "provisioning" } },
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(provisionInstance).not.toHaveBeenCalled();
    expect(screen.getByTestId("ansible-launch-info-modal")).toBeInTheDocument();
  });

  it("does not call unidleInstance when clicking during unidling", async () => {
    const unidleInstance = vi.fn().mockResolvedValue(undefined);

    renderCard({}, { unidleInstance, instanceStatus: { kind: "unidling" } });

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(unidleInstance).not.toHaveBeenCalled();
    expect(screen.getByTestId("ansible-launch-info-modal")).toBeInTheDocument();
  });

  it("blocks primary button click during deletion", async () => {
    const provisionInstance = vi.fn().mockResolvedValue(undefined);

    renderCard({}, { provisionInstance, instanceStatus: { kind: "deleting" } });

    await userEvent.click(screen.getByTestId("try-it-button"));

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

    const card = screen.getByTestId("catalog-card");
    expect(card.textContent).toContain("Failed");
  });

  it("renders 'Deleting' status label for 'deleting' status", () => {
    renderCard({}, { instanceStatus: { kind: "deleting" } });

    const card = screen.getByTestId("catalog-card");
    expect(card.textContent).toContain("Deleting");
  });

  it("renders 'Provisioning' status label for 'unidling' status", () => {
    renderCard({}, { instanceStatus: { kind: "unidling" } });

    const card = screen.getByTestId("catalog-card");
    expect(card.textContent).toContain("Provisioning");
  });

  it("calls deleteInstance when delete is confirmed and dismisses the modal", async () => {
    const deleteInstance = vi.fn().mockResolvedValue(undefined);

    renderCard({}, { deleteInstance, instanceStatus: { kind: "ready" } });

    const deleteButton = screen.getByTestId("delete-instance-button");
    await userEvent.click(deleteButton);

    expect(screen.getByTestId("ansible-delete-modal")).toBeInTheDocument();

    const confirmDelete = screen.getByTestId("confirm-delete-aap");
    await userEvent.click(confirmDelete);

    expect(deleteInstance).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByTestId("ansible-delete-modal"),
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

    await userEvent.click(screen.getByTestId("delete-instance-button"));
    await userEvent.click(screen.getByTestId("confirm-delete-aap"));

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

    await userEvent.click(screen.getByTestId("delete-instance-button"));
    await userEvent.click(screen.getByTestId("confirm-delete-aap"));

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

    await userEvent.click(screen.getByTestId("delete-instance-button"));

    const confirmButton = screen.getByTestId("confirm-delete-aap");
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

    await userEvent.click(screen.getByTestId("delete-instance-button"));
    await userEvent.click(screen.getByTestId("confirm-delete-aap"));

    expect(
      screen.getByTestId("ansible-automation-platform-error"),
    ).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "Close" });
    await userEvent.click(closeButton);

    expect(
      screen.queryByTestId("ansible-automation-platform-error"),
    ).not.toBeInTheDocument();
  });
});
