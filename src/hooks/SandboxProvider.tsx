import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  type AAPData,
  type OpenClawItem,
  type SignupData,
  UserStatus,
} from "../types";
import { Environment, getConfig } from "../config/config";
import {
  getSignupData,
  signup,
  getSegmentWriteKey,
  getUIConfig,
} from "../api/registration";
import { getAAP, createAAP, unIdleAAP } from "../api/aap";
import { getSecret } from "../api/kube";
import * as openclawApi from "../api/openclaw";
import { useRecaptcha } from "./useRecaptcha";
import { LONG_INTERVAL, SHORT_INTERVAL, SUPPORT_EMAIL } from "../const";
import { signupDataToStatus } from "../utils/register-utils";
import { AnsibleStatus, decode, getReadyCondition } from "../utils/aap-utils";
import {
  OpenClawStatus,
  getOpenClawReadyCondition,
  isSpaceRequestReady,
  isSpaceRequestTerminating,
  getSpaceRequestNamespace,
} from "../utils/openclaw-utils";
import {
  defaultOpenClawWorkspace,
  defaultOpenClawSkills,
} from "../utils/openclaw-workspace-content";
import type { AddedCredential } from "../utils/openclaw-providers";
import { errorMessage } from "../utils/common";
import { withRetry } from "../utils/retry";
import { SandboxContext } from "./SandboxContext";
import { UserFacingError } from "../error/UserFacingError";
import { ApiError } from "../error/ApiError";
import { CriticalError } from "../error/CriticalError";
import { DeletionError } from "../error/DeletionError";
import { CriticalErrorPage } from "../components/CriticalErrorPage";
import logger from "../utils/logger";

export function SandboxProvider({ children }: { children: ReactNode }) {
  const config = getConfig();
  const isProd = config.environment === Environment.PRODUCTION;
  useRecaptcha(isProd);

  const [segmentWriteKey, setSegmentWriteKey] = useState<string>();
  const [marketoWebhookURL, setMarketoWebhookURL] = useState<string>();
  const [disabledIntegrations, setDisabledIntegrations] = useState<
    string[] | undefined
  >();
  const [statusUnknown, setStatusUnknown] = useState(true);
  const [userFound, setUserFound] = useState(false);
  const [userData, setData] = useState<SignupData | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [criticalError, setCriticalError] = useState<CriticalError | null>(
    null,
  );

  const [ansibleData, setAnsibleData] = useState<AAPData | undefined>();
  const [ansibleUILink, setAnsibleUILink] = useState<string | undefined>();
  const [ansibleUIUser, setAnsibleUIUser] = useState<string>();
  const [ansibleUIPassword, setAnsibleUIPassword] = useState("");
  const [ansibleStatus, setAnsibleStatus] = useState<AnsibleStatus>(
    AnsibleStatus.NEW,
  );
  const [ansibleProvisioningErrorDetails, setAnsibleProvisioningErrorDetails] =
    useState<string | null>(null);

  const [clawNamespace, setClawNamespace] = useState<string | undefined>();
  const pendingCredentials = useRef<AddedCredential[] | undefined>(undefined);
  const pendingDisableDevicePairing = useRef(false);
  const creatingSpaceRequest = useRef(false);
  const creatingOpenClaw = useRef(false);
  const deletingOpenClaw = useRef(false);
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

  const userDataRef = useRef<SignupData | undefined>(undefined);
  const proxyURLRef = useRef<string | undefined>(undefined);
  const ansibleStatusRef = useRef(ansibleStatus);
  const ansibleDataRef = useRef(ansibleData);

  useEffect(() => {
    proxyURLRef.current = userData?.proxyURL;
  }, [userData?.proxyURL]);

  useEffect(() => {
    ansibleStatusRef.current = ansibleStatus;
  }, [ansibleStatus]);

  useEffect(() => {
    ansibleDataRef.current = ansibleData;
  }, [ansibleData]);

  const status = useMemo(
    () => (statusUnknown ? UserStatus.UNKNOWN : signupDataToStatus(userData)),
    [statusUnknown, userData],
  );

  const verificationRequired = status === UserStatus.VERIFY;
  const pendingApproval = status === UserStatus.PENDING_APPROVAL;
  const userReady = status === UserStatus.READY;

  /**
   * Resets the OpenClaw deletion's error details and re-fetches the current
   * state of the OpenClaw instance so that the UI recovers from the failed
   * deletion attempt.
   */
  function resetOpenClawDeletionErrorDetails(): void {
    setOpenClawDeletionErrorDetails(null);

    if (userData?.defaultUserNamespace) {
      getOpenClawData(userData.defaultUserNamespace);
    }
  }

  /**
   * Resents AAP provisioning's error details.
   */
  function resetAnsibleProvisioningErrorDetails(): void {
    setAnsibleProvisioningErrorDetails(null);
  }

  /**
   * Resolves an OpenClaw error into a detail string and logs non-ApiError cases.
   * ApiError bodies are used directly (they are already logged by
   * `ApiError.fromResponse`). Error instances are logged and their message is
   * incorporated into the detail string. Unknown errors are logged with the
   * fallback prefix returned as-is.
   * @param err the caught error.
   * @param fallbackPrefix a human-readable prefix describing the failed
   *   operation, used when the error is not an Error instance.
   * @returns a detail string suitable for `setOpenClawProvisioningErrorDetails`.
   */
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

  /**
   * Resets the OpenClaw provisioning error details and re-fetches the current
   * state so the catalog card can return to the correct "Provision" state
   * without requiring a page reload.
   */
  function resetOpenClawProvisioningErrorDetails(): void {
    setOpenClawProvisioningErrorDetails(null);

    const ns = userDataRef.current?.defaultUserNamespace;
    if (ns) {
      getOpenClawData(ns);
    }
  }

  /**
   * Fetches the user's signup data, critical for the application to work.
   * @param isRefetch signals if it is a refetching operation.
   * @returns the {@link SignupData} of the user.
   */
  const fetchData = async (
    isRefetch = false,
  ): Promise<SignupData | undefined> => {
    if (!isRefetch) {
      setLoading(true);
    }

    let result;
    try {
      result = isRefetch
        ? await getSignupData()
        : await withRetry(() => getSignupData(), 3, 2000);

      if (JSON.stringify(userDataRef.current) !== JSON.stringify(result)) {
        userDataRef.current = result;
        setData(result);
      }
      setUserFound(!!result);
    } catch (err) {
      if (!isRefetch) {
        logger.error("Critical: unable to fetch user data after retries:", err);
        setCriticalError(
          new CriticalError(
            `We're unable to load your account information. Please try again later, and if the issue persists, contact ${SUPPORT_EMAIL}.`,
            err,
          ),
        );
        return undefined;
      }
      logger.error("Error fetching user data:", err);
      userDataRef.current = undefined;
      setData(undefined);
      setUserFound(false);
    } finally {
      setLoading(false);
      setStatusUnknown(false);
    }
    return result;
  };

  /**
   * Creates a user signup in the back end.
   */
  const signupUser = async () => {
    setLoading(true);
    try {
      await signup();
    } catch (err) {
      if (err instanceof ApiError) {
        throw new UserFacingError(
          "Unable to sign you up",
          "We were unable to sign your account up in our systems. Please try again later.",
          err,
        );
      } else if (
        err instanceof Error &&
        err.message.toLowerCase().includes("recaptcha")
      ) {
        logger.error("Recaptcha failure during signup:", err);
        throw new UserFacingError(
          "Recaptcha failure",
          "We were unable to successfully verify that you're human with Recaptcha due to an internal error. Please try again later.",
          err,
        );
      } else {
        logger.error("Unexpected error during signup:", err);
        throw new UserFacingError(
          "Unable to sign you up",
          "An unexpected error occurred while setting up your account. Please try again later.",
          err,
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Gets the Ansible Automation Platform resource from Kubernetes.
   * @param userNamespace the namespace to fetch teh resource for.
   * @throws {ApiError} if the API calls to fetch the AAP resource or the
   * secret containing the admin details fail.
   */
  const getAAPData = async (
    userNamespace: string,
  ): Promise<{ status: AnsibleStatus; data: AAPData | undefined }> => {
    const proxyURL = proxyURLRef.current;
    if (!proxyURL)
      return { status: ansibleStatusRef.current, data: ansibleDataRef.current };

    const data = await getAAP(proxyURL, userNamespace);
    setAnsibleData(data);
    let failed = false;
    const st = getReadyCondition(data, (e) => {
      failed = true;
      setAnsibleProvisioningErrorDetails(errorMessage(e));
    });
    if (!failed) {
      resetAnsibleProvisioningErrorDetails();
    }
    setAnsibleStatus(st);
    if (data && data.items?.length > 0 && data.items[0]?.status) {
      if (data.items[0].status.URL) {
        setAnsibleUILink(data.items[0].status.URL);
      }
      if (data.items[0].status.adminUser) {
        setAnsibleUIUser(data.items[0].status.adminUser);
      }
      if (data.items[0].status.adminPasswordSecret) {
        try {
          const adminSecret = await getSecret(
            proxyURL,
            userNamespace,
            data.items[0].status.adminPasswordSecret,
          );
          if (adminSecret?.data) {
            setAnsibleUIPassword(decode(adminSecret.data.password));
          }
        } catch (secretError) {
          logger.error("Failed to fetch AAP admin secret", secretError);
        }
      }
    }
    return { status: st, data };
  };

  /**
   * Provisions or "unidles" the Ansible Automation Platform instance
   * depending on its current status.
   * @param userNamespace the namespace to perform the actions in.
   * @throws {UserFacingError} if fetching, "unidling" or creating the
   * instance fails.
   */
  const handleAAPInstance = async (userNamespace: string) => {
    let currentStatus: AnsibleStatus;
    let currentData: AAPData | undefined;

    try {
      const result = await getAAPData(userNamespace);
      currentStatus = result.status;
      currentData = result.data;
    } catch (apiError) {
      if (apiError instanceof ApiError && apiError.statusCode === 404) {
        currentStatus = AnsibleStatus.NEW;
        currentData = undefined;
        setAnsibleStatus(AnsibleStatus.NEW);
        setAnsibleData(undefined);
      } else {
        throw new UserFacingError(
          "Unable to get your Ansible Automation Platform instance's information",
          "We were unable to obtain the status of your Ansible Automation Platform instance. Please try again later.",
          apiError,
        );
      }
    }
    if (
      currentStatus === AnsibleStatus.PROVISIONING ||
      currentStatus === AnsibleStatus.READY
    ) {
      return;
    }

    const proxyURL = proxyURLRef.current;
    if (!proxyURL) return;

    if (
      currentStatus === AnsibleStatus.IDLED &&
      currentData &&
      currentData.items?.length > 0
    ) {
      try {
        await unIdleAAP(proxyURL, userNamespace);
      } catch (apiError) {
        throw new UserFacingError(
          "Unable to provision your Ansible Automation Platform instance",
          "We were unable to reprovision your Ansible Automation Platform instance. Please try again later.",
          apiError,
        );
      }
      return;
    }

    try {
      await createAAP(proxyURL, userNamespace);
    } catch (apiError) {
      throw new UserFacingError(
        "Unable to provision your Ansible Automation Platform instance",
        "We were unable to provision your Ansible Automation Platform instance. Please try again later.",
        apiError,
      );
    }
  };

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
  const getOpenClawData = async (userNamespace: string) => {
    const proxyURL = proxyURLRef.current;
    if (!proxyURL) return;

    try {
      const sr = await openclawApi.getSpaceRequest(proxyURL, userNamespace);

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
            await openclawApi.createSpaceRequest(proxyURL, userNamespace);
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

      const data = await openclawApi.getOpenClaw(proxyURL, targetNamespace);
      setOpenclawData(data);

      if (!data && pendingCredentials.current && !creatingOpenClaw.current) {
        creatingOpenClaw.current = true;
        const credentials = pendingCredentials.current;
        const disableDevicePairing = pendingDisableDevicePairing.current;
        try {
          await openclawApi.setupWorkspaceEnvironment(
            proxyURL,
            userNamespace,
            targetNamespace,
          );
          const currentUserData = userDataRef.current;
          if (!currentUserData?.apiEndpoint) {
            throw new Error(
              "Cannot create workspace kubeconfig: apiEndpoint is missing from signup data",
            );
          }
          await openclawApi.createWorkspaceKubeconfig(
            proxyURL,
            userNamespace,
            targetNamespace,
            currentUserData.apiEndpoint,
          );

          await openclawApi.createOpenClaw(
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
          setOpenClawProvisioningErrorDetails(
            resolveOpenClawError(
              e,
              "Unable to provision OpenClaw: the instance creation failed",
            ),
          );
          setOpenclawStatus(OpenClawStatus.UNKNOWN);
          try {
            await openclawApi.cleanupWorkspaceEnvironment(
              proxyURL,
              userNamespace,
            );
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
  };

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
  const handleOpenClawInstance = async (
    userNamespace: string,
    credentials?: AddedCredential[],
    disableDevicePairing?: boolean,
  ): Promise<boolean> => {
    const proxyURL = proxyURLRef.current;
    if (!proxyURL) return false;

    // Fetch current state first.
    let currentStatus = openclawStatus;
    let resolvedNamespace = clawNamespace;

    try {
      const sr = await openclawApi.getSpaceRequest(proxyURL, userNamespace);
      if (sr) {
        const ns = getSpaceRequestNamespace(sr);
        if (ns) {
          resolvedNamespace = ns;
          const data = await openclawApi.getOpenClaw(proxyURL, ns);
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
        await openclawApi.unIdleOpenClaw(proxyURL, resolvedNamespace);
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
      await openclawApi.createSpaceRequest(proxyURL, userNamespace);
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
  };

  /**
   * Deletes the OpenClaw instance and all its related resources.
   * @param userNamespace the user namespace to delete OpenClaw from.
   * @throws {UserFacingError} if the deletion of any of the resources fail.
   */
  const deleteOpenClaw = async (userNamespace: string) => {
    const proxyURL = proxyURLRef.current;
    if (!proxyURL) return;

    const previousUILink = openclawUILink;

    deletingOpenClaw.current = true;
    setOpenclawStatus(OpenClawStatus.DELETING);
    setOpenclawUILink(undefined);
    setOpenClawDeletionErrorDetails(null);

    // Delete the OpenClaw resource and all of its related resources. Any
    // errors are caught by "allSettled".
    const results = await Promise.allSettled([
      clawNamespace
        ? openclawApi.deleteOpenClawCR(proxyURL, clawNamespace)
        : Promise.resolve(),
      openclawApi.deleteSpaceRequest(proxyURL, userNamespace),
      openclawApi.cleanupWorkspaceEnvironment(proxyURL, userNamespace),
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
  };

  // Initial fetch
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    fetchData();
  });

  // Fetch Segment write key (placeholder for Phase 5)
  useEffect(() => {
    if (!isProd) return;
    const fetchKey = async () => {
      try {
        const writeKey = await getSegmentWriteKey();
        setSegmentWriteKey(writeKey);
      } catch {
        // Continue without Segment tracking
      }
    };
    fetchKey();
  }, [isProd]);

  // Fetch UI config
  useEffect(() => {
    const fetchUIConfigData = async () => {
      try {
        const uiConfig = await getUIConfig();
        if (uiConfig.workatoWebHookURL) {
          setMarketoWebhookURL(uiConfig.workatoWebHookURL);
        }
        setDisabledIntegrations(
          Array.isArray(uiConfig.disabledIntegrations)
            ? uiConfig.disabledIntegrations
            : [],
        );
      } catch (err) {
        logger.error("Error fetching UI config:", err);
        setDisabledIntegrations([]);
      }
    };
    fetchUIConfigData();
  }, []);

  // Poll user status
  const pollStatus = userFound && !userReady;
  const pollInterval =
    status === UserStatus.PROVISIONING ? SHORT_INTERVAL : LONG_INTERVAL;

  useEffect(() => {
    if (pollStatus) {
      const handle = setInterval(() => {
        fetchData(true);
      }, pollInterval);
      return () => clearInterval(handle);
    }
    return undefined;
  }, [pollStatus, pollInterval]);

  // Poll AAP status
  useEffect(() => {
    if (userData?.defaultUserNamespace) {
      const ns = userData.defaultUserNamespace;
      const handle = setInterval(
        async () => {
          try {
            await getAAPData(ns);
          } catch (err) {
            if (!(err instanceof ApiError)) {
              logger.error("Unexpected error polling AAP data:", err);
            }
          }
        },
        SHORT_INTERVAL,
        ns,
      );
      return () => clearInterval(handle);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.defaultUserNamespace, userData?.proxyURL]);

  // Initial OpenClaw fetch
  useEffect(() => {
    if (userData?.defaultUserNamespace) {
      void (async () => {
        await getOpenClawData(userData.defaultUserNamespace!);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.defaultUserNamespace, userData?.proxyURL]);

  // Poll OpenClaw status during provisioning/terminating/deleting
  useEffect(() => {
    if (
      userData?.defaultUserNamespace &&
      (openclawStatus === OpenClawStatus.PROVISIONING ||
        openclawStatus === OpenClawStatus.TERMINATING ||
        openclawStatus === OpenClawStatus.DELETING)
    ) {
      const ns = userData.defaultUserNamespace;
      const handle = setInterval(() => getOpenClawData(ns), SHORT_INTERVAL);
      return () => clearInterval(handle);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.defaultUserNamespace, userData?.proxyURL, openclawStatus]);

  // segmentWriteKey will be consumed in Phase 5
  void segmentWriteKey;

  // Render an error page on critical errors instead of having a broken and
  // unresponsive user interface.
  if (criticalError) {
    return <CriticalErrorPage error={criticalError} />;
  }

  return (
    <SandboxContext.Provider
      value={{
        userStatus: status,
        userFound,
        userReady,
        verificationRequired,
        pendingApproval,
        userData,
        loading,
        refetchUserData: fetchData,
        signupUser,
        refetchAAP: getAAPData,
        handleAAPInstance,
        ansibleData,
        ansibleUIUser,
        ansibleUIPassword,
        ansibleUILink,
        ansibleProvisioningErrorDetails,
        ansibleStatus,
        openclawData,
        openclawStatus,
        openclawUILink,
        openClawDeletionErrorDetails,
        openClawProvisioningErrorDetails,
        resetAnsibleProvisioningErrorDetails,
        resetOpenClawDeletionErrorDetails,
        resetOpenClawProvisioningErrorDetails,
        handleOpenClawInstance,
        deleteOpenClaw,
        segmentTrackClick: undefined,
        marketoWebhookURL,
        disabledIntegrations,
      }}
    >
      {children}
    </SandboxContext.Provider>
  );
}
