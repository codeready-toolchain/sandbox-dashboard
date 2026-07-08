import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SandboxContextType } from "../../../hooks/SandboxContext";
import { SandboxContext } from "../../../hooks/SandboxContext";
import { Product } from "../../../hooks/useProductURLs";
import { readyUserFixture } from "../../../mocks/fixtures";
import { UserStatus } from "../../../types";
import { AnsibleStatus } from "../../../utils/aap-utils";
import { OpenClawStatus } from "../../../utils/openclaw-utils";
import type { EnsureUserIsReadyResult } from "../catalogCardTypes";
import { OpenClawCatalogCard } from "../OpenClawCatalogCard";
import { productData } from "../productData";

const openclawProduct = productData.find((p) => p.id === Product.OPENCLAW)!;

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
    ansibleError: null,
    ansibleStatus: AnsibleStatus.NEW,
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
      <OpenClawCatalogCard
        product={openclawProduct}
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

describe("OpenClawCatalogCard", () => {
  it("opens link and marks as tried when status is READY and link exists", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const markProductAsTried = vi.fn();

    renderCard(
      {
        openclawStatus: OpenClawStatus.READY,
        openclawUILink: "https://openclaw.example.com",
      },
      undefined,
      markProductAsTried,
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://openclaw.example.com",
      "_blank",
      "noopener,noreferrer",
    );
    expect(markProductAsTried).toHaveBeenCalledWith(Product.OPENCLAW);

    windowOpenSpy.mockRestore();
  });

  it("opens info modal and does not launch when status is READY but link is missing", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const markProductAsTried = vi.fn();

    renderCard(
      {
        openclawStatus: OpenClawStatus.READY,
        openclawUILink: undefined,
      },
      undefined,
      markProductAsTried,
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();
    expect(screen.getByTestId("openclaw-launch-modal")).toBeInTheDocument();

    windowOpenSpy.mockRestore();
  });

  it("opens info modal when status is READY but link is empty string", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const markProductAsTried = vi.fn();

    renderCard(
      {
        openclawStatus: OpenClawStatus.READY,
        openclawUILink: "",
      },
      undefined,
      markProductAsTried,
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();
    expect(screen.getByTestId("openclaw-launch-modal")).toBeInTheDocument();

    windowOpenSpy.mockRestore();
  });

  it("calls handleOpenClawInstance when status is IDLED", async () => {
    const handleOpenClawInstance = vi.fn().mockResolvedValue(true);

    renderCard({
      openclawStatus: OpenClawStatus.IDLED,
      handleOpenClawInstance,
    });

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(handleOpenClawInstance).toHaveBeenCalledWith(
      readyUserFixture.defaultUserNamespace,
    );
  });

  it("opens info modal when status is PROVISIONING", async () => {
    renderCard({ openclawStatus: OpenClawStatus.PROVISIONING });

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(screen.getByTestId("openclaw-launch-modal")).toBeInTheDocument();
  });

  it("opens info modal when status is TERMINATING", async () => {
    renderCard({ openclawStatus: OpenClawStatus.TERMINATING });

    const button = screen.getByTestId("try-it-button");
    expect(button).toBeDisabled();
  });

  it("opens info modal when status is NEW (provision flow)", async () => {
    renderCard({ openclawStatus: OpenClawStatus.NEW });

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(screen.getByTestId("openclaw-launch-modal")).toBeInTheDocument();
  });

  it("opens info modal when status is FAILED", async () => {
    renderCard({ openclawStatus: OpenClawStatus.FAILED });

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(screen.getByTestId("openclaw-launch-modal")).toBeInTheDocument();
  });

  it("does not perform any action when ensureUserIsReady returns not ready", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const handleOpenClawInstance = vi.fn();
    const markProductAsTried = vi.fn();
    const ensureUserIsReady = vi.fn().mockResolvedValue({ ready: false });

    renderCard(
      {
        openclawStatus: OpenClawStatus.READY,
        openclawUILink: "https://openclaw.example.com",
        handleOpenClawInstance,
      },
      ensureUserIsReady,
      markProductAsTried,
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(ensureUserIsReady).toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(handleOpenClawInstance).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();

    windowOpenSpy.mockRestore();
  });

  it("opens the delete confirmation modal when delete button is clicked", async () => {
    renderCard({ openclawStatus: OpenClawStatus.READY });

    const deleteButton = screen.getByTestId("delete-instance-button");
    await userEvent.click(deleteButton);

    expect(screen.getByTestId("delete-instance-modal")).toBeInTheDocument();
  });

  it("calls deleteOpenClaw when delete is confirmed", async () => {
    const deleteOpenClaw = vi.fn().mockResolvedValue(undefined);

    renderCard({ openclawStatus: OpenClawStatus.READY, deleteOpenClaw });

    await userEvent.click(screen.getByTestId("delete-instance-button"));

    const confirmButton = screen.getByTestId("confirm-delete-instance");
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteOpenClaw).toHaveBeenCalledWith(
        readyUserFixture.defaultUserNamespace,
      );
    });
  });

  it("does not render modals when userData is missing proxyURL", () => {
    renderCard({
      openclawStatus: OpenClawStatus.READY,
      userData: { ...readyUserFixture, proxyURL: "" },
    });

    expect(
      screen.queryByTestId("openclaw-launch-modal"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("delete-instance-modal"),
    ).not.toBeInTheDocument();
  });
});
