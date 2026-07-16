import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { UserFacingError } from "../../../error/UserFacingError";
import {
  AnsibleContext,
  type AnsibleContextType,
} from "../../../hooks/AnsibleContext";
import type { AAPInstanceCredentials } from "../../../types";
import { AAPInstanceErrorType } from "../../../utils/aap-utils";
import { AnsibleLaunchInfoModal } from "../AnsibleLaunchInfoModal";

const mockOnClose = vi.fn();

const defaultCredentials: AAPInstanceCredentials = {
  username: "admin",
  password: "secret-password",
  url: "https://aap.example.com",
};

function makeAnsibleContext(
  overrides: Partial<AnsibleContextType> = {},
): AnsibleContextType {
  return {
    deleteInstance: vi.fn(),
    fetchInstanceCredentials: vi.fn().mockResolvedValue(defaultCredentials),
    handleAAPInstance: vi.fn().mockResolvedValue(undefined),
    instanceStatus: { kind: "ready" },
    ...overrides,
  };
}

function renderModal(
  ansibleOverrides: Partial<AnsibleContextType> = {},
  modalProps: {
    isOpen?: boolean;
    provisioningError?: UserFacingError;
  } = {},
) {
  const ctx = makeAnsibleContext(ansibleOverrides);
  const { isOpen = true, provisioningError } = modalProps;

  const utils = render(
    <AnsibleContext.Provider value={ctx}>
      <AnsibleLaunchInfoModal
        isOpen={isOpen}
        onClose={mockOnClose}
        provisioningError={provisioningError}
      />
    </AnsibleContext.Provider>,
  );

  return { ...utils, ctx };
}

describe("AnsibleLaunchInfoModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    renderModal({}, { isOpen: false });
    expect(
      screen.queryByTestId("ansible-launch-info-modal"),
    ).not.toBeInTheDocument();
  });

  it("shows the provisioned title with two-account instructions when ready and credentials are loaded", async () => {
    renderModal({ instanceStatus: { kind: "ready" } });

    await waitFor(() => {
      expect(screen.getByText(/instance provisioned/)).toBeInTheDocument();
    });
    expect(screen.getByText(/two different accounts/)).toBeInTheDocument();
  });

  it("shows AAP admin account section with credentials once loaded", async () => {
    renderModal({ instanceStatus: { kind: "ready" } });

    await waitFor(() => {
      expect(screen.getByText("AAP admin account")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Log in to your AAP admin account/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("ansible-username")).toBeInTheDocument();
    expect(screen.getByTestId("ansible-password-field")).toBeInTheDocument();
  });

  it("shows Red Hat account section when credentials are ready", async () => {
    renderModal({ instanceStatus: { kind: "ready" } });

    await waitFor(() => {
      expect(screen.getByText("Red Hat account")).toBeInTheDocument();
    });
    expect(screen.getByText(/activate your subscription/)).toBeInTheDocument();
  });

  it("shows password toggle and copy buttons when credentials are loaded", async () => {
    renderModal({ instanceStatus: { kind: "ready" } });

    await waitFor(() => {
      expect(
        screen.getByTestId("toggle-password-visibility"),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("copy-password")).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    renderModal({ instanceStatus: { kind: "ready" } });

    await waitFor(() => {
      expect(screen.getByTestId("ansible-password-field")).toBeInTheDocument();
    });

    const passwordField = screen.getByTestId(
      "ansible-password-field",
    ) as HTMLInputElement;
    expect(passwordField.value).not.toContain("secret-password");

    await user.click(screen.getByTestId("toggle-password-visibility"));
    expect(passwordField.value).toBe("secret-password");

    await user.click(screen.getByTestId("toggle-password-visibility"));
    expect(passwordField.value).not.toContain("secret-password");
  });

  it("shows 'Get started' button with correct href when ready", async () => {
    renderModal({ instanceStatus: { kind: "ready" } });

    await waitFor(() => {
      expect(screen.getByTestId("get-started-button")).toBeInTheDocument();
    });
    expect(screen.getByTestId("get-started-button")).toHaveAttribute(
      "href",
      "https://aap.example.com",
    );
  });

  it("shows the access-again hint text when credentials are ready", async () => {
    renderModal({ instanceStatus: { kind: "ready" } });

    await waitFor(() => {
      expect(
        screen.getByText(/Access this information again/),
      ).toBeInTheDocument();
    });
  });

  it("shows provisioning spinner when AAP is provisioning", () => {
    renderModal({ instanceStatus: { kind: "provisioning" } });

    expect(
      screen.getByText(/instance is being provisioned/),
    ).toBeInTheDocument();
  });

  it("shows provisioning spinner when AAP status is 'new'", () => {
    renderModal({ instanceStatus: { kind: "new" } });

    expect(
      screen.getByText(/instance is being provisioned/),
    ).toBeInTheDocument();
  });

  it("shows provisioning spinner when AAP status is 'idled'", () => {
    renderModal({ instanceStatus: { kind: "idled" } });

    expect(
      screen.getByText(/instance is being provisioned/),
    ).toBeInTheDocument();
  });

  it("shows unidling spinner when AAP is unidling", () => {
    renderModal({ instanceStatus: { kind: "unidling" } });

    expect(
      screen.getByText(/instance is being reprovisioned/),
    ).toBeInTheDocument();
  });

  it("shows error modal when a provisioningError is provided", () => {
    const provisioningError = new UserFacingError(
      "Provision failed",
      "Something went wrong",
      undefined,
      "Technical details here",
    );

    renderModal(
      { instanceStatus: { kind: "provisioning" } },
      { provisioningError },
    );

    expect(
      screen.getByTestId("ansible-automation-platform-error"),
    ).toBeInTheDocument();
    expect(screen.getByText("Provision failed")).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    expect(screen.getByText(/copy the technical details/)).toBeInTheDocument();
  });

  it("calls onClose when the error modal is dismissed", async () => {
    const user = userEvent.setup();
    const provisioningError = new UserFacingError(
      "Provision failed",
      "Something went wrong",
    );

    renderModal({}, { provisioningError });

    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("shows Close button when not ready", () => {
    renderModal({ instanceStatus: { kind: "provisioning" } });

    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("calls fetchInstanceCredentials when open and status becomes ready", async () => {
    const fetchInstanceCredentials = vi
      .fn()
      .mockResolvedValue(defaultCredentials);

    renderModal({
      instanceStatus: { kind: "ready" },
      fetchInstanceCredentials,
    });

    await waitFor(() => {
      expect(fetchInstanceCredentials).toHaveBeenCalledTimes(1);
    });
  });

  it("shows credentials loading spinner while fetching credentials", () => {
    const fetchInstanceCredentials = vi
      .fn()
      .mockReturnValue(new Promise(() => {}));

    renderModal({
      instanceStatus: { kind: "ready" },
      fetchInstanceCredentials,
    });

    expect(
      screen.getByText(/obtaining your provisioned instance/),
    ).toBeInTheDocument();
  });

  it("shows error modal with UserFacingError.detail when credential fetching fails with UserFacingError", async () => {
    const fetchInstanceCredentials = vi
      .fn()
      .mockRejectedValue(
        new UserFacingError("Creds failed", "Unable to fetch credentials"),
      );

    renderModal({
      instanceStatus: { kind: "ready" },
      fetchInstanceCredentials,
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("ansible-automation-platform-error"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("Unable to obtain the credentials for your instance"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/error occurred while attempting to fetch/),
    ).toBeInTheDocument();
    expect(screen.getByText("Copy technical details")).toBeInTheDocument();
  });

  it("shows error modal with Error.message when credential fetching fails with a generic error", async () => {
    const fetchInstanceCredentials = vi
      .fn()
      .mockRejectedValue(new Error("network error"));

    renderModal({
      instanceStatus: { kind: "ready" },
      fetchInstanceCredentials,
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("ansible-automation-platform-error"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("Unable to obtain the credentials for your instance"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/error occurred while attempting to fetch/),
    ).toBeInTheDocument();
    expect(screen.getByText("Copy technical details")).toBeInTheDocument();
  });

  it("does not fetch credentials when modal is closed", () => {
    const fetchInstanceCredentials = vi
      .fn()
      .mockResolvedValue(defaultCredentials);

    renderModal(
      { instanceStatus: { kind: "ready" }, fetchInstanceCredentials },
      { isOpen: false },
    );

    expect(fetchInstanceCredentials).not.toHaveBeenCalled();
  });

  it("shows unknown status message when status is 'unknown' and no provisioning error", () => {
    renderModal({ instanceStatus: { kind: "unknown" } });

    expect(
      screen.getByText(/Unable to determine the status/),
    ).toBeInTheDocument();
  });

  it("does not show provisioned content when status is 'deleting'", () => {
    renderModal({ instanceStatus: { kind: "deleting" } });

    expect(screen.queryByText(/instance provisioned/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/instance is being provisioned/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/instance is being reprovisioned/),
    ).not.toBeInTheDocument();
  });

  it("shows Close button when status is 'deleting'", () => {
    renderModal({ instanceStatus: { kind: "deleting" } });

    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("does not show Get started button when status is 'deleting'", () => {
    renderModal({ instanceStatus: { kind: "deleting" } });

    expect(screen.queryByTestId("get-started-button")).not.toBeInTheDocument();
  });

  it("does not fetch credentials when status is not 'ready'", () => {
    const fetchInstanceCredentials = vi
      .fn()
      .mockResolvedValue(defaultCredentials);

    renderModal({
      instanceStatus: { kind: "provisioning" },
      fetchInstanceCredentials,
    });

    expect(fetchInstanceCredentials).not.toHaveBeenCalled();
  });

  it("does not fetch credentials when status is 'error'", () => {
    const fetchInstanceCredentials = vi
      .fn()
      .mockResolvedValue(defaultCredentials);

    renderModal({
      instanceStatus: {
        kind: "error",
        errorType: AAPInstanceErrorType.INITIAL_FETCH_FAILED,
      },
      fetchInstanceCredentials,
    });

    expect(fetchInstanceCredentials).not.toHaveBeenCalled();
  });

  it("resets credential state when credential error modal is dismissed and allows refetch", async () => {
    const user = userEvent.setup();
    let callCount = 0;
    const fetchInstanceCredentials = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(
          new UserFacingError("Creds failed", "Unable to fetch credentials"),
        );
      }
      return Promise.resolve(defaultCredentials);
    });

    const ctx = makeAnsibleContext({
      instanceStatus: { kind: "ready" },
      fetchInstanceCredentials,
    });

    function ControlledModal() {
      const [isOpen, setIsOpen] = useState(true);
      const handleClose = () => {
        mockOnClose();
        setIsOpen(false);
      };
      return (
        <>
          <AnsibleContext.Provider value={ctx}>
            <AnsibleLaunchInfoModal isOpen={isOpen} onClose={handleClose} />
          </AnsibleContext.Provider>
          <button data-testid="reopen" onClick={() => setIsOpen(true)} />
        </>
      );
    }

    render(<ControlledModal />);

    await waitFor(() => {
      expect(
        screen.getByTestId("ansible-automation-platform-error"),
      ).toBeInTheDocument();
    });

    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();

    await user.click(screen.getByTestId("reopen"));

    await waitFor(() => {
      expect(fetchInstanceCredentials).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByTestId("ansible-username")).toBeInTheDocument();
    });
    expect(screen.getByTestId("ansible-password-field")).toBeInTheDocument();
  });
});
