import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { setTokenGetter } from "../authFetch";
import {
  deleteSecretsAndPVCs,
  deletePVCsForSTS,
  getSecret,
  getPersistentVolumeClaims,
  getDeployments,
  getStatefulSets,
} from "../kube";
import type {
  DeploymentData,
  PersistentVolumeClaimData,
  SecretItem,
  StatefulSetData,
} from "../../types";

const PROXY_URL = "https://proxy.example.com";
const NS = "test-namespace";

const commonMetadata = {
  uuid: "test-uuid",
  creationTimestamp: "2025-05-15T00:00:00Z",
  labels: { app: "test" },
};

beforeAll(() => {
  setTokenGetter(async () => "test-token");
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("deleteSecretsAndPVCs", () => {
  const mockDeploymentData: DeploymentData = {
    items: [
      {
        metadata: { name: "test-deployment", ...commonMetadata },
        status: {
          conditions: [{ type: "Available", status: "True" }],
        },
        spec: {
          replicas: 1,
          template: {
            metadata: {
              labels: { app: "test", deployment: "test" },
            },
            spec: {
              volumes: [
                {
                  name: "test-volume",
                  persistentVolumeClaim: { claimName: "test-pvc" },
                },
                {
                  name: "test-secret-volume",
                  secret: { secretName: "test-secret" },
                },
              ],
            },
          },
        },
      },
    ],
  };

  it("should delete PVCs and secrets successfully", async () => {
    const deletedResources: string[] = [];
    server.use(
      http.delete(
        `${PROXY_URL}/api/v1/namespaces/${NS}/persistentvolumeclaims/test-pvc`,
        () => {
          deletedResources.push("pvc");
          return new HttpResponse(null, { status: 200 });
        },
      ),
      http.delete(
        `${PROXY_URL}/api/v1/namespaces/${NS}/secrets/test-secret`,
        () => {
          deletedResources.push("secret");
          return new HttpResponse(null, { status: 200 });
        },
      ),
    );

    await expect(
      deleteSecretsAndPVCs(PROXY_URL, mockDeploymentData, NS),
    ).resolves.not.toThrow();
    expect(deletedResources).toContain("pvc");
    expect(deletedResources).toContain("secret");
  });

  it("should not throw on 404 responses", async () => {
    server.use(
      http.delete(
        `${PROXY_URL}/api/v1/namespaces/${NS}/persistentvolumeclaims/test-pvc`,
        () => {
          return new HttpResponse(null, { status: 404 });
        },
      ),
      http.delete(
        `${PROXY_URL}/api/v1/namespaces/${NS}/secrets/test-secret`,
        () => {
          return new HttpResponse(null, { status: 404 });
        },
      ),
    );

    await expect(
      deleteSecretsAndPVCs(PROXY_URL, mockDeploymentData, NS),
    ).resolves.not.toThrow();
  });

  it("should throw on other error responses", async () => {
    server.use(
      http.delete(
        `${PROXY_URL}/api/v1/namespaces/${NS}/persistentvolumeclaims/test-pvc`,
        () => {
          return HttpResponse.json(
            { message: "Internal error" },
            { status: 500 },
          );
        },
      ),
    );

    await expect(
      deleteSecretsAndPVCs(PROXY_URL, mockDeploymentData, NS),
    ).rejects.toThrow();
  });
});

describe("deletePVCsForSTS", () => {
  const mockStatefulSetData: StatefulSetData = {
    items: [
      {
        metadata: { name: "test-statefulset", ...commonMetadata },
        spec: {
          replicas: 1,
          template: {
            metadata: { labels: { app: "test", deployment: "test" } },
            spec: {},
          },
          volumeClaimTemplates: [{ metadata: { name: "test-template" } }],
        },
        status: { conditions: [] },
      },
    ],
  };

  const mockPVCData: PersistentVolumeClaimData = {
    items: [
      {
        metadata: { name: "test-pvc-1", ...commonMetadata },
      },
    ],
  };

  it("should delete PVCs for StatefulSet successfully", async () => {
    server.use(
      http.get(
        `${PROXY_URL}/api/v1/namespaces/${NS}/persistentvolumeclaims`,
        () => {
          return HttpResponse.json(mockPVCData);
        },
      ),
      http.delete(
        `${PROXY_URL}/api/v1/namespaces/${NS}/persistentvolumeclaims/test-pvc-1`,
        () => {
          return new HttpResponse(null, { status: 200 });
        },
      ),
    );

    await expect(
      deletePVCsForSTS(PROXY_URL, mockStatefulSetData, NS),
    ).resolves.not.toThrow();
  });
});

describe("getSecret", () => {
  const mockSecret: SecretItem = {
    metadata: {
      name: "test-secret",
      uuid: "test-secret-uuid",
      creationTimestamp: "2025-05-15T00:00:00Z",
    },
    data: { password: "test-value" },
  };

  it("should return secret data on successful response", async () => {
    server.use(
      http.get(
        `${PROXY_URL}/api/v1/namespaces/${NS}/secrets/test-secret`,
        () => {
          return HttpResponse.json(mockSecret);
        },
      ),
    );

    const result = await getSecret(PROXY_URL, NS, "test-secret");
    expect(result).toEqual(mockSecret);
  });

  it("should throw error on unsuccessful response", async () => {
    server.use(
      http.get(
        `${PROXY_URL}/api/v1/namespaces/${NS}/secrets/test-secret`,
        () => {
          return HttpResponse.json({ message: "Not found" }, { status: 404 });
        },
      ),
    );

    await expect(getSecret(PROXY_URL, NS, "test-secret")).rejects.toThrow();
  });
});

describe("getPersistentVolumeClaims", () => {
  const mockPVCs: PersistentVolumeClaimData = {
    items: [
      { metadata: { name: "pvc-1", ...commonMetadata } },
      { metadata: { name: "pvc-2", ...commonMetadata } },
    ],
  };

  it("should return PVCs without labels", async () => {
    server.use(
      http.get(
        `${PROXY_URL}/api/v1/namespaces/${NS}/persistentvolumeclaims`,
        () => {
          return HttpResponse.json(mockPVCs);
        },
      ),
    );

    const result = await getPersistentVolumeClaims(PROXY_URL, NS);
    expect(result).toEqual(mockPVCs);
  });
});

describe("getDeployments", () => {
  const mockDeployments: DeploymentData = {
    items: [
      {
        metadata: { name: "deployment-1", ...commonMetadata },
        status: {
          conditions: [{ type: "Available", status: "True" }],
        },
        spec: {
          replicas: 1,
          template: {
            metadata: { labels: { app: "test", deployment: "test" } },
            spec: {},
          },
        },
      },
    ],
  };

  it("should return deployments", async () => {
    server.use(
      http.get(`${PROXY_URL}/apis/apps/v1/namespaces/${NS}/deployments`, () => {
        return HttpResponse.json(mockDeployments);
      }),
    );

    const result = await getDeployments(PROXY_URL, NS);
    expect(result).toEqual(mockDeployments);
  });

  it("should throw error on unsuccessful response", async () => {
    server.use(
      http.get(`${PROXY_URL}/apis/apps/v1/namespaces/${NS}/deployments`, () => {
        return HttpResponse.json({ message: "Forbidden" }, { status: 403 });
      }),
    );

    await expect(getDeployments(PROXY_URL, NS)).rejects.toThrow();
  });
});

describe("getStatefulSets", () => {
  const mockStatefulSets: StatefulSetData = {
    items: [
      {
        metadata: { name: "statefulset-1", ...commonMetadata },
        status: {
          conditions: [{ type: "Available", status: "True" }],
        },
        spec: {
          replicas: 1,
          template: {
            metadata: { labels: { app: "test", deployment: "test" } },
            spec: {},
          },
        },
      },
    ],
  };

  it("should return statefulsets", async () => {
    server.use(
      http.get(
        `${PROXY_URL}/apis/apps/v1/namespaces/${NS}/statefulsets`,
        () => {
          return HttpResponse.json(mockStatefulSets);
        },
      ),
    );

    const result = await getStatefulSets(PROXY_URL, NS);
    expect(result).toEqual(mockStatefulSets);
  });

  it("should throw error on unsuccessful response", async () => {
    server.use(
      http.get(
        `${PROXY_URL}/apis/apps/v1/namespaces/${NS}/statefulsets`,
        () => {
          return HttpResponse.json({ message: "Forbidden" }, { status: 403 });
        },
      ),
    );

    await expect(getStatefulSets(PROXY_URL, NS)).rejects.toThrow();
  });
});
