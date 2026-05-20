import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";

function ThrowingComponent({ message }: { message: string }): never {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Normal content")).toBeInTheDocument();
  });

  it("renders fallback UI when a child throws", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent message="Test crash" />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test crash")).toBeInTheDocument();
    expect(screen.getByText("Reload page")).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
