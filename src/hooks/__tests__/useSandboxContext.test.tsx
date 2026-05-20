import { render, screen, waitFor } from "@testing-library/react";
import { server } from "../../mocks/server";
import { setTokenGetter } from "../../api/authFetch";
import {
  SandboxProvider,
  useSandboxContext,
} from "../useSandboxContext";

function ContextConsumer() {
  const ctx = useSandboxContext();
  return (
    <div>
      <span data-testid="status">{ctx.userStatus}</span>
      <span data-testid="userFound">{String(ctx.userFound)}</span>
      <span data-testid="userReady">{String(ctx.userReady)}</span>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="givenName">{ctx.userData?.givenName ?? ""}</span>
      <span data-testid="disabledIntegrations">
        {JSON.stringify(ctx.disabledIntegrations)}
      </span>
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

describe("SandboxProvider", () => {
  it("fetches user data and provides it via context", async () => {
    render(
      <SandboxProvider>
        <ContextConsumer />
      </SandboxProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("userFound").textContent).toBe("true");
    expect(screen.getByTestId("userReady").textContent).toBe("true");
    expect(screen.getByTestId("status").textContent).toBe("ready");
    expect(screen.getByTestId("givenName").textContent).toBe("John");
  });

  it("fetches disabled integrations from UI config", async () => {
    render(
      <SandboxProvider>
        <ContextConsumer />
      </SandboxProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("disabledIntegrations").textContent).toBe(
        "[]",
      );
    });
  });
});

describe("useSandboxContext", () => {
  it("throws when used outside SandboxProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<ContextConsumer />)).toThrow(
      "Context useSandboxContext is not defined",
    );

    consoleError.mockRestore();
  });
});
