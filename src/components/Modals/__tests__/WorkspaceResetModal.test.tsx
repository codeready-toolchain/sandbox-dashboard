import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as registrationApi from "../../../api/registration";
import { SUPPORT_EMAIL } from "../../../const";
import { ApiError } from "../../../error/ApiError";
import {
  AnalyticsContext,
  noopAnalyticsContext,
} from "../../../hooks/AnalyticsContext";
import { IntentEvent } from "../../../utils/analytics";
import { WorkspaceResetModal } from "../WorkspaceResetModal";

const trackIntent = vi.fn();

vi.mock("../../../api/registration", () => ({
  resetWorkspaces: vi.fn(),
}));

const mockOnClose = vi.fn();
const mockOnReset = vi.fn();

function renderModal(isOpen = true) {
  return render(
    <AnalyticsContext.Provider value={{ ...noopAnalyticsContext, trackIntent }}>
      <WorkspaceResetModal
        isOpen={isOpen}
        onClose={mockOnClose}
        onReset={mockOnReset}
      />
    </AnalyticsContext.Provider>,
  );
}

function getResetWorkspacesDialog() {
  return screen.getByRole("dialog", { name: "Reset workspaces" });
}

function queryResetWorkspacesDialog() {
  return screen.queryByRole("dialog", { name: "Reset workspaces" });
}

async function confirmReset(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: "I understand and I want to reset" }),
  );
  await user.click(screen.getByRole("button", { name: "Reset my workspaces" }));
}

describe("WorkspaceResetModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    renderModal(false);
    expect(queryResetWorkspacesDialog()).not.toBeInTheDocument();
  });

  it("renders the initial confirmation dialog", () => {
    renderModal();
    expect(getResetWorkspacesDialog()).toBeInTheDocument();
    expect(screen.getByText("Reset Workspaces")).toBeInTheDocument();
    expect(screen.getByText(/delete all your workspaces/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "I understand and I want to reset" }),
    ).toBeInTheDocument();
  });

  it("progresses through the 3-state button", async () => {
    vi.mocked(registrationApi.resetWorkspaces).mockResolvedValue();
    const user = userEvent.setup();
    renderModal();

    // Stage 1: initial → confirmed
    await user.click(
      screen.getByRole("button", { name: "I understand and I want to reset" }),
    );
    expect(
      screen.getByRole("button", { name: "Reset my workspaces" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/about to delete all your data/),
    ).toBeInTheDocument();

    // Stage 2: confirmed → submitting → complete
    await user.click(
      screen.getByRole("button", { name: "Reset my workspaces" }),
    );

    await waitFor(() => {
      expect(mockOnReset).toHaveBeenCalled();
    });
    expect(registrationApi.resetWorkspaces).toHaveBeenCalled();
    expect(trackIntent).toHaveBeenCalledWith(
      IntentEvent.workspacesReset,
      "Account",
    );
  });

  it("shows error on reset failure", async () => {
    vi.mocked(registrationApi.resetWorkspaces).mockRejectedValue(
      new Error("Unable to reset"),
    );
    const user = userEvent.setup();
    renderModal();

    await confirmReset(user);

    await waitFor(() => {
      expect(trackIntent).not.toHaveBeenCalled();
      expect(
        screen.getByText(
          `Unable to reset your workspaces. Please, try again later, and if your issue persists, contact support at ${SUPPORT_EMAIL}`,
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows copyable technical details on ApiError reset failure", async () => {
    vi.mocked(registrationApi.resetWorkspaces).mockRejectedValue(
      new ApiError("reset failed", 500, "internal server error"),
    );
    const user = userEvent.setup();
    renderModal();

    await confirmReset(user);

    await waitFor(() => {
      expect(
        screen.getByText(
          `Unable to reset your workspaces. Please, try again later, and if your issue persists, contact support at ${SUPPORT_EMAIL}`,
        ),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Copy technical details")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
