import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { setTokenGetter } from "../authFetch";
import {
  getSignupData,
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
        return new HttpResponse(null, {
          status: 500,
          statusText: "Server Error",
        });
      }),
    );

    await expect(getSignupData()).rejects.toThrow(
      "Unexpected status code: 500 Server Error",
    );
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
    ).resolves.not.toThrow();
  });

  it("should throw error for invalid country code", async () => {
    await expect(
      initiatePhoneVerification("abc", "1234567890"),
    ).rejects.toThrow("Invalid country code.");
  });

  it("should throw error for invalid phone number", async () => {
    await expect(initiatePhoneVerification("+1", "abc")).rejects.toThrow(
      "Invalid phone number.",
    );
  });

  it("should throw user-friendly error for invalid phone number from backend", async () => {
    server.use(
      http.put(`${REG_URL}/api/v1/signup/verification`, () => {
        return HttpResponse.json(
          { message: "Invalid 'To' Phone Number" },
          { status: 400 },
        );
      }),
    );

    await expect(
      initiatePhoneVerification("+1", "1234567890"),
    ).rejects.toThrow(
      "Invalid phone number. Please verify the country code and number format, then try again.",
    );
  });

  it("should throw error for already used phone number", async () => {
    server.use(
      http.put(`${REG_URL}/api/v1/signup/verification`, () => {
        return HttpResponse.json(
          { message: "phone number already in use" },
          { status: 400 },
        );
      }),
    );

    await expect(
      initiatePhoneVerification("+1", "1234567890"),
    ).rejects.toThrow(
      "This phone number is already in use. Please use a different number.",
    );
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

    await expect(completePhoneVerification("badcode")).rejects.toThrow(
      "Invalid verification code",
    );
  });
});

describe("verifyActivationCode", () => {
  it("should successfully verify activation code", async () => {
    server.use(
      http.post(
        `${REG_URL}/api/v1/signup/verification/activation-code`,
        () => {
          return new HttpResponse(null, { status: 200 });
        },
      ),
    );

    await expect(verifyActivationCode("123456")).resolves.not.toThrow();
  });

  it("should throw error on unsuccessful verification", async () => {
    server.use(
      http.post(
        `${REG_URL}/api/v1/signup/verification/activation-code`,
        () => {
          return HttpResponse.json(
            { message: "Invalid activation code" },
            { status: 400 },
          );
        },
      ),
    );

    await expect(verifyActivationCode("badcode")).rejects.toThrow(
      "Invalid activation code",
    );
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
  const expectedGenericError =
    "Unable to reset your workspaces. Please, try again later, and if your issue persists, contact support at devsandbox@redhat.com";

  it("should succeed on 200 response", async () => {
    server.use(
      http.post(`${REG_URL}/api/v1/reset-namespaces`, () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await expect(resetWorkspaces()).resolves.not.toThrow();
  });

  it("returns a generic error when there is a network error", async () => {
    server.use(
      http.post(`${REG_URL}/api/v1/reset-namespaces`, () => {
        return HttpResponse.error();
      }),
    );

    await expect(resetWorkspaces()).rejects.toThrow(expectedGenericError);
  });

  it("returns the response error details when present", async () => {
    server.use(
      http.post(`${REG_URL}/api/v1/reset-namespaces`, () => {
        return HttpResponse.json(
          { details: "the back end failed because of x, y and z" },
          { status: 500 },
        );
      }),
    );

    await expect(resetWorkspaces()).rejects.toThrow(
      "the back end failed because of x, y and z",
    );
  });

  it("returns a generic error when the response error details are not present", async () => {
    server.use(
      http.post(`${REG_URL}/api/v1/reset-namespaces`, () => {
        return HttpResponse.json({}, { status: 500 });
      }),
    );

    await expect(resetWorkspaces()).rejects.toThrow(expectedGenericError);
  });
});
