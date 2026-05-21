import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnsibleLaunchInfoModal } from "../AnsibleLaunchInfoModal";
import { AnsibleStatus } from "../../../utils/aap-utils";

const mockOnClose = vi.fn();

const defaultProps = {
  isOpen: true,
  onClose: mockOnClose,
  ansibleUILink: "https://aap.example.com",
  ansibleUIUser: "admin",
  ansibleUIPassword: "secret-password",
  ansibleStatus: AnsibleStatus.READY,
  ansibleError: null,
};

describe("AnsibleLaunchInfoModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    render(<AnsibleLaunchInfoModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId("ansible-launch-info-modal")).not.toBeInTheDocument();
  });

  it("shows the provisioned title with two-account instructions when ready", () => {
    render(<AnsibleLaunchInfoModal {...defaultProps} />);
    expect(screen.getByText(/instance provisioned/)).toBeInTheDocument();
    expect(screen.getByText(/two different accounts/)).toBeInTheDocument();
  });

  it("shows AAP admin account section with credentials", () => {
    render(<AnsibleLaunchInfoModal {...defaultProps} />);
    expect(screen.getByText("AAP admin account")).toBeInTheDocument();
    expect(screen.getByText(/Log in to your AAP admin account/)).toBeInTheDocument();
    expect(screen.getByTestId("ansible-username")).toBeInTheDocument();
    expect(screen.getByTestId("ansible-password-field")).toBeInTheDocument();
  });

  it("shows Red Hat account section", () => {
    render(<AnsibleLaunchInfoModal {...defaultProps} />);
    expect(screen.getByText("Red Hat account")).toBeInTheDocument();
    expect(screen.getByText(/activate your subscription/)).toBeInTheDocument();
  });

  it("shows password toggle and copy buttons", () => {
    render(<AnsibleLaunchInfoModal {...defaultProps} />);
    expect(screen.getByTestId("toggle-password-visibility")).toBeInTheDocument();
    expect(screen.getByTestId("copy-password")).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<AnsibleLaunchInfoModal {...defaultProps} />);

    const passwordField = screen.getByTestId("ansible-password-field") as HTMLInputElement;
    expect(passwordField.value).not.toContain("secret-password");

    await user.click(screen.getByTestId("toggle-password-visibility"));
    expect(passwordField.value).toBe("secret-password");

    await user.click(screen.getByTestId("toggle-password-visibility"));
    expect(passwordField.value).not.toContain("secret-password");
  });

  it("shows 'Get started' button when ready", () => {
    render(<AnsibleLaunchInfoModal {...defaultProps} />);
    expect(screen.getByTestId("get-started-button")).toBeInTheDocument();
    expect(screen.getByText("Get started")).toBeInTheDocument();
  });

  it("shows the access-again hint text", () => {
    render(<AnsibleLaunchInfoModal {...defaultProps} />);
    expect(screen.getByText(/Access this information again/)).toBeInTheDocument();
  });

  it("shows provisioning spinner when AAP is provisioning", () => {
    render(
      <AnsibleLaunchInfoModal
        {...defaultProps}
        ansibleStatus={AnsibleStatus.PROVISIONING}
      />,
    );
    expect(screen.getByText(/instance is being provisioned/)).toBeInTheDocument();
  });

  it("shows error when ansibleError is set", () => {
    render(
      <AnsibleLaunchInfoModal
        {...defaultProps}
        ansibleError="Something went wrong"
      />,
    );
    expect(screen.getByTestId("ansible-error")).toBeInTheDocument();
  });

  it("shows Close button only when not ready", () => {
    render(
      <AnsibleLaunchInfoModal
        {...defaultProps}
        ansibleStatus={AnsibleStatus.PROVISIONING}
      />,
    );
    expect(screen.getByText("Close")).toBeInTheDocument();
  });
});
