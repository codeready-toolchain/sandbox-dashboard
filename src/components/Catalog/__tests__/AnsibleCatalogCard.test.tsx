import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SandboxContextType } from "../../../hooks/SandboxContext";
import { SandboxContext } from "../../../hooks/SandboxContext";
import { Product } from "../../../hooks/useProductURLs";
import { readyUserFixture } from "../../../mocks/fixtures";
import { UserStatus } from "../../../types";
import { AnsibleStatus } from "../../../utils/aap-utils";
import { OpenClawStatus } from "../../../utils/openclaw-utils";
import type { EnsureUserIsReadyResult } from "../catalogCardTypes";
import { AnsibleCatalogCard } from "../AnsibleCatalogCard";
import { productData } from "../productData";

const aapProduct = productData.find((p) => p.id === Product.AAP)!;

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
    ansibleUIUser: "admin",
    ansibleUIPassword: "secret123",
    ansibleUILink: "https://aap.example.com",
    ansibleError: null,
    ansibleStatus: AnsibleStatus.READY,
    openclawData: undefined,
    openclawError: null,
    openclawStatus: OpenClawStatus.NEW,
    openclawUILink: undefined,
    handleOpenClawInstance: vi.fn(),
    deleteOpenClaw: vi.fn(),
    disabledIntegrations: [],
    ...overrides,
  };
}

function renderCard(
  contextOverrides: Partial<SandboxContextType> = {},
  ensureUserIsReady?: () => Promise<EnsureUserIsReadyResult>,
  markProductAsTried?: (product: Product) => void,
) {
  const ctx = makeContext(contextOverrides);
  const defaultEnsureReady =
    ensureUserIsReady ??
    vi.fn().mockResolvedValue({
      ready: true,
      namespace: readyUserFixture.defaultUserNamespace,
    });
  const defaultMarkTried = markProductAsTried ?? vi.fn();

  render(
    <SandboxContext.Provider value={ctx}>
      <AnsibleCatalogCard
        product={aapProduct}
        isGreenCornerVisible={false}
        ensureUserIsReady={defaultEnsureReady}
        markProductAsTried={defaultMarkTried}
      />
    </SandboxContext.Provider>,
  );

  return {
    ctx,
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
      { handleAAPInstance, ansibleStatus: AnsibleStatus.NEW },
      ensureUserIsReady,
      markProductAsTried,
    );

    const button = screen.getByTestId("try-it-button");
    await userEvent.click(button);

    expect(ensureUserIsReady).toHaveBeenCalled();
    expect(handleAAPInstance).toHaveBeenCalledWith("test-ns");
    expect(markProductAsTried).toHaveBeenCalledWith(Product.AAP);
    expect(screen.getByTestId("ansible-launch-info-modal")).toBeInTheDocument();
  });

  it("does not call handleAAPInstance when ensureUserIsReady returns not ready", async () => {
    const handleAAPInstance = vi.fn();
    const markProductAsTried = vi.fn();
    const ensureUserIsReady = vi.fn().mockResolvedValue({ ready: false });

    renderCard(
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
    renderCard({ ansibleStatus: AnsibleStatus.READY });

    const deleteButton = screen.getByTestId("delete-instance-button");
    await userEvent.click(deleteButton);

    expect(screen.getByTestId("ansible-delete-modal")).toBeInTheDocument();
  });

  it("does not render delete button or modal when userData is missing proxyURL", () => {
    renderCard({
      ansibleStatus: AnsibleStatus.READY,
      userData: { ...readyUserFixture, proxyURL: "" },
    });

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
});
