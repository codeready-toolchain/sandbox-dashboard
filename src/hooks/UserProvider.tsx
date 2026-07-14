import { AlertVariant } from "@patternfly/react-core";
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
import { useNotifications } from "../notifications/useNotifications";
import { type User } from "../types";
import logger from "../utils/logger";
import { mapUserStatusToSignupPhase } from "../utils/register-utils";
import { withRetry } from "../utils/retry";
import { UserContext, UserSignupPhase } from "./UserContext";
import { useRecaptcha } from "./useRecaptcha";

export function UserProvider({ children }: { children: ReactNode }) {
  const config = getConfig();
  const isProd = config.environment === Environment.PRODUCTION;
  useRecaptcha(isProd);

  // Grab the notifications' utilities to be able to post errors if anything
  // goes wrong.
  const { addAlert } = useNotifications();

  const [user, setUser] = useState<User | undefined>(undefined);
  const [userSignupPhase, setUserSignupPhase] = useState<UserSignupPhase>(
    UserSignupPhase.NOT_STARTED,
  );

  const [criticalError, setCriticalError] = useState<CriticalError | null>(
    null,
  );

  /**
   * User reference to avoid rerender in case we fetch the user from the
   * backend and it hasn't changed at all.
   */
  const userRef = useRef<User | undefined>(undefined);

  /**
   * Reference of the phase in which the user signup is in. It is useful so
   * that the "signupUser" function always has the freshest signup phase
   * object possible.
   */
  const userSignupPhaseRef = useRef<UserSignupPhase>(
    UserSignupPhase.NOT_STARTED,
  );

  /**
   * Keeps track of the last time there was a change in the user signup
   * status.
   */
  const lastUserSignupPhaseChangedAt = useRef<number>(0);

  /**
   * Utility function so that we can keep both the user signup phase and
   * reference in sync. It just makes sure that we update both at the same
   * time.
   */
  const updateSignupPhase = useCallback((phase: UserSignupPhase) => {
    if (phase !== userSignupPhaseRef.current) {
      userSignupPhaseRef.current = phase;
      setUserSignupPhase(phase);
      lastUserSignupPhaseChangedAt.current = Date.now();
    }
  }, []);

  /**
   * Fetches the user's signup data, critical for the application to work.
   * @param isRefetch signals if it is a refetching operation.
   * @returns the {@link User} itself.
   */
  const fetchUser = useCallback(
    async (isRefetch = false): Promise<void> => {
      if (!isRefetch) {
        updateSignupPhase(UserSignupPhase.FETCHING_DATA);
      }

      try {
        let result: User | undefined;
        if (isRefetch) {
          result = await getSignupData();
        } else {
          result = await withRetry(() => getSignupData(), 3, 2000);
        }

        // Make sure that the user has changed before changing the state and
        // scheduling a rerender.
        if (JSON.stringify(userRef.current) !== JSON.stringify(result)) {
          userRef.current = result;
          setUser(result);
        }

        updateSignupPhase(
          mapUserStatusToSignupPhase(userSignupPhaseRef.current, result),
        );
      } catch (err) {
        // On mount, the user is fetched for the first time. Since 404 errors
        // are not treated as such because they just signal that a user signup
        // yet does not exist, any other error means that we couldn't get the
        // user information and therefore we can't really have a functional
        // UI.
        if (!isRefetch) {
          logger.error(
            "Critical: unable to fetch user data after retries:",
            err,
          );
          setCriticalError(
            new CriticalError(
              `We're unable to load your account information. Please try again later, and if the issue persists, contact ${SUPPORT_EMAIL}.`,
              err,
            ),
          );
          return undefined;
        }
        logger.error("Error fetching user data:", err);
        // Keep the last known-good user/phase. A transient refetch failure
        // will be retried on the next poll tick.
      }
    },
    [updateSignupPhase],
  );

  /**
   * Creates a user signup in the back end.
   */
  const signupUser = useCallback(async () => {
    if (
      userSignupPhaseRef.current === UserSignupPhase.SIGNING_UP ||
      userSignupPhaseRef.current === UserSignupPhase.PROVISIONING ||
      userSignupPhaseRef.current === UserSignupPhase.PROVISIONING_TIMED_OUT
    ) {
      return;
    }

    updateSignupPhase(UserSignupPhase.SIGNING_UP);
    addAlert(
      AlertVariant.info,
      "Setting up your access to Developer Sandbox",
      "We are working to set everything up so that you can access the product trials. Please wait...",
    );
    try {
      await signup();
    } catch (err) {
      // Only reset the "userSignupPhase" to "NOT_STARTED" if the status is
      // still "SIGNING_UP". We account for the edge case in which the server
      // might sign the user up, but for some reason the UI might fail. If all
      // this aligns with a polling fetch of the user, it might advance the
      // state and the statement below would reset it back to "NOT_STARTED".
      //
      // The cast is needed because TypeScript carries the stale narrowing
      // from the early return in the beginning of the function, without
      // realizing that the reference can change due to the "signup" call.
      if (
        (userSignupPhaseRef.current as UserSignupPhase) ===
        UserSignupPhase.SIGNING_UP
      ) {
        updateSignupPhase(UserSignupPhase.NOT_STARTED);
      }
      if (err instanceof ApiError) {
        logger.error(
          "Unexpected response received when attempting to create a user signup",
          err,
        );

        addAlert(
          AlertVariant.danger,
          "Unable to sign you up",
          "We were unable to sign your account up in our systems. Please try again later.",
        );
      } else if (
        err instanceof Error &&
        err.message.toLowerCase().includes("recaptcha")
      ) {
        logger.error("Recaptcha failure during signup:", err);

        addAlert(
          AlertVariant.danger,
          "Recaptcha failure",
          "We were unable to successfully verify that you're human with Recaptcha due to an internal error. Please try again later.",
        );
      } else {
        logger.error("Unexpected error during signup:", err);

        addAlert(
          AlertVariant.danger,
          "Unable to sign you up",
          "An unexpected error occurred while setting up your account. Please try again later.",
        );
      }
    }
  }, [addAlert, updateSignupPhase]);

  // Initial user fetch when the provider is mounted.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount is intentional
    fetchUser();
  }, [fetchUser]);

  // Determine if we should be polling to fetch the latest user data.
  const shouldBePolling = useMemo<boolean>(() => {
    switch (userSignupPhase) {
      case UserSignupPhase.NOT_STARTED:
      case UserSignupPhase.READY:
      default:
        return false;
      case UserSignupPhase.SIGNING_UP:
      case UserSignupPhase.PENDING_PHONE_VERIFICATION:
      case UserSignupPhase.PENDING_MANUAL_APPROVAL:
      case UserSignupPhase.PROVISIONING:
        return true;
    }
  }, [userSignupPhase]);

  // Determine the polling interval for the user data.
  const pollInterval = useMemo<number>(() => {
    switch (userSignupPhase) {
      case UserSignupPhase.NOT_STARTED:
      case UserSignupPhase.PENDING_MANUAL_APPROVAL:
        return LONG_INTERVAL;
      case UserSignupPhase.SIGNING_UP:
      case UserSignupPhase.PENDING_PHONE_VERIFICATION:
      case UserSignupPhase.PROVISIONING:
        return SHORT_INTERVAL;
      default:
        return LONG_INTERVAL;
    }
  }, [userSignupPhase]);

  // Poll for the latest user data from the back end. In the case that the
  // user was in the process of being signed up, some notifications will be
  // shown to the user.
  useEffect(() => {
    if (!shouldBePolling) {
      return undefined;
    }

    let cancelled = false;
    const poll = async () => {
      // Capture the phase of the user signup before polling for the fresh
      // user data again.
      const wasSigningUp =
        userSignupPhaseRef.current === UserSignupPhase.SIGNING_UP ||
        userSignupPhaseRef.current === UserSignupPhase.PROVISIONING;

      // Refresh the user.
      await fetchUser(true);

      // If we were in the process of signing the user up, show a notification
      // to the user depending on their current state of their account.
      if (wasSigningUp) {
        // Make sure that after a significant amount of polling, we show some
        // feedback to the user if their account has not been provisioned.
        if (Date.now() - lastUserSignupPhaseChangedAt.current > 60_000) {
          addAlert(
            AlertVariant.danger,
            "Unable to set up your Developer Sandbox account",
            `We were unable to set up your Developer Sandbox account. Please contact support at ${SUPPORT_EMAIL}`,
          );

          updateSignupPhase(UserSignupPhase.PROVISIONING_TIMED_OUT);
          return;
        }

        switch (userSignupPhaseRef.current) {
          case UserSignupPhase.PENDING_MANUAL_APPROVAL:
            addAlert(
              AlertVariant.info,
              "Your account needs manual approval",
              "Your user has been signed up, but your account requires manual approval from the Developer Sandbox administrators.",
            );
            break;
          case UserSignupPhase.PENDING_PHONE_VERIFICATION:
            addAlert(
              AlertVariant.info,
              "Phone verification needed",
              `Your user has been signed up, but you need to verify your phone number before you can try any products. Please click on any product you would like to try to initiate the process.`,
            );
            break;
          case UserSignupPhase.READY:
            addAlert(
              AlertVariant.info,
              "Everything is set!",
              `Your user has been signed up, and you are ready to try our Red Hat products.`,
            );
        }
      }

      // Schedule a new timeout.
      if (!cancelled) {
        timerId = setTimeout(poll, pollInterval);
      }
    };

    let timerId = setTimeout(poll, pollInterval);
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [addAlert, fetchUser, pollInterval, shouldBePolling, updateSignupPhase]);

  const refetchUserData = useCallback(() => fetchUser(true), [fetchUser]);

  // Memoize the contents of the context to avoid rerenders on any state or
  // function changes.
  const contextValue = useMemo(
    () => ({
      refetchUserData,
      signupUser,
      user,
      userSignupPhase,
    }),
    [refetchUserData, signupUser, user, userSignupPhase],
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
