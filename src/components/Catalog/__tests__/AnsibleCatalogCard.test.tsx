import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AnsibleContext,
  type AnsibleContextType,
} from "../../../hooks/AnsibleContext";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext, UserSignupPhase } from "../../../hooks/UserContext";
import { PhoneVerificationContext } from "../../../hooks/PhoneVerificationContext";
import { readyUserFixture } from "../../../mocks/fixtures";
import { NotificationProvider } from "../../../notifications/NotificationProvider";
import { ProductType, type Product } from "../../../types/product";
import { AnsibleStatus } from "../../../utils/aap-utils";
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
  it("calls handleAAPInstance and opens info modal on primary button click when user is ready", async () => {
    const handleAAPInstance = vi.fn().mockResolvedValue(undefined);
    const markProductAsTried = vi.fn();

    renderCard(
      {},
      { handleAAPInstance, ansibleStatus: AnsibleStatus.NEW },
      markProductAsTried,
    );

    const button = screen.getByTestId("try-it-button");
    await userEvent.click(button);

    expect(handleAAPInstance).toHaveBeenCalledWith(
      readyUserFixture.defaultUserNamespace,
    );
    expect(markProductAsTried).toHaveBeenCalledWith(aapProduct);
    expect(screen.getByTestId("ansible-launch-info-modal")).toBeInTheDocument();
  });

  it("calls signupUser when signup phase is NOT_STARTED instead of provisioning", async () => {
    const handleAAPInstance = vi.fn();
    const signupUser = vi.fn();

    renderCard(
      {
        userSignupPhase: UserSignupPhase.NOT_STARTED,
        user: undefined,
        signupUser,
      },
      { handleAAPInstance, ansibleStatus: AnsibleStatus.NEW },
    );

    const button = screen.getByTestId("try-it-button");
    await userEvent.click(button);

    expect(signupUser).toHaveBeenCalled();
    expect(handleAAPInstance).not.toHaveBeenCalled();
  });

  it("opens phone verification modal when signup phase is PENDING_PHONE_VERIFICATION", async () => {
    const handleAAPInstance = vi.fn();

    const { openPhoneVerificationModal } = renderCard(
      { userSignupPhase: UserSignupPhase.PENDING_PHONE_VERIFICATION },
      { handleAAPInstance, ansibleStatus: AnsibleStatus.NEW },
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(openPhoneVerificationModal).toHaveBeenCalledTimes(1);
    expect(handleAAPInstance).not.toHaveBeenCalled();
  });

  it("does not call handleAAPInstance when signup phase is not READY", async () => {
    const handleAAPInstance = vi.fn();
    const markProductAsTried = vi.fn();

    renderCard(
      { userSignupPhase: UserSignupPhase.PROVISIONING },
      { handleAAPInstance, ansibleStatus: AnsibleStatus.NEW },
      markProductAsTried,
    );

    const button = screen.getByTestId("try-it-button");
    await userEvent.click(button);

    expect(handleAAPInstance).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();
  });

  it("opens the delete confirmation modal when delete button is clicked", async () => {
    renderCard({}, { ansibleStatus: AnsibleStatus.READY });

    const deleteButton = screen.getByTestId("delete-instance-button");
    await userEvent.click(deleteButton);

    expect(screen.getByTestId("ansible-delete-modal")).toBeInTheDocument();
  });

  it("does not render delete button or modal when user is missing proxyURL", () => {
    renderCard(
      { user: { ...readyUserFixture, proxyURL: "" } },
      { ansibleStatus: AnsibleStatus.READY },
    );

    expect(
      screen.queryByTestId("delete-instance-button"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("ansible-delete-modal"),
    ).not.toBeInTheDocument();
  });

  it("renders info modal with correct credentials when status is READY", async () => {
    renderCard(
      {},
      {
        ansibleStatus: AnsibleStatus.READY,
        ansibleUIUser: "my-admin",
        ansibleUIPassword: "my-password",
        ansibleUILink: "https://aap.test.com",
        handleAAPInstance: vi.fn().mockResolvedValue(undefined),
      },
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

    const modal = screen.getByTestId("ansible-launch-info-modal");
    expect(modal).toBeInTheDocument();

    const usernameField = screen.getByTestId("ansible-username");
    const usernameInput = usernameField.querySelector(
      "input",
    ) as HTMLInputElement;
    expect(usernameInput.value).toBe("my-admin");

    const getStartedButton = screen.getByTestId("get-started-button");
    expect(getStartedButton).toHaveAttribute("href", "https://aap.test.com");

    await userEvent.click(screen.getByTestId("toggle-password-visibility"));
    const passwordField = screen.getByTestId(
      "ansible-password-field",
    ) as HTMLInputElement;
    expect(passwordField.value).toBe("my-password");
  });

  it("shows 'Provision' button when ansibleStatus is NEW", () => {
    renderCard({}, { ansibleStatus: AnsibleStatus.NEW });

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provision");
    expect(mainButton.textContent).not.toContain("Provisioning");
  });

  it("shows 'Provisioning...' button when ansibleStatus is PROVISIONING", () => {
    renderCard({}, { ansibleStatus: AnsibleStatus.PROVISIONING });

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provisioning...");
  });

  it("shows 'Launch' button when ansibleStatus is READY", () => {
    renderCard({}, { ansibleStatus: AnsibleStatus.READY });

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Launch");
  });

  it("shows 'Re-provision' button when ansibleStatus is IDLED", () => {
    renderCard({}, { ansibleStatus: AnsibleStatus.IDLED });

    const mainButton = screen.getByTestId("try-it-button") as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Re-provision");
  });

  it("hides delete button when ansibleStatus is NEW", () => {
    renderCard({}, { ansibleStatus: AnsibleStatus.NEW });

    expect(
      screen.queryByTestId("delete-instance-button"),
    ).not.toBeInTheDocument();
  });

  it("hides delete button when ansibleStatus is NOT_DEPLOYED", () => {
    renderCard({}, { ansibleStatus: AnsibleStatus.NOT_DEPLOYED });

    expect(
      screen.queryByTestId("delete-instance-button"),
    ).not.toBeInTheDocument();
  });

  it("shows delete button when ansibleStatus is READY", () => {
    renderCard({}, { ansibleStatus: AnsibleStatus.READY });

    expect(screen.getByTestId("delete-instance-button")).toBeInTheDocument();
  });

  it("shows delete button when ansibleStatus is PROVISIONING", () => {
    renderCard({}, { ansibleStatus: AnsibleStatus.PROVISIONING });

    expect(screen.getByTestId("delete-instance-button")).toBeInTheDocument();
  });

  it("renders 'Ready' status label when ansibleStatus is READY", () => {
    renderCard({}, { ansibleStatus: AnsibleStatus.READY });

    const card = screen.getByTestId("catalog-card");
    expect(card.textContent).toContain("Ready");
  });

  it("renders 'Provisioning' status label when ansibleStatus is PROVISIONING", () => {
    renderCard({}, { ansibleStatus: AnsibleStatus.PROVISIONING });

    const card = screen.getByTestId("catalog-card");
    expect(card.textContent).toContain("Provisioning");
  });
});
