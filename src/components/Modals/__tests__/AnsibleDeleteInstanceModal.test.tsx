import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnsibleDeleteInstanceModal } from "../AnsibleDeleteInstanceModal";
import {
  AnsibleContext,
  type AnsibleContextType,
} from "../../../hooks/AnsibleContext";
import { UserFacingError } from "../../../error/UserFacingError";

const mockOnClose = vi.fn();
const mockOnClickDelete = vi.fn();

function makeAnsibleContext(
  overrides: Partial<AnsibleContextType> = {},
): AnsibleContextType {
  return {
    deleteInstance: vi.fn(),
    fetchInstanceCredentials: vi.fn().mockResolvedValue({
      username: "admin",
      password: "secret",
      url: "https://aap.example.com",
    }),
    instanceStatus: { kind: "ready" },
    provisionInstance: vi.fn().mockResolvedValue(undefined),
    unidleInstance: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderModal(
  ansibleOverrides: Partial<AnsibleContextType> = {},
  modalProps: {
    isOpen?: boolean;
    deletionError?: UserFacingError;
  } = {},
) {
  const ctx = makeAnsibleContext(ansibleOverrides);
  const { isOpen = true, deletionError } = modalProps;

  const utils = render(
    <AnsibleContext.Provider value={ctx}>
      <AnsibleDeleteInstanceModal
        isOpen={isOpen}
        onClose={mockOnClose}
        onClickDelete={mockOnClickDelete}
        deletionError={deletionError}
      />
    </AnsibleContext.Provider>,
  );

  return { ...utils, ctx };
}

describe("AnsibleDeleteInstanceModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    renderModal({}, { isOpen: false });
    expect(
      screen.queryByTestId("ansible-delete-modal"),
    ).not.toBeInTheDocument();
  });

  it("renders confirmation dialog with warning text", () => {
    renderModal();
    expect(screen.getByText("Delete AAP Instance")).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
    expect(screen.getByTestId("confirm-delete-aap")).toBeInTheDocument();
  });

  it("calls onClickDelete when the delete button is clicked", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId("confirm-delete-aap"));

    expect(mockOnClickDelete).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("Cancel"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("shows 'Deleting...' and disables button when instanceStatus is 'deleting'", () => {
    renderModal({ instanceStatus: { kind: "deleting" } });

    const deleteButton = screen.getByTestId(
      "confirm-delete-aap",
    ) as HTMLButtonElement;
    expect(deleteButton.textContent).toContain("Deleting...");
    expect(deleteButton).toBeDisabled();
  });

  it("disables Cancel button when instanceStatus is 'deleting'", () => {
    renderModal({ instanceStatus: { kind: "deleting" } });

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(cancelButton).toBeDisabled();
  });

  it("shows error modal when a deletionError is provided", () => {
    const deletionError = new UserFacingError(
      "Unable to delete",
      "Deletion failed",
      undefined,
      "Technical: deletion of CR failed: 500 Internal Server Error",
    );

    renderModal({}, { deletionError });

    expect(
      screen.getByTestId("ansible-automation-platform-error"),
    ).toBeInTheDocument();
  });

  it("shows the error modal with copyable technical details", () => {
    const deletionError = new UserFacingError(
      "Unable to delete",
      "Deletion failed",
      undefined,
      "Technical details for support",
    );

    renderModal({}, { deletionError });

    expect(screen.getByText("Copy technical details")).toBeInTheDocument();
  });

  it("calls onClose when the error modal is dismissed", async () => {
    const user = userEvent.setup();
    const deletionError = new UserFacingError(
      "Unable to delete",
      "Deletion failed",
    );

    renderModal({}, { deletionError });

    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("disables the delete button when a deletionError is present", () => {
    const deletionError = new UserFacingError(
      "Unable to delete",
      "Deletion failed",
    );

    renderModal({}, { deletionError });

    expect(
      screen.getByTestId("ansible-automation-platform-error"),
    ).toBeInTheDocument();
  });

  it("shows 'Delete' text on the button when not in deleting state", () => {
    renderModal({ instanceStatus: { kind: "ready" } });

    const deleteButton = screen.getByTestId(
      "confirm-delete-aap",
    ) as HTMLButtonElement;
    expect(deleteButton.textContent).toBe("Delete");
  });
});
