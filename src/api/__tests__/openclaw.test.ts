import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { setTokenGetter } from "../authFetch";
import {
  getSpaceRequest,
  deleteSpaceRequest,
  getOpenClaw,
  createOpenClaw,
  deleteOpenClawCR,
  cleanupWorkspaceEnvironment,
} from "../openclaw";
import type {
  ProviderConfig,
  AddedCredential,
} from "../../utils/openclaw-providers";

const PROXY_URL = "https://proxy.example.com";
const NS = "test-namespace";
const TARGET_NS = "target-namespace";
const SECRETS_BASE = `${PROXY_URL}/api/v1/namespaces/${TARGET_NS}/secrets`;

const testProvider: ProviderConfig = {
  id: "openai",
  name: "OpenAI",
  provider: "openai",
  category: "primary",
  credentialType: "bearer",
  domain: "api.openai.com",
  fields: [
    { key: "api-key", label: "API Key", type: "apiKey", required: true },
  ],
};

const testCredential: AddedCredential = {
  provider: testProvider,
  values: { "api-key": "sk-test-key-123" },
};

beforeAll(() => {
  setTokenGetter(async () => "test-token");
  server.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("createOrUpdateSecret (via createOpenClaw)", () => {
  it("creates a secret on POST 200", async () => {
    let postCalled = false;
    server.use(
      http.post(`${SECRETS_BASE}`, () => {
        postCalled = true;
        return new HttpResponse(null, { status: 201 });
      }),
      http.post(
        `${PROXY_URL}/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${TARGET_NS}/claws`,
        () => new HttpResponse(null, { status: 201 }),
      ),
    );

    await createOpenClaw(PROXY_URL, TARGET_NS, [testCredential], false);
    expect(postCalled).toBe(true);
  });

  it("fetches resourceVersion on 409 before PUT", async () => {
    const existingResourceVersion = "12345";
    let getCalled = false;
    let putBody: Record<string, unknown> | undefined;

    server.use(
      http.post(`${SECRETS_BASE}`, () => {
        return HttpResponse.json(
          { message: "already exists" },
          { status: 409 },
        );
      }),
      http.get(`${SECRETS_BASE}/llm-key`, () => {
        getCalled = true;
        return HttpResponse.json({
          metadata: {
            name: "llm-key",
            namespace: TARGET_NS,
            resourceVersion: existingResourceVersion,
          },
          data: {},
        });
      }),
      http.put(`${SECRETS_BASE}/llm-key`, async ({ request }) => {
        putBody = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 200 });
      }),
      http.post(
        `${PROXY_URL}/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${TARGET_NS}/claws`,
        () => new HttpResponse(null, { status: 201 }),
      ),
    );

    await createOpenClaw(PROXY_URL, TARGET_NS, [testCredential], false);

    expect(getCalled).toBe(true);
    expect(putBody).toBeDefined();
    expect((putBody!.metadata as Record<string, unknown>).resourceVersion).toBe(
      existingResourceVersion,
    );
  });

  it("throws when GET fails during 409 recovery", async () => {
    server.use(
      http.post(`${SECRETS_BASE}`, () => {
        return HttpResponse.json(
          { message: "already exists" },
          { status: 409 },
        );
      }),
      http.get(`${SECRETS_BASE}/llm-key`, () => {
        return HttpResponse.json({ message: "forbidden" }, { status: 403 });
      }),
    );

    await expect(
      createOpenClaw(PROXY_URL, TARGET_NS, [testCredential], false),
    ).rejects.toThrow();
  });
});

describe("getSpaceRequest", () => {
  const SR_URL = `${PROXY_URL}/apis/toolchain.dev.openshift.com/v1alpha1/namespaces/${NS}/spacerequests/claw`;

  it("returns the space request on success", async () => {
    const mockSR = { metadata: { name: "claw" }, status: {} };
    server.use(http.get(SR_URL, () => HttpResponse.json(mockSR)));

    const result = await getSpaceRequest(PROXY_URL, NS);
    expect(result).toEqual(mockSR);
  });

  it("returns undefined on 404", async () => {
    server.use(http.get(SR_URL, () => new HttpResponse(null, { status: 404 })));

    const result = await getSpaceRequest(PROXY_URL, NS);
    expect(result).toBeUndefined();
  });
});

describe("deleteSpaceRequest", () => {
  const SR_URL = `${PROXY_URL}/apis/toolchain.dev.openshift.com/v1alpha1/namespaces/${NS}/spacerequests/claw`;

  it("does not throw on 404", async () => {
    server.use(
      http.delete(SR_URL, () => new HttpResponse(null, { status: 404 })),
    );
    await expect(deleteSpaceRequest(PROXY_URL, NS)).resolves.toBeUndefined();
  });
});

describe("getOpenClaw", () => {
  const CLAW_URL = `${PROXY_URL}/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${NS}/claws/claw`;

  it("returns undefined on 404", async () => {
    server.use(
      http.get(CLAW_URL, () => new HttpResponse(null, { status: 404 })),
    );
    expect(await getOpenClaw(PROXY_URL, NS)).toBeUndefined();
  });
});

describe("deleteOpenClawCR", () => {
  const CLAW_URL = `${PROXY_URL}/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${NS}/claws/claw`;

  it("deletes the CR and its secrets successfully", async () => {
    server.use(
      http.get(CLAW_URL, () =>
        HttpResponse.json({
          spec: {
            credentials: [
              { secretRef: [{ name: "llm-key" }] },
              { secretRef: [{ name: "other-key" }] },
            ],
          },
        }),
      ),
      http.delete(CLAW_URL, () => new HttpResponse(null, { status: 200 })),
      http.delete(
        `${PROXY_URL}/api/v1/namespaces/${NS}/secrets/llm-key`,
        () => new HttpResponse(null, { status: 200 }),
      ),
      http.delete(
        `${PROXY_URL}/api/v1/namespaces/${NS}/secrets/other-key`,
        () => new HttpResponse(null, { status: 200 }),
      ),
    );

    await expect(deleteOpenClawCR(PROXY_URL, NS)).resolves.toBeUndefined();
  });

  it("ignores 404 for both CR and secrets", async () => {
    server.use(
      http.get(CLAW_URL, () =>
        HttpResponse.json({
          spec: {
            credentials: [{ secretRef: [{ name: "llm-key" }] }],
          },
        }),
      ),
      http.delete(CLAW_URL, () => new HttpResponse(null, { status: 404 })),
      http.delete(
        `${PROXY_URL}/api/v1/namespaces/${NS}/secrets/llm-key`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    await expect(deleteOpenClawCR(PROXY_URL, NS)).resolves.toBeUndefined();
  });

  it("resolves when there are no secrets to delete", async () => {
    server.use(
      http.get(CLAW_URL, () => HttpResponse.json({ spec: {} })),
      http.delete(CLAW_URL, () => new HttpResponse(null, { status: 200 })),
    );

    await expect(deleteOpenClawCR(PROXY_URL, NS)).resolves.toBeUndefined();
  });

  it("throws AggregateError when secret deletions fail", async () => {
    server.use(
      http.get(CLAW_URL, () =>
        HttpResponse.json({
          spec: {
            credentials: [
              { secretRef: [{ name: "llm-key" }] },
              { secretRef: [{ name: "ok-key" }] },
            ],
          },
        }),
      ),
      http.delete(CLAW_URL, () => new HttpResponse(null, { status: 200 })),
      http.delete(`${PROXY_URL}/api/v1/namespaces/${NS}/secrets/llm-key`, () =>
        HttpResponse.json({ message: "Internal error" }, { status: 500 }),
      ),
      http.delete(
        `${PROXY_URL}/api/v1/namespaces/${NS}/secrets/ok-key`,
        () => new HttpResponse(null, { status: 200 }),
      ),
    );

    await expect(deleteOpenClawCR(PROXY_URL, NS)).rejects.toThrow(
      AggregateError,
    );
  });
});

describe("cleanupWorkspaceEnvironment", () => {
  it("resolves when all deletions succeed", async () => {
    server.use(
      http.delete(
        `${PROXY_URL}/apis/networking.k8s.io/v1/namespaces/${NS}/networkpolicies/*`,
        () => new HttpResponse(null, { status: 200 }),
      ),
      http.delete(
        `${PROXY_URL}/apis/rbac.authorization.k8s.io/v1/namespaces/${NS}/rolebindings/*`,
        () => new HttpResponse(null, { status: 200 }),
      ),
      http.delete(
        `${PROXY_URL}/api/v1/namespaces/${NS}/serviceaccounts/*`,
        () => new HttpResponse(null, { status: 200 }),
      ),
    );

    await expect(
      cleanupWorkspaceEnvironment(PROXY_URL, NS),
    ).resolves.toBeUndefined();
  });
});
