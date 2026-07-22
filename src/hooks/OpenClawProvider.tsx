import { AlertVariant } from "@patternfly/react-core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  cleanupWorkspaceEnvironment,
  createOpenClaw,
  createSpaceRequest,
  createWorkspaceKubeconfig,
  deleteOpenClawCR,
  deleteSpaceRequest,
  getOpenClaw,
  getSpaceRequest,
  setupWorkspaceEnvironment,
  unIdleOpenClaw,
} from "../api/openclaw";
import { SHORT_INTERVAL, SUPPORT_EMAIL } from "../const";
import { AggregatedOperationError } from "../error/AggregatedOperationError";
import { ApiError } from "../error/ApiError";
import { ProvisioningError } from "../error/ProvisioningError";
import { UserFacingError } from "../error/UserFacingError";
import { useNotifications } from "../notifications/useNotifications";
import type { OpenClawCR, SpaceRequestItem } from "../types";
import logger from "../utils/logger";
import type { AddedCredential } from "../utils/openclaw-providers";
import {
  getSpaceRequestNamespace,
  isSpaceRequestTerminating,
  mapOpenClawStatus,
  OpenClawStatus,
} from "../utils/openclaw-utils";
import {
  defaultOpenClawSkills,
  defaultOpenClawWorkspace,
} from "../utils/openclaw-workspace-content";
import { isTransient, withRetry } from "../utils/retry";
import { OpenClawContext } from "./OpenClawContext";
import { useUserContext } from "./UserContext";

export function OpenClawProvider({ children }: { children: ReactNode }) {
  const { user } = useUserContext();

  // Route and mount a fake provider if the user is not yet signed up or if it
  // doesn't have the required variables for the OpenClaw provider to properly
  // work.
  if (user?.apiEndpoint && user?.defaultUserNamespace && user?.proxyURL) {
    return (
      <OpenClawProviderConnected
        apiEndpoint={user.apiEndpoint}
        proxyURL={user.proxyURL}
        userNamespace={user.defaultUserNamespace}
      >
        {children}
      </OpenClawProviderConnected>
    );
  } else {
    return <OpenClawProviderNoop>{children}</OpenClawProviderNoop>;
  }
}

/**
 * A NOOP provider for when the user is not yet signed up. Allows rendering
 * the cards with its actions effectively disabled.
 */
export function OpenClawProviderNoop({ children }: { children: ReactNode }) {
  return (
    <OpenClawContext.Provider
      value={{
        clearDeletionError: () => {},
        clearProvisioningError: () => {},
        deleteInstance: async () =>
          Promise.reject(new Error("User not signed up")),
        deletionError: undefined,
        provisioningError: undefined,
        startProvisioning: async (): Promise<void> => {},
        status: OpenClawStatus.USER_NOT_READY,
        uiURL: undefined,
        unidleInstance: async (): Promise<void> => {},
      }}
    >
      {children}
    </OpenClawContext.Provider>
  );
}

/**
 * A real provider for when the user is signed up. The variables defined in
 * the components' props are a requirement for the provider to work, so this
 * type narrowing helps avoiding having guards for them everywhere.
 */
export function OpenClawProviderConnected({
  children,
  apiEndpoint,
  proxyURL,
  userNamespace,
}: {
  children: ReactNode;
  apiEndpoint: string;
  proxyURL: string;
  userNamespace: string;
}) {
  const { addAlert } = useNotifications();

  /**
   * A reference to track down if the instance is being currently deleted, to
   * be able to provide proper user feedback if it is.
   */
  const deletingOpenClaw = useRef<boolean>(false);

  /**
   * A reference to the instance's CR to avoid stale values in closures. Since
   * we do not expose the CR anywhere, and no functions or callbacks depend on
   * the CR itself to rerender or update status, we can use just this for now.
   */
  const instanceCRRef = useRef<OpenClawCR | undefined>(undefined);

  /**
   * A reference to the resolved OpenClaw namespace to avoid stale values in
   * closures.
   */
  const openClawNamespaceRef = useRef<string | undefined>(undefined);

  /**
   * A reference of the status to avoid stale values in closures.
   */
  const statusRef = useRef<OpenClawStatus>(OpenClawStatus.NEW);

  const [status, setStatus] = useState<OpenClawStatus>(OpenClawStatus.NEW);
  const [uiURL, setUiURL] = useState<string | undefined>();
  const [deletionError, setDeletionError] = useState<
    UserFacingError | undefined
  >();
  const [provisioningError, setProvisioningError] = useState<
    UserFacingError | undefined
  >();

  /**
   * Defines how many times we are going to retry fetching for the instance's
   * status on transient errors before giving up.
   */
  const maxTransientErrorRetries: number = 3;

  /**
   * Counter to keep track of how many transient errors we have encountered
   * while polling to check for an status update of the instance.
   */
  const pollTransientRetriesLeft = useRef<number>(maxTransientErrorRetries);

  const provisioningPhase = useRef<
    | "not_started"
    | "creating_space_request"
    | "creating_cr"
    | "waiting_for_readiness"
  >("not_started");

  /**
   * A reference containing the credentials and the device pairing settings
   * that the user gave us via the interface. We need to save them because the
   * provisioning takes a few asynchronous steps, and we need to keep the data
   * momentarily.
   */
  const provisioningSettings = useRef<
    | {
        credentials: AddedCredential[];
        isDevicePairingDisabled: boolean;
      }
    | undefined
  >(undefined);

  /**
   * Updates the instance status atomically both for the state variable and
   * the reference.
   */
  const updateInstanceStatus = useCallback(
    (newStatus: OpenClawStatus): void => {
      setStatus(newStatus);
      statusRef.current = newStatus;
    },
    [],
  );

  /**
   * Fetches the OpenClaw CR and updates the references and the status
   * variables. When the instance is ready, it grabs the UI link from the
   * status.
   * @param openClawNamespace the namespace in which the OpenClaw instance
   * should be.
   * @throws {ApiError} if the network calls to fetch the space request or the
   * instance's resource itself fail.
   * @throws {UserFacingError}
   */
  const refreshInstanceStatus = useCallback(async () => {
    const spaceRequest: SpaceRequestItem | undefined = await getSpaceRequest(
      proxyURL,
      userNamespace,
    );

    // Not having a space request either means that we were deleting it
    // before, or that it didn't exit in the first place.
    if (!spaceRequest) {
      if (statusRef.current === OpenClawStatus.DELETING) {
        deletingOpenClaw.current = false;
        instanceCRRef.current = undefined;
        openClawNamespaceRef.current = undefined;
        setDeletionError(undefined);
        setUiURL(undefined);
        setProvisioningError(undefined);
      }

      updateInstanceStatus(OpenClawStatus.NEW);
      return;
    }

    // When the space request is terminating, that means that we're in the
    // deletion process.
    if (isSpaceRequestTerminating(spaceRequest)) {
      if (statusRef.current !== OpenClawStatus.DELETING) {
        updateInstanceStatus(OpenClawStatus.DELETING);
      }

      return;
    }

    // Get OpenClaw's namespace from the space request.
    const openClawNamespace: string | undefined =
      getSpaceRequestNamespace(spaceRequest);

    // The space request might not have the namespace ready yet, or we
    // haven't had time to extract it. This could happen if the user starts
    // provisioning the instance but refreshes before the namespace appears.
    if (!openClawNamespace) {
      updateInstanceStatus(OpenClawStatus.PROVISIONING);
      provisioningPhase.current = "creating_space_request";
      return;
    }

    // Update the namespace we have for OpenClaw.
    openClawNamespaceRef.current = openClawNamespace;

    // Fetch the CR and update its status.
    const fetchedCR = await getOpenClaw(proxyURL, openClawNamespace);
    const [currentStatus, failedCondition] = mapOpenClawStatus(fetchedCR);

    // Is the instance in a "failed" condition?
    if (failedCondition) {
      updateInstanceStatus(OpenClawStatus.FAILED);
      throw new ProvisioningError("OpenClaw", failedCondition);
    }

    // If the CR does not exist yet, but we are actively provisioning, don't
    // override the current status with "NEW". The polling should keep calling
    // this function and eventually we'll transition to a new state.
    if (
      currentStatus === OpenClawStatus.NEW &&
      statusRef.current === OpenClawStatus.PROVISIONING &&
      provisioningPhase.current !== "not_started"
    ) {
      return;
    }

    // If for some reason we haven't been able to determine the status, but
    // the provisioning has started, map it to provisioning.
    //
    if (
      currentStatus === OpenClawStatus.UNKNOWN &&
      provisioningPhase.current !== "not_started"
    ) {
      updateInstanceStatus(OpenClawStatus.PROVISIONING);
    } else {
      // Update the instance's status for any other condition.
      updateInstanceStatus(currentStatus);
    }

    // At this point we know there's no provisioning error so we can reset
    // it.
    setProvisioningError(undefined);

    // If it happens to be ready, extract all the necessary bits for the
    // integration to work.
    if (currentStatus === OpenClawStatus.READY && fetchedCR) {
      if (fetchedCR.status?.url) {
        try {
          const url = new URL(fetchedCR.status.url);
          if (!fetchedCR.spec?.auth?.disableDevicePairing) {
            url.pathname = `${url.pathname.replace(
              /\/$/,
              "",
            )}/integration/device-pairing/`;
          }
          setUiURL(url.toString());
        } catch {
          setUiURL(fetchedCR.status.url);
        }
      } else {
        updateInstanceStatus(OpenClawStatus.FAILED);
        throw new ProvisioningError("OpenClaw", {
          type: "Failure",
          status: "True",
          reason: "MissingURL",
          message:
            "The OpenClaw instance is ready but did not provide an access URL.",
        });
      }

      instanceCRRef.current = fetchedCR;
    }

    // When the instance is provisioning and we are just waiting for
    // readiness, the CR is there so we can just set it in the reference.
    if (
      currentStatus === OpenClawStatus.PROVISIONING &&
      provisioningPhase.current === "waiting_for_readiness"
    ) {
      instanceCRRef.current = fetchedCR;
    }
  }, [proxyURL, updateInstanceStatus, userNamespace]);

  /**
   * Starts the provisioning process for the OpenClaw instance.
   * @throws {UserFacingError} if the provisioning process could not be
   * started.
   */
  const startProvisioning = useCallback(
    async (
      credentials: AddedCredential[],
      isDevicePairingDisabled?: boolean,
    ): Promise<void> => {
      // Update the state of the instance and the provisioning phase.
      updateInstanceStatus(OpenClawStatus.PROVISIONING);
      provisioningPhase.current = "creating_space_request";

      // Create the space request and save the settings.
      try {
        await createSpaceRequest(proxyURL, userNamespace);
        provisioningSettings.current = {
          credentials: credentials,
          isDevicePairingDisabled: isDevicePairingDisabled ?? false,
        };
      } catch (error) {
        provisioningPhase.current = "not_started";
        updateInstanceStatus(OpenClawStatus.FAILED);

        let technicalDetails: string;
        if (error instanceof ApiError) {
          technicalDetails = error.body;
        } else {
          technicalDetails = `${error}`;
        }

        throw new UserFacingError(
          "Unable to provision your OpenClaw instance",
          `We were unable to provision your OpenClaw instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
          error,
          technicalDetails,
        );
      }
    },
    [proxyURL, updateInstanceStatus, userNamespace],
  );

  /**
   * A little helper function for the {@link provisionInstance} function. It
   * attempts a best-effort cleanup, extracts the technical details, logs an
   * error message and sets a {@link UserFacingError} with
   * {@link setProvisioningError}.
   *
   * @param error the error to extract the technical details from.
   * @param logMessage the log message to log.
   */
  const handleProvisioningStepFailure = useCallback(
    async (error: unknown, logMessage: string): Promise<void> => {
      try {
        await cleanupWorkspaceEnvironment(proxyURL, userNamespace);
      } catch (error) {
        // Best effort cleanup.
        logger.error(
          "Unable to cleanup the workspace environment after attempting to set it up",
          error,
        );
      }

      let technicalErrorDetails: string;
      if (error instanceof ApiError) {
        technicalErrorDetails = error.body;
      } else if (error instanceof AggregatedOperationError) {
        technicalErrorDetails = error.toString();
      } else {
        technicalErrorDetails = `${error}`;
      }

      logger.error(logMessage, error);

      provisioningPhase.current = "not_started";
      updateInstanceStatus(OpenClawStatus.FAILED);
      provisioningSettings.current = undefined;
      setProvisioningError(
        new UserFacingError(
          "Unable to provision your OpenClaw instance",
          `Unfortunately we were unable to provision your OpenClaw instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}.`,
          error,
          technicalErrorDetails,
        ),
      );
    },
    [proxyURL, updateInstanceStatus, userNamespace],
  );

  /**
   * Provisions the OpenClaw instance by setting up the workspace, the
   * kubeconfig and the OpenClaw CR itself.
   */
  const provisionInstance = useCallback(
    async (openClawNamespace: string): Promise<void> => {
      // If we don't have user settings, we can't move forward.
      if (!provisioningSettings.current) {
        return;
      }

      provisioningPhase.current = "creating_cr";
      try {
        await setupWorkspaceEnvironment(
          proxyURL,
          userNamespace,
          openClawNamespace,
        );
      } catch (error) {
        await handleProvisioningStepFailure(
          error,
          "Unable to create OpenClaw's workspace environment's resources",
        );
        return;
      }

      try {
        await createWorkspaceKubeconfig(
          proxyURL,
          userNamespace,
          openClawNamespace,
          apiEndpoint,
        );
      } catch (error) {
        await handleProvisioningStepFailure(
          error,
          "Unable to create OpenClaw's Kubeconfig workspace resources",
        );
        return;
      }

      try {
        await createOpenClaw(
          proxyURL,
          openClawNamespace,
          provisioningSettings.current?.credentials,
          provisioningSettings.current?.isDevicePairingDisabled,
          defaultOpenClawWorkspace,
          defaultOpenClawSkills,
        );

        provisioningSettings.current = undefined;
        provisioningPhase.current = "waiting_for_readiness";
        pollTransientRetriesLeft.current = maxTransientErrorRetries;
      } catch (error) {
        await handleProvisioningStepFailure(
          error,
          "Unable to create OpenClaw's instance's CR resource",
        );
        return;
      }
    },
    [apiEndpoint, handleProvisioningStepFailure, proxyURL, userNamespace],
  );

  /**
   * Clears the deletion error.
   */
  const clearDeletionError = useCallback((): void => {
    setDeletionError(undefined);
  }, []);

  /**
   * Clears the provisioning error.
   */
  const clearProvisioningError = useCallback((): void => {
    setProvisioningError(undefined);
  }, []);

  /**
   * Unidles the already provisioned instance.
   * @throws {UserFacingError} if an error occurred during the unidling of the
   * instance.
   */
  const unidleInstance = useCallback(async (): Promise<void> => {
    let cause: unknown;
    let technicalDetails: string | undefined;

    if (openClawNamespaceRef.current) {
      try {
        await unIdleOpenClaw(proxyURL, openClawNamespaceRef.current);
        updateInstanceStatus(OpenClawStatus.UNIDLING);
        provisioningPhase.current = "waiting_for_readiness";
        return;
      } catch (error) {
        cause = error;
        if (error instanceof ApiError) {
          technicalDetails = error.body;
        } else {
          technicalDetails = `${error}`;
        }
      }
    }

    throw new UserFacingError(
      "Unable to reprovision your OpenClaw instance",
      `We were unable to reprovision your OpenClaw instance. Please try again later, and if the issue persists, contact ${SUPPORT_EMAIL}`,
      cause,
      technicalDetails,
    );
  }, [proxyURL, updateInstanceStatus]);

  /**
   * Deletes the OpenClaw instance and all its related resources.
   * @param userNamespace the user namespace to delete OpenClaw from.
   * @throws {UserFacingError} if the deletion of any of the resources fail.
   */
  const deleteInstance = useCallback(async () => {
    const previousUILink = uiURL;

    deletingOpenClaw.current = true;
    updateInstanceStatus(OpenClawStatus.DELETING);
    setUiURL(undefined);
    setDeletionError(undefined);

    // Delete the OpenClaw resource and all of its related resources. Any
    // errors are caught by "allSettled".
    const results = await Promise.allSettled([
      openClawNamespaceRef.current
        ? deleteOpenClawCR(proxyURL, openClawNamespaceRef.current)
        : Promise.resolve(),
      deleteSpaceRequest(proxyURL, userNamespace),
      cleanupWorkspaceEnvironment(proxyURL, userNamespace),
    ]);

    // Prepare an error structure to make it easy to copy for the users in
    // case they seek support.
    const aggregatedError = AggregatedOperationError.fromSettledResults(
      "OpenClaw",
      ["Delete CR", "Delete SpaceRequest", "Cleanup workspace"],
      results,
    );

    if (aggregatedError) {
      deletingOpenClaw.current = false;
      updateInstanceStatus(OpenClawStatus.FAILED);
      setUiURL(previousUILink);
      const error = new UserFacingError(
        "Unable to delete your OpenClaw instance",
        `We have been unable to delete your OpenClaw instance. Please try again later, and if the issue persists, contact "${SUPPORT_EMAIL}".`,
        aggregatedError.cause,
        aggregatedError.toString(),
      );
      setDeletionError(error);
      throw error;
    }

    openClawNamespaceRef.current = undefined;
    instanceCRRef.current = undefined;
  }, [uiURL, proxyURL, updateInstanceStatus, userNamespace]);

  // Initial fetch of the OpenClaw resource to determine its status. On
  // non-transient errors we notify the user that something went wrong.
  const hasFetchedOnMount = useRef<boolean>(false);
  useEffect(() => {
    void (async () => {
      if (!hasFetchedOnMount.current) {
        // The reference is updated here to avoid any more executions if the
        // "instanceStatus" changes while "withRetry" is in flight.
        hasFetchedOnMount.current = true;

        await withRetry(() => refreshInstanceStatus(), 3, 3_000).catch(
          (error) => {
            logger.error(
              `Unable to obtain the OpenClaw instance's status: ${error}`,
            );
            // With a ProvisioningError we know there's a condition failure in
            // the instance, so we want to preserve the error status that is set
            // by the fetch call. Any other errors we want to report them as an
            // initial fetch failure.
            if (!(error instanceof ProvisioningError)) {
              updateInstanceStatus(OpenClawStatus.INITIAL_FETCH_FAILED);
            }
            addAlert(
              AlertVariant.danger,
              "Unable to determine your OpenClaw instance's status",
              `We have been unable to determine the status of your OpenClaw instance. Please refresh the page, and if the issue persists, contact ${SUPPORT_EMAIL}.`,
            );
          },
        );
      }
    })();
  }, [addAlert, refreshInstanceStatus, updateInstanceStatus]);

  // Helper variable to determine if the polling loop should be working or
  // not.
  const shouldBePolling =
    status === OpenClawStatus.DELETING ||
    status === OpenClawStatus.PROVISIONING ||
    status === OpenClawStatus.UNIDLING;

  /**
   * Polling effect that keeps polling when:
   *
   * - The space request is being provisioned and while the namespace the
   * instance has to go in has not yet been resolved.
   * - The instance has been provisioned and we are waiting for its readiness.
   */
  useEffect(() => {
    if (!shouldBePolling) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        await refreshInstanceStatus();
        pollTransientRetriesLeft.current = maxTransientErrorRetries;
      } catch (error) {
        if (error instanceof ProvisioningError) {
          setProvisioningError(
            new UserFacingError(
              "Unable to provision your OpenClaw instance",
              `We were unable to provision your OpenClaw instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
              error,
              error.getFormattedErrorMessage(),
            ),
          );
          return;
        } else if (isTransient(error) && pollTransientRetriesLeft.current > 0) {
          pollTransientRetriesLeft.current--;
          logger.warn(
            `Unexpected transient error received while polling to check if the OpenClaw's CR is ready: ${error}`,
          );
        } else {
          let technicalDetails: string;
          if (error instanceof ApiError) {
            technicalDetails = error.body;
          } else {
            technicalDetails = `${error}`;
          }

          logger.error(
            `Unexpected error received while polling to check if the OpenClaw's CR is ready: ${error}`,
          );
          updateInstanceStatus(OpenClawStatus.FAILED);

          if (deletingOpenClaw.current) {
            deletingOpenClaw.current = false;

            setDeletionError(
              new UserFacingError(
                "Unable to delete your OpenClaw instance",
                `We were unable to delete your OpenClaw instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
                error,
                technicalDetails,
              ),
            );
          } else {
            setProvisioningError(
              new UserFacingError(
                "Unable to provision your OpenClaw instance",
                `We were unable to provision your OpenClaw instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
                error,
                technicalDetails,
              ),
            );
          }
          return;
        }
      }

      // The namespace is ready but the instance is not created yet, or we
      // lost the in-memory state after the user refreshed the page.
      //
      // - With provisioning settings, we just continue and create the
      // instance.
      // - Without them, the credentials are gone. So if the CR was created
      // before losing the credentials, we can resume waiting for the
      // instance's readiness. Otherwise we reset the state to "NEW" and let
      // the user to reprovision again, since creating the space request
      // is idempotent and will not fail.
      if (
        statusRef.current === OpenClawStatus.PROVISIONING &&
        provisioningPhase.current === "creating_space_request" &&
        openClawNamespaceRef.current &&
        !instanceCRRef.current
      ) {
        if (provisioningSettings.current) {
          try {
            await provisionInstance(openClawNamespaceRef.current);
          } catch (error) {
            logger.error(
              "Unexpected error during instance provisioning",
              error,
            );
            updateInstanceStatus(OpenClawStatus.FAILED);
            setProvisioningError(
              new UserFacingError(
                "Unable to provision your OpenClaw instance",
                `We were unable to provision your OpenClaw instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
                error,
                `${error}`,
              ),
            );
            return;
          }
        } else {
          // With no CR and no provisioning settings, we assume that the user
          // refreshed the page mid-provisioning. And without those lost
          // credentials we cannot provision the instance. Reset the status to
          // NEW so that the user can start over.
          provisioningPhase.current = "not_started";
          updateInstanceStatus(OpenClawStatus.NEW);
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
    refreshInstanceStatus,
    provisionInstance,
    proxyURL,
    shouldBePolling,
    updateInstanceStatus,
    userNamespace,
  ]);

  // Memoize the contents of the context to avoid rerenders on any state or
  // function changes.
  const contextValue = useMemo(
    () => ({
      clearDeletionError,
      clearProvisioningError,
      deleteInstance,
      deletionError,
      provisioningError,
      startProvisioning,
      status,
      uiURL,
      unidleInstance,
    }),
    [
      clearDeletionError,
      clearProvisioningError,
      deleteInstance,
      deletionError,
      provisioningError,
      startProvisioning,
      status,
      uiURL,
      unidleInstance,
    ],
  );

  return (
    <OpenClawContext.Provider value={contextValue}>
      {children}
    </OpenClawContext.Provider>
  );
}
