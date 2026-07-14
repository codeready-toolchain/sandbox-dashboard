import { createContext, useContext } from "react";
import { type User } from "../types";

/**
 * Defines the phases in which the "user signup" currently is.
 */
export enum UserSignupPhase {
  NOT_STARTED,
  FETCHING_DATA,
  SIGNING_UP,
  PENDING_PHONE_VERIFICATION,
  PENDING_MANUAL_APPROVAL,
  PROVISIONING,
  PROVISIONING_TIMED_OUT,
  READY,
}

export interface UserContextType {
  /** Triggers a refetch of the "userSignup". */
  refetchUserData: () => Promise<void>;
  /** Signs up the user in the Developer Sandbox. */
  signupUser: () => void;
  /** The user object representing the logged in and signed up user. */
  user?: User;
  /** Holds the phase in which the user signup currently is. */
  userSignupPhase: UserSignupPhase;
}

export const UserContext = createContext<UserContextType | undefined>(
  undefined,
);

export const useUserContext = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("Context useUserContext is not defined");
  }
  return context;
};
