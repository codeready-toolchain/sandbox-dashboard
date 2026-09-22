import { createContext, useContext } from "react";

import type { ButtonLabel } from "../../components/Catalog/catalogCardTypes";
import type { ProductType } from "../../types/product";

/**
 * A catalog primary action that can be resumed after user signup.
 */
export type SignupAction = {
  /** Label copied from the catalog card that started signup. */
  buttonLabel: ButtonLabel;
  /**
   * True when the catalog action can run after signup. Simple URL
   * products only need `READY`. AAP and OpenClaw also need their
   * connected providers (not the NO-OP `userNotReady` status).
   */
  canEnable: boolean;
  /** Runs the original catalog CTA. */
  onReady: () => void;
};

export interface SignupActionContextType {
  /**
   * True while a signup action is being processed — from the moment the
   * user clicks a card through signup until the action completes, the
   * modal is dismissed, or an interrupt occurs. Cards should disable
   * their primary buttons while this is true.
   */
  isSignupInProgress: boolean;
  /**
   * Starts signup (if needed) and watches user activation for the given
   * product. The original CTA is taken from the latest
   * {@link registerAction} call for that product.
   */
  signupAndRun: (productType: ProductType) => void;
  /**
   * Keeps the latest READY handler and enablement flag for a product.
   * Cards must call this on every relevant update so a remount after
   * signup (NO-OP provider → connected provider) does not lose the
   * pending action.
   */
  registerAction: (productType: ProductType, action: SignupAction) => void;
}

export const SignupActionContext = createContext<
  SignupActionContextType | undefined
>(undefined);

export const useSignupAction = (): SignupActionContextType => {
  const context = useContext(SignupActionContext);

  if (!context) {
    throw new Error("Context useSignupAction is not defined");
  }

  return context;
};
