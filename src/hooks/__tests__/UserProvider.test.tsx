import { render, screen, waitFor } from "@testing-library/react";
import { setTokenGetter } from "../../api/authFetch";
import { server } from "../../mocks/server";
import { UserProvider } from "../UserProvider";
import { useUserContext } from "../UserContext";

function ContextConsumer() {
  const ctx = useUserContext();
  return (
    <div>
      <span data-testid="status">{ctx.userStatus}</span>
      <span data-testid="userFound">{String(ctx.userFound)}</span>
      <span data-testid="userReady">{String(ctx.userReady)}</span>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="givenName">{ctx.userData?.givenName ?? ""}</span>
    </div>
  );
}

beforeAll(() => {
  window.__config__ = {
    registrationServiceURL: "https://registration.example.com",
    recaptchaSiteKey: "test-site-key",
    environment: "dev",
  };
  setTokenGetter(async () => "test-token");
  server.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("UserProvider", () => {
  it("fetches user data and provides it via context", async () => {
    render(
      <UserProvider>
        <ContextConsumer />
      </UserProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("userFound").textContent).toBe("true");
    expect(screen.getByTestId("userReady").textContent).toBe("true");
    expect(screen.getByTestId("status").textContent).toBe("ready");
    expect(screen.getByTestId("givenName").textContent).toBe("John");
  });
});

describe("useUserContext", () => {
  it("throws when used outside UserProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<ContextConsumer />)).toThrow(
      "Context useUserContext is not defined",
    );

    consoleError.mockRestore();
  });
});
