import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { setTokenGetter } from "../authFetch";
import { getAAP, createAAP, unIdleAAP, deleteAAPCR } from "../aap";

const PROXY_URL = "https://proxy.example.com";
const NS = "test-namespace";
const AAP_BASE = `${PROXY_URL}/apis/aap.ansible.com/v1alpha1/namespaces/${NS}/ansibleautomationplatforms`;

beforeAll(() => {
  setTokenGetter(async () => "test-token");
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("getAAP", () => {
  it("should return AAP data on successful response", async () => {
    const mockData = { items: [{ metadata: { name: "sandbox-aap" } }] };
    server.use(
      http.get(AAP_BASE, () => {
        return HttpResponse.json(mockData);
      }),
    );

    const result = await getAAP(PROXY_URL, NS);
    expect(result).toEqual(mockData);
  });

  it("should throw error on unsuccessful response", async () => {
    server.use(
      http.get(AAP_BASE, () => {
        return HttpResponse.json({ message: "Not found" }, { status: 404 });
      }),
    );

    await expect(getAAP(PROXY_URL, NS)).rejects.toThrow();
  });
});

describe("createAAP", () => {
  it("should successfully create AAP", async () => {
    let capturedBody: string | undefined;
    let capturedContentType: string | null = null;
    server.use(
      http.post(AAP_BASE, async ({ request }) => {
        capturedBody = await request.text();
        capturedContentType = request.headers.get("Content-Type");
        return new HttpResponse(null, { status: 201 });
      }),
    );

    await expect(createAAP(PROXY_URL, NS)).resolves.toBeUndefined();
    expect(capturedBody).toContain('"kind":"AnsibleAutomationPlatform"');
    expect(capturedContentType).toBe("application/yaml");
  });

  it("should not throw error on 409 Conflict response", async () => {
    server.use(
      http.post(AAP_BASE, () => {
        return new HttpResponse(null, { status: 409 });
      }),
    );

    await expect(createAAP(PROXY_URL, NS)).resolves.toBeUndefined();
  });

  it("should throw error on other unsuccessful responses", async () => {
    server.use(
      http.post(AAP_BASE, () => {
        return HttpResponse.json(
          { message: "Internal error" },
          { status: 500 },
        );
      }),
    );

    await expect(createAAP(PROXY_URL, NS)).rejects.toThrow();
  });
});

describe("unIdleAAP", () => {
  it("should successfully unidle AAP", async () => {
    let capturedBody: string | undefined;
    let capturedContentType: string | null = null;
    server.use(
      http.patch(`${AAP_BASE}/sandbox-aap`, async ({ request }) => {
        capturedBody = await request.text();
        capturedContentType = request.headers.get("Content-Type");
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await expect(unIdleAAP(PROXY_URL, NS)).resolves.toBeUndefined();
    expect(JSON.parse(capturedBody!)).toEqual({
      spec: { idle_aap: false },
    });
    expect(capturedContentType).toBe("application/merge-patch+json");
  });

  it("should throw error on unsuccessful response", async () => {
    server.use(
      http.patch(`${AAP_BASE}/sandbox-aap`, () => {
        return HttpResponse.json(
          { message: "Failed to unidle" },
          { status: 400 },
        );
      }),
    );

    await expect(unIdleAAP(PROXY_URL, NS)).rejects.toThrow();
  });
});

describe("deleteAAPCR", () => {
  it("should successfully delete AAP CR", async () => {
    server.use(
      http.delete(`${AAP_BASE}/sandbox-aap`, () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await expect(deleteAAPCR(PROXY_URL, NS)).resolves.toBeUndefined();
  });

  it("should not throw error on 404 Not Found response", async () => {
    server.use(
      http.delete(`${AAP_BASE}/sandbox-aap`, () => {
        return new HttpResponse(null, { status: 404 });
      }),
    );

    await expect(deleteAAPCR(PROXY_URL, NS)).resolves.toBeUndefined();
  });

  it("should throw error on other unsuccessful responses", async () => {
    server.use(
      http.delete(`${AAP_BASE}/sandbox-aap`, () => {
        return HttpResponse.json(
          { message: "Internal error" },
          { status: 500 },
        );
      }),
    );

    await expect(deleteAAPCR(PROXY_URL, NS)).rejects.toThrow();
  });
});
