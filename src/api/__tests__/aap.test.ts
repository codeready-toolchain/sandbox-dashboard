import { http, HttpResponse } from "msw";

import { server } from "../../mocks/server";
import logger from "../../utils/logger";
import {
  createAAP,
  deleteAAPCR,
  getAAP,
  removeUnidleAnnotation,
  unIdleAAP,
} from "../aap";
import { setTokenGetter } from "../authFetch";

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
  it("should return the CR item matching metadata.name 'sandbox-aap'", async () => {
    const otherItem = { metadata: { name: "other-aap" } };
    const crItem = { metadata: { name: "sandbox-aap" } };
    server.use(
      http.get(AAP_BASE, () => {
        return HttpResponse.json({ items: [otherItem, crItem] });
      }),
    );

    const result = await getAAP(PROXY_URL, NS);
    expect(result).toEqual(crItem);
  });

  it("should return undefined when the items list is empty", async () => {
    server.use(
      http.get(AAP_BASE, () => {
        return HttpResponse.json({ items: [] });
      }),
    );

    const result = await getAAP(PROXY_URL, NS);
    expect(result).toBeUndefined();
  });

  it("should throw an ApiError with status 404 on a 404 response", async () => {
    server.use(
      http.get(AAP_BASE, () => {
        return HttpResponse.json({ message: "Not found" }, { status: 404 });
      }),
    );

    await expect(getAAP(PROXY_URL, NS)).rejects.toThrow(
      expect.objectContaining({
        message: "getAAP failed",
        statusCode: 404,
      }),
    );
  });

  it("should throw an ApiError with status 500 on a 500 response", async () => {
    server.use(
      http.get(AAP_BASE, () => {
        return HttpResponse.json(
          { message: "Internal error" },
          { status: 500 },
        );
      }),
    );

    await expect(getAAP(PROXY_URL, NS)).rejects.toThrow(
      expect.objectContaining({
        message: "getAAP failed",
        statusCode: 500,
      }),
    );
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
    const parsedBody = JSON.parse(capturedBody!);
    expect(parsedBody.spec).toEqual({ idle_aap: false });
    expect(parsedBody.metadata.annotations).toHaveProperty(
      "sandbox.redhat.com/unidle-requested-at",
    );
    expect(capturedContentType).toBe("application/merge-patch+json");
  });

  it("should set the unidle annotation to a valid ISO 8601 timestamp", async () => {
    let capturedBody: string | undefined;
    server.use(
      http.patch(`${AAP_BASE}/sandbox-aap`, async ({ request }) => {
        capturedBody = await request.text();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await unIdleAAP(PROXY_URL, NS);
    const parsedBody = JSON.parse(capturedBody!);
    const timestamp =
      parsedBody.metadata.annotations["sandbox.redhat.com/unidle-requested-at"];
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
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

describe("removeUnidleAnnotation", () => {
  it("should send a PATCH with the annotation set to null", async () => {
    let capturedBody: string | undefined;
    let capturedContentType: string | null = null;
    server.use(
      http.patch(`${AAP_BASE}/sandbox-aap`, async ({ request }) => {
        capturedBody = await request.text();
        capturedContentType = request.headers.get("Content-Type");
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await removeUnidleAnnotation(PROXY_URL, NS);
    const parsedBody = JSON.parse(capturedBody!);
    expect(parsedBody).toEqual({
      metadata: {
        annotations: {
          "sandbox.redhat.com/unidle-requested-at": null,
        },
      },
    });
    expect(capturedContentType).toBe("application/merge-patch+json");
  });

  it("should not throw when the API returns an error", async () => {
    const warnSpy = vi.spyOn(logger, "warn");

    server.use(
      http.patch(`${AAP_BASE}/sandbox-aap`, () => {
        return HttpResponse.json(
          { message: "Internal error" },
          { status: 500 },
        );
      }),
    );

    await expect(
      removeUnidleAnnotation(PROXY_URL, NS),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("should not throw when the network request fails entirely", async () => {
    server.use(
      http.patch(`${AAP_BASE}/sandbox-aap`, () => {
        return HttpResponse.error();
      }),
    );

    await expect(
      removeUnidleAnnotation(PROXY_URL, NS),
    ).resolves.toBeUndefined();
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
