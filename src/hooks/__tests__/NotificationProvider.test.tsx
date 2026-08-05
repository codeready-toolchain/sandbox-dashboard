import { AlertVariant } from "@patternfly/react-core";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ErrorSeverity, UserFacingError } from "../../error/UserFacingError";
import { useNotifications } from "../NotificationContext";
import { NotificationProvider } from "../NotificationProvider";

function TestConsumer() {
  const { addAlert, addAlertFromError } = useNotifications();
  return (
    <div>
      <button
        onClick={() =>
          addAlert(AlertVariant.success, "Test alert", "Description")
        }
      >
        Add Alert
      </button>
      <button
        onClick={() =>
          addAlert(AlertVariant.danger, "Danger alert", "Danger description")
        }
      >
        Add Danger Alert
      </button>
      <button
        onClick={() =>
          addAlertFromError(new UserFacingError("Error title", "Error detail"))
        }
      >
        Add Error From UserFacingError
      </button>
      <button
        onClick={() =>
          addAlertFromError(
            new UserFacingError(
              "Warning title",
              "Warning detail",
              undefined,
              undefined,
              ErrorSeverity.WARNING,
            ),
          )
        }
      >
        Add Warning From UserFacingError
      </button>
    </div>
  );
}

describe("NotificationProvider", () => {
  it("renders children", () => {
    render(
      <NotificationProvider>
        <div>Child content</div>
      </NotificationProvider>,
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("shows an alert when addAlert is called", async () => {
    const user = userEvent.setup();

    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>,
    );

    await user.click(screen.getByText("Add Alert"));
    expect(screen.getByText("Test alert")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("auto-dismisses non-danger alerts after timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>,
    );

    await act(async () => {
      screen.getByText("Add Alert").click();
    });

    expect(screen.getByText("Test alert")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });

    expect(screen.queryByText("Test alert")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("does not auto-dismiss danger alerts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>,
    );

    await act(async () => {
      screen.getByText("Add Danger Alert").click();
    });

    expect(screen.getByText("Danger alert")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(screen.getByText("Danger alert")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("allows manually closing a danger alert", async () => {
    const user = userEvent.setup();

    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>,
    );

    await user.click(screen.getByText("Add Danger Alert"));
    expect(screen.getByText("Danger alert")).toBeInTheDocument();

    await user.click(
      screen.getByLabelText("Close Danger alert: alert: Danger alert"),
    );
    expect(screen.queryByText("Danger alert")).not.toBeInTheDocument();
  });

  it("shows a danger alert from a UserFacingError with ERROR severity", async () => {
    const user = userEvent.setup();

    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>,
    );

    await user.click(screen.getByText("Add Error From UserFacingError"));
    expect(screen.getByText("Error title")).toBeInTheDocument();
    expect(screen.getByText("Error detail")).toBeInTheDocument();
  });

  it("shows a warning alert from a UserFacingError with WARNING severity", async () => {
    const user = userEvent.setup();

    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>,
    );

    await user.click(screen.getByText("Add Warning From UserFacingError"));
    expect(screen.getByText("Warning title")).toBeInTheDocument();
    expect(screen.getByText("Warning detail")).toBeInTheDocument();
  });
});

describe("useNotifications", () => {
  it("throws when used outside NotificationProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      "useNotifications must be used within NotificationProvider",
    );

    consoleError.mockRestore();
  });
});
