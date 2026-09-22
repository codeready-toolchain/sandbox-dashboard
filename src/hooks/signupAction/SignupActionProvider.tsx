import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ButtonLabel } from "../../components/Catalog/catalogCardTypes";
import { SignupInProgressModal } from "../../components/Modals";
import type { ProductType } from "../../types/product";
import { useUserContext } from "../UserContext";
import { UserSignupPhase } from "../userSignupPhase";
import { type SignupAction, SignupActionContext } from "./SignupActionContext";
import {
  isSignupActionInterrupt,
  isUserActivationActive,
  SIGNUP_WATCHER_INTERVAL_MS,
} from "./signupActionUtils";

/**
 * Owns the signup-to-action flow: when a user clicks a catalog CTA
 * before being signed up, this provider starts signup, watches user
 * activation, and either auto-runs the action (fast path) or shows a
 * continuation modal (slow path).
 *
 * Lives above product-specific providers so that swapping the
 * AAP/OpenClaw NO-OP provider for the connected one does not lose the
 * pending action.
 */
export function SignupActionProvider({ children }: { children: ReactNode }) {
  const { signupUser, userSignupPhase } = useUserContext();

  /**
   * Maps the product types and signup actions together.
   */
  const slotsRef = useRef<Map<ProductType, SignupAction>>(new Map());

  /**
   * Contains the product type the user clicked on, and for which we have a
   * pending action for.
   */
  const pendingProductTypeRef = useRef<ProductType | undefined>(undefined);

  /**
   * Holds the reference of the interval used to track the user signup.
   */
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Holds a reference of the user signup phase to avoid stale references in   * closures.
   */
  const userSignupPhaseRef = useRef(userSignupPhase);

  /**
   * Flag which help us determine if there is a pending action executed in
   * the fast path. This means that the gesture window is still active.
   */
  const pendingFastPathRef = useRef(false);

  /**
   * Flag to track whether the signup phase has moved beyond NOT_STARTED at
   * least once during the current signup attempt. This lets the signup
   * interrupt logic distinguish "signup hasn't started yet", where
   * NOT_STARTED is the initial state and should not close the modal, from
   * "signup failed and reverted to NOT_STARTED".
   */
  const hasProgressedPastNotStartedRef = useRef(
    userSignupPhase !== UserSignupPhase.NOT_STARTED &&
      userSignupPhase !== UserSignupPhase.INITIAL_FETCH,
  );

  /**
   * Holds the button label to set in the signup modal, if necessary.
   */
  const [buttonLabel, setButtonLabel] = useState<ButtonLabel>(
    ButtonLabel.TRY_IT,
  );

  /**
   * Holds the "can be enabled" state for the action.
   */
  const [canEnable, setCanEnable] = useState(false);

  /**
   * Holds the state of the signup modal.
   */
  const [isSignupModalOpen, setSignupModalOpen] = useState(false);

  /**
   * True while a signup action is being processed. Cards use this to
   * disable their primary buttons until the flow completes.
   */
  const [isSignupInProgress, setSignupInProgress] = useState(false);

  /**
   * Clears the user signup watcher.
   */
  const clearWatcher = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /** Returns the registered action for the pending product, if any. */
  const getPendingAction = useCallback((): SignupAction | undefined => {
    const pt = pendingProductTypeRef.current;
    return pt ? slotsRef.current.get(pt) : undefined;
  }, []);

  /**
   * Watches the user signup's phase and:
   *
   * - Performs the pending action if the browser's gesture threshold allows
   *   it.
   * - Opens the "signup" modal which explains that the signup is taking
   *   longer than expected.
   */
  const startWatcher = useCallback(() => {
    clearWatcher();

    const tick = () => {
      const phase = userSignupPhaseRef.current;
      const isActive = isUserActivationActive();

      // The user got signed up? If the context allows it execute the pending
      // action right away. Otherwise, flag that the action is pending to be
      // executed so that the effect that is watching this can fire it once
      // "canEnable" becomes true.
      if (isActive && phase === UserSignupPhase.READY) {
        clearWatcher();
        const action = getPendingAction();
        if (action?.canEnable) {
          action.onReady();
          setSignupInProgress(false);
        } else {
          pendingFastPathRef.current = true;
        }
        return;
      }

      // When the gesture window times out, we are on the slow path and we
      // need to open the informative signup modal.
      if (!isActive) {
        clearWatcher();
        setSignupModalOpen(true);
      }
    };

    intervalRef.current = setInterval(tick, SIGNUP_WATCHER_INTERVAL_MS);
    tick();
  }, [clearWatcher, getPendingAction]);

  /**
   * Copies the action's display fields into React state so the modal
   * re-renders with the right label and enablement.
   */
  const applyAction = useCallback((action: SignupAction) => {
    setButtonLabel(action.buttonLabel);
    setCanEnable(action.canEnable);
  }, []);

  /**
   * Registers an action for a given product type. If the user has already
   * clicked a button while we are registering the action, we set it as the
   * primary pending action to execute.
   */
  const registerAction = useCallback(
    (productType: ProductType, action: SignupAction) => {
      slotsRef.current.set(productType, action);

      if (pendingProductTypeRef.current === productType) {
        applyAction(action);
      }
    },
    [applyAction],
  );

  /**
   * Registers which product the user clicked on, begins the signup process
   * and monitors its state.
   */
  const signupAndRun = useCallback(
    (productType: ProductType) => {
      // Register which product we need to perform the action for.
      pendingProductTypeRef.current = productType;

      const action = slotsRef.current.get(productType);
      if (action) {
        applyAction(action);
      }

      // Reset the "has progressed" flag if the signup has not started yet.
      if (userSignupPhase === UserSignupPhase.NOT_STARTED) {
        hasProgressedPastNotStartedRef.current = false;
      }

      // Reset whether we have a pending "fast path" action to be executed.
      pendingFastPathRef.current = false;

      // Mark signup as in progress so that cards disable their buttons.
      setSignupInProgress(true);

      // Sign the user up.
      signupUser();

      // Watch the user signup's status.
      startWatcher();
    },
    [applyAction, signupUser, startWatcher, userSignupPhase],
  );

  /**
   * Watches the user signup in case we need to interrupt the pending action.
   * When the user signup lands in a non `READY` state, due to some pending
   * verification or any other restriction, it does not make sense to execute
   * any pending actions or have the modal show up. In those cases, we want to
   * clear any pending actions and close the modals so that any other flows
   * can take over, like the phone verification one or any toasts that will
   * give more information to the user.
   *
   * The reason this is not done in the {@link startWatcher} function is
   * because the watcher stops and clears once the gesture threshold window
   * times out, so once we're in the "long path" with the modal open the
   * watcher simply is not running.
   */
  useEffect(() => {
    userSignupPhaseRef.current = userSignupPhase;

    if (
      userSignupPhase !== UserSignupPhase.NOT_STARTED &&
      userSignupPhase !== UserSignupPhase.INITIAL_FETCH
    ) {
      hasProgressedPastNotStartedRef.current = true;
    }

    if (
      isSignupActionInterrupt(
        userSignupPhase,
        hasProgressedPastNotStartedRef.current,
      )
    ) {
      pendingFastPathRef.current = false;
      setSignupModalOpen(false);
      setSignupInProgress(false);
      clearWatcher();
    }
  }, [clearWatcher, userSignupPhase]);

  // When the fast path fires before the product action can run, it
  // defers via `pendingFastPathRef`. This effect resolves the deferred
  // action once `canEnable` becomes true.
  useEffect(() => {
    if (pendingFastPathRef.current && canEnable) {
      pendingFastPathRef.current = false;
      getPendingAction()?.onReady();
      setSignupInProgress(false);
    }
  }, [canEnable, getPendingAction]);

  // Clean up the watcher on unmount.
  useEffect(() => {
    return () => {
      clearWatcher();
    };
  }, [clearWatcher]);

  /**
   * Closes the signup modal.
   */
  const closeModal = useCallback(() => {
    setSignupModalOpen(false);
    setSignupInProgress(false);
  }, []);

  /**
   * Passes the action to be executed to the signup modal.
   */
  const onContinue = useCallback(() => {
    if (!canEnable) {
      return;
    }

    setSignupModalOpen(false);
    setSignupInProgress(false);
    getPendingAction()?.onReady();
  }, [canEnable, getPendingAction]);

  // --- Context ---

  const contextValue = useMemo(
    () => ({ isSignupInProgress, signupAndRun, registerAction }),
    [isSignupInProgress, signupAndRun, registerAction],
  );

  return (
    <SignupActionContext.Provider value={contextValue}>
      {children}
      <SignupInProgressModal
        isOpen={isSignupModalOpen}
        onClose={closeModal}
        buttonLabel={buttonLabel}
        isActionEnabled={canEnable}
        onContinue={onContinue}
      />
    </SignupActionContext.Provider>
  );
}
