import Keycloak from "keycloak-js";
import { http, HttpResponse } from "msw";
import { setTokenGetter } from "../../api/authFetch";
import { Environment, type AppConfig } from "../../config/config";
import { authConfigFixture } from "../../mocks/fixtures/registration-fixtures";
import { server } from "../../mocks/server";
import initializeKeycloak from "../initializeKeycloak";

vi.mock("keycloak-js", () => {
  const MockKeycloak = vi.fn();
  return { default: MockKeycloak };
});
vi.mock("../../api/authFetch", () => ({
  setTokenGetter: vi.fn(),
}));

const MOCK_REG_URL = "https://registration.example.com";

const mockKeycloakInstance = {
  init: vi.fn(),
  updateToken: vi.fn(),
  logout: vi.fn(),
  token: "mock-token",
  tokenParsed: {
    given_name: "Jane",
    family_name: "Doe",
    email: "jane@example.com",
    preferred_username: "janedoe",
  },
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

beforeEach(() => {
  vi.mocked(Keycloak).mockImplementation(function () {
    return mockKeycloakInstance as unknown as Keycloak;
  });
  mockKeycloakInstance.init.mockResolvedValue(true);
});

describe("initializeKeycloak", () => {
  describe("DEVELOPMENT environment", () => {
    const config: AppConfig = {
      environment: Environment.DEVELOPMENT,
      registrationServiceURL: MOCK_REG_URL,
      recaptchaSiteKey: "test-key",
    };

    it("returns a fake context value", async () => {
      const result = await initializeKeycloak(config);

      expect(result.token).toBe("dev-fake-token");
      expect(result.givenName).toBe("Developer");
      expect(result.familyName).toBe("Sandbox");
      expect(result.email).toBe("dev@example.com");
      expect(result.username).toBe("dev-user");
    });

    it("sets the token getter", async () => {
      await initializeKeycloak(config);

      expect(setTokenGetter).toHaveBeenCalled();
    });

    it("does not create a Keycloak instance", async () => {
      await initializeKeycloak(config);

      expect(Keycloak).not.toHaveBeenCalled();
    });
  });

  describe("DEVELOPMENT_KEYCLOAK environment", () => {
    const config: AppConfig = {
      environment: Environment.DEVELOPMENT_KEYCLOAK,
      registrationServiceURL: MOCK_REG_URL,
      recaptchaSiteKey: "test-key",
      auth: {
        clientId: "my-client",
        realm: "my-realm",
        url: "http://localhost:8080",
      },
    };

    it("creates Keycloak from the provided auth config", async () => {
      await initializeKeycloak(config);

      expect(Keycloak).toHaveBeenCalledWith({
        clientId: "my-client",
        realm: "my-realm",
        url: "http://localhost:8080",
      });
    });

    it("initializes Keycloak with login-required", async () => {
      await initializeKeycloak(config);

      expect(mockKeycloakInstance.init).toHaveBeenCalledWith({
        onLoad: "login-required",
        checkLoginIframe: false,
      });
    });

    it("returns the authenticated context value from token claims", async () => {
      const result = await initializeKeycloak(config);

      expect(result.token).toBe("mock-token");
      expect(result.givenName).toBe("Jane");
      expect(result.familyName).toBe("Doe");
      expect(result.email).toBe("jane@example.com");
      expect(result.username).toBe("janedoe");
    });

    it("sets the token getter", async () => {
      await initializeKeycloak(config);

      expect(setTokenGetter).toHaveBeenCalled();
    });
  });

  describe("DEVELOPMENT_STAGE environment", () => {
    const config: AppConfig = {
      environment: Environment.DEVELOPMENT_STAGE,
      registrationServiceURL: MOCK_REG_URL,
      recaptchaSiteKey: "test-key",
      auth: { clientId: "stage-client" },
    };

    beforeEach(() => {
      server.use(
        http.get(`${MOCK_REG_URL}/api/v1/authconfig`, () =>
          HttpResponse.json(authConfigFixture),
        ),
      );
    });

    it("fetches remote config and creates Keycloak with proxy token endpoint", async () => {
      await initializeKeycloak(config);

      expect(Keycloak).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "stage-client",
          oidcProvider: expect.objectContaining({
            token_endpoint: expect.stringContaining("/vite-sso-token-proxy"),
          }),
        }),
      );
    });

    it("builds the correct OIDC provider endpoints", async () => {
      await initializeKeycloak(config);

      const realmUrl =
        "https://sso.devsandbox.dev/auth/realms/sandbox-dev/protocol/openid-connect";

      expect(Keycloak).toHaveBeenCalledWith({
        clientId: "stage-client",
        oidcProvider: {
          authorization_endpoint: `${realmUrl}/auth`,
          token_endpoint: `/vite-sso-token-proxy${realmUrl}/token`,
          end_session_endpoint: `${realmUrl}/logout`,
          userinfo_endpoint: `${realmUrl}/userinfo`,
        },
      });
    });

    it("returns the authenticated context value", async () => {
      const result = await initializeKeycloak(config);

      expect(result.token).toBe("mock-token");
    });
  });

  describe("PRODUCTION environment", () => {
    const config: AppConfig = {
      environment: Environment.PRODUCTION,
      registrationServiceURL: MOCK_REG_URL,
      recaptchaSiteKey: "test-key",
    };

    beforeEach(() => {
      server.use(
        http.get(`${MOCK_REG_URL}/api/v1/authconfig`, () =>
          HttpResponse.json(authConfigFixture),
        ),
      );
    });

    it("fetches remote config and creates Keycloak from it", async () => {
      await initializeKeycloak(config);

      expect(Keycloak).toHaveBeenCalledWith({
        url: "https://sso.devsandbox.dev/auth",
        realm: "sandbox-dev",
        clientId: "sandbox-public",
      });
    });

    it("returns the authenticated context value from token claims", async () => {
      const result = await initializeKeycloak(config);

      expect(result.email).toBe("jane@example.com");
      expect(result.username).toBe("janedoe");
    });
  });

  describe("token refresh", () => {
    it("sets a token getter that refreshes the token via updateToken", async () => {
      mockKeycloakInstance.updateToken.mockResolvedValue(true);

      const config: AppConfig = {
        environment: Environment.DEVELOPMENT_KEYCLOAK,
        registrationServiceURL: MOCK_REG_URL,
        recaptchaSiteKey: "test-key",
        auth: {
          clientId: "c",
          realm: "r",
          url: "http://localhost",
        },
      };

      await initializeKeycloak(config);

      const registeredGetter = vi.mocked(setTokenGetter).mock.calls[0][0];
      const token = await registeredGetter();

      expect(mockKeycloakInstance.updateToken).toHaveBeenCalledWith(30);
      expect(token).toBe("mock-token");
    });
  });

  describe("error handling", () => {
    it("throws when keycloak.init resolves with false", async () => {
      mockKeycloakInstance.init.mockResolvedValue(false);

      const config: AppConfig = {
        environment: Environment.DEVELOPMENT_KEYCLOAK,
        registrationServiceURL: MOCK_REG_URL,
        recaptchaSiteKey: "test-key",
        auth: {
          clientId: "c",
          realm: "r",
          url: "http://localhost",
        },
      };

      await expect(initializeKeycloak(config)).rejects.toThrow(
        "Authentication failed",
      );
    });

    it("throws when the authconfig fetch fails", async () => {
      server.use(
        http.get(
          `${MOCK_REG_URL}/api/v1/authconfig`,
          () => new HttpResponse(null, { status: 500 }),
        ),
      );

      const config: AppConfig = {
        environment: Environment.PRODUCTION,
        registrationServiceURL: MOCK_REG_URL,
        recaptchaSiteKey: "test-key",
      };

      await expect(initializeKeycloak(config)).rejects.toThrow(
        "Failed to fetch the configuration for the authentication client: 500",
      );
    });
  });
});
