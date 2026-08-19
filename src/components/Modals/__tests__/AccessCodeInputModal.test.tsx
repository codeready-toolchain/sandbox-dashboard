import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as registrationApi from "../../../api/registration";
import { AccessCodeInputModal } from "../AccessCodeInputModal";

vi.mock("../../../api/registration", () => ({
  verifyActivationCode: vi.fn(),
}));

const mockOnClose = vi.fn();
const mockOnVerified = vi.fn();

function renderModal(isOpen = true) {
  return render(
    <AccessCodeInputModal
      isOpen={isOpen}
      onClose={mockOnClose}
      onVerified={mockOnVerified}
    />,
  );
}

function getCodeBox(index: number) {
  return screen.getByLabelText(`Activation code character ${index + 1}`);
}

describe("AccessCodeInputModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    renderModal(false);
    expect(
      screen.queryByRole("dialog", { name: "Enter the activation code" }),
    ).not.toBeInTheDocument();
  });

  it("renders the 5 code boxes", () => {
    renderModal();
    expect(screen.getByText("Enter the activation code")).toBeInTheDocument();
    expect(
      screen.getByText("If you have an activation code, enter it now."),
    ).toBeInTheDocument();
    for (let i = 0; i < 5; i++) {
      expect(getCodeBox(i)).toBeInTheDocument();
    }
    expect(screen.getByText("Start trial")).toBeInTheDocument();
  });

  it("shows validation error when not all characters entered", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(getCodeBox(0), "A");
    await user.click(screen.getByText("Start trial"));

    expect(
      screen.getByText(/Please enter all 5 characters of your activation code/),
    ).toBeInTheDocument();
  });

  it("submits the full code and calls onVerified", async () => {
    vi.mocked(registrationApi.verifyActivationCode).mockResolvedValue();
    const user = userEvent.setup();
    renderModal();

    await user.type(getCodeBox(0), "A");
    await user.type(getCodeBox(1), "B");
    await user.type(getCodeBox(2), "C");
    await user.type(getCodeBox(3), "D");
    await user.type(getCodeBox(4), "E");
    await user.click(screen.getByText("Start trial"));

    await waitFor(() => {
      expect(mockOnVerified).toHaveBeenCalled();
    });
    expect(registrationApi.verifyActivationCode).toHaveBeenCalledWith("ABCDE");
  });

  it("shows error from API", async () => {
    vi.mocked(registrationApi.verifyActivationCode).mockRejectedValue(
      new Error("Invalid code"),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(getCodeBox(0), "X");
    await user.type(getCodeBox(1), "Y");
    await user.type(getCodeBox(2), "Z");
    await user.type(getCodeBox(3), "1");
    await user.type(getCodeBox(4), "2");
    await user.click(screen.getByText("Start trial"));

    await waitFor(() => {
      expect(
        screen.getByText(/Unable to verify your code/),
      ).toBeInTheDocument();
    });
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("Cancel"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("auto-advances focus to the next box on character entry", async () => {
    const user = userEvent.setup();
    renderModal();

    const box0 = getCodeBox(0);
    await user.click(box0);
    await user.type(box0, "A");

    expect(getCodeBox(1)).toHaveFocus();
  });

  it("prevents duplicate submissions on rapid double-click", async () => {
    let resolveCall: (() => void) | undefined;
    vi.mocked(registrationApi.verifyActivationCode).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCall = resolve;
        }),
    );

    const user = userEvent.setup();
    renderModal();

    await user.type(getCodeBox(0), "A");
    await user.type(getCodeBox(1), "B");
    await user.type(getCodeBox(2), "C");
    await user.type(getCodeBox(3), "D");
    await user.type(getCodeBox(4), "E");

    const submitBtn = screen.getByRole("button", { name: /Start trial/ });
    await user.click(submitBtn);
    await user.click(submitBtn);

    expect(registrationApi.verifyActivationCode).toHaveBeenCalledTimes(1);

    resolveCall!();
    await waitFor(() => {
      expect(mockOnVerified).toHaveBeenCalledTimes(1);
    });
  });
});
