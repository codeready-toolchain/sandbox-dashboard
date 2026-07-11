import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AnsibleContext,
  type AnsibleContextType,
} from "../../../hooks/AnsibleContext";
import type { SandboxContextType } from "../../../hooks/SandboxContext";
import { SandboxContext } from "../../../hooks/SandboxContext";
import { readyUserFixture } from "../../../mocks/fixtures";
import { NotificationProvider } from "../../../notifications/NotificationProvider";
import { UserStatus } from "../../../types";
import { ProductType, type Product } from "../../../types/product";
import { AnsibleStatus } from "../../../utils/aap-utils";
import { AnsibleCatalogCard } from "../AnsibleCatalogCard";
import type { EnsureUserIsReadyResult } from "../catalogCardTypes";
import { products } from "../productData";

const aapProduct = products.find((p) => p.type === ProductType.AAP)!;

function makeSandboxContext(
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

function renderCard(
  sandboxOverrides: Partial<SandboxContextType> = {},
  ansibleOverrides: Partial<AnsibleContextType> = {},
  ensureUserIsReady?: () => Promise<EnsureUserIsReadyResult>,
  markProductAsTried?: (product: Product) => void,
) {
  const sandboxCtx = makeSandboxContext(sandboxOverrides);
  const ansibleCtx = makeAnsibleContext(ansibleOverrides);
  const defaultEnsureReady =
    ensureUserIsReady ??
    vi.fn().mockResolvedValue({
      ready: true,
      namespace: readyUserFixture.defaultUserNamespace,
    });
  const defaultMarkTried = markProductAsTried ?? vi.fn();

  render(
    <NotificationProvider>
      <SandboxContext.Provider value={sandboxCtx}>
        <AnsibleContext.Provider value={ansibleCtx}>
          <AnsibleCatalogCard
            product={aapProduct}
            isGreenCornerVisible={false}
            ensureUserIsReady={defaultEnsureReady}
            markProductAsTried={defaultMarkTried}
          />
        </AnsibleContext.Provider>
      </SandboxContext.Provider>
    </NotificationProvider>,
  );

  return {
    sandboxCtx,
    ansibleCtx,
    ensureUserIsReady: defaultEnsureReady,
    markProductAsTried: defaultMarkTried,
  };
}

describe("AnsibleCatalogCard", () => {
  it("calls handleAAPInstance and opens info modal on primary button click when user is ready", async () => {
    const handleAAPInstance = vi.fn().mockResolvedValue(undefined);
    const markProductAsTried = vi.fn();
    const ensureUserIsReady = vi.fn().mockResolvedValue({
      ready: true,
      namespace: "test-ns",
    });

    renderCard(
      {},
      { handleAAPInstance, ansibleStatus: AnsibleStatus.NEW },
      ensureUserIsReady,
      markProductAsTried,
    );

    const button = screen.getByTestId("try-it-button");
    await userEvent.click(button);

    expect(ensureUserIsReady).toHaveBeenCalled();
    expect(handleAAPInstance).toHaveBeenCalledWith("test-ns");
    expect(markProductAsTried).toHaveBeenCalledWith(aapProduct);
    expect(screen.getByTestId("ansible-launch-info-modal")).toBeInTheDocument();
  });

  it("does not call handleAAPInstance when ensureUserIsReady returns not ready", async () => {
    const handleAAPInstance = vi.fn();
    const markProductAsTried = vi.fn();
    const ensureUserIsReady = vi.fn().mockResolvedValue({ ready: false });

    renderCard(
      {},
      { handleAAPInstance, ansibleStatus: AnsibleStatus.NEW },
      ensureUserIsReady,
      markProductAsTried,
    );

    const button = screen.getByTestId("try-it-button");
    await userEvent.click(button);

    expect(ensureUserIsReady).toHaveBeenCalled();
    expect(handleAAPInstance).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();
  });

  it("opens the delete confirmation modal when delete button is clicked", async () => {
    renderCard({}, { ansibleStatus: AnsibleStatus.READY });

    const deleteButton = screen.getByTestId("delete-instance-button");
    await userEvent.click(deleteButton);

    expect(screen.getByTestId("ansible-delete-modal")).toBeInTheDocument();
  });

  it("does not render delete button or modal when userData is missing proxyURL", () => {
    renderCard(
      { userData: { ...readyUserFixture, proxyURL: "" } },
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
    const ensureUserIsReady = vi.fn().mockResolvedValue({
      ready: true,
      namespace: "test-ns",
    });

    renderCard(
      {},
      {
        ansibleStatus: AnsibleStatus.READY,
        ansibleUIUser: "my-admin",
        ansibleUIPassword: "my-password",
        ansibleUILink: "https://aap.test.com",
        handleAAPInstance: vi.fn().mockResolvedValue(undefined),
      },
      ensureUserIsReady,
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
