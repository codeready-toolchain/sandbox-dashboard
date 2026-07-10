import { http, HttpResponse } from "msw";
import { ApiError } from "../../error/ApiError";
import { server } from "../../mocks/server";
import { setTokenGetter } from "../authFetch";
import {
  getSignupData,
  getRecaptchaToken,
  initiatePhoneVerification,
  completePhoneVerification,
  verifyActivationCode,
  getUIConfig,
  getSegmentWriteKey,
  resetWorkspaces,
} from "../registration";
import { readyUserFixture, uiConfigFixture } from "../../mocks/fixtures";

const REG_URL = "https://registration.example.com";

beforeAll(() => {
  window.__config__ = {
    registrationServiceURL: REG_URL,
    recaptchaSiteKey: "test-site-key",
    environment: "dev",
  };
  setTokenGetter(async () => "test-token");
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("getSignupData", () => {
  it("should return signup data on successful response", async () => {
    server.use(
      http.get(`${REG_URL}/api/v1/signup`, () => {
        return HttpResponse.json(readyUserFixture);
      }),
    );

    const result = await getSignupData();
    expect(result).toEqual(readyUserFixture);
  });

  it("should return undefined on 404 response", async () => {
    server.use(
      http.get(`${REG_URL}/api/v1/signup`, () => {
        return new HttpResponse(null, { status: 404 });
      }),
    );

    const result = await getSignupData();
    expect(result).toBeUndefined();
  });

  it("should throw error on other unsuccessful responses", async () => {
    server.use(
      http.get(`${REG_URL}/api/v1/signup`, () => {
        return HttpResponse.json(
          { message: "internal failure" },
          { status: 500 },
        );
      }),
    );

    const error = await getSignupData().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(500);
    expect(error.body).toContain("internal failure");
  });
});

describe("getRecaptchaToken", () => {
  const g = globalThis as Record<string, unknown>;
  const originalGrecaptcha = g.grecaptcha;

  afterEach(() => {
    g.grecaptcha = originalGrecaptcha;
  });

  it("resolves with the token when execute succeeds", async () => {
    g.grecaptcha = {
      enterprise: {
        ready: (cb: () => void) => cb(),
        execute: vi.fn().mockResolvedValue("test-token-value"),
      },
    };

    await expect(getRecaptchaToken()).resolves.toBe("test-token-value");
  });

  it("rejects when execute throws", async () => {
    g.grecaptcha = {
      enterprise: {
        ready: (cb: () => void) => cb(),
        execute: vi.fn().mockRejectedValue(new Error("execute failed")),
      },
    };

    await expect(getRecaptchaToken()).rejects.toThrow("Recaptcha failure.");
  });

  it("rejects when grecaptcha.enterprise is not available", async () => {
    g.grecaptcha = {};

    await expect(getRecaptchaToken()).rejects.toThrow("Recaptcha failure.");
  });

  it("rejects with timeout when execute hangs beyond the deadline", async () => {
    vi.useFakeTimers();
    try {
      g.grecaptcha = {
        enterprise: {
          ready: (cb: () => void) => cb(),
          execute: () => new Promise(() => {}),
        },
      };

      const promise = getRecaptchaToken();
      const caught = promise.catch((e: unknown) => e);

      await vi.advanceTimersByTimeAsync(10_000);

      const error = await caught;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Recaptcha timeout.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not resolve after timeout has fired even if execute eventually completes", async () => {
    vi.useFakeTimers();
    try {
      let resolveExecute!: (v: string) => void;
      g.grecaptcha = {
        enterprise: {
          ready: (cb: () => void) => cb(),
          execute: () =>
            new Promise<string>((r) => {
              resolveExecute = r;
            }),
        },
      };

      const promise = getRecaptchaToken();
      const caught = promise.catch((e: unknown) => e);

      await vi.advanceTimersByTimeAsync(10_000);

      const error = await caught;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Recaptcha timeout.");

      resolveExecute("late-token");
      await vi.advanceTimersByTimeAsync(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("initiatePhoneVerification", () => {
  it("should successfully initiate phone verification", async () => {
    server.use(
      http.put(`${REG_URL}/api/v1/signup/verification`, () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await expect(
      initiatePhoneVerification("+1", "1234567890"),
    ).resolves.toBeUndefined();
  });

  it("should throw on unsuccessful response from backend", async () => {
    server.use(
      http.put(`${REG_URL}/api/v1/signup/verification`, () => {
        return HttpResponse.json(
          { message: "Invalid 'To' Phone Number" },
          { status: 400 },
        );
      }),
    );

    const error = await initiatePhoneVerification("+1", "1234567890").catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(400);
    expect(error.body).toContain("Invalid 'To' Phone Number");
  });
});

describe("completePhoneVerification", () => {
  it("should successfully complete phone verification", async () => {
    server.use(
      http.get(`${REG_URL}/api/v1/signup/verification/123456`, () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await expect(completePhoneVerification("123456")).resolves.not.toThrow();
  });

  it("should throw error on unsuccessful verification", async () => {
    server.use(
      http.get(`${REG_URL}/api/v1/signup/verification/badcode`, () => {
        return HttpResponse.json(
          { message: "Invalid verification code" },
          { status: 400 },
        );
      }),
    );

    const error = await completePhoneVerification("badcode").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(400);
    expect(error.body).toContain("Invalid verification code");
  });
});

describe("verifyActivationCode", () => {
  it("should successfully verify activation code", async () => {
    server.use(
      http.post(`${REG_URL}/api/v1/signup/verification/activation-code`, () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await expect(verifyActivationCode("123456")).resolves.not.toThrow();
  });

  it("should throw error on unsuccessful verification", async () => {
    server.use(
      http.post(`${REG_URL}/api/v1/signup/verification/activation-code`, () => {
        return HttpResponse.json(
          { message: "Invalid activation code" },
          { status: 400 },
        );
      }),
    );

    const error = await verifyActivationCode("badcode").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(400);
    expect(error.body).toContain("Invalid activation code");
  });
});

describe("getUIConfig", () => {
  it("should return UI config with workatoWebHookURL", async () => {
    server.use(
      http.get(`${REG_URL}/api/v1/uiconfig`, () => {
        return HttpResponse.json(uiConfigFixture);
      }),
    );

    const result = await getUIConfig();
    expect(result).toEqual(uiConfigFixture);
  });

  it("should return UI config with disabledIntegrations", async () => {
    const configWithDisabled = {
      ...uiConfigFixture,
      disabledIntegrations: ["openshift-console", "devspaces"],
    };
    server.use(
      http.get(`${REG_URL}/api/v1/uiconfig`, () => {
        return HttpResponse.json(configWithDisabled);
      }),
    );

    const result = await getUIConfig();
    expect(result.disabledIntegrations).toEqual([
      "openshift-console",
      "devspaces",
    ]);
  });

  it("should return empty config on unsuccessful response", async () => {
    server.use(
      http.get(`${REG_URL}/api/v1/uiconfig`, () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const result = await getUIConfig();
    expect(result).toEqual({});
  });

  it("should return empty config on fetch error", async () => {
    server.use(
      http.get(`${REG_URL}/api/v1/uiconfig`, () => {
        return HttpResponse.error();
      }),
    );

    const result = await getUIConfig();
    expect(result).toEqual({});
  });
});

describe("getSegmentWriteKey", () => {
  it("should return the segment write key", async () => {
    server.use(
      http.get(`${REG_URL}/api/v1/analytics/segment-write-key`, () => {
        return new HttpResponse("  mock-key  ");
      }),
    );

    const result = await getSegmentWriteKey();
    expect(result).toBe("mock-key");
  });

  it("should throw error on unsuccessful response", async () => {
    server.use(
      http.get(`${REG_URL}/api/v1/analytics/segment-write-key`, () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    await expect(getSegmentWriteKey()).rejects.toThrow(
      "Failed to fetch Segment write key: 500",
    );
  });
});

describe("resetWorkspaces", () => {
  it("should succeed on 200 response", async () => {
    server.use(
      http.post(`${REG_URL}/api/v1/reset-namespaces`, () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await expect(resetWorkspaces()).resolves.not.toThrow();
  });

  it("throws on network error", async () => {
    server.use(
      http.post(`${REG_URL}/api/v1/reset-namespaces`, () => {
        return HttpResponse.error();
      }),
    );

    await expect(resetWorkspaces()).rejects.toThrow();
  });

  it("throws on non-ok response", async () => {
    server.use(
      http.post(`${REG_URL}/api/v1/reset-namespaces`, () => {
        return HttpResponse.json(
          { details: "the back end failed because of x, y and z" },
          { status: 500 },
        );
      }),
    );

    const error = await resetWorkspaces().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(500);
    expect(error.body).toContain("the back end failed because of x, y and z");
  });
});
