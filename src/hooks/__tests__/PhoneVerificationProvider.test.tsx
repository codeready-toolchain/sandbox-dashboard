import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as registrationApi from "../../api/registration";
import {
  getPhoneNumberInput,
  getPhoneVerificationDialog,
  getVerificationCodeInput,
  queryPhoneVerificationDialog,
} from "../../components/Modals/__tests__/phoneVerificationTestHelpers";
import { readyUserFixture } from "../../mocks/fixtures";
import { AnalyticsContext } from "../AnalyticsContext";
import { NotificationProvider } from "../NotificationProvider";
import { usePhoneVerificationContext } from "../PhoneVerificationContext";
import { PhoneVerificationProvider } from "../PhoneVerificationProvider";
import { UserContext, type UserContextType } from "../UserContext";
import { UserSignupPhase } from "../userSignupPhase";

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
    <NotificationProvider>
      <AnalyticsContext.Provider value={{ trackAnalytics: vi.fn() }}>
        <UserContext.Provider value={ctx}>
          <PhoneVerificationProvider>
            <OpenModalButton />
          </PhoneVerificationProvider>
        </UserContext.Provider>
      </AnalyticsContext.Provider>
    </NotificationProvider>,
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
    expect(queryPhoneVerificationDialog()).not.toBeInTheDocument();
  });

  it("opens the phone verification modal via context function", async () => {
    renderProvider();

    await userEvent.click(screen.getByTestId("open-modal"));

    expect(getPhoneVerificationDialog()).toBeInTheDocument();
  });

  it("closes the modal when onClose is triggered", async () => {
    renderProvider();

    await userEvent.click(screen.getByTestId("open-modal"));
    expect(getPhoneVerificationDialog()).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(queryPhoneVerificationDialog()).not.toBeInTheDocument();
    });
  });

  it("refetches user data after successful phone verification", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockResolvedValue();
    vi.mocked(registrationApi.completePhoneVerification).mockResolvedValue();

    const refetchUserData = vi.fn().mockResolvedValue(undefined);
    renderProvider({ refetchUserData });

    const user = userEvent.setup();

    await user.click(screen.getByTestId("open-modal"));

    await user.type(getPhoneNumberInput(), "5551234567");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => {
      expect(getVerificationCodeInput()).toBeInTheDocument();
    });

    await user.type(getVerificationCodeInput(), "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(refetchUserData).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(queryPhoneVerificationDialog()).not.toBeInTheDocument();
    });
  });

  it("shows warning alert when refetchUserData rejects after phone verification", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockResolvedValue();
    vi.mocked(registrationApi.completePhoneVerification).mockResolvedValue();

    const refetchUserData = vi
      .fn()
      .mockRejectedValue(new Error("network failure"));
    renderProvider({ refetchUserData });

    const user = userEvent.setup();

    await user.click(screen.getByTestId("open-modal"));

    await user.type(getPhoneNumberInput(), "5551234567");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => {
      expect(getVerificationCodeInput()).toBeInTheDocument();
    });

    await user.type(getVerificationCodeInput(), "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(refetchUserData).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.getByText("Unable to refresh your user's details"),
      ).toBeInTheDocument();
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
