import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as registrationApi from "../../api/registration";
import { readyUserFixture } from "../../mocks/fixtures";
import { usePhoneVerificationContext } from "../PhoneVerificationContext";
import { PhoneVerificationProvider } from "../PhoneVerificationProvider";
import {
  UserContext,
  UserSignupPhase,
  type UserContextType,
} from "../UserContext";

vi.mock("../../api/registration", () => ({
  initiatePhoneVerification: vi.fn(),
  completePhoneVerification: vi.fn(),
  getSignupData: vi.fn(),
  signup: vi.fn(),
}));

function makeUserContext(
  overrides: Partial<UserContextType> = {},
): UserContextType {
  return {
    user: readyUserFixture,
    userSignupPhase: UserSignupPhase.PENDING_PHONE_VERIFICATION,
    refetchUserData: vi.fn().mockResolvedValue(undefined),
    signupUser: vi.fn(),
    ...overrides,
  };
}

function OpenModalButton() {
  const { openPhoneVerificationModal } = usePhoneVerificationContext();
  return (
    <button data-testid="open-modal" onClick={openPhoneVerificationModal}>
      Open
    </button>
  );
}

function renderProvider(contextOverrides: Partial<UserContextType> = {}) {
  const ctx = makeUserContext(contextOverrides);
  render(
    <UserContext.Provider value={ctx}>
      <PhoneVerificationProvider>
        <OpenModalButton />
      </PhoneVerificationProvider>
    </UserContext.Provider>,
  );
  return ctx;
}

describe("PhoneVerificationProvider", () => {
  it("renders children", () => {
    renderProvider();
    expect(screen.getByTestId("open-modal")).toBeInTheDocument();
  });

  it("does not show the phone verification modal by default", () => {
    renderProvider();
    expect(
      screen.queryByTestId("phone-verification-modal"),
    ).not.toBeInTheDocument();
  });

  it("opens the phone verification modal via context function", async () => {
    renderProvider();

    await userEvent.click(screen.getByTestId("open-modal"));

    expect(screen.getByTestId("phone-verification-modal")).toBeInTheDocument();
  });

  it("closes the modal when onClose is triggered", async () => {
    renderProvider();

    await userEvent.click(screen.getByTestId("open-modal"));
    expect(screen.getByTestId("phone-verification-modal")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("phone-verification-modal"),
      ).not.toBeInTheDocument();
    });
  });

  it("refetches user data after successful phone verification", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockResolvedValue();
    vi.mocked(registrationApi.completePhoneVerification).mockResolvedValue();

    const refetchUserData = vi.fn().mockResolvedValue(undefined);
    renderProvider({ refetchUserData });

    const user = userEvent.setup();

    await user.click(screen.getByTestId("open-modal"));

    await user.type(screen.getByTestId("phone-number-input"), "5551234567");
    await user.click(screen.getByText("Send code"));

    await waitFor(() => {
      expect(screen.getByTestId("verification-code-input")).toBeInTheDocument();
    });

    await user.type(screen.getByTestId("verification-code-input"), "123456");
    await user.click(screen.getByText("Verify"));

    await waitFor(() => {
      expect(refetchUserData).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId("phone-verification-modal"),
      ).not.toBeInTheDocument();
    });
  });
});

describe("usePhoneVerificationContext", () => {
  it("throws when used outside PhoneVerificationProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<OpenModalButton />)).toThrow(
      "Context usePhoneVerificationContext is not defined",
    );

    consoleError.mockRestore();
  });
});
