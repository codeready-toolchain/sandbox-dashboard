import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationProvider } from "../NotificationContext";
import { useNotifications } from "../useNotifications";

function TestConsumer() {
  const { addAlert } = useNotifications();
  return (
    <button
      onClick={() => addAlert("success" as never, "Test alert", "Description")}
    >
      Add Alert
    </button>
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
