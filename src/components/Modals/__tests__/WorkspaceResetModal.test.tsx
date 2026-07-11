import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceResetModal } from "../WorkspaceResetModal";
import { ApiError } from "../../../error/ApiError";
import * as registrationApi from "../../../api/registration";

vi.mock("../../../api/registration", () => ({
  resetWorkspaces: vi.fn(),
}));

const mockOnClose = vi.fn();
const mockOnReset = vi.fn();

function renderModal(isOpen = true) {
  return render(
    <WorkspaceResetModal
      isOpen={isOpen}
      onClose={mockOnClose}
      onReset={mockOnReset}
    />,
  );
}

describe("WorkspaceResetModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    renderModal(false);
    expect(
      screen.queryByTestId("workspace-reset-modal"),
    ).not.toBeInTheDocument();
  });

  it("renders the initial confirmation dialog", () => {
    renderModal();
    expect(screen.getByText("Reset Workspaces")).toBeInTheDocument();
    expect(screen.getByText(/delete all your workspaces/)).toBeInTheDocument();
    expect(
      screen.getByText("I understand and I want to reset"),
    ).toBeInTheDocument();
  });

  it("progresses through the 3-state button", async () => {
    vi.mocked(registrationApi.resetWorkspaces).mockResolvedValue();
    const user = userEvent.setup();
    renderModal();

    // Stage 1: initial → confirmed
    await user.click(screen.getByTestId("workspace-reset-button"));
    expect(screen.getByText("Reset my workspaces")).toBeInTheDocument();
    expect(
      screen.getByText(/about to delete all your data/),
    ).toBeInTheDocument();

    // Stage 2: confirmed → submitting → complete
    await user.click(screen.getByTestId("workspace-reset-button"));

    await waitFor(() => {
      expect(mockOnReset).toHaveBeenCalled();
    });
    expect(registrationApi.resetWorkspaces).toHaveBeenCalled();
  });

  it("shows error on reset failure", async () => {
    vi.mocked(registrationApi.resetWorkspaces).mockRejectedValue(
      new Error("Unable to reset"),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId("workspace-reset-button"));
    await user.click(screen.getByTestId("workspace-reset-button"));

    await waitFor(() => {
      expect(screen.getByTestId("workspace-reset-error")).toBeInTheDocument();
    });
  });

  it("shows copyable technical details on ApiError reset failure", async () => {
    vi.mocked(registrationApi.resetWorkspaces).mockRejectedValue(
      new ApiError("reset failed", 500, "internal server error"),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId("workspace-reset-button"));
    await user.click(screen.getByTestId("workspace-reset-button"));

    await waitFor(() => {
      expect(screen.getByTestId("workspace-reset-error")).toBeInTheDocument();
    });
    expect(screen.getByText("Copy technical details")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("Cancel"));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
