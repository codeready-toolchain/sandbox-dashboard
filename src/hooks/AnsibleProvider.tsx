import { AlertVariant } from "@patternfly/react-core";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createAAP,
  deleteAAPCR,
  getAAP,
  removeUnidleAnnotation,
  unIdleAAP,
} from "../api/aap";
import {
  deletePVCsForSTS,
  deleteSecretsAndPVCs,
  getDeployments,
  getSecret,
  getStatefulSets,
} from "../api/kube";
import {
  LONG_INTERVAL,
  SHORT_INTERVAL,
  SUPPORT_EMAIL,
  UNIDLE_REQUESTED_AT_ANNOTATION,
} from "../const";
import { AggregatedOperationError } from "../error/AggregatedOperationError";
import { ApiError } from "../error/ApiError";
import { UserFacingError } from "../error/UserFacingError";
import type {
  AAPCR,
  AAPInstanceCredentials,
  DeploymentData,
  SecretItem,
  StatefulSetData,
} from "../types";
import {
  AAPInstanceErrorType,
  type AAPInstanceStatus,
  type FetchCRResult,
  mapAnsibleStatus,
} from "../utils/aap-utils";
import logger from "../utils/logger";
import { isTransient, withRetry } from "../utils/retry";
import { AnsibleContext } from "./AnsibleContext";
import { useNotifications } from "./NotificationContext";
import { useUserContext } from "./UserContext";

export function AnsibleProvider({ children }: { children: ReactNode }) {
  const { user } = useUserContext();

  // Route and mount a fake provider if the user is not yet signed up or if it
  // doesn't have the required variables for the Ansible provider to properly
  // work.
  if (user?.defaultUserNamespace && user?.proxyURL) {
    return (
      <AnsibleProviderConnected
        proxyURL={user.proxyURL}
        userNamespace={user.defaultUserNamespace}
      >
        {children}
      </AnsibleProviderConnected>
    );
  } else {
    return <AnsibleProviderNoop>{children}</AnsibleProviderNoop>;
  }
}

/**
 * A NOOP provider for when the user is not yet signed up. Allows rendering
 * the cards with its actions effectively disabled.
 */
export function AnsibleProviderNoop({ children }: { children: ReactNode }) {
  return (
    <AnsibleContext.Provider
      value={{
        deleteInstance: async () => {
          throw new Error("User not signed up");
        },
        fetchInstanceCredentials: async () =>
          Promise.reject(new Error("User not signed up")),
        instanceStatus: { kind: "userNotReady" },
        provisionInstance: async () => {
          throw new Error("User not signed up");
        },
        unidleInstance: async () => {
          throw new Error("User not signed up");
        },
      }}
    >
      {children}
    </AnsibleContext.Provider>
  );
}

/**
 * A real provider for when the user is signed up. The variables defined in
 * the components' props are a requirement for the provider to work, so this
 * type narrowing helps avoiding having guards for them everywhere.
 */
export function AnsibleProviderConnected({
  children,
  userNamespace,
  proxyURL,
}: {
  children: ReactNode;
  userNamespace: string;
  proxyURL: string;
}) {
  const { addAlert, addAlertFromError } = useNotifications();

  const [instanceCR, setInstanceCR] = useState<AAPCR | undefined>();
  const [instanceCredentials, setInstanceCredentials] = useState<
    AAPInstanceCredentials | undefined
  >();
  const [instanceStatus, setInstanceStatus] = useState<AAPInstanceStatus>({
    kind: "new",
  });

  /**
   * Defines how many times we are going to retry fetching for the instance's
   * status on transient errors before giving up.
   */
  const maxTransientErrorRetries: number = 3;

  /**
   * Reference to avoid stale closures in functions that require the latest
   * status available.
   */
  const instanceStatusRef = useRef<AAPInstanceStatus>(instanceStatus);
  /**
   * Reference to avoid stale closures in functions that require the latest
   * CR available.
   */
  const instanceCRRef = useRef<AAPCR | undefined>(instanceCR);
  /**
   * Reference to know if we have already fetched the CR on the provider's
   * mount.
   */
  const hasFetchedOnMount = useRef<boolean>(false);
  /**
   * Counter to keep track of how many transient errors we have encountered
   * while polling to check for an status update of the instance.
   */
  const pollTransientRetriesLeft = useRef<number>(maxTransientErrorRetries);

  /**
   * Helper function to keep the instance's CR contents up to date both in
   * the state and in its reference. Clears cached credentials when the CR
   * is removed or replaced with a different identity so that stale secrets
   * from a previous instance are never served.
   */
  const updateInstanceCR = useCallback((newCR: AAPCR | undefined) => {
    const prevCR = instanceCRRef.current;
    if (
      prevCR &&
      (!newCR ||
        prevCR.metadata?.uuid !== newCR.metadata?.uuid ||
        prevCR.status?.adminPasswordSecret !==
          newCR.status?.adminPasswordSecret)
    ) {
      setInstanceCredentials(undefined);
    }
    setInstanceCR(newCR);
    instanceCRRef.current = newCR;
  }, []);

  /**
   * Helper function to keep the keep the instance's status up to date both
   * in the state and in its reference.
   */
  const updateInstanceStatus = useCallback((status: AAPInstanceStatus) => {
    setInstanceStatus(status);
    instanceStatusRef.current = status;
  }, []);

  const [prevProxyURL, setPrevProxyURL] = useState(proxyURL);
  const [prevNamespace, setPrevNamespace] = useState(userNamespace);

  if (proxyURL !== prevProxyURL || userNamespace !== prevNamespace) {
    setPrevProxyURL(proxyURL);
    setPrevNamespace(userNamespace);
    setInstanceCR(undefined);
    setInstanceStatus({ kind: "new" });
    setInstanceCredentials(undefined);
  }

  useEffect(() => {
    hasFetchedOnMount.current = false;
    instanceCRRef.current = undefined;
    instanceStatusRef.current = { kind: "new" };
  }, [proxyURL, userNamespace]);

  /**
   * Gets the Ansible Automation Platform resource from Kubernetes.
   * @param userNamespace the namespace to fetch teh resource for.
   * @returns one of "absent", "failed" or "ok" statuses, signaling that the
   * instance is either absent, in a failure state or reporting everything
   * right.
   * @throws {ApiError} if the API calls to fetch the AAP resource.
   */
  const fetchCR = useCallback(
    async (namespace: string): Promise<FetchCRResult> => {
      const cr = await getAAP(proxyURL, namespace);
      if (!cr) {
        return { kind: "absent" };
      }

      const [status, matchedCondition] = mapAnsibleStatus(cr);
      if (status.kind === "error" && matchedCondition) {
        return {
          kind: "failed",
          cr,
          status,
          failedCondition: matchedCondition,
        };
      }

      return {
        kind: "ok",
        cr,
        status,
      };
    },
    [proxyURL],
  );

  /**
   * Fetches the user instance's administrator credentials.
   */
  const fetchInstanceCredentials =
    useCallback(async (): Promise<AAPInstanceCredentials> => {
      // Return the cached version if we have it to avoid refetching the
      // secret.
      if (instanceCredentials) {
        return instanceCredentials;
      }

      // Make sure we have all the information to be able to both fetch the
      // secret and then display it to the user.
      if (
        !instanceCR?.status ||
        !instanceCR.status.adminPasswordSecret ||
        !instanceCR.status.adminUser ||
        !instanceCR.status.URL
      ) {
        throw new UserFacingError(
          "Unable to obtain your instance's credentials",
          `Unable to obtain the credentials for your Ansible Automation Platform instance at the moment. Please try again later and if the issue persists, please contact ${SUPPORT_EMAIL}.`,
          undefined,
          'Unable to fetch AAP credentials: the CR does not have one of "status", "adminPasswordSecret", "adminUser" or "URL" fields.',
        );
      }

      // Fetch the secret from OpenShift.
      let adminSecret: SecretItem;
      try {
        adminSecret = await getSecret(
          proxyURL,
          userNamespace,
          instanceCR.status.adminPasswordSecret,
        );
      } catch (error) {
        if (error instanceof ApiError) {
          throw new UserFacingError(
            "Unable to fetch your instance's credentials",
            `Error while attempting to fetch the credentials: ${error.message}`,
            error,
            `Unable to fetch AAP credentials: fetching the secret returned an error: ${error.message}.`,
          );
        } else {
          throw new UserFacingError(
            "Unable to fetch your instance's credentials",
            `Error while attempting to fetch the credentials: ${error}`,
            error,
            `Unable to fetch AAP credentials: fetching the secret returned an error: ${error}.`,
          );
        }
      }

      // Make sure the secret has the expected payload.
      if (!adminSecret?.data?.password) {
        throw new UserFacingError(
          "Unable to fetch your instance's credentials",
          'The fetched secret does not have the expected "Password" field',
          undefined,
          `Unable to decode AAP credentials: the "password" field is missing from the secret.`,
        );
      }

      // Build the instance credentials and return them.
      let fetchedCredentials: AAPInstanceCredentials;
      try {
        fetchedCredentials = {
          username: instanceCR.status.adminUser,
          password: new TextDecoder().decode(
            Uint8Array.from(
              atob(adminSecret.data.password),
              (character: string) => character.charCodeAt(0),
            ),
          ),
          url: instanceCR.status.URL,
        };
      } catch (error) {
        throw new UserFacingError(
          "Unable to fetch your instance's credentials",
          `Error while decoding the credentials: ${error}`,
          error,
          `Unable to decode AAP credentials: the ${error}.`,
        );
      }

      setInstanceCredentials(fetchedCredentials);
      return fetchedCredentials;
    }, [instanceCredentials, instanceCR, proxyURL, userNamespace]);

  /**
   * Provisions the Ansible Automation Platform instance.
   * @throws {UserFacingError} if provisioning the instance fails.
   */
  const provisionInstance = useCallback(async () => {
    // When the instance is provisioning or is already provisioned, there is
    // nothing else to do.
    if (
      instanceStatusRef.current.kind === "provisioning" ||
      instanceStatusRef.current.kind === "ready"
    ) {
      return;
    }

    // When the CR already exists with an unrecognized status, treat it as a
    // transient active state and poll for updates instead of creating a
    // duplicate resource.
    if (instanceCRRef.current) {
      pollTransientRetriesLeft.current = maxTransientErrorRetries;
      updateInstanceStatus({ kind: "provisioning" });
      return;
    }

    // The CR is absent, so at this point we create the instance.
    try {
      await createAAP(proxyURL, userNamespace);
      pollTransientRetriesLeft.current = maxTransientErrorRetries;
      updateInstanceStatus({ kind: "provisioning" });
    } catch (error) {
      logger.error(`Unable to create AAP instance: ${error}`);

      updateInstanceStatus({
        kind: "error",
        errorType: AAPInstanceErrorType.INSTANCE_CREATION_FAILED,
      });

      throw new UserFacingError(
        "Unable to provision your Ansible Automation Platform instance",
        "We were unable to provision your Ansible Automation Platform instance. Please try again later.",
        error,
        `Unable to create the AAP instance for the user: the CR creation failed: ${error}`,
      );
    }
  }, [proxyURL, updateInstanceStatus, userNamespace]);

  /**
   * Unidles the Ansible Automation Platform instance.
   * @throws {UserFacingError} if unidling the instance fails.
   */
  const unidleInstance = useCallback(async () => {
    try {
      await unIdleAAP(proxyURL, userNamespace);
      pollTransientRetriesLeft.current = maxTransientErrorRetries;
      updateInstanceStatus({ kind: "unidling" });
      return;
    } catch (error) {
      // Keep the instance in "idled" status and tell the user that we
      // could not unidle it for them.
      throw new UserFacingError(
        "Unable to reprovision your Ansible Automation Platform instance",
        "We were unable to reprovision your Ansible Automation Platform instance. Please try again later.",
        error,
        `Unable to handle AAP instance for the user: unidling the instance failed: ${error}`,
      );
    }
  }, [proxyURL, updateInstanceStatus, userNamespace]);

  /**
   * Deletes the AAP instance and all the related resources.
   * @throws {UserFacingError} if the deletion of the CR itself, or the rest
   * of the resources fails.
   */
  const deleteInstance = useCallback(async () => {
    const previousInstanceState = instanceStatusRef.current;
    updateInstanceStatus({ kind: "deleting" });

    let deployments: DeploymentData | undefined;
    let statefulSets: StatefulSetData | undefined;
    try {
      [deployments, statefulSets] = await Promise.all([
        getDeployments(
          proxyURL,
          userNamespace,
          "app.kubernetes.io/managed-by=aap-operator",
        ),
        getStatefulSets(
          proxyURL,
          userNamespace,
          "app.kubernetes.io/managed-by=aap-operator",
        ),
      ]);

      await deleteAAPCR(proxyURL, userNamespace);
      pollTransientRetriesLeft.current = maxTransientErrorRetries;
      setInstanceCredentials(undefined);
    } catch (error) {
      updateInstanceStatus(previousInstanceState);
      throw new UserFacingError(
        "Unable to delete your AAP instance",
        `We have been unable to delete your AAP instance. Please try again, and if the issue persists, contact ${SUPPORT_EMAIL}.`,
        error,
        `Unable to delete AAP instance: ${error instanceof ApiError ? error.body : error}`,
      );
    }

    // Delete all the related resources and capture the results and any
    // errors via "allSettled".
    const cleanupResults = await Promise.allSettled([
      deleteSecretsAndPVCs(proxyURL, deployments, userNamespace),
      deleteSecretsAndPVCs(proxyURL, statefulSets, userNamespace),
      deletePVCsForSTS(proxyURL, statefulSets, userNamespace),
    ]);

    // Prepare the error structure so that the user can copy it nicely
    // for support.
    const cleanupError = AggregatedOperationError.fromSettledResults(
      "Ansible Automation Platform",
      [
        "Delete deployment secrets/PVCs",
        "Delete statefulset secrets/PVCs",
        "Delete statefulset PVCs",
      ],
      cleanupResults,
    );

    if (cleanupError) {
      updateInstanceStatus({
        kind: "error",
        errorType: AAPInstanceErrorType.DELETION_RESOURCES_ERROR,
      });
      throw new UserFacingError(
        "Unable to fully delete your AAP instance",
        `We have been able to successfully delete your AAP instance, but some internal errors might prevent you from reprovisioning it again. Please contact support at ${SUPPORT_EMAIL}.`,
        undefined,
        `Unable to fully delete AAP instance: the deletion of the related resources failed: ${cleanupError.toString()}`,
      );
    }

    updateInstanceStatus({ kind: "deleted" });
  }, [proxyURL, updateInstanceStatus, userNamespace]);

  /**
   * Fetch the instance's status on mount. It retries on transient failures to
   * make sure we are able to either determine a status for the instance, or
   * tell the user that something more critical might be going on.
   *
   * The reference is to ensure we only run this effect once.
   */
  useEffect(() => {
    // Guard for in-flight requests, so that if the component gets unmounted
    // while the request is in-flight, we ignore the results instead of
    // modifying the state with stale results.
    let cancelled = false;

    if (!hasFetchedOnMount.current) {
      // The reference is updated here to avoid any more executions if the
      // "instanceStatus" changes while "withRetry" is in flight.
      hasFetchedOnMount.current = true;

      updateInstanceStatus({ kind: "initialFetch" });
      withRetry(() => fetchCR(userNamespace), 3, 3_000)
        .then((result: FetchCRResult) => {
          if (cancelled) {
            return;
          }

          if (result.kind === "absent") {
            updateInstanceStatus({ kind: "new" });
            updateInstanceCR(undefined);
          } else if (result.kind === "failed") {
            updateInstanceStatus(result.status);
            updateInstanceCR(result.cr);
            addAlertFromError(
              new UserFacingError(
                "Ansible Automation Platform instance is not properly provisioned",
                `We have detected that your Ansible Automation Platform instance is not successfully provisioned. Please, either delete it and try again later, or contact ${SUPPORT_EMAIL}.`,
                undefined,
                `The AAP instance reports the following failed condition: ${JSON.stringify(result.failedCondition)}`,
              ),
            );
          } else {
            // When the instance is ready, check if for some reason it has the
            // annotation we use for timestamping the unidling request. If it
            // does, attempt removing it.
            if (
              result.status.kind === "ready" &&
              result.cr.metadata.annotations?.[UNIDLE_REQUESTED_AT_ANNOTATION]
            ) {
              removeUnidleAnnotation(proxyURL, userNamespace);
            }

            updateInstanceStatus(result.status);
            updateInstanceCR(result.cr);
          }
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          logger.error(
            `Unable to obtain the Ansible Automation Platform instance's status: ${error}`,
          );
          addAlertFromError(
            new UserFacingError(
              "Unable to determine your Ansible Automation Platform instance's status",
              `We have been unable to determine the status of your Ansible Automation Platform's instance. Please refresh the page, and if the issue persists, contact ${SUPPORT_EMAIL}.`,
              error,
              `${error}`,
            ),
          );
          updateInstanceStatus({
            kind: "error",
            errorType: AAPInstanceErrorType.INITIAL_FETCH_FAILED,
          });
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    addAlertFromError,
    fetchCR,
    proxyURL,
    updateInstanceCR,
    updateInstanceStatus,
    userNamespace,
  ]);

  /**
   * Poll for the instance's status when the instance is provisioning,
   * unidling or deleting. It stops the polling in case of unrecoverable
   * errors, and notifies the user accordingly.
   */
  useEffect(() => {
    // Narrow down the status type. Should we be using the
    // "instanceStatusRef" here, TypeScript assumes that the status could be
    // any of them, even though we have an "if" statement that will not allow
    // to poll for any other statuses than the ones listed.
    //
    // This way TypeScript understands that "currentInstanceStatus" can only
    // hold the listed values during the execution of this polling. It also
    // serves us as a guard in the very rare case that the status reference
    // drifts out of sync with the state. Something unlikely to happen, but
    // it's good to have it.
    const currentInstanceStatus = instanceStatusRef.current.kind;
    if (
      currentInstanceStatus !== "deleting" &&
      currentInstanceStatus !== "deleted" &&
      currentInstanceStatus !== "provisioning" &&
      currentInstanceStatus !== "unidling"
    ) {
      return;
    }

    // Prepare the elements that would be required for the error messages for
    // the user, in case we need them.
    const { titleVerb, descriptionVerb, errorType } = (() => {
      switch (currentInstanceStatus) {
        case "deleted":
        case "deleting":
          return {
            titleVerb: "delete",
            descriptionVerb: "deletion",
            errorType: AAPInstanceErrorType.DELETING_POLLING_REPORTS_FAILURE,
          };
        case "provisioning":
          return {
            titleVerb: "provision",
            descriptionVerb: "provisioning",
            errorType:
              AAPInstanceErrorType.PROVISIONING_POLLING_REPORTS_FAILURE,
          };
        case "unidling":
          return {
            titleVerb: "reprovision",
            descriptionVerb: "reprovisioning",
            errorType: AAPInstanceErrorType.UNIDLING_POLLING_REPORTS_FAILURE,
          };
      }
    })();

    // Since AAP instances can take a long time to provision/reprovision, it
    // does not make sense to be checking for a status update very often. For
    // the rest of the states it does make sense, since for example the
    // deletion of the instance should not take very long.
    const pollingInterval: number =
      currentInstanceStatus === "provisioning" ||
      currentInstanceStatus === "unidling"
        ? LONG_INTERVAL
        : SHORT_INTERVAL;

    let cancelled = false;
    const poll = async () => {
      let result: FetchCRResult;
      try {
        result = await fetchCR(userNamespace);
        // If the effect gets cancelled whil the "fetchCR" request is in
        // flight simply ignore all the results and stop polling.
        if (cancelled) {
          return;
        }

        pollTransientRetriesLeft.current = maxTransientErrorRetries;
      } catch (error) {
        if (cancelled) {
          return;
        }

        // On a transient error, if we still have retries left, we simply want
        // to keep polling.
        if (isTransient(error) && pollTransientRetriesLeft.current > 0) {
          pollTransientRetriesLeft.current--;
          logger.warn(
            `Transient error while polling AAP instance: ${error instanceof ApiError ? error.body : error}`,
          );

          if (!cancelled) {
            timerId = setTimeout(poll, pollingInterval);
          }
          return;
        }

        // After the retries have been depleted, or on a non-transient error
        // occurs, we want to stop the polling and notify the user.
        addAlertFromError(
          new UserFacingError(
            `Unable to ${titleVerb} your Ansible Automation Platform instance`,
            `Unfortunately, the ${descriptionVerb} of your Ansible Automation Platform instance failed. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}.`,
            error,
            `${error}`,
          ),
        );
        updateInstanceStatus({
          kind: "error",
          errorType: errorType,
        });
        return;
      }

      if (result.kind === "absent") {
        // When fetching the CR returned nothing, if we're deleting the
        // instance then that means that the deletion of the instance
        // succeeded.
        if (
          currentInstanceStatus === "deleting" ||
          currentInstanceStatus === "deleted"
        ) {
          addAlert(
            AlertVariant.success,
            "Ansible Automation Platform instance deleted",
            "Your Ansible Automation Platform instance was successfully deleted.",
          );

          updateInstanceStatus({ kind: "new" });
          updateInstanceCR(undefined);
          return;
        }

        // Otherwise, something unexpected happened because the CR should not
        // magically disappear when we are provisioning or reprovisioning it.
        addAlertFromError(
          new UserFacingError(
            `Unable to ${titleVerb} your AAP instance`,
            `Unfortunately, an internal error occurred that prevented from ${descriptionVerb} your Ansible Automation Platform instance. Please contact ${SUPPORT_EMAIL}.`,
            undefined,
            "During provisioning/reprovisioning, a fetch call returned no CR",
          ),
        );

        updateInstanceStatus({
          kind: "error",
          errorType: errorType,
        });
        updateInstanceCR(undefined);
        return;
      } else if (result.kind === "failed") {
        // When the instance is being deleted, we do not care about any
        // failures, because the instance will get deleted eventually. So in
        // that case we keep polling.
        if (
          currentInstanceStatus === "deleted" ||
          currentInstanceStatus === "deleting"
        ) {
          if (!cancelled) {
            timerId = setTimeout(poll, pollingInterval);
          }
          return;
        }

        // The instance ended up in a "failure" state, so we do not want to
        // keep polling and we want to notify the user that something went
        // wrong.
        addAlertFromError(
          new UserFacingError(
            `Unable to ${titleVerb} your AAP instance`,
            `Unfortunately, an internal error occurred that prevented from ${descriptionVerb} your Ansible Automation Platform instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}.`,
            undefined,
            `During provisioning/reprovisioning, the instance ended in a failed condition: ${JSON.stringify(result.failedCondition)}`,
          ),
        );
        updateInstanceStatus({
          kind: "error",
          errorType: errorType,
        });

        return;
      }

      // Only update the instance's status when we are either provisioning
      // or reprovisioning the instance. We do not want to overwrite the
      // deletion status while the instance is being deleted, because we
      // want to continue polling.
      if (
        currentInstanceStatus !== "deleting" &&
        currentInstanceStatus !== "deleted"
      ) {
        updateInstanceStatus(result.status);
        updateInstanceCR(result.cr);
      }

      // When the instance becomes ready, we might need to remove the
      // annotation we set when unidling the instance.
      if (
        result.status.kind === "ready" &&
        currentInstanceStatus === "unidling" &&
        result.cr.metadata.annotations?.[UNIDLE_REQUESTED_AT_ANNOTATION]
      ) {
        removeUnidleAnnotation(proxyURL, userNamespace);
      }

      // Schedule a new timeout.
      if (!cancelled) {
        timerId = setTimeout(poll, pollingInterval);
      }
    };

    let timerId = setTimeout(poll, pollingInterval);
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [
    addAlert,
    addAlertFromError,
    fetchCR,
    instanceStatus.kind,
    proxyURL,
    updateInstanceCR,
    updateInstanceStatus,
    userNamespace,
  ]);

  // Memoize the contents of the context to avoid rerenders on any state or
  // function changes.
  const contextValue = useMemo(
    () => ({
      deleteInstance,
      fetchInstanceCredentials,
      instanceStatus,
      provisionInstance,
      unidleInstance,
    }),
    [
      deleteInstance,
      fetchInstanceCredentials,
      instanceStatus,
      provisionInstance,
      unidleInstance,
    ],
  );

  return (
    <AnsibleContext.Provider value={contextValue}>
      {children}
    </AnsibleContext.Provider>
  );
}
