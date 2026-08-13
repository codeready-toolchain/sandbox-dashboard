import { UNIDLE_REQUESTED_AT_ANNOTATION } from "../const";
import { ApiError } from "../error/ApiError";
import type { AAPCR, AAPCRList } from "../types";
import { AAPObject } from "../utils/aap-utils";
import logger from "../utils/logger";
import { authFetch } from "./authFetch";

const aapBasePath = (namespace: string) =>
  `/apis/aap.ansible.com/v1alpha1/namespaces/${namespace}/ansibleautomationplatforms`;

/**
 * Fetches an Ansible Automation Platform custom resource.
 * @param proxyURL the URL of the proxy to send the request to.
 * @param namespace the namespace to fetch the resource from.
 * @returns the Ansible Automation Platform custom resource or `undefined` if
 * the resource does not exist.
 * @throws {ApiError} if the API call fails.
 */
export async function getAAP(
  proxyURL: string,
  namespace: string,
): Promise<AAPCR | undefined> {
  const response = await authFetch(`${proxyURL}${aapBasePath(namespace)}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw await ApiError.fromResponse("getAAP failed", response);
  }

  const crList: AAPCRList = await response.json();
  return crList.items.find(({ metadata }) => metadata.name === "sandbox-aap");
}

/**
 * Creates an Ansible Automation Platform custom resource.
 * @param proxyURL the URL of the proxy to send the request to.
 * @param namespace the namespace to create the resource in.
 * @throws {ApiError} if the API call fails.
 */
export async function createAAP(
  proxyURL: string,
  namespace: string,
): Promise<void> {
  const response = await authFetch(`${proxyURL}${aapBasePath(namespace)}`, {
    method: "POST",
    body: AAPObject,
    headers: {
      "Content-Type": "application/yaml",
    },
  });

  // A "409 - Conflict" response means that the resource was already created.
  if (!response.ok && response.status !== 409) {
    throw await ApiError.fromResponse("createAAP failed", response);
  }
}

/**
 * Sets the "idle" status of the Ansible Automation Platform as "false".
 * @param proxyURL the URL of the proxy to send the request to.
 * @param namespace the namespace to update the resource in.
 * @throws {ApiError} if the API call fails.
 */
export async function unIdleAAP(
  proxyURL: string,
  namespace: string,
): Promise<void> {
  const response = await authFetch(
    `${proxyURL}${aapBasePath(namespace)}/sandbox-aap`,
    {
      method: "PATCH",
      body: JSON.stringify({
        metadata: {
          annotations: {
            [UNIDLE_REQUESTED_AT_ANNOTATION]: new Date().toISOString(),
          },
        },
        spec: {
          idle_aap: false,
        },
      }),
      headers: {
        "Content-Type": "application/merge-patch+json",
      },
    },
  );

  if (!response.ok) {
    throw await ApiError.fromResponse("unIdleAAP failed", response);
  }
}

/**
 * Removes the "unidle-requested-at" annotation that we set when we unidle
 * the instance. Since it's a best-effort operation, any thrown error gets
 * just logged but not thrown.
 * @param proxyURL the URL of the proxy to send the request to.
 * @param namespace the namespace to update the resource in.
 */
export async function removeUnidleAnnotation(
  proxyURL: string,
  namespace: string,
): Promise<void> {
  try {
    const response = await authFetch(
      `${proxyURL}${aapBasePath(namespace)}/sandbox-aap`,
      {
        method: "PATCH",
        body: JSON.stringify({
          metadata: {
            annotations: {
              [UNIDLE_REQUESTED_AT_ANNOTATION]: null,
            },
          },
        }),
        headers: {
          "Content-Type": "application/merge-patch+json",
        },
      },
    );

    if (!response.ok) {
      logger.warn(
        "Unable to remove the custom unidling timestamp annotation from resource",
        `status: ${response.status}`,
      );
    }
  } catch (error) {
    logger.warn(
      "Unable to remove the custom unidling timestamp annotation from resource",
      error,
    );
  }
}

/**
 * Deletes the Ansible Automation Platform custom resource.
 * @param proxyURL the URL of the proxy to send the request to.
 * @param namespace the namespace to delete the resource from.
 * @throws {ApiError} if the API call fails.
 */
export async function deleteAAPCR(
  proxyURL: string,
  namespace: string,
): Promise<void> {
  const response = await authFetch(
    `${proxyURL}${aapBasePath(namespace)}/sandbox-aap`,
    { method: "DELETE" },
  );

  if (!response.ok && response.status !== 404) {
    throw await ApiError.fromResponse("deleteAAPCR failed", response);
  }
}
