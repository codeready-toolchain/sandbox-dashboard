import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnsibleDeleteInstanceModal } from "../AnsibleDeleteInstanceModal";
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
    expect(screen.queryByTestId("ansible-delete-modal")).not.toBeInTheDocument();
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
      expect(screen.getByTestId("ansible-delete-error")).toBeInTheDocument();
    });
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<AnsibleDeleteInstanceModal {...defaultProps} />);

    await user.click(screen.getByText("Cancel"));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
