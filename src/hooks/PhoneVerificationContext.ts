import { createContext, useContext } from "react";

export interface PhoneVerificationContextType {
  /** Opens the phone verification modal. */
  openPhoneVerificationModal: () => void;
}

export const PhoneVerificationContext = createContext<
  PhoneVerificationContextType | undefined
>(undefined);

export const usePhoneVerificationContext = (): PhoneVerificationContextType => {
  const context = useContext(PhoneVerificationContext);

  if (!context) {
    throw new Error("Context usePhoneVerificationContext is not defined");
  }

  return context;
};
