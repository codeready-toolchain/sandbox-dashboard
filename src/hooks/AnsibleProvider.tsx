import { AlertVariant } from "@patternfly/react-core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createAAP, deleteAAPCR, getAAP, unIdleAAP } from "../api/aap";
import {
  deletePVCsForSTS,
  deleteSecretsAndPVCs,
  getDeployments,
  getSecret,
  getStatefulSets,
} from "../api/kube";
import { SHORT_INTERVAL, SUPPORT_EMAIL } from "../const";
import { AggregatedOperationError } from "../error/AggregatedOperationError";
import { ApiError } from "../error/ApiError";
import { ProvisioningError } from "../error/ProvisioningError";
import { UserFacingError } from "../error/UserFacingError";
import { useNotifications } from "../notifications/useNotifications";
import type {
  AAPCR,
  AAPInstanceCredentials,
  DeploymentData,
  SecretItem,
  StatefulSetData,
} from "../types";
import {
  AAPInstanceErrorType,
  mapAnsibleStatus,
  type AAPInstanceStatus,
} from "../utils/aap-utils";
import logger from "../utils/logger";
import { isTransient, withRetry } from "../utils/retry";
import { AnsibleContext } from "./AnsibleContext";
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
  const { addAlert } = useNotifications();

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
   * @throws {ApiError} if the API calls to fetch the AAP resource.
   */
  const fetchCR = useCallback(
    async (namespace: string): Promise<void> => {
      const cr = await getAAP(proxyURL, namespace);
      if (!cr) {
        updateInstanceStatus({ kind: "new" });
        updateInstanceCR(undefined);
        return;
      }

      const [ansibleStatus, matchedCondition] = mapAnsibleStatus(cr);
      if (ansibleStatus.kind === "error" && matchedCondition) {
        updateInstanceStatus(ansibleStatus);
        throw new ProvisioningError("AAP", matchedCondition);
      }

      updateInstanceStatus(ansibleStatus);
      updateInstanceCR(cr);
    },
    [proxyURL, updateInstanceCR, updateInstanceStatus],
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
    if (!hasFetchedOnMount.current) {
      // The reference is updated here to avoid any more executions if the
      // "instanceStatus" changes while "withRetry" is in flight.
      hasFetchedOnMount.current = true;

      withRetry(() => fetchCR(userNamespace), 3, 3_000).catch((error) => {
        logger.error(
          `Unable to obtain the Ansible Automation Platform instance's status: ${error}`,
        );
        // With a ProvisioningError we know there's a condition failure in
        // the instance, so we want to preserve the error status that is set
        // by the fetch call. Any other errors we want to report them as an
        // initial fetch failure.
        if (!(error instanceof ProvisioningError)) {
          updateInstanceStatus({
            kind: "error",
            errorType: AAPInstanceErrorType.INITIAL_FETCH_FAILED,
          });
        }
        addAlert(
          AlertVariant.danger,
          "Unable to determine your Ansible Automation Platform instance's status",
          `We have been unable to determine the status of your Ansible Automation Platform's instance. Please refresh the page, and if the issue persists, contact ${SUPPORT_EMAIL}.`,
        );
      });
    }
  }, [addAlert, fetchCR, updateInstanceStatus, userNamespace]);

  /**
   * Poll for the instance's status when the instance is provisioning,
   * unidling or deleting. It stops the polling in case of unrecoverable
   * errors, and notifies the user accordingly.
   */
  useEffect(() => {
    if (
      instanceStatus.kind !== "deleting" &&
      instanceStatus.kind !== "deleted" &&
      instanceStatus.kind !== "provisioning" &&
      instanceStatus.kind !== "unidling"
    ) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      if (
        instanceStatusRef.current.kind === "deleting" ||
        instanceStatusRef.current.kind === "deleted"
      ) {
        // We want to keep the "fetchCR" function as a "fetch and update"
        // status function without any deletion logic on it. This is why the
        // polling mechanism has this special case.
        //
        // Using "fetchCR" directly would probably change the instance's
        // status to something else than "deleting", which would stop the
        // polling.
        try {
          const cr = await getAAP(proxyURL, userNamespace);

          if (!cr && instanceStatusRef.current.kind === "deleted") {
            updateInstanceStatus({ kind: "new" });
            updateInstanceCR(undefined);
            return;
          }
        } catch (err) {
          if (err instanceof ApiError) {
            if (isTransient(err) && pollTransientRetriesLeft.current > 0) {
              pollTransientRetriesLeft.current--;
              logger.warn(
                `Unexpected transient error received while polling on an AAP instance when verifying its deletion: ${err.body}`,
              );
            } else {
              cancelled = true;
              updateInstanceStatus({
                kind: "error",
                errorType:
                  AAPInstanceErrorType.DELETING_POLLING_REPORTS_FAILURE,
              });
              addAlert(
                AlertVariant.danger,
                `Unable to delete your instance`,
                `The deletion of the instance failed. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
              );
              logger.error(
                `Unexpected response received while polling on a AAP instance when verifying its deletion: ${err.body}`,
              );
            }
          } else {
            // Any other unexpected error should make the polling stop, since
            // it would be probably related to the "send the request" failures.
            cancelled = true;
            updateInstanceStatus({
              kind: "error",
              errorType: AAPInstanceErrorType.DELETING_POLLING_REPORTS_FAILURE,
            });

            logger.error(
              `Unexpected error while polling for the status of the deletion of the AAP instance: ${err}`,
            );
            addAlert(
              AlertVariant.danger,
              `Unable to delete your instance`,
              `The deletion of the instance failed. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
            );
          }
        }
      } else {
        const wasUnidling = instanceStatusRef.current.kind === "unidling";
        try {
          await fetchCR(userNamespace);
        } catch (err) {
          if (err instanceof ApiError) {
            if (isTransient(err) && pollTransientRetriesLeft.current > 0) {
              pollTransientRetriesLeft.current--;
              logger.warn(
                `Unexpected transient error received while polling on an AAP instance when verifying its ${wasUnidling ? "unidling" : "provisioning"}: ${err.body}`,
              );
            } else {
              cancelled = true;
            }
          } else if (err instanceof ProvisioningError) {
            cancelled = true;

            logger.error(
              `Error while polling for the AAP instance status: the AAP instance ended up in a failure condition: ${err.getFormattedErrorMessage()}`,
            );
          } else {
            cancelled = true;

            logger.error(
              `Unexpected error while polling for the AAP instance status: ${err}`,
            );
          }

          if (cancelled) {
            // ProvisioningError means fetchCR already set the
            // condition-specific error status — preserve it.
            if (!(err instanceof ProvisioningError)) {
              updateInstanceStatus({
                kind: "error",
                errorType: wasUnidling
                  ? AAPInstanceErrorType.UNIDLING_POLLING_REPORTS_FAILURE
                  : AAPInstanceErrorType.PROVISIONING_POLLING_REPORTS_FAILURE,
              });
            }
            addAlert(
              AlertVariant.danger,
              `Unable to ${wasUnidling ? "reprovision" : "provision"} your instance`,
              `The ${wasUnidling ? "reprovisioning" : "provisioning"} of the instance failed. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
            );
          }
        }
      }

      // Schedule a new timeout.
      if (!cancelled) {
        timerId = setTimeout(poll, SHORT_INTERVAL);
      }
    };

    let timerId = setTimeout(poll, SHORT_INTERVAL);
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [
    addAlert,
    fetchCR,
    instanceStatus.kind,
    updateInstanceCR,
    updateInstanceStatus,
    userNamespace,
    proxyURL,
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
