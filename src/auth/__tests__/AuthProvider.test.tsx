import { render, screen } from "@testing-library/react";
import { AuthProvider } from "../AuthProvider";
import { useAuth } from "../useAuth";

function AuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="authenticated">{String(auth.authenticated)}</span>
      <span data-testid="givenName">{auth.givenName}</span>
      <span data-testid="familyName">{auth.familyName}</span>
      <span data-testid="email">{auth.email}</span>
      <span data-testid="username">{auth.username}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeAll(() => {
    window.__config__ = {
      registrationServiceURL: "https://registration.example.com",
      recaptchaSiteKey: "test-site-key",
      environment: "dev",
    };
  });

  it("provides fake auth context in dev bypass mode", () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("authenticated").textContent).toBe("true");
    expect(screen.getByTestId("givenName").textContent).toBe("Developer");
    expect(screen.getByTestId("familyName").textContent).toBe("Sandbox");
    expect(screen.getByTestId("email").textContent).toBe("dev@example.com");
    expect(screen.getByTestId("username").textContent).toBe("dev-user");
  });

  it("renders children in dev bypass mode", () => {
    render(
      <AuthProvider>
        <div>Test Child</div>
      </AuthProvider>,
    );

    expect(screen.getByText("Test Child")).toBeInTheDocument();
  });
});

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<AuthConsumer />)).toThrow(
      "useAuth must be used within an AuthProvider",
    );

    consoleError.mockRestore();
  });
});
