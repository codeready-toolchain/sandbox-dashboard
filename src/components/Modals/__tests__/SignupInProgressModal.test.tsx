import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ButtonLabel } from "../../Catalog/catalogCardTypes";
import { SignupInProgressModal } from "../SignupInProgressModal";

const mockOnClose = vi.fn();
const mockOnContinue = vi.fn();

function renderModal({
  isOpen = true,
  isActionEnabled = false,
  buttonLabel = ButtonLabel.TRY_IT,
}: {
  isOpen?: boolean;
  isActionEnabled?: boolean;
  buttonLabel?: ButtonLabel;
} = {}) {
  return render(
    <SignupInProgressModal
      isOpen={isOpen}
      onClose={mockOnClose}
      buttonLabel={buttonLabel}
      isActionEnabled={isActionEnabled}
      onContinue={mockOnContinue}
    />,
  );
}

describe("SignupInProgressModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    renderModal({ isOpen: false });
    expect(
      screen.queryByRole("dialog", { name: "User signup is in progress" }),
    ).not.toBeInTheDocument();
  });

  it("renders the title, body and disabled continue button", () => {
    renderModal();

    expect(
      screen.getByRole("dialog", { name: "User signup is in progress" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We are setting up your Developer Sandbox access/),
    ).toBeInTheDocument();

    const continueButton = screen.getByRole("button", { name: /Try it/ });
    expect(continueButton).toBeDisabled();
  });

  it("uses the provided button label", () => {
    renderModal({ buttonLabel: ButtonLabel.PROVISION });
    expect(
      screen.getByRole("button", { name: /Provision/ }),
    ).toBeInTheDocument();
  });

  it("enables the continue button and calls onContinue", async () => {
    renderModal({ isActionEnabled: true });

    const continueButton = screen.getByRole("button", { name: "Try it" });
    expect(continueButton).toBeEnabled();

    await userEvent.click(continueButton);
    expect(mockOnContinue).toHaveBeenCalledTimes(1);
  });

  it("shows an external link icon for the Try it label", () => {
    renderModal({ isActionEnabled: true, buttonLabel: ButtonLabel.TRY_IT });

    const button = screen.getByRole("button", { name: "Try it" });
    expect(button.querySelector("svg")).toBeInTheDocument();
  });

  it("does not show an external link icon for the Provision label", () => {
    renderModal({
      isActionEnabled: true,
      buttonLabel: ButtonLabel.PROVISION,
    });

    const button = screen.getByRole("button", { name: "Provision" });
    expect(button.querySelector("svg")).not.toBeInTheDocument();
  });

  it("calls onClose from the close button", async () => {
    renderModal();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnContinue).not.toHaveBeenCalled();
  });
});
