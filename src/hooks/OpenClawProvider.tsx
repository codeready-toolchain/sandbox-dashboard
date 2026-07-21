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
import type { OpenClawCR, StatusCondition } from "../types";
import { errorMessage } from "../utils/common";
import logger from "../utils/logger";
import type { AddedCredential } from "../utils/openclaw-providers";
import {
  getSpaceRequestNamespace,
  isSpaceRequestReady,
  isSpaceRequestTerminating,
  mapOpenClawStatus,
  OpenClawStatus,
} from "../utils/openclaw-utils";
import {
  defaultOpenClawSkills,
  defaultOpenClawWorkspace,
} from "../utils/openclaw-workspace-content";
import { isTransient } from "../utils/retry";
import { OpenClawContext } from "./OpenClawContext";
import { useUserContext } from "./UserContext";

function resolveOpenClawError(err: unknown, fallbackPrefix: string): string {
  if (err instanceof ApiError) {
    return err.body;
  }
  if (err instanceof Error) {
    logger.error(fallbackPrefix, err);
    return `${fallbackPrefix}: ${err.message}`;
  }
  logger.error(fallbackPrefix, err);
  return fallbackPrefix;
}

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
        deleteOpenClaw: async () =>
          Promise.reject(new Error("User not signed up")),
        handleOpenClawInstance: async () => {},
        openClawDeletionErrorDetails: null,
        openClawProvisioningErrorDetails: null,
        openclawStatus: OpenClawStatus.USER_NOT_READY,
        openclawUILink: undefined,
        provisioningError: undefined,
        resetOpenClawDeletionErrorDetails: () => {},
        resetOpenClawProvisioningErrorDetails: () => {},
        startProvisioning: async (): Promise<void> => {},
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
  const [openclawUILink, setOpenclawUILink] = useState<string | undefined>();
  const [openClawDeletionErrorDetails, setOpenClawDeletionErrorDetails] =
    useState<string | null>(null);
  const [provisioningError, setProvisioningError] = useState<
    UserFacingError | undefined
  >();
  const [
    openClawProvisioningErrorDetails,
    setOpenClawProvisioningErrorDetails,
  ] = useState<string | null>(null);

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
   * Polls the current state of the OpenClaw instance and drives the
   * provisioning state machine forward.
   *
   * @param userNamespace the user's home namespace used to locate the
   *   SpaceRequest and workspace resources.
   * @deprecated to be removed soon in favor of smaller and more organized
   * functions.
   */
  const getOpenClawData = useCallback(
    async (namespace: string) => {
      try {
        const sr = await getSpaceRequest(proxyURL, namespace);

        if (!sr) {
          if (deletingOpenClaw.current) {
            deletingOpenClaw.current = false;
            openClawNamespaceRef.current = undefined;
            instanceCRRef.current = undefined;
            updateInstanceStatus(OpenClawStatus.NEW);
            setOpenclawUILink(undefined);
            setOpenClawProvisioningErrorDetails(null);
            return;
          }

          updateInstanceStatus(OpenClawStatus.NEW);
          return;
        }

        if (isSpaceRequestTerminating(sr)) {
          if (deletingOpenClaw.current) return;
          updateInstanceStatus(OpenClawStatus.TERMINATING);
          return;
        }

        if (deletingOpenClaw.current) return;

        // Accounts for the case in which the user starts provisioning and
        // refreshes the page before the namespace appears. Repolling could
        // find the space request without a namespace yet.
        const targetNamespace = getSpaceRequestNamespace(sr);
        if (!targetNamespace) {
          updateInstanceStatus(OpenClawStatus.PROVISIONING);
          provisioningPhase.current = "creating_space_request";
          return;
        }

        openClawNamespaceRef.current = targetNamespace;

        const data = await getOpenClaw(proxyURL, targetNamespace);
        instanceCRRef.current = data;

        let conditionFailed = false;
        const st = mapOpenClawStatus(data, (conditionMessage) => {
          logger.error("OpenClaw CR reported failure:", conditionMessage);
          conditionFailed = true;
          setOpenClawProvisioningErrorDetails(errorMessage(conditionMessage));
        });
        if (!conditionFailed) {
          setOpenClawProvisioningErrorDetails(null);
        }
        updateInstanceStatus(st);
        if (st === OpenClawStatus.PROVISIONING) {
          provisioningPhase.current = "waiting_for_readiness";
        }

        if (data?.status?.url) {
          try {
            const url = new URL(data.status.url);
            if (!data.spec?.auth?.disableDevicePairing) {
              url.pathname = `${url.pathname.replace(
                /\/$/,
                "",
              )}/integration/device-pairing/`;
            }
            setOpenclawUILink(url.toString());
          } catch {
            setOpenclawUILink(data.status.url);
          }
        }

        if (st === OpenClawStatus.UNKNOWN && isSpaceRequestReady(sr)) {
          updateInstanceStatus(OpenClawStatus.PROVISIONING);
          provisioningPhase.current = "waiting_for_readiness";
        }
      } catch (e) {
        const detail = resolveOpenClawError(
          e,
          "Unable to fetch OpenClaw instance status",
        );
        if (deletingOpenClaw.current) {
          setOpenClawDeletionErrorDetails(detail);
        } else {
          setOpenClawProvisioningErrorDetails(detail);
        }
      }
    },
    [proxyURL, updateInstanceStatus],
  );

  /**
   * Fetches the OpenClaw CR and updates the references and the status
   * variables. When the instance is ready, it grabs the UI link from the
   * status.
   * @param openClawNamespace the namespace in which the OpenClaw instance
   * should be.
   */
  const fetchCR = useCallback(
    async (openClawNamespace: string) => {
      // Fetch the CR and update its status.
      const fetchedCR = await getOpenClaw(proxyURL, openClawNamespace);
      const currentStatus = mapOpenClawStatus(
        fetchedCR,
        (errorCondition: StatusCondition) => {
          updateInstanceStatus(OpenClawStatus.FAILED);
          throw new ProvisioningError("OpenClaw", errorCondition);
        },
      );
      updateInstanceStatus(currentStatus);

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
            setOpenclawUILink(url.toString());
          } catch {
            setOpenclawUILink(fetchedCR.status.url);
          }
        } else {
          updateInstanceStatus(OpenClawStatus.FAILED);
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
    },
    [proxyURL, updateInstanceStatus],
  );

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

  // Initial OpenClaw fetch
  useEffect(() => {
    void (async () => {
      await getOpenClawData(userNamespace);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proxyURL, userNamespace]);

  const resetOpenClawDeletionErrorDetails = useCallback((): void => {
    setOpenClawDeletionErrorDetails(null);
    getOpenClawData(userNamespace);
  }, [getOpenClawData, userNamespace]);

  const resetOpenClawProvisioningErrorDetails = useCallback((): void => {
    setOpenClawProvisioningErrorDetails(null);
    setProvisioningError(undefined);
    getOpenClawData(userNamespace);
  }, [getOpenClawData, userNamespace]);

  /**
   * Unidles the already provisioned instance if it exists, and if not, it
   * creates it.
   * @throws {UserFacingError} if an error occurred during the fetching or
   * "unidling" of the instance.
   */
  const handleOpenClawInstance = useCallback(async (): Promise<void> => {
    // Fetch current state first.
    let currentStatus = status;
    let resolvedNamespace: string | undefined;

    try {
      const sr = await getSpaceRequest(proxyURL, userNamespace);
      if (sr) {
        const ns = getSpaceRequestNamespace(sr);
        if (ns) {
          resolvedNamespace = ns;
          const data = await getOpenClaw(proxyURL, ns);
          currentStatus = mapOpenClawStatus(data, () => {});
        }
      } else {
        currentStatus = OpenClawStatus.NEW;
      }
    } catch (apiError) {
      if (apiError instanceof ApiError && apiError.statusCode === 404) {
        currentStatus = OpenClawStatus.NEW;
      } else {
        throw new UserFacingError(
          "Unable to get your OpenClaw instance's information",
          "We were unable to obtain the status of your OpenClaw instance. Please try again later.",
          apiError,
        );
      }
    }

    if (
      currentStatus === OpenClawStatus.PROVISIONING ||
      currentStatus === OpenClawStatus.READY
    ) {
      return;
    }

    if (currentStatus === OpenClawStatus.DELETING) {
      return;
    }

    if (currentStatus === OpenClawStatus.IDLED && resolvedNamespace) {
      try {
        await unIdleOpenClaw(proxyURL, resolvedNamespace);
        updateInstanceStatus(OpenClawStatus.PROVISIONING);
        provisioningPhase.current = "waiting_for_readiness";
      } catch (apiError) {
        throw new UserFacingError(
          "Unable to reprovision your OpenClaw instance",
          "We were unable to reprovision your OpenClaw instance. Please try again later.",
          apiError,
        );
      }
    }
  }, [proxyURL, status, updateInstanceStatus, userNamespace]);

  /**
   * Deletes the OpenClaw instance and all its related resources.
   * @param userNamespace the user namespace to delete OpenClaw from.
   * @throws {UserFacingError} if the deletion of any of the resources fail.
   */
  const deleteOpenClaw = useCallback(async () => {
    const previousUILink = openclawUILink;

    deletingOpenClaw.current = true;
    updateInstanceStatus(OpenClawStatus.DELETING);
    setOpenclawUILink(undefined);
    setOpenClawDeletionErrorDetails(null);

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
    const deletionError = AggregatedOperationError.fromSettledResults(
      "OpenClaw",
      ["Delete CR", "Delete SpaceRequest", "Cleanup workspace"],
      results,
    );

    if (deletionError) {
      deletingOpenClaw.current = false;
      updateInstanceStatus(OpenClawStatus.FAILED);
      setOpenclawUILink(previousUILink);
      setOpenClawDeletionErrorDetails(deletionError.toString());
      return;
    }

    openClawNamespaceRef.current = undefined;
    instanceCRRef.current = undefined;
  }, [openclawUILink, proxyURL, updateInstanceStatus, userNamespace]);

  // Poll OpenClaw status during provisioning/terminating/deleting
  useEffect(() => {
    if (
      status === OpenClawStatus.TERMINATING ||
      status === OpenClawStatus.DELETING
    ) {
      const handle = setInterval(
        () => getOpenClawData(userNamespace),
        SHORT_INTERVAL,
      );
      return () => clearInterval(handle);
    }
    return undefined;
  }, [getOpenClawData, status, userNamespace]);

  // Helper variable to determine if the polling loop should be working or
  // not.
  const shouldBePolling = status === OpenClawStatus.PROVISIONING;

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
      if (
        statusRef.current === OpenClawStatus.PROVISIONING &&
        provisioningPhase.current === "creating_space_request"
      ) {
        let resolvedNamespace: string | undefined;
        try {
          // Attempt fetching the space request and if its not there or we
          // cannot get the namespace from it, keep polling.
          const spaceRequest = await getSpaceRequest(proxyURL, userNamespace);
          resolvedNamespace = getSpaceRequestNamespace(spaceRequest);
          if (resolvedNamespace) {
            openClawNamespaceRef.current = resolvedNamespace;
          }

          pollTransientRetriesLeft.current = maxTransientErrorRetries;
        } catch (error) {
          if (isTransient(error) && pollTransientRetriesLeft.current > 0) {
            pollTransientRetriesLeft.current--;
            logger.warn(
              `Unexpected transient error received while polling to check if the OpenClaw's space request is ready: ${error}`,
            );
          } else {
            let technicalDetails: string;
            if (error instanceof ApiError) {
              technicalDetails = error.body;
            } else {
              technicalDetails = `${error}`;
            }

            logger.error(
              `Unexpected error received while polling to check if the OpenClaw's space request is ready: ${error}`,
            );
            updateInstanceStatus(OpenClawStatus.FAILED);
            setProvisioningError(
              new UserFacingError(
                "Unable to provision your OpenClaw instance",
                `We were unable to provision your OpenClaw instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
                error,
                technicalDetails,
              ),
            );
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
        if (!instanceCRRef.current && resolvedNamespace) {
          if (provisioningSettings.current) {
            await provisionInstance(resolvedNamespace);
          } else {
            let fetchedCR: OpenClawCR | undefined;
            try {
              fetchedCR = await getOpenClaw(proxyURL, resolvedNamespace);
              if (fetchedCR) {
                instanceCRRef.current = fetchedCR;
                provisioningPhase.current = "waiting_for_readiness";
              } else {
                provisioningPhase.current = "not_started";
                updateInstanceStatus(OpenClawStatus.NEW);
              }
            } catch (error) {
              if (isTransient(error) && pollTransientRetriesLeft.current > 0) {
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
                setProvisioningError(
                  new UserFacingError(
                    "Unable to provision your OpenClaw instance",
                    `We were unable to provision your OpenClaw instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
                    error,
                    technicalDetails,
                  ),
                );
                return;
              }
            }
          }
        }
      }

      if (
        statusRef.current === OpenClawStatus.PROVISIONING &&
        provisioningPhase.current === "waiting_for_readiness" &&
        openClawNamespaceRef.current
      ) {
        try {
          await fetchCR(openClawNamespaceRef.current);
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
          } else if (
            isTransient(error) &&
            pollTransientRetriesLeft.current > 0
          ) {
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
            setProvisioningError(
              new UserFacingError(
                "Unable to provision your OpenClaw instance",
                `We were unable to provision your OpenClaw instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
                error,
                technicalDetails,
              ),
            );
            return;
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
    fetchCR,
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
      deleteOpenClaw,
      handleOpenClawInstance,
      openClawDeletionErrorDetails,
      openClawProvisioningErrorDetails,
      openclawStatus: status,
      openclawUILink,
      provisioningError,
      resetOpenClawDeletionErrorDetails,
      resetOpenClawProvisioningErrorDetails,
      startProvisioning,
    }),
    [
      deleteOpenClaw,
      handleOpenClawInstance,
      openClawDeletionErrorDetails,
      openClawProvisioningErrorDetails,
      status,
      openclawUILink,
      provisioningError,
      resetOpenClawDeletionErrorDetails,
      resetOpenClawProvisioningErrorDetails,
      startProvisioning,
    ],
  );

  return (
    <OpenClawContext.Provider value={contextValue}>
      {children}
    </OpenClawContext.Provider>
  );
}
