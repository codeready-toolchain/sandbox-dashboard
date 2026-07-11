import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createAAP, getAAP, unIdleAAP } from "../api/aap";
import { getSecret } from "../api/kube";
import { SHORT_INTERVAL } from "../const";
import { ApiError } from "../error/ApiError";
import { UserFacingError } from "../error/UserFacingError";
import type { AAPData } from "../types";
import { AnsibleStatus, decode, getReadyCondition } from "../utils/aap-utils";
import { errorMessage } from "../utils/common";
import logger from "../utils/logger";
import { AnsibleContext } from "./AnsibleContext";
import { useSandboxContext } from "./SandboxContext";

export function AnsibleProvider({ children }: { children: ReactNode }) {
  const { userData } = useSandboxContext();

  const [ansibleData, setAnsibleData] = useState<AAPData | undefined>();
  const [ansibleUILink, setAnsibleUILink] = useState<string | undefined>();
  const [ansibleUIUser, setAnsibleUIUser] = useState<string>();
  const [ansibleUIPassword, setAnsibleUIPassword] = useState("");
  const [ansibleStatus, setAnsibleStatus] = useState<AnsibleStatus>(
    AnsibleStatus.NEW,
  );
  const [ansibleProvisioningErrorDetails, setAnsibleProvisioningErrorDetails] =
    useState<string | null>(null);

  const ansibleStatusRef = useRef(ansibleStatus);
  const ansibleDataRef = useRef(ansibleData);
  const ansibleUIPasswordRef = useRef(ansibleUIPassword);

  /**
   * Keeps {@link ansibleStatusRef} in sync with the latest
   * {@link ansibleStatus} state so that callbacks invoked from
   * the polling interval (which would otherwise close over a stale
   * value) can read the current status via the ref.
   */
  useEffect(() => {
    ansibleStatusRef.current = ansibleStatus;
  }, [ansibleStatus]);

  /**
   * Keeps {@link ansibleDataRef} in sync with the latest
   * {@link ansibleData} state for the same stale-closure reason
   * described above.
   */
  useEffect(() => {
    ansibleDataRef.current = ansibleData;
  }, [ansibleData]);

  /**
   * Keeps {@link ansibleUIPasswordRef} in sync with the latest
   * {@link ansibleData} state for the same stale-closure reason
   * described above.
   */
  useEffect(() => {
    ansibleUIPasswordRef.current = ansibleUIPassword;
  }, [ansibleUIPassword]);

  const resetAnsibleProvisioningErrorDetails = useCallback((): void => {
    setAnsibleProvisioningErrorDetails(null);
  }, []);

  /**
   * Gets the Ansible Automation Platform resource from Kubernetes.
   * @param userNamespace the namespace to fetch teh resource for.
   * @throws {ApiError} if the API calls to fetch the AAP resource or the
   * secret containing the admin details fail.
   */
  const getAAPData = useCallback(
    async (
      userNamespace: string,
    ): Promise<{ status: AnsibleStatus; data: AAPData | undefined }> => {
      const proxyURL = userData?.proxyURL;
      if (!proxyURL)
        return {
          status: ansibleStatusRef.current,
          data: ansibleDataRef.current,
        };

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
          if (!ansibleUIPasswordRef.current) {
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
      }
      return { status: st, data };
    },
    [userData?.proxyURL, resetAnsibleProvisioningErrorDetails],
  );

  /**
   * Provisions or "unidles" the Ansible Automation Platform instance
   * depending on its current status.
   * @param userNamespace the namespace to perform the actions in.
   * @throws {UserFacingError} if fetching, "unidling" or creating the
   * instance fails.
   */
  const handleAAPInstance = useCallback(
    async (userNamespace: string) => {
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

      const proxyURL = userData?.proxyURL;
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
    },
    [getAAPData, userData?.proxyURL],
  );

  /**
   * Polls the Ansible Automation Platform resource status at
   * {@link SHORT_INTERVAL} intervals. On each tick it calls
   * {@link getAAPData} to refresh {@link ansibleData},
   * {@link ansibleStatus}, the UI link, and admin credentials.
   *
   * The interval is created only when the user's namespace is
   * available and is torn down on unmount or when the dependencies
   * ({@link userData.defaultUserNamespace}, {@link userData.proxyURL})
   * change.
   *
   * Expected {@link ApiError}s (transient 4xx/5xx from the proxy)
   * are silently swallowed; unexpected errors are logged.
   */
  useEffect(() => {
    if (userData?.defaultUserNamespace) {
      const ns = userData.defaultUserNamespace;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount is intentional
      getAAPData(ns).catch((err) => {
        if (!(err instanceof ApiError)) {
          logger.error("Unexpected error fetching AAP data:", err);
        }
      });
    }
  }, [getAAPData, userData?.defaultUserNamespace]);

  useEffect(() => {
    if (
      userData?.defaultUserNamespace &&
      ansibleStatus === AnsibleStatus.PROVISIONING
    ) {
      const ns = userData.defaultUserNamespace;
      const handle = setInterval(async () => {
        try {
          await getAAPData(ns);
        } catch (err) {
          if (!(err instanceof ApiError)) {
            logger.error("Unexpected error polling AAP data:", err);
          }
        }
      }, SHORT_INTERVAL);
      return () => clearInterval(handle);
    }
    return undefined;
  }, [getAAPData, userData?.defaultUserNamespace, ansibleStatus]);

  // Memoize the contents of the context to avoid rerenders on any state or
  // function changes.
  const contextValue = useMemo(
    () => ({
      ansibleData,
      ansibleProvisioningErrorDetails,
      ansibleStatus,
      ansibleUILink,
      ansibleUIPassword,
      ansibleUIUser,
      handleAAPInstance,
      refetchAAP: getAAPData,
      resetAnsibleProvisioningErrorDetails,
    }),
    [
      ansibleData,
      ansibleProvisioningErrorDetails,
      ansibleStatus,
      ansibleUILink,
      ansibleUIPassword,
      ansibleUIUser,
      handleAAPInstance,
      getAAPData,
      resetAnsibleProvisioningErrorDetails,
    ],
  );

  return (
    <AnsibleContext.Provider value={contextValue}>
      {children}
    </AnsibleContext.Provider>
  );
}
