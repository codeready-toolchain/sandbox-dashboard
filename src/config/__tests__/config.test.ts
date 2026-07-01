import { afterEach, describe, expect, it } from "vitest";
import { Environment, getConfig } from "../config";

describe("getConfig", () => {
  afterEach(() => {
    delete window.__config__;
  });

  it("throws when window.__config__ is not defined", () => {
    expect(() => getConfig()).toThrow(
      "window.__config__ is not defined. Is config.js loaded?",
    );
  });

  it("throws for unknown environment", () => {
    window.__config__ = {
      registrationServiceURL: "http://localhost",
      recaptchaSiteKey: "key",
      environment: "invalid",
    };
    expect(() => getConfig()).toThrow(
      'Unknown environment specified: "invalid"',
    );
  });

  describe("dev-keycloak environment", () => {
    it("parses with valid auth config", () => {
      window.__config__ = {
        registrationServiceURL: "http://localhost:8080",
        recaptchaSiteKey: "test-key",
        environment: "dev-keycloak",
        auth: {
          url: "http://localhost:8180",
          realm: "sandbox",
          clientId: "sandbox-client",
        },
      };

      const config = getConfig();
      if (config.environment !== Environment.DEVELOPMENT_KEYCLOAK) {
        throw new Error("expected dev-keycloak environment");
      }
      expect(config.auth.url).toBe("http://localhost:8180");
      expect(config.auth.realm).toBe("sandbox");
      expect(config.auth.clientId).toBe("sandbox-client");
    });

    it("throws when auth is not provided", () => {
      window.__config__ = {
        registrationServiceURL: "http://localhost:8080",
        recaptchaSiteKey: "test-key",
        environment: "dev-keycloak",
      };

      expect(() => getConfig()).toThrow(
        /you need to specify an "auth" object with the "clientId", "realm" and "url" fields/,
      );
    });

    it("throws when clientId is missing", () => {
      window.__config__ = {
        registrationServiceURL: "http://localhost:8080",
        recaptchaSiteKey: "test-key",
        environment: "dev-keycloak",
        auth: {
          url: "http://localhost:8180",
          realm: "sandbox",
          clientId: "",
        },
      };

      expect(() => getConfig()).toThrow(
        /Missing required configuration field: "clientId"/,
      );
    });

    it("throws when clientId is whitespace only", () => {
      window.__config__ = {
        registrationServiceURL: "http://localhost:8080",
        recaptchaSiteKey: "test-key",
        environment: "dev-keycloak",
        auth: {
          url: "http://localhost:8180",
          realm: "sandbox",
          clientId: "   ",
        },
      };

      expect(() => getConfig()).toThrow(
        /Missing required configuration field: "clientId"/,
      );
    });

    it("throws when realm is missing", () => {
      window.__config__ = {
        registrationServiceURL: "http://localhost:8080",
        recaptchaSiteKey: "test-key",
        environment: "dev-keycloak",
        auth: {
          url: "http://localhost:8180",
          realm: "",
          clientId: "sandbox-client",
        },
      };

      expect(() => getConfig()).toThrow(
        /Missing required configuration field: "realm"/,
      );
    });

    it("throws when realm is whitespace only", () => {
      window.__config__ = {
        registrationServiceURL: "http://localhost:8080",
        recaptchaSiteKey: "test-key",
        environment: "dev-keycloak",
        auth: {
          url: "http://localhost:8180",
          realm: "   ",
          clientId: "sandbox-client",
        },
      };

      expect(() => getConfig()).toThrow(
        /Missing required configuration field: "realm"/,
      );
    });

    it("throws when url is missing", () => {
      window.__config__ = {
        registrationServiceURL: "http://localhost:8080",
        recaptchaSiteKey: "test-key",
        environment: "dev-keycloak",
        auth: {
          url: "",
          realm: "sandbox",
          clientId: "sandbox-client",
        },
      };
      expect(() => getConfig()).toThrow(
        /Missing required configuration field: "url"/,
      );
    });

    it("throws when url is whitespace only", () => {
      window.__config__ = {
        registrationServiceURL: "http://localhost:8080",
        recaptchaSiteKey: "test-key",
        environment: "dev-keycloak",
        auth: {
          url: "   ",
          realm: "sandbox",
          clientId: "sandbox-client",
        },
      };
      expect(() => getConfig()).toThrow(
        /Missing required configuration field: "url"/,
      );
    });
  });

  it("throws when dev-stage has no auth", () => {
    window.__config__ = {
      registrationServiceURL: "http://localhost",
      recaptchaSiteKey: "key",
      environment: "dev-stage",
    };
    expect(() => getConfig()).toThrow(
      'In the "dev-stage" environment you need to specify an "auth" object with the "clientId" key.',
    );
  });

  it("throws when dev-stage has empty clientId", () => {
    window.__config__ = {
      registrationServiceURL: "http://localhost",
      recaptchaSiteKey: "key",
      environment: "dev-stage",
      auth: {
        url: "https://sso.example.com",
        realm: "sandbox",
        clientId: "   ",
      },
    };
    expect(() => getConfig()).toThrow(
      /Missing required configuration field: "clientId"/,
    );
  });

  it('parses "dev" environment correctly', () => {
    window.__config__ = {
      registrationServiceURL: "http://localhost:8080",
      recaptchaSiteKey: "test-key",
      environment: "dev",
    };
    const config = getConfig();
    expect(config.environment).toBe(Environment.DEVELOPMENT);
    expect(config.recaptchaSiteKey).toBe("test-key");
    expect(config.registrationServiceURL).toBe("http://localhost:8080");
  });

  it('parses "prod" environment correctly', () => {
    window.__config__ = {
      registrationServiceURL: "https://api.redhat.com",
      recaptchaSiteKey: "prod-key",
      environment: "prod",
    };
    const config = getConfig();
    expect(config.environment).toBe(Environment.PRODUCTION);
    expect(config.recaptchaSiteKey).toBe("prod-key");
    expect(config.registrationServiceURL).toBe("https://api.redhat.com");
  });

  it('parses "dev-stage" environment with valid auth', () => {
    window.__config__ = {
      registrationServiceURL: "https://stage.example.com",
      recaptchaSiteKey: "stage-key",
      environment: "dev-stage",
      auth: {
        url: "https://sso.stage.example.com",
        realm: "sandbox",
        clientId: "my-client-id",
      },
    };
    const config = getConfig();
    expect(config.environment).toBe(Environment.DEVELOPMENT_STAGE);
    expect(config.recaptchaSiteKey).toBe("stage-key");
    expect(config.auth?.clientId).toBe("my-client-id");
  });
});
