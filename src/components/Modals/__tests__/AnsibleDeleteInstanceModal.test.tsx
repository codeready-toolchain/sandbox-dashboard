import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnsibleDeleteInstanceModal } from "../AnsibleDeleteInstanceModal";
import { ApiError } from "../../../error/ApiError";
import * as aapApi from "../../../api/aap";
import * as kubeApi from "../../../api/kube";

vi.mock("../../../api/aap", () => ({
  deleteAAPCR: vi.fn(),
}));

vi.mock("../../../api/kube", () => ({
  getDeployments: vi.fn(),
  getStatefulSets: vi.fn(),
  deleteSecretsAndPVCs: vi.fn(),
  deletePVCsForSTS: vi.fn(),
}));

const mockOnClose = vi.fn();
const mockOnDeleted = vi.fn();

const defaultProps = {
  isOpen: true,
  onClose: mockOnClose,
  onDeleted: mockOnDeleted,
  proxyURL: "https://proxy.example.com",
  userNamespace: "johndoe-dev",
};

describe("AnsibleDeleteInstanceModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    render(<AnsibleDeleteInstanceModal {...defaultProps} isOpen={false} />);
    expect(
      screen.queryByTestId("ansible-delete-modal"),
    ).not.toBeInTheDocument();
  });

  it("renders confirmation dialog", () => {
    render(<AnsibleDeleteInstanceModal {...defaultProps} />);
    expect(screen.getByText("Delete AAP Instance")).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
    expect(screen.getByTestId("confirm-delete-aap")).toBeInTheDocument();
  });

  it("calls delete flow and onDeleted on success", async () => {
    vi.mocked(kubeApi.getDeployments).mockResolvedValue({ items: [] });
    vi.mocked(kubeApi.getStatefulSets).mockResolvedValue({ items: [] });
    vi.mocked(aapApi.deleteAAPCR).mockResolvedValue();
    vi.mocked(kubeApi.deleteSecretsAndPVCs).mockResolvedValue();
    vi.mocked(kubeApi.deletePVCsForSTS).mockResolvedValue();

    const user = userEvent.setup();
    render(<AnsibleDeleteInstanceModal {...defaultProps} />);

    await user.click(screen.getByTestId("confirm-delete-aap"));

    await waitFor(() => {
      expect(mockOnDeleted).toHaveBeenCalled();
    });
    expect(aapApi.deleteAAPCR).toHaveBeenCalled();
  });

  it("shows error on delete failure", async () => {
    vi.mocked(kubeApi.getDeployments).mockRejectedValue(
      new Error("Network error"),
    );

    const user = userEvent.setup();
    render(<AnsibleDeleteInstanceModal {...defaultProps} />);

    await user.click(screen.getByTestId("confirm-delete-aap"));

    await waitFor(() => {
      expect(
        screen.getByTestId("ansible-automation-platform-error"),
      ).toBeInTheDocument();
    });
  });

  it("calls onDeleted even when cleanup fails, then shows error modal", async () => {
    vi.mocked(kubeApi.getDeployments).mockResolvedValue({ items: [] });
    vi.mocked(kubeApi.getStatefulSets).mockResolvedValue({ items: [] });
    vi.mocked(aapApi.deleteAAPCR).mockResolvedValue();
    vi.mocked(kubeApi.deleteSecretsAndPVCs).mockRejectedValue(
      new Error("cleanup failed"),
    );
    vi.mocked(kubeApi.deletePVCsForSTS).mockResolvedValue();

    let isOpen = true;
    const onDeleted = vi.fn(() => {
      isOpen = false;
    });

    const user = userEvent.setup();
    const { rerender } = render(
      <AnsibleDeleteInstanceModal
        {...defaultProps}
        isOpen={isOpen}
        onDeleted={onDeleted}
      />,
    );

    await user.click(screen.getByTestId("confirm-delete-aap"));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalled();
    });

    rerender(
      <AnsibleDeleteInstanceModal
        {...defaultProps}
        isOpen={isOpen}
        onDeleted={onDeleted}
      />,
    );

    expect(
      screen.getByTestId("ansible-automation-platform-error-modal"),
    ).toBeInTheDocument();
  });

  it("includes HTTP status code in ApiError deletion error details", async () => {
    vi.mocked(kubeApi.getDeployments).mockRejectedValue(
      new ApiError("getDeployments failed", 403, "Forbidden"),
    );

    const user = userEvent.setup();
    render(<AnsibleDeleteInstanceModal {...defaultProps} />);

    await user.click(screen.getByTestId("confirm-delete-aap"));

    await waitFor(() => {
      expect(
        screen.getByTestId("ansible-automation-platform-error-modal"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Copy technical details")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<AnsibleDeleteInstanceModal {...defaultProps} />);

    await user.click(screen.getByText("Cancel"));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
