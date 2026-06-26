import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  type AAPData,
  type OpenClawItem,
  type SignupData,
  UserStatus,
} from "../types";
import { getConfig } from "../config/config";
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
import { LONG_INTERVAL, SHORT_INTERVAL } from "../const";
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
import { SandboxContext } from "./SandboxContext";

export { useSandboxContext } from "./SandboxContext";

export function SandboxProvider({ children }: { children: ReactNode }) {
  const config = getConfig();
  const isProd = config.environment !== "dev";
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

  const [ansibleData, setAnsibleData] = useState<AAPData | undefined>();
  const [ansibleUILink, setAnsibleUILink] = useState<string | undefined>();
  const [ansibleUIUser, setAnsibleUIUser] = useState<string>();
  const [ansibleUIPassword, setAnsibleUIPassword] = useState("");
  const [ansibleStatus, setAnsibleStatus] = useState<AnsibleStatus>(
    AnsibleStatus.NEW,
  );
  const [ansibleError, setAnsibleError] = useState<string | null>(null);

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
  const [openclawError, setOpenclawError] = useState<string | null>(null);

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

  const fetchData = async (
    isRefetch = false,
  ): Promise<SignupData | undefined> => {
    if (!isRefetch) {
      setLoading(true);
    }

    let result;
    try {
      result = await getSignupData();
      if (JSON.stringify(userDataRef.current) !== JSON.stringify(result)) {
        userDataRef.current = result;
        setData(result);
      }
      setUserFound(!!result);
    } catch (err) {
      console.error("Error fetching user data:", err);
      setData(undefined);
      setUserFound(false);
    } finally {
      setLoading(false);
      setStatusUnknown(false);
    }
    return result;
  };

  const signupUser = async () => {
    setLoading(true);
    try {
      await signup();
    } catch (err) {
      console.error("Error during signup", err);
    } finally {
      setLoading(false);
    }
  };

  const getAAPData = async (userNamespace: string) => {
    try {
      const proxyURL = proxyURLRef.current;
      if (!proxyURL) return;

      const data = await getAAP(proxyURL, userNamespace);
      setAnsibleData(data);
      const st = getReadyCondition(data, (e) =>
        setAnsibleError(errorMessage(e)),
      );
      setAnsibleStatus(st);
      if (data && data.items?.length > 0 && data.items[0]?.status) {
        if (data.items[0].status.URL) {
          setAnsibleUILink(data.items[0].status.URL);
        }
        if (data.items[0].status.adminUser) {
          setAnsibleUIUser(data.items[0].status.adminUser);
        }
        if (data.items[0].status.adminPasswordSecret) {
          const adminSecret = await getSecret(
            proxyURL,
            userNamespace,
            data.items[0].status.adminPasswordSecret,
          );
          if (adminSecret?.data) {
            setAnsibleUIPassword(decode(adminSecret.data.password));
          }
        }
      }
    } catch (e) {
      setAnsibleError(errorMessage(e));
    }
  };

  const handleAAPInstance = async (userNamespace: string) => {
    await getAAPData(userNamespace);

    const currentStatus = ansibleStatusRef.current;
    if (
      currentStatus === AnsibleStatus.PROVISIONING ||
      currentStatus === AnsibleStatus.READY
    ) {
      return;
    }

    const proxyURL = proxyURLRef.current;
    if (!proxyURL) return;

    const currentData = ansibleDataRef.current;
    if (
      currentStatus === AnsibleStatus.IDLED &&
      currentData &&
      currentData.items?.length > 0
    ) {
      try {
        await unIdleAAP(proxyURL, userNamespace);
      } catch (e) {
        console.error(e);
      }
      return;
    }
    try {
      await createAAP(proxyURL, userNamespace);
    } catch (e) {
      console.error(e);
    }
  };

  const getOpenClawData = async (userNamespace: string) => {
    const proxyURL = proxyURLRef.current;
    if (!proxyURL) return;

    setOpenclawError(null);
    try {
      const sr = await openclawApi.getSpaceRequest(proxyURL, userNamespace);

      if (!sr) {
        if (deletingOpenClaw.current) {
          deletingOpenClaw.current = false;
          setClawNamespace(undefined);
          setOpenclawData(undefined);
          setOpenclawStatus(OpenClawStatus.NEW);
          setOpenclawUILink(undefined);
          setOpenclawError(null);
          return;
        }

        if (pendingCredentials.current && !creatingSpaceRequest.current) {
          creatingSpaceRequest.current = true;
          try {
            await openclawApi.createSpaceRequest(proxyURL, userNamespace);
            setOpenclawStatus(OpenClawStatus.PROVISIONING);
          } catch (e) {
            pendingCredentials.current = undefined;
            setOpenclawError(errorMessage(e));
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
          setOpenclawError(errorMessage(e));
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

      const st = getOpenClawReadyCondition(data, setOpenclawError);
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
      setOpenclawError(errorMessage(e));
    }
  };

  const handleOpenClawInstance = async (
    userNamespace: string,
    credentials?: AddedCredential[],
    disableDevicePairing?: boolean,
  ): Promise<boolean> => {
    const proxyURL = proxyURLRef.current;
    if (!proxyURL) return false;

    // Fetch current state first
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
    } catch {
      // Use existing state
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
      } catch (e) {
        console.error(e);
        setOpenclawError(errorMessage(e));
        return false;
      }
    }

    if (!credentials || credentials.length === 0) return false;

    try {
      pendingCredentials.current = credentials;
      pendingDisableDevicePairing.current = disableDevicePairing ?? false;
      await openclawApi.createSpaceRequest(proxyURL, userNamespace);
      setOpenclawStatus(OpenClawStatus.PROVISIONING);
      return true;
    } catch (e) {
      pendingCredentials.current = undefined;
      setOpenclawError(errorMessage(e));
      console.error(e);
      return false;
    }
  };

  const deleteOpenClaw = async (userNamespace: string) => {
    const proxyURL = proxyURLRef.current;
    if (!proxyURL) return;

    deletingOpenClaw.current = true;
    setOpenclawStatus(OpenClawStatus.DELETING);
    setOpenclawUILink(undefined);
    setOpenclawError(null);

    const results = await Promise.allSettled([
      clawNamespace
        ? openclawApi.deleteOpenClawCR(proxyURL, clawNamespace)
        : Promise.resolve(),
      openclawApi.deleteSpaceRequest(proxyURL, userNamespace),
      openclawApi.cleanupWorkspaceEnvironment(proxyURL, userNamespace),
    ]);

    const failures = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    if (failures.length > 0) {
      for (const f of failures) {
        console.error(f.reason);
      }
      deletingOpenClaw.current = false;
      setOpenclawStatus(OpenClawStatus.FAILED);
      setOpenclawError(errorMessage(failures[0].reason));
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
        console.error("Error fetching UI config:", err);
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
      const handle = setInterval(getAAPData, SHORT_INTERVAL, ns);
      return () => clearInterval(handle);
    }
    return undefined;
  }, [userData?.defaultUserNamespace, userData?.proxyURL]);

  // Initial OpenClaw fetch
  useEffect(() => {
    if (userData?.defaultUserNamespace) {
      void (async () => {
        await getOpenClawData(userData.defaultUserNamespace!);
      })();
    }
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
  }, [userData?.defaultUserNamespace, userData?.proxyURL, openclawStatus]);

  // segmentWriteKey will be consumed in Phase 5
  void segmentWriteKey;

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
        ansibleError,
        ansibleStatus,
        openclawData,
        openclawError,
        openclawStatus,
        openclawUILink,
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
