import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CriticalErrorPage } from "../CriticalErrorPage";
import { CriticalError } from "../../error/CriticalError";

describe("CriticalErrorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the user-facing error message", () => {
    const error = new CriticalError("Something went terribly wrong.");
    render(<CriticalErrorPage error={error} />);

    expect(
      screen.getByText("Something went terribly wrong."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Unable to load the Developer Sandbox"),
    ).toBeInTheDocument();
  });

  it("renders Reload page and Contact support actions", () => {
    const error = new CriticalError("An error occurred.");
    render(<CriticalErrorPage error={error} />);

    expect(screen.getByText("Reload page")).toBeInTheDocument();
    expect(screen.getByText("Contact support")).toBeInTheDocument();
  });

  it("does not render copy button when error has no cause", () => {
    const error = new CriticalError("An error occurred.");
    render(<CriticalErrorPage error={error} />);

    expect(
      screen.queryByText("Copy technical details"),
    ).not.toBeInTheDocument();
  });

  it("renders copy button when error has a cause", () => {
    const error = new CriticalError(
      "An error occurred.",
      new Error("upstream failure"),
    );
    render(<CriticalErrorPage error={error} />);

    expect(screen.getByText("Copy technical details")).toBeInTheDocument();
  });

  it("shows 'Copied!' on successful clipboard write", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const error = new CriticalError(
      "An error occurred.",
      new Error("upstream failure"),
    );
    render(<CriticalErrorPage error={error} />);

    fireEvent.click(screen.getByText("Copy technical details"));

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
    expect(writeText).toHaveBeenCalledWith("upstream failure");
  });

  it("shows 'Unable to copy' on clipboard write failure", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Not allowed"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const error = new CriticalError(
      "An error occurred.",
      new Error("upstream failure"),
    );
    render(<CriticalErrorPage error={error} />);

    fireEvent.click(screen.getByText("Copy technical details"));

    await waitFor(() => {
      expect(screen.getByText("Unable to copy")).toBeInTheDocument();
    });
  });

  it("handles non-Error cause objects via errorMessage", () => {
    const error = new CriticalError("An error occurred.", {
      message: "structured error",
    });
    render(<CriticalErrorPage error={error} />);

    expect(screen.getByText("Copy technical details")).toBeInTheDocument();
  });
});
