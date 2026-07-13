import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getSignupData, signup } from "../api/registration";
import { CriticalErrorPage } from "../components/CriticalErrorPage";
import { Environment, getConfig } from "../config/config";
import { LONG_INTERVAL, SHORT_INTERVAL, SUPPORT_EMAIL } from "../const";
import { ApiError } from "../error/ApiError";
import { CriticalError } from "../error/CriticalError";
import { UserFacingError } from "../error/UserFacingError";
import { UserStatus, type SignupData } from "../types";
import logger from "../utils/logger";
import { signupDataToStatus } from "../utils/register-utils";
import { withRetry } from "../utils/retry";
import { UserContext } from "./UserContext";
import { useRecaptcha } from "./useRecaptcha";

export function UserProvider({ children }: { children: ReactNode }) {
  const config = getConfig();
  const isProd = config.environment === Environment.PRODUCTION;
  useRecaptcha(isProd);

  const [statusUnknown, setStatusUnknown] = useState(true);
  const [userFound, setUserFound] = useState(false);
  const [userData, setData] = useState<SignupData | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [criticalError, setCriticalError] = useState<CriticalError | null>(
    null,
  );

  const userDataRef = useRef<SignupData | undefined>(undefined);

  const status = useMemo(
    () => (statusUnknown ? UserStatus.UNKNOWN : signupDataToStatus(userData)),
    [statusUnknown, userData],
  );

  const verificationRequired = status === UserStatus.VERIFY;
  const pendingApproval = status === UserStatus.PENDING_APPROVAL;
  const userReady = status === UserStatus.READY;

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

  // Initial fetch
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    fetchData();
  });

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

  const refetchUserData = useCallback(() => fetchData(true), []);

  // Memoize the contents of the context to avoid rerenders on any state or
  // function changes.
  const contextValue = useMemo(
    () => ({
      loading,
      pendingApproval,
      refetchUserData,
      signupUser,
      userData,
      userFound,
      userReady,
      userStatus: status,
      verificationRequired,
    }),
    [
      loading,
      pendingApproval,
      refetchUserData,
      status,
      userData,
      userFound,
      userReady,
      verificationRequired,
    ],
  );

  // Render an error page on critical errors instead of having a broken and
  // unresponsive user interface.
  if (criticalError) {
    return <CriticalErrorPage error={criticalError} />;
  }

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}
