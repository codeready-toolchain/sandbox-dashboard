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
import { SHORT_INTERVAL } from "../const";
import { ApiError } from "../error/ApiError";
import { DeletionError } from "../error/DeletionError";
import { UserFacingError } from "../error/UserFacingError";
import type { OpenClawItem } from "../types";
import { errorMessage } from "../utils/common";
import logger from "../utils/logger";
import type { AddedCredential } from "../utils/openclaw-providers";
import {
  getOpenClawReadyCondition,
  getSpaceRequestNamespace,
  isSpaceRequestReady,
  isSpaceRequestTerminating,
  OpenClawStatus,
} from "../utils/openclaw-utils";
import {
  defaultOpenClawSkills,
  defaultOpenClawWorkspace,
} from "../utils/openclaw-workspace-content";
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
        handleOpenClawInstance: async () => false,
        openclawData: undefined,
        openClawDeletionErrorDetails: null,
        openClawProvisioningErrorDetails: null,
        openclawStatus: OpenClawStatus.USER_NOT_READY,
        openclawUILink: undefined,
        resetOpenClawDeletionErrorDetails: () => {},
        resetOpenClawProvisioningErrorDetails: () => {},
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
  const [clawNamespace, setClawNamespace] = useState<string | undefined>();
  const pendingCredentials = useRef<AddedCredential[] | undefined>(undefined);
  const pendingDisableDevicePairing = useRef<boolean>(false);
  const creatingSpaceRequest = useRef<boolean>(false);
  const creatingOpenClaw = useRef<boolean>(false);
  const deletingOpenClaw = useRef<boolean>(false);
  const [openclawData, setOpenclawData] = useState<OpenClawItem | undefined>();
  const [openclawStatus, setOpenclawStatus] = useState<OpenClawStatus>(
    OpenClawStatus.NEW,
  );
  const [openclawUILink, setOpenclawUILink] = useState<string | undefined>();
  const [openClawDeletionErrorDetails, setOpenClawDeletionErrorDetails] =
    useState<string | null>(null);
  const [
    openClawProvisioningErrorDetails,
    setOpenClawProvisioningErrorDetails,
  ] = useState<string | null>(null);

  /**
   * Polls the current state of the OpenClaw instance and drives the
   * provisioning state machine forward.
   *
   * This function is invoked on an interval (`SHORT_INTERVAL`) whenever the
   * instance is in a transitional state (provisioning, terminating, or
   * deleting). It performs the following steps:
   *
   * 1. Fetches the SpaceRequest to determine whether the backing namespace
   *    exists and is ready.
   * 2. If a deletion is in progress and the SpaceRequest is gone, resets state
   *    to NEW.
   * 3. If credentials are pending and no SpaceRequest exists yet, creates one.
   * 4. Once the SpaceRequest's target namespace is available, fetches the
   *    OpenClaw CR to determine instance readiness.
   * 5. If the CR does not yet exist but credentials are pending, sets up the
   *    workspace environment and creates the CR.
   * 6. Derives the display status from the CR's conditions and exposes the
   *    instance URL when ready.
   *
   * Errors are surfaced through `setOpenClawProvisioningErrorDetails` and
   * shown in the provisioning modal rather than via toast notifications,
   * since repeated polling errors would otherwise spam the user.
   *
   * @param userNamespace the user's home namespace used to locate the
   *   SpaceRequest and workspace resources.
   */
  const getOpenClawData = useCallback(
    async (namespace: string) => {
      try {
        const sr = await getSpaceRequest(proxyURL, namespace);

        if (!sr) {
          if (deletingOpenClaw.current) {
            deletingOpenClaw.current = false;
            setClawNamespace(undefined);
            setOpenclawData(undefined);
            setOpenclawStatus(OpenClawStatus.NEW);
            setOpenclawUILink(undefined);
            setOpenClawProvisioningErrorDetails(null);
            return;
          }

          if (pendingCredentials.current && !creatingSpaceRequest.current) {
            creatingSpaceRequest.current = true;
            try {
              await createSpaceRequest(proxyURL, namespace);
              setOpenclawStatus(OpenClawStatus.PROVISIONING);
            } catch (e) {
              setOpenClawProvisioningErrorDetails(
                resolveOpenClawError(
                  e,
                  "Unable to provision OpenClaw: the space request creation failed",
                ),
              );
              pendingCredentials.current = undefined;
              setOpenclawStatus(OpenClawStatus.NEW);
            } finally {
              creatingSpaceRequest.current = false;
            }
            return;
          }
          setOpenclawStatus(OpenClawStatus.NEW);
          return;
        }

        if (isSpaceRequestTerminating(sr)) {
          if (deletingOpenClaw.current) return;
          setOpenclawStatus(OpenClawStatus.TERMINATING);
          return;
        }

        if (deletingOpenClaw.current) return;

        const targetNamespace = getSpaceRequestNamespace(sr);
        if (!targetNamespace) {
          setOpenclawStatus(OpenClawStatus.PROVISIONING);
          return;
        }

        setClawNamespace(targetNamespace);

        const data = await getOpenClaw(proxyURL, targetNamespace);
        setOpenclawData(data);

        if (!data && pendingCredentials.current && !creatingOpenClaw.current) {
          creatingOpenClaw.current = true;
          const credentials = pendingCredentials.current;
          const disableDevicePairing = pendingDisableDevicePairing.current;
          try {
            await setupWorkspaceEnvironment(
              proxyURL,
              userNamespace,
              targetNamespace,
            );
            await createWorkspaceKubeconfig(
              proxyURL,
              userNamespace,
              targetNamespace,
              apiEndpoint,
            );

            await createOpenClaw(
              proxyURL,
              targetNamespace,
              credentials,
              disableDevicePairing,
              defaultOpenClawWorkspace,
              defaultOpenClawSkills,
            );
            pendingCredentials.current = undefined;
            pendingDisableDevicePairing.current = false;
            setOpenclawStatus(OpenClawStatus.PROVISIONING);
          } catch (e) {
            pendingCredentials.current = undefined;
            pendingDisableDevicePairing.current = false;
            setOpenClawProvisioningErrorDetails(
              resolveOpenClawError(
                e,
                "Unable to provision OpenClaw: the instance creation failed",
              ),
            );
            setOpenclawStatus(OpenClawStatus.UNKNOWN);
            try {
              await cleanupWorkspaceEnvironment(proxyURL, userNamespace);
            } catch {
              // Best-effort cleanup
            }
          } finally {
            creatingOpenClaw.current = false;
          }
          return;
        }

        let conditionFailed = false;
        const st = getOpenClawReadyCondition(data, (conditionMessage) => {
          logger.error("OpenClaw CR reported failure:", conditionMessage);
          conditionFailed = true;
          setOpenClawProvisioningErrorDetails(errorMessage(conditionMessage));
        });
        if (!conditionFailed) {
          setOpenClawProvisioningErrorDetails(null);
        }
        setOpenclawStatus(st);
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
          setOpenclawStatus(OpenClawStatus.PROVISIONING);
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
    [apiEndpoint, proxyURL, userNamespace],
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
    getOpenClawData(userNamespace);
  }, [getOpenClawData, userNamespace]);

  /**
   * Unidles the already provisioned instance if it exists, and if not, it
   * creates it.
   * @param userNamespace the user namespace in which to create the instance.
   * @param credentials the credentials for the OpenClaw.
   * @param disableDevicePairing whether the device pairing is disabled or
   * not.
   * @throws {UserFacingError} if an error occurred during the fetching,
   * "unidling" or provisioning of the instance.
   */
  const handleOpenClawInstance = useCallback(
    async (
      credentials?: AddedCredential[],
      disableDevicePairing?: boolean,
    ): Promise<boolean> => {
      // Fetch current state first.
      let currentStatus = openclawStatus;
      let resolvedNamespace = clawNamespace;

      try {
        const sr = await getSpaceRequest(proxyURL, userNamespace);
        if (sr) {
          const ns = getSpaceRequestNamespace(sr);
          if (ns) {
            resolvedNamespace = ns;
            const data = await getOpenClaw(proxyURL, ns);
            currentStatus = getOpenClawReadyCondition(data, () => {});
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
        return true;
      }

      if (currentStatus === OpenClawStatus.DELETING) {
        return false;
      }

      if (currentStatus === OpenClawStatus.TERMINATING) {
        if (!credentials || credentials.length === 0) return false;
        pendingCredentials.current = credentials;
        pendingDisableDevicePairing.current = disableDevicePairing ?? false;
        setOpenclawStatus(OpenClawStatus.TERMINATING);
        return true;
      }

      if (currentStatus === OpenClawStatus.IDLED && resolvedNamespace) {
        try {
          await unIdleOpenClaw(proxyURL, resolvedNamespace);
          setOpenclawStatus(OpenClawStatus.PROVISIONING);
          return true;
        } catch (apiError) {
          throw new UserFacingError(
            "Unable to reprovision your OpenClaw instance",
            "We were unable to reprovision your OpenClaw instance. Please try again later.",
            apiError,
          );
        }
      }

      if (!credentials || credentials.length === 0) return false;

      try {
        pendingCredentials.current = credentials;
        pendingDisableDevicePairing.current = disableDevicePairing ?? false;
        await createSpaceRequest(proxyURL, userNamespace);
        setOpenclawStatus(OpenClawStatus.PROVISIONING);
        return true;
      } catch (apiError) {
        pendingCredentials.current = undefined;
        throw new UserFacingError(
          "Unable to provision your OpenClaw instance",
          "We were unable to provision your OpenClaw instance. Please try again later.",
          apiError,
        );
      }
    },
    [clawNamespace, proxyURL, openclawStatus, userNamespace],
  );

  /**
   * Deletes the OpenClaw instance and all its related resources.
   * @param userNamespace the user namespace to delete OpenClaw from.
   * @throws {UserFacingError} if the deletion of any of the resources fail.
   */
  const deleteOpenClaw = useCallback(async () => {
    const previousUILink = openclawUILink;

    deletingOpenClaw.current = true;
    setOpenclawStatus(OpenClawStatus.DELETING);
    setOpenclawUILink(undefined);
    setOpenClawDeletionErrorDetails(null);

    // Delete the OpenClaw resource and all of its related resources. Any
    // errors are caught by "allSettled".
    const results = await Promise.allSettled([
      clawNamespace
        ? deleteOpenClawCR(proxyURL, clawNamespace)
        : Promise.resolve(),
      deleteSpaceRequest(proxyURL, userNamespace),
      cleanupWorkspaceEnvironment(proxyURL, userNamespace),
    ]);

    // Prepare an error structure to make it easy to copy for the users in
    // case they seek support.
    const deletionError = DeletionError.fromSettledResults(
      "OpenClaw",
      ["Delete CR", "Delete SpaceRequest", "Cleanup workspace"],
      results,
    );

    if (deletionError) {
      deletingOpenClaw.current = false;
      setOpenclawStatus(OpenClawStatus.FAILED);
      setOpenclawUILink(previousUILink);
      setOpenClawDeletionErrorDetails(deletionError.toString());
      return;
    }

    setClawNamespace(undefined);
    setOpenclawData(undefined);
  }, [clawNamespace, openclawUILink, proxyURL, userNamespace]);

  // Poll OpenClaw status during provisioning/terminating/deleting
  useEffect(() => {
    if (
      openclawStatus === OpenClawStatus.PROVISIONING ||
      openclawStatus === OpenClawStatus.TERMINATING ||
      openclawStatus === OpenClawStatus.DELETING
    ) {
      const handle = setInterval(
        () => getOpenClawData(userNamespace),
        SHORT_INTERVAL,
      );
      return () => clearInterval(handle);
    }
    return undefined;
  }, [getOpenClawData, openclawStatus, userNamespace]);

  // Memoize the contents of the context to avoid rerenders on any state or
  // function changes.
  const contextValue = useMemo(
    () => ({
      deleteOpenClaw,
      handleOpenClawInstance,
      openclawData,
      openClawDeletionErrorDetails,
      openClawProvisioningErrorDetails,
      openclawStatus,
      openclawUILink,
      resetOpenClawDeletionErrorDetails,
      resetOpenClawProvisioningErrorDetails,
    }),
    [
      deleteOpenClaw,
      handleOpenClawInstance,
      openclawData,
      openClawDeletionErrorDetails,
      openClawProvisioningErrorDetails,
      openclawStatus,
      openclawUILink,
      resetOpenClawDeletionErrorDetails,
      resetOpenClawProvisioningErrorDetails,
    ],
  );

  return (
    <OpenClawContext.Provider value={contextValue}>
      {children}
    </OpenClawContext.Provider>
  );
}
