import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AnalyticsContext } from "../../../hooks/AnalyticsContext";
import { NotificationProvider } from "../../../hooks/NotificationProvider";
import type { OpenClawContextType } from "../../../hooks/OpenClawContext";
import { OpenClawContext } from "../../../hooks/OpenClawContext";
import { PhoneVerificationContext } from "../../../hooks/PhoneVerificationContext";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext } from "../../../hooks/UserContext";
import { UserSignupPhase } from "../../../hooks/userSignupPhase";
import { readyUserFixture } from "../../../mocks/fixtures";
import { type Product, ProductType } from "../../../types/product";
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
        <AnalyticsContext.Provider value={{ trackAnalytics: vi.fn() }}>
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
        </AnalyticsContext.Provider>
      </UserContext.Provider>
    </NotificationProvider>,
  );

  return {
    sandboxCtx,
    openClawCtx,
    markProductAsTried: defaultMarkTried,
  };
}

function getCard() {
  return screen.getByRole("article", { name: "OpenClaw product card" });
}

function getPrimaryButton(name: RegExp | string) {
  return within(getCard()).getByRole("button", { name });
}

describe("OpenClawCatalogCard", () => {
  it("shows 'Loading' button and disables it when status is INITIAL_FETCH", () => {
    renderCard({ status: OpenClawStatus.INITIAL_FETCH });

    const button = getPrimaryButton(/Loading/);
    expect(button.textContent).toContain("Loading");
    expect(button).toBeDisabled();
  });

  it("renders 'Loading' status label when status is INITIAL_FETCH", () => {
    renderCard({ status: OpenClawStatus.INITIAL_FETCH });

    expect(getCard().textContent).toContain("Loading");
  });

  it("hides delete button when status is INITIAL_FETCH", () => {
    renderCard({ status: OpenClawStatus.INITIAL_FETCH });

    expect(
      screen.queryByRole("button", { name: "Delete instance" }),
    ).not.toBeInTheDocument();
  });

  it("opens info modal (not direct link) when status is READY and link exists", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const markProductAsTried = vi.fn();

    renderCard(
      {
        status: OpenClawStatus.READY,
        uiURL: "https://openclaw.example.com",
      },
      markProductAsTried,
    );

    await userEvent.click(getPrimaryButton("Launch"));

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    windowOpenSpy.mockRestore();
  });

  it("opens info modal and does not launch when status is READY but link is missing", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const markProductAsTried = vi.fn();

    renderCard(
      {
        status: OpenClawStatus.READY,
        uiURL: undefined,
      },
      markProductAsTried,
    );

    await userEvent.click(getPrimaryButton("Launch"));

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    windowOpenSpy.mockRestore();
  });

  it("opens info modal when status is READY but link is empty string", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const markProductAsTried = vi.fn();

    renderCard(
      {
        status: OpenClawStatus.READY,
        uiURL: "",
      },
      markProductAsTried,
    );

    await userEvent.click(getPrimaryButton("Launch"));

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    windowOpenSpy.mockRestore();
  });

  it("calls unidleInstance and opens info modal when status is IDLED", async () => {
    const unidleInstance = vi.fn().mockResolvedValue(undefined);

    renderCard({
      status: OpenClawStatus.IDLED,
      unidleInstance,
    });

    await userEvent.click(getPrimaryButton("Re-provision"));

    expect(unidleInstance).toHaveBeenCalledWith();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens info modal when status is PROVISIONING", async () => {
    renderCard({ status: OpenClawStatus.PROVISIONING });

    await userEvent.click(getPrimaryButton(/Provisioning/));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens info modal when status is NEW (provision flow)", async () => {
    renderCard({ status: OpenClawStatus.NEW });

    await userEvent.click(getPrimaryButton("Provision"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens info modal when status is FAILED", async () => {
    renderCard({ status: OpenClawStatus.FAILED });

    await userEvent.click(getPrimaryButton("Provision"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("calls signupUser when signup phase is NOT_STARTED instead of performing actions", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const unidleInstance = vi.fn();
    const markProductAsTried = vi.fn();
    const signupUser = vi.fn();

    renderCard(
      {
        status: OpenClawStatus.READY,
        uiURL: "https://openclaw.example.com",
        unidleInstance,
      },
      markProductAsTried,
      {
        userSignupPhase: UserSignupPhase.NOT_STARTED,
        user: undefined,
        signupUser,
      },
    );

    await userEvent.click(getPrimaryButton("Launch"));

    expect(signupUser).toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(unidleInstance).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();

    windowOpenSpy.mockRestore();
  });

  it("opens phone verification modal when signup phase is PENDING_PHONE_VERIFICATION", async () => {
    const unidleInstance = vi.fn();
    const openPhoneVerificationModal = vi.fn();

    const sandboxCtx = makeSandboxContext({
      userSignupPhase: UserSignupPhase.PENDING_PHONE_VERIFICATION,
    });
    const openClawCtx = makeOpenClawContext({
      status: OpenClawStatus.READY,
      uiURL: "https://openclaw.example.com",
      unidleInstance,
    });

    render(
      <NotificationProvider>
        <UserContext.Provider value={sandboxCtx}>
          <AnalyticsContext.Provider value={{ trackAnalytics: vi.fn() }}>
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
          </AnalyticsContext.Provider>
        </UserContext.Provider>
      </NotificationProvider>,
    );

    await userEvent.click(getPrimaryButton("Launch"));

    expect(openPhoneVerificationModal).toHaveBeenCalledTimes(1);
    expect(unidleInstance).not.toHaveBeenCalled();
  });

  it("does not perform any action when signup phase is not READY or NOT_STARTED", async () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const unidleInstance = vi.fn();
    const markProductAsTried = vi.fn();

    renderCard(
      {
        status: OpenClawStatus.READY,
        uiURL: "https://openclaw.example.com",
        unidleInstance,
      },
      markProductAsTried,
      { userSignupPhase: UserSignupPhase.PROVISIONING },
    );

    await userEvent.click(getPrimaryButton("Launch"));

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(unidleInstance).not.toHaveBeenCalled();
    expect(markProductAsTried).not.toHaveBeenCalled();

    windowOpenSpy.mockRestore();
  });

  it("opens the delete confirmation modal when delete button is clicked", async () => {
    renderCard({ status: OpenClawStatus.READY });

    await userEvent.click(
      screen.getByRole("button", { name: "Delete instance" }),
    );

    expect(
      screen.getByRole("dialog", { name: /Delete.*OpenClaw/ }),
    ).toBeInTheDocument();
  });

  it("calls deleteInstance when delete is confirmed", async () => {
    const deleteInstance = vi.fn().mockResolvedValue(undefined);

    renderCard({ status: OpenClawStatus.READY, deleteInstance });

    await userEvent.click(
      screen.getByRole("button", { name: "Delete instance" }),
    );

    const deleteModal = screen.getByRole("dialog", {
      name: /Delete.*OpenClaw/,
    });
    await userEvent.click(
      within(deleteModal).getByRole("button", { name: /Delete instance/ }),
    );

    await waitFor(() => {
      expect(deleteInstance).toHaveBeenCalledWith();
    });
  });

  it("hides delete button when status is USER_NOT_READY", () => {
    renderCard({ status: OpenClawStatus.USER_NOT_READY });

    expect(
      screen.queryByRole("button", { name: "Delete instance" }),
    ).not.toBeInTheDocument();
  });

  it("does not call unidleInstance or open modal when status is USER_NOT_READY", async () => {
    const unidleInstance = vi.fn().mockResolvedValue(undefined);

    renderCard({
      status: OpenClawStatus.USER_NOT_READY,
      unidleInstance,
    });

    await userEvent.click(getPrimaryButton("Try it"));

    expect(unidleInstance).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables primary button when userSignupPhase is INITIAL_FETCH", () => {
    renderCard({ status: OpenClawStatus.READY }, undefined, {
      userSignupPhase: UserSignupPhase.INITIAL_FETCH,
    });

    expect(getPrimaryButton(/Loading/)).toBeDisabled();
  });
});
