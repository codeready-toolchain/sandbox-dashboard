import { render, screen, waitFor } from "@testing-library/react";
import { setTokenGetter } from "../../api/authFetch";
import { server } from "../../mocks/server";
import { UIConfigurationProvider } from "../UIConfigurationProvider";
import { useUIConfigurationContext } from "../UIConfigurationContext";

function ContextConsumer() {
  const ctx = useUIConfigurationContext();
  return (
    <div>
      <span data-testid="disabledIntegrations">
        {JSON.stringify(ctx.disabledIntegrations)}
      </span>
      <span data-testid="marketoWebhookURL">{ctx.marketoWebhookURL ?? ""}</span>
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

describe("UIConfigurationProvider", () => {
  it("fetches disabled integrations and marketo webhook URL from UI config", async () => {
    render(
      <UIConfigurationProvider>
        <ContextConsumer />
      </UIConfigurationProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("disabledIntegrations").textContent).toBe("[]");
    });

    expect(screen.getByTestId("marketoWebhookURL").textContent).toBe(
      "https://webhooks.example.com/sandbox",
    );
  });
});

describe("useUIConfigurationContext", () => {
  it("throws when used outside UIConfigurationProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<ContextConsumer />)).toThrow(
      "Context useUIConfigurationContext is not defined",
    );

    consoleError.mockRestore();
  });
});
