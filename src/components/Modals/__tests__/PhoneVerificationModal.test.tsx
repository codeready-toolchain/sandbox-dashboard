import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneVerificationModal } from "../PhoneVerificationModal";
import * as registrationApi from "../../../api/registration";

vi.mock("../../../api/registration", () => ({
  initiatePhoneVerification: vi.fn(),
  completePhoneVerification: vi.fn(),
}));

const mockOnClose = vi.fn();
const mockOnVerified = vi.fn();

function renderModal(isOpen = true) {
  return render(
    <PhoneVerificationModal
      isOpen={isOpen}
      onClose={mockOnClose}
      onVerified={mockOnVerified}
    />,
  );
}

describe("PhoneVerificationModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    renderModal(false);
    expect(
      screen.queryByTestId("phone-verification-modal"),
    ).not.toBeInTheDocument();
  });

  it("renders the phone step initially", () => {
    renderModal();
    expect(screen.getByText("Verify your phone number")).toBeInTheDocument();
    expect(screen.getByTestId("country-code-input")).toBeInTheDocument();
    expect(screen.getByTestId("phone-number-input")).toBeInTheDocument();
    expect(screen.getByText("Send code")).toBeInTheDocument();
  });

  it("shows validation error for empty phone number", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("Send code"));
    expect(screen.getByTestId("phone-verification-error")).toBeInTheDocument();
  });

  it("submits phone number and moves to code step", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockResolvedValue();
    const user = userEvent.setup();
    renderModal();

    await user.clear(screen.getByTestId("phone-number-input"));
    await user.type(screen.getByTestId("phone-number-input"), "5551234567");
    await user.click(screen.getByText("Send code"));

    await waitFor(() => {
      expect(screen.getByText("Enter verification code")).toBeInTheDocument();
    });
    expect(registrationApi.initiatePhoneVerification).toHaveBeenCalledWith(
      "+1",
      "5551234567",
    );
  });

  it("shows error from API on phone step", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockRejectedValue(
      new Error("phone number already in use"),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId("phone-number-input"), "5551234567");
    await user.click(screen.getByText("Send code"));

    await waitFor(() => {
      expect(
        screen.getByTestId("phone-verification-error"),
      ).toBeInTheDocument();
    });
  });

  it("submits verification code and calls onVerified", async () => {
    vi.mocked(registrationApi.initiatePhoneVerification).mockResolvedValue();
    vi.mocked(registrationApi.completePhoneVerification).mockResolvedValue();
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId("phone-number-input"), "5551234567");
    await user.click(screen.getByText("Send code"));

    await waitFor(() => {
      expect(screen.getByTestId("verification-code-input")).toBeInTheDocument();
    });

    await user.type(screen.getByTestId("verification-code-input"), "123456");
    await user.click(screen.getByText("Verify"));

    await waitFor(() => {
      expect(mockOnVerified).toHaveBeenCalled();
    });
    expect(registrationApi.completePhoneVerification).toHaveBeenCalledWith(
      "123456",
    );
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("Cancel"));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
