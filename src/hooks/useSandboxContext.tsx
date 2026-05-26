import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { type AAPData, type SignupData, UserStatus } from "../types";
import { getConfig } from "../config/config";
import {
  getSignupData,
  signup,
  getSegmentWriteKey,
  getUIConfig,
} from "../api/registration";
import { getAAP, createAAP, unIdleAAP } from "../api/aap";
import { getSecret } from "../api/kube";
import { useRecaptcha } from "./useRecaptcha";
import { LONG_INTERVAL, SHORT_INTERVAL } from "../const";
import { signupDataToStatus } from "../utils/register-utils";
import { AnsibleStatus, decode, getReadyCondition } from "../utils/aap-utils";
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
        segmentTrackClick: undefined,
        marketoWebhookURL,
        disabledIntegrations,
      }}
    >
      {children}
    </SandboxContext.Provider>
  );
}
