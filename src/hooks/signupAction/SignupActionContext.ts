import { createContext, useContext } from "react";

import type { Product, ProductType } from "../../types/product";
import type { DpalClickAttributes } from "../../utils/analytics";

/**
 * A catalog primary action that can be resumed after user signup.
 */
export type SignupAction = {
  /** The product this action belongs to. */
  product: Product;
  /**
   * Whether the action requires a transient user gesture (e.g.
   * `window.open`). When `false` the watcher auto-executes the
   * action after signup, skipping the continuation modal. Defaults
   * to `true` when not set.
   */
  requiresUserGesture?: boolean;
  /**
   * True when the catalog action can run after signup. Simple URL
   * products only need `READY`. AAP and OpenClaw also need their
   * connected providers (not the NO-OP `userNotReady` status).
   */
  canEnable: boolean;
  /**
   * Adobe attributes for the continuation button. Set only when
   * that click opens a product URL. Omitted for signup itself and
   * for products that have no URL.
   */
  clickAnalytics?: DpalClickAttributes;
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
  registerAction: (action: SignupAction) => void;
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
