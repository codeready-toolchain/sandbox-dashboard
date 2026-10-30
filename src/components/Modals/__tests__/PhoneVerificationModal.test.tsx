import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as registrationApi from "../../../api/registration";
import { SUPPORT_EMAIL } from "../../../const";
import { AnalyticsContext } from "../../../hooks/AnalyticsContext";
import { UserContext, type UserContextType } from "../../../hooks/UserContext";
import { UserSignupPhase } from "../../../hooks/userSignupPhase";
import { readyUserFixture } from "../../../mocks/fixtures";
import { PhoneVerificationModal } from "../PhoneVerificationModal";
import {
  getCountryCodeInput,
  getPhoneNumberInput,
  getPhoneVerificationDialog,
  getVerificationCodeInput,
  queryPhoneVerificationDialog,
  selectCountryCode,
} from "./phoneVerificationTestHelpers";

vi.mock("../../../api/registration", () => ({
  initiatePhoneVerification: vi.fn(),
  completePhoneVerification: vi.fn(),
}));

function makeContext(
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

function renderModal(
  isOpen = true,
  contextOverrides: Partial<UserContextType> = {},
  onClose: () => void = vi.fn(),
) {
  return render(
    <AnalyticsContext.Provider value={{ trackAnalytics: vi.fn() }}>
      <UserContext.Provider value={makeContext(contextOverrides)}>
        <PhoneVerificationModal isOpen={isOpen} onClose={onClose} />
      </UserContext.Provider>
    </AnalyticsContext.Provider>,
  );
}

describe("PhoneVerificationModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    renderModal(false);
    expect(queryPhoneVerificationDialog()).not.toBeInTheDocument();
  });

  it("renders the phone step initially", () => {
    renderModal();
    expect(getPhoneVerificationDialog()).toBeInTheDocument();
    expect(screen.getByText("Verify your phone number")).toBeInTheDocument();
    expect(getCountryCodeInput()).toBeInTheDocument();
    expect(getCountryCodeInput()).toHaveValue("");
    expect(getPhoneNumberInput()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();
  });

  it("disables Send code until both fields have a value", async () => {
    const user = userEvent.setup();
    renderModal();

    const sendCodeButton = screen.getByRole("button", { name: "Send code" });
    expect(sendCodeButton).toBeDisabled();

    await selectCountryCode(user);
    expect(sendCodeButton).toBeDisabled();

    await user.type(getPhoneNumberInput(), "5551234567");
    expect(sendCodeButton).toBeEnabled();
  });

  it("auto-selects a known dial code on blur without showing an alert", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(getCountryCodeInput());
    await user.type(getCountryCodeInput(), "+34");
    await user.click(getPhoneNumberInput());

    await waitFor(() => {
      expect(getCountryCodeInput()).toHaveValue("Spain (+34)");
    });
    expect(
      screen.queryByText("Please enter a valid country code."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Please enter a valid phone number."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();

    await user.type(getPhoneNumberInput(), "612345678");
    expect(screen.getByRole("button", { name: "Send code" })).toBeEnabled();
  });

  it("auto-selects the preferred country for shared dial codes on blur", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(getCountryCodeInput());
    await user.type(getCountryCodeInput(), "+1");
    await user.click(getPhoneNumberInput());

    await waitFor(() => {
      expect(getCountryCodeInput()).toHaveValue("United States (+1)");
    });
  });

  it("shows a phone number validation error on Send code", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectCountryCode(user);
    await user.type(getPhoneNumberInput(), "abc");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(
      screen.getByText("Please enter a valid phone number."),
    ).toBeInTheDocument();
  });

  it("submits phone number and moves to code step", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockResolvedValue();
    const user = userEvent.setup();
    renderModal();

    await selectCountryCode(user);
    await user.clear(getPhoneNumberInput());
    await user.type(getPhoneNumberInput(), "5551234567");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => {
      expect(screen.getByText("Enter verification code")).toBeInTheDocument();
    });
    expect(registrationApi.initiatePhoneVerification).toHaveBeenCalledWith(
      "+1",
      "5551234567",
    );
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });

  it("enables Verify once a verification code is entered", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockResolvedValue();
    const user = userEvent.setup();
    renderModal();

    await selectCountryCode(user);
    await user.type(getPhoneNumberInput(), "5551234567");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => {
      expect(getVerificationCodeInput()).toBeInTheDocument();
    });

    const verifyButton = screen.getByRole("button", { name: "Verify" });
    expect(verifyButton).toBeDisabled();

    await user.type(getVerificationCodeInput(), "123456");
    expect(verifyButton).toBeEnabled();
  });

  it("disables Send code again after clearing a filled field", async () => {
    const user = userEvent.setup();
    renderModal();

    const sendCodeButton = screen.getByRole("button", { name: "Send code" });
    await selectCountryCode(user);
    await user.type(getPhoneNumberInput(), "5551234567");
    expect(sendCodeButton).toBeEnabled();

    await user.clear(getPhoneNumberInput());
    expect(sendCodeButton).toBeDisabled();

    await user.type(getPhoneNumberInput(), "5551234567");
    expect(sendCodeButton).toBeEnabled();

    await user.click(
      screen.getByRole("button", { name: "Clear country code" }),
    );
    expect(sendCodeButton).toBeDisabled();
  });

  it("shows a verification code validation error on Verify", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockResolvedValue();
    const user = userEvent.setup();
    renderModal();

    await selectCountryCode(user);
    await user.type(getPhoneNumberInput(), "5551234567");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => {
      expect(getVerificationCodeInput()).toBeInTheDocument();
    });

    await user.type(getVerificationCodeInput(), "12-34");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(
      screen.getByText("Please enter a valid verification code."),
    ).toBeInTheDocument();
    expect(registrationApi.completePhoneVerification).not.toHaveBeenCalled();
  });

  it("shows error from API on phone step", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockRejectedValue(
      new Error("phone number already in use"),
    );
    const user = userEvent.setup();
    renderModal();

    await selectCountryCode(user);
    await user.type(getPhoneNumberInput(), "5551234567");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          `Unable to verify your phone number. Please contact ${SUPPORT_EMAIL}`,
        ),
      ).toBeInTheDocument();
    });
  });

  it("submits verification code and calls refetchUserData", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockResolvedValue();
    vi.mocked(registrationApi.completePhoneVerification).mockResolvedValue();
    const refetchUserData = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderModal(true, { refetchUserData });

    await selectCountryCode(user);
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
    expect(registrationApi.completePhoneVerification).toHaveBeenCalledWith(
      "123456",
    );
  });

  it("shows error when refetchUserData rejects after verification", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockResolvedValue();
    vi.mocked(registrationApi.completePhoneVerification).mockResolvedValue();
    const refetchUserData = vi
      .fn()
      .mockRejectedValue(new Error("network failure"));
    const user = userEvent.setup();
    renderModal(true, { refetchUserData });

    await selectCountryCode(user);
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
        screen.getByText(/unable to refresh your user's details/i),
      ).toBeInTheDocument();
    });
  });

  it("retries only the refetch when the phone was already verified", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockResolvedValue();
    vi.mocked(registrationApi.completePhoneVerification).mockResolvedValue();
    const mockRefetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("network failure"))
      .mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal(true, { refetchUserData: mockRefetch }, onClose);

    await selectCountryCode(user);
    await user.type(getPhoneNumberInput(), "5551234567");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => {
      expect(getVerificationCodeInput()).toBeInTheDocument();
    });

    await user.type(getVerificationCodeInput(), "123456");

    // First attempt: verification succeeds, refetch fails.
    await user.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => {
      expect(screen.getByText(/unable to refresh/i)).toBeInTheDocument();
    });
    expect(registrationApi.completePhoneVerification).toHaveBeenCalledTimes(1);

    // Second attempt: should skip verification, retry only the refetch.
    await user.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(registrationApi.completePhoneVerification).toHaveBeenCalledTimes(1);
    expect(mockRefetch).toHaveBeenCalledTimes(2);
  });

  it("calls onClose and resets state when Cancel is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal(true, {}, onClose);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate phone submissions on rapid double-click", async () => {
    let resolveCall: (() => void) | undefined;
    vi.mocked(registrationApi.initiatePhoneVerification).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCall = resolve;
        }),
    );
    const user = userEvent.setup();
    renderModal();

    await selectCountryCode(user);
    await user.type(getPhoneNumberInput(), "5551234567");

    const submitBtn = screen.getByRole("button", { name: "Send code" });
    await user.click(submitBtn);
    await user.click(submitBtn);

    expect(registrationApi.initiatePhoneVerification).toHaveBeenCalledTimes(1);

    resolveCall!();
    await waitFor(() => {
      expect(screen.getByText("Enter verification code")).toBeInTheDocument();
    });
  });

  it("prevents duplicate code submissions on rapid double-click", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockResolvedValue();
    let resolveCall: (() => void) | undefined;
    vi.mocked(registrationApi.completePhoneVerification).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCall = resolve;
        }),
    );
    const refetchUserData = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderModal(true, { refetchUserData });

    await selectCountryCode(user);
    await user.type(getPhoneNumberInput(), "5551234567");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => {
      expect(getVerificationCodeInput()).toBeInTheDocument();
    });

    await user.type(getVerificationCodeInput(), "123456");

    const verifyBtn = screen.getByRole("button", { name: "Verify" });
    await user.click(verifyBtn);
    await user.click(verifyBtn);

    expect(registrationApi.completePhoneVerification).toHaveBeenCalledTimes(1);

    resolveCall!();
    await waitFor(() => {
      expect(refetchUserData).toHaveBeenCalledTimes(1);
    });
  });

  it("applies the PatternFly dark theme class to the modal", () => {
    renderModal();

    const dialog = getPhoneVerificationDialog();
    // The PatternFly Modal wraps content in a .pf-v6-c-modal-box
    // element. Check the dark theme class is on the parent container.
    const modalBox = dialog.closest(".pf-v6-c-modal-box");
    expect(modalBox?.classList.contains("pf-v6-theme-dark")).toBe(true);
  });
});
