import { createContext, useContext } from "react";

import { type User } from "../types";
import type { UserSignupPhase } from "./userSignupPhase";

export interface UserContextType {
  /** Triggers a refetch of the "userSignup". */
  refetchUserData: (signal?: AbortSignal) => Promise<void>;
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
