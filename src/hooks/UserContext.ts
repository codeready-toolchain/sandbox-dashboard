import { createContext, useContext } from "react";
import { type SignupData, UserStatus } from "../types";

export interface UserContextType {
  loading: boolean;
  pendingApproval: boolean;
  refetchUserData: () => Promise<SignupData | undefined>;
  signupUser: () => void;
  userData: SignupData | undefined;
  userFound: boolean;
  userReady: boolean;
  userStatus: UserStatus;
  verificationRequired: boolean;
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
