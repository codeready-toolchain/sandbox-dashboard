import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  AuthenticatedContext,
  type AuthenticatedContextValue,
} from "../../../auth/AuthenticatedContext";
import {
  AnalyticsContext,
  noopAnalyticsContext,
} from "../../../hooks/AnalyticsContext";
import { NotificationProvider } from "../../../hooks/NotificationProvider";
import type { OpenClawContextType } from "../../../hooks/OpenClawContext";
import { OpenClawContext } from "../../../hooks/OpenClawContext";
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
import { OpenClawStatus } from "../../../utils/openclaw-utils";
import { OpenClawCatalogCard } from "../OpenClawCatalogCard";
import { products } from "../productData";
import { makeOpenClawContext } from "./openClawTestHelpers";

const openclawProduct = products.find((p) => p.type === ProductType.OPENCLAW)!;
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

function renderCardTree(
  sandboxCtx: UserContextType,
  openClawCtx: OpenClawContextType,
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
                <OpenClawContext.Provider value={openClawCtx}>
                  <OpenClawCatalogCard
                    product={openclawProduct}
                    isTriedProductHintVisible={false}
                    markProductAsTried={markProductAsTried}
                  />
                </OpenClawContext.Provider>
              </AnalyticsContext.Provider>
            </SignupActionContext.Provider>
          </PhoneVerificationContext.Provider>
        </UserContext.Provider>
      </NotificationProvider>
    </AuthenticatedContext.Provider>
  );
}

function renderCard(
  openClawOverrides: Partial<OpenClawContextType> = {},
  markProductAsTried?: (product: Product) => void,
  sandboxOverrides: Partial<UserContextType> = {},
  signupActionOverrides: Partial<SignupActionContextType> = {},
) {
  const sandboxCtx = makeSandboxContext(sandboxOverrides);
  const openClawCtx = makeOpenClawContext(openClawOverrides);
  const signupActionCtx = makeSignupActionContext(signupActionOverrides);
  const defaultMarkTried = markProductAsTried ?? vi.fn();

  const view = render(
    renderCardTree(sandboxCtx, openClawCtx, signupActionCtx, defaultMarkTried),
  );

  return {
    sandboxCtx,
    openClawCtx,
    markProductAsTried: defaultMarkTried,
    rerenderCard: (
      nextOpenClaw: Partial<OpenClawContextType> = {},
      nextSandbox: Partial<UserContextType> = {},
    ) => {
      view.rerender(
        renderCardTree(
          makeSandboxContext({
            ...sandboxOverrides,
            ...nextSandbox,
          }),
          makeOpenClawContext({
            ...openClawOverrides,
            ...nextOpenClaw,
          }),
          signupActionCtx,
          defaultMarkTried,
        ),
      );
    },
  };
}

function getCard() {
  return screen.getByRole("article", { name: "OpenClaw product card" });
}

function getPrimaryButton(name: RegExp | string) {
  return within(getCard()).getByRole("button", { name });
}

describe("OpenClawCatalogCard", () => {
  afterEach(() => {
    trackProductAction.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

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
    expect(trackProductAction).not.toHaveBeenCalled();
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

    await userEvent.click(getPrimaryButton("Resume"));

    expect(unidleInstance).toHaveBeenCalledWith();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens info modal when status is PROVISIONING", async () => {
    renderCard({ status: OpenClawStatus.PROVISIONING });

    await userEvent.click(getPrimaryButton(/Setting up/));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens info modal when status is NEW (provision flow)", async () => {
    renderCard({ status: OpenClawStatus.NEW });

    await userEvent.click(getPrimaryButton("Set up"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("disables device pairing when the user provisions an instance", async () => {
    const user = userEvent.setup();
    const startProvisioning = vi.fn().mockResolvedValue(undefined);
    renderCard({ status: OpenClawStatus.NEW, startProvisioning });

    await user.click(getPrimaryButton("Set up"));

    const providerInput = screen.getByPlaceholderText(
      "Select or type an AI provider",
    );
    await user.click(providerInput);
    await user.keyboard("{ArrowDown}{Enter}");
    await user.type(screen.getByLabelText("API Key"), "gemini-test-key");
    await user.click(screen.getByTestId("openclaw-provision-button"));

    expect(trackProductAction).toHaveBeenCalledWith(openclawProduct, "set-up");
    expect(startProvisioning).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          provider: expect.objectContaining({ id: "gemini" }),
          values: { "api-key": "gemini-test-key" },
        }),
      ],
      true,
    );
  });

  it("opens info modal when status is FAILED", async () => {
    renderCard({ status: OpenClawStatus.FAILED });

    await userEvent.click(getPrimaryButton("Set up"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
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

  it("shows 'Set up' and does not open the modal when status is USER_NOT_READY", async () => {
    const unidleInstance = vi.fn().mockResolvedValue(undefined);

    renderCard({
      status: OpenClawStatus.USER_NOT_READY,
      unidleInstance,
    });

    const button = getPrimaryButton("Set up");
    expect(button.textContent).toContain("Set up");

    await userEvent.click(button);

    expect(unidleInstance).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts signup from 'Set up' when the user has not signed up", async () => {
    const signupAndRun = vi.fn();

    renderCard(
      { status: OpenClawStatus.USER_NOT_READY },
      undefined,
      { userSignupPhase: UserSignupPhase.NOT_STARTED },
      { signupAndRun },
    );

    await userEvent.click(getPrimaryButton("Set up"));

    expect(signupAndRun).toHaveBeenCalledWith(ProductType.OPENCLAW);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables primary button during INITIAL_FETCH", () => {
    renderCard({ status: OpenClawStatus.READY }, undefined, {
      userSignupPhase: UserSignupPhase.INITIAL_FETCH,
    });

    // The spinner is shown, making the accessible name include
    // "Loading...".
    expect(getPrimaryButton(/Launch/)).toBeDisabled();
  });
});
