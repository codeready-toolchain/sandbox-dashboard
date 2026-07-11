import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorModal } from "../ErrorModal";

const mockOnClose = vi.fn();

const defaultProps = {
  headerTitle: "Error",
  productName: "test-product",
  alertTitle: "Something went wrong",
  alertText: "An error occurred.",
  isErrorModalOpen: true,
  onErrorModalClose: mockOnClose,
};

describe("ErrorModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    render(<ErrorModal {...defaultProps} isErrorModalOpen={false} />);
    expect(
      screen.queryByTestId("test-product-error-modal"),
    ).not.toBeInTheDocument();
  });

  it("renders the alert with title and text", () => {
    render(<ErrorModal {...defaultProps} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("An error occurred.")).toBeInTheDocument();
  });

  it("does not render copy link when copyableTechnicalDetails is absent", () => {
    render(<ErrorModal {...defaultProps} />);
    expect(
      screen.queryByText("Copy technical details"),
    ).not.toBeInTheDocument();
  });

  it("renders copy link when copyableTechnicalDetails is provided", () => {
    render(
      <ErrorModal
        {...defaultProps}
        copyableTechnicalDetails="error details here"
      />,
    );
    expect(screen.getByText("Copy technical details")).toBeInTheDocument();
  });

  it("shows 'Copied!' on successful clipboard write", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(
      <ErrorModal
        {...defaultProps}
        copyableTechnicalDetails="error details here"
      />,
    );

    fireEvent.click(screen.getByText("Copy technical details"));

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
    expect(writeText).toHaveBeenCalledWith("error details here");
  });

  it("shows 'Unable to copy' on clipboard write failure", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Not allowed"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(
      <ErrorModal
        {...defaultProps}
        copyableTechnicalDetails="error details here"
      />,
    );

    fireEvent.click(screen.getByText("Copy technical details"));

    await waitFor(() => {
      expect(screen.getByText("Unable to copy")).toBeInTheDocument();
    });
  });

  it("calls onErrorModalClose when modal is dismissed", async () => {
    const user = userEvent.setup();
    render(<ErrorModal {...defaultProps} />);

    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
