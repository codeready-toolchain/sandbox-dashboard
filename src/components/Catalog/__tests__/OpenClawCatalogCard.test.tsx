import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OpenClawContextType } from "../../../hooks/OpenClawContext";
import { OpenClawContext } from "../../../hooks/OpenClawContext";
import { PhoneVerificationContext } from "../../../hooks/PhoneVerificationContext";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext, UserSignupPhase } from "../../../hooks/UserContext";
import { readyUserFixture } from "../../../mocks/fixtures";
import { NotificationProvider } from "../../../notifications/NotificationProvider";
import { ProductType, type Product } from "../../../types/product";
import { OpenClawStatus } from "../../../utils/openclaw-utils";
import { OpenClawCatalogCard } from "../OpenClawCatalogCard";
import { products } from "../productData";
import { makeOpenClawContext } from "./openClawTestHelpers";

const openclawProduct = products.find((p) => p.type === ProductType.OPENCLAW)!;

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

function renderCard(
  openClawOverrides: Partial<OpenClawContextType> = {},
  markProductAsTried?: (product: Product) => void,
  sandboxOverrides: Partial<UserContextType> = {},
) {
  const sandboxCtx = makeSandboxContext(sandboxOverrides);
  const openClawCtx = makeOpenClawContext(openClawOverrides);
  const defaultMarkTried = markProductAsTried ?? vi.fn();

  render(
    <NotificationProvider>
      <UserContext.Provider value={sandboxCtx}>
        <OpenClawContext.Provider value={openClawCtx}>
          <PhoneVerificationContext.Provider
            value={{ openPhoneVerificationModal: vi.fn() }}
          >
            <OpenClawCatalogCard
              product={openclawProduct}
              isGreenCornerVisible={false}
              markProductAsTried={defaultMarkTried}
            />
          </PhoneVerificationContext.Provider>
        </OpenClawContext.Provider>
      </UserContext.Provider>
    </NotificationProvider>,
  );

  return {
    sandboxCtx,
    openClawCtx,
    markProductAsTried: defaultMarkTried,
  };
}

describe("OpenClawCatalogCard", () => {
  it("opens info modal (not direct link) when status is READY and link exists", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const markProductAsTried = vi.fn();

    renderCard(
      {
        openclawStatus: OpenClawStatus.READY,
        openclawUILink: "https://openclaw.example.com",
      },
      markProductAsTried,
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();
    expect(screen.getByTestId("openclaw-launch-modal")).toBeInTheDocument();

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
      markProductAsTried,
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();
    expect(screen.getByTestId("openclaw-launch-modal")).toBeInTheDocument();

    windowOpenSpy.mockRestore();
  });

  it("calls handleOpenClawInstance and opens info modal when status is IDLED", async () => {
    const handleOpenClawInstance = vi.fn().mockResolvedValue(true);

    renderCard({
      openclawStatus: OpenClawStatus.IDLED,
      handleOpenClawInstance,
    });

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(handleOpenClawInstance).toHaveBeenCalledWith();
    expect(screen.getByTestId("openclaw-launch-modal")).toBeInTheDocument();
  });

  it("opens info modal when status is PROVISIONING", async () => {
    renderCard({ openclawStatus: OpenClawStatus.PROVISIONING });

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(screen.getByTestId("openclaw-launch-modal")).toBeInTheDocument();
  });

  it("disables button when status is TERMINATING", async () => {
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

  it("calls signupUser when signup phase is NOT_STARTED instead of performing actions", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const handleOpenClawInstance = vi.fn();
    const markProductAsTried = vi.fn();
    const signupUser = vi.fn();

    renderCard(
      {
        openclawStatus: OpenClawStatus.READY,
        openclawUILink: "https://openclaw.example.com",
        handleOpenClawInstance,
      },
      markProductAsTried,
      {
        userSignupPhase: UserSignupPhase.NOT_STARTED,
        user: undefined,
        signupUser,
      },
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(signupUser).toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(handleOpenClawInstance).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();

    windowOpenSpy.mockRestore();
  });

  it("opens phone verification modal when signup phase is PENDING_PHONE_VERIFICATION", async () => {
    const handleOpenClawInstance = vi.fn();
    const openPhoneVerificationModal = vi.fn();

    const sandboxCtx = makeSandboxContext({
      userSignupPhase: UserSignupPhase.PENDING_PHONE_VERIFICATION,
    });
    const openClawCtx = makeOpenClawContext({
      openclawStatus: OpenClawStatus.READY,
      openclawUILink: "https://openclaw.example.com",
      handleOpenClawInstance,
    });

    render(
      <NotificationProvider>
        <UserContext.Provider value={sandboxCtx}>
          <OpenClawContext.Provider value={openClawCtx}>
            <PhoneVerificationContext.Provider
              value={{ openPhoneVerificationModal }}
            >
              <OpenClawCatalogCard
                product={openclawProduct}
                isGreenCornerVisible={false}
                markProductAsTried={vi.fn()}
              />
            </PhoneVerificationContext.Provider>
          </OpenClawContext.Provider>
        </UserContext.Provider>
      </NotificationProvider>,
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(openPhoneVerificationModal).toHaveBeenCalledTimes(1);
    expect(handleOpenClawInstance).not.toHaveBeenCalled();
  });

  it("does not perform any action when signup phase is not READY or NOT_STARTED", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const handleOpenClawInstance = vi.fn();
    const markProductAsTried = vi.fn();

    renderCard(
      {
        openclawStatus: OpenClawStatus.READY,
        openclawUILink: "https://openclaw.example.com",
        handleOpenClawInstance,
      },
      markProductAsTried,
      { userSignupPhase: UserSignupPhase.PROVISIONING },
    );

    await userEvent.click(screen.getByTestId("try-it-button"));

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
      expect(deleteOpenClaw).toHaveBeenCalledWith();
    });
  });

  it("hides delete button when status is USER_NOT_READY", () => {
    renderCard({ openclawStatus: OpenClawStatus.USER_NOT_READY });

    expect(
      screen.queryByTestId("delete-instance-button"),
    ).not.toBeInTheDocument();
  });

  it("does not call handleOpenClawInstance or open modal when status is USER_NOT_READY", async () => {
    const handleOpenClawInstance = vi.fn().mockResolvedValue(true);

    renderCard({
      openclawStatus: OpenClawStatus.USER_NOT_READY,
      handleOpenClawInstance,
    });

    await userEvent.click(screen.getByTestId("try-it-button"));

    expect(handleOpenClawInstance).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("openclaw-launch-modal"),
    ).not.toBeInTheDocument();
  });
});
