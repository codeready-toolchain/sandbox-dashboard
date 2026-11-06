import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { catalogProductOpenAttributes } from "../../../components/Catalog/productData";
import { type Product, ProductType } from "../../../types/product";
import { NotificationProvider } from "../../NotificationProvider";
import { UserContext, type UserContextType } from "../../UserContext";
import { UserSignupPhase } from "../../userSignupPhase";
import { useSignupAction } from "../SignupActionContext";
import { SignupActionProvider } from "../SignupActionProvider";
import {
  SIGNUP_WATCHER_INTERVAL_MS,
  SIGNUP_WATCHER_TIMEOUT_MS,
} from "../signupActionUtils";
import { mockUserActivation } from "./userActivationTestHelpers";

// ── Fixtures ──────────────────────────────────────────────

const openshiftProduct: Product = {
  type: ProductType.OPENSHIFT_CONSOLE,
  title: "OpenShift",
  image: "openshift.svg",
  description: [],
};

const aapProduct: Product = {
  type: ProductType.AAP,
  title: "Ansible Automation Platform",
  image: "ansible.svg",
  description: [],
};

const openclawProduct: Product = {
  type: ProductType.OPENCLAW,
  title: "OpenClaw",
  image: "openclaw.svg",
  description: [],
};

// ── Helpers ───────────────────────────────────────────────

function makeUserContext(
  overrides: Partial<UserContextType> = {},
): UserContextType {
  return {
    refetchUserData: vi.fn().mockResolvedValue(undefined),
    signupUser: vi.fn(),
    user: undefined,
    userSignupPhase: UserSignupPhase.NOT_STARTED,
    ...overrides,
  };
}

/**
 * A component that consumes the signup action context and exposes it
 * via test IDs and buttons.
 */
function ContextConsumer({
  product = openshiftProduct,
}: {
  product?: Product;
}) {
  const { isSignupInProgress, signupAndRun, registerAction } =
    useSignupAction();

  return (
    <div>
      <span data-testid="in-progress">{String(isSignupInProgress)}</span>
      <button
        data-testid="signup-and-run"
        onClick={() => signupAndRun(product.type)}
      >
        signupAndRun
      </button>
      <button
        data-testid="register-action"
        onClick={() =>
          registerAction({
            product,
            canEnable: true,
            onReady: () => {},
          })
        }
      >
        registerAction
      </button>
    </div>
  );
}

/**
 * Renders the {@link SignupActionProvider} wrapped in the required
 * contexts.
 *
 * Returns a `setPhase` helper that rerenders the tree with a new
 * user signup phase.
 */
function renderAuthenticated(
  userCtxOverrides: Partial<UserContextType> = {},
  children?: React.ReactNode,
) {
  const userCtx = makeUserContext(userCtxOverrides);

  const ui = (ctx: UserContextType) => (
    <NotificationProvider>
      <UserContext.Provider value={ctx}>
        <SignupActionProvider>
          {children ?? <ContextConsumer />}
        </SignupActionProvider>
      </UserContext.Provider>
    </NotificationProvider>
  );

  const view = render(ui(userCtx));

  return {
    userCtx,
    setPhase: (phase: UserSignupPhase) => {
      const next = { ...userCtx, userSignupPhase: phase };
      view.rerender(ui(next));
    },
    unmount: view.unmount,
  };
}

// ── Setup / teardown ──────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockUserActivation(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SignupActionProvider", () => {
  describe("signupAndRun", () => {
    it("calls signupUser and sets isSignupInProgress to true", async () => {
      const { userCtx } = renderAuthenticated();

      await act(async () => {
        screen.getByTestId("signup-and-run").click();
      });

      expect(userCtx.signupUser).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("in-progress").textContent).toBe("true");
    });
  });

  describe("fast path", () => {
    it("executes the action when READY, canEnable and gesture are all met", async () => {
      const onReady = vi.fn();

      function FastPathConsumer() {
        const { signupAndRun, registerAction } = useSignupAction();

        return (
          <div>
            <button
              data-testid="register"
              onClick={() =>
                registerAction({
                  product: openshiftProduct,
                  canEnable: true,
                  onReady,
                })
              }
            />
            <button
              data-testid="run"
              onClick={() => signupAndRun(openshiftProduct.type)}
            />
          </div>
        );
      }

      const { setPhase } = renderAuthenticated(
        { userSignupPhase: UserSignupPhase.NOT_STARTED },
        <FastPathConsumer />,
      );

      // Register the action, then trigger signupAndRun.
      // fireEvent wraps in act() to flush state updates.
      fireEvent.click(screen.getByTestId("register"));
      fireEvent.click(screen.getByTestId("run"));

      // Simulate signup completion. setPhase and advanceTimers are
      // split so that effects from the rerender (which update
      // userSignupPhaseRef) flush before the watcher tick fires.
      // Keeping them together can race with shouldAdvanceTime.
      await act(async () => {
        setPhase(UserSignupPhase.READY);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(onReady).toHaveBeenCalledTimes(1);
    });

    it("keeps ticking when READY but canEnable is false", async () => {
      const onReady = vi.fn();

      function DelayedEnableConsumer() {
        const { signupAndRun, registerAction } = useSignupAction();

        return (
          <div>
            <button
              data-testid="register-disabled"
              onClick={() =>
                registerAction({
                  product: openshiftProduct,
                  canEnable: false,
                  onReady,
                })
              }
            />
            <button
              data-testid="register-enabled"
              onClick={() =>
                registerAction({
                  product: openshiftProduct,
                  canEnable: true,
                  onReady,
                })
              }
            />
            <button
              data-testid="run"
              onClick={() => signupAndRun(openshiftProduct.type)}
            />
          </div>
        );
      }

      const { setPhase } = renderAuthenticated(
        { userSignupPhase: UserSignupPhase.NOT_STARTED },
        <DelayedEnableConsumer />,
      );

      // Register with canEnable: false (simulating the NO-OP
      // provider state for AAP/OpenClaw).
      fireEvent.click(screen.getByTestId("register-disabled"));
      fireEvent.click(screen.getByTestId("run"));

      // Phase reaches READY but action is not enabled yet.
      await act(async () => {
        setPhase(UserSignupPhase.READY);
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(onReady).not.toHaveBeenCalled();

      // Now the provider loads and re-registers with canEnable:
      // true. The next watcher tick should execute the action.
      fireEvent.click(screen.getByTestId("register-enabled"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });

  describe("slow path (modal)", () => {
    it("opens the modal when the gesture expires before signup completes", async () => {
      mockUserActivation(false);

      renderAuthenticated({
        userSignupPhase: UserSignupPhase.NOT_STARTED,
      });

      fireEvent.click(screen.getByTestId("signup-and-run"));

      // The first tick sees !isActive and opens the modal.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(
        screen.getByRole("dialog", {
          name: "Signup in progress",
        }),
      ).toBeInTheDocument();
    });

    it("opens the modal when gesture expires while READY but canEnable is false", async () => {
      let isActive = true;
      vi.spyOn(navigator, "userActivation", "get").mockImplementation(() => ({
        isActive,
        hasBeenActive: true,
      }));

      const onReady = vi.fn();

      function SlowPathConsumer() {
        const { signupAndRun, registerAction } = useSignupAction();

        return (
          <div>
            <button
              data-testid="register"
              onClick={() =>
                registerAction({
                  product: openshiftProduct,
                  canEnable: false,
                  onReady,
                })
              }
            />
            <button
              data-testid="run"
              onClick={() => signupAndRun(openshiftProduct.type)}
            />
          </div>
        );
      }

      const { setPhase } = renderAuthenticated(
        { userSignupPhase: UserSignupPhase.NOT_STARTED },
        <SlowPathConsumer />,
      );

      fireEvent.click(screen.getByTestId("register"));
      fireEvent.click(screen.getByTestId("run"));

      // Phase reaches READY but canEnable is false.
      await act(async () => {
        setPhase(UserSignupPhase.READY);
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(onReady).not.toHaveBeenCalled();
      // Modal should not be open yet — gesture is still active.
      expect(
        screen.queryByRole("dialog", {
          name: "Signup in progress",
        }),
      ).not.toBeInTheDocument();

      // Gesture expires.
      isActive = false;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      // Modal should open as the fallback.
      expect(
        screen.getByRole("dialog", {
          name: "Signup in progress",
        }),
      ).toBeInTheDocument();
      expect(onReady).not.toHaveBeenCalled();
    });

    it("treats a missing User Activation API as the slow path", async () => {
      mockUserActivation(undefined);

      renderAuthenticated({
        userSignupPhase: UserSignupPhase.NOT_STARTED,
      });

      fireEvent.click(screen.getByTestId("signup-and-run"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(
        screen.getByRole("dialog", {
          name: "Signup in progress",
        }),
      ).toBeInTheDocument();
    });

    it("treats a missing User Activation API as the slow path only for gesture-requiring actions", async () => {
      mockUserActivation(undefined);

      const onReady = vi.fn();

      function NoGestureConsumer() {
        const { signupAndRun, registerAction } = useSignupAction();

        return (
          <div>
            <button
              data-testid="register"
              onClick={() =>
                registerAction({
                  product: aapProduct,
                  requiresUserGesture: false,
                  canEnable: true,
                  onReady,
                })
              }
            />
            <button
              data-testid="run"
              onClick={() => signupAndRun(aapProduct.type)}
            />
          </div>
        );
      }

      const { setPhase } = renderAuthenticated(
        { userSignupPhase: UserSignupPhase.NOT_STARTED },
        <NoGestureConsumer />,
      );

      fireEvent.click(screen.getByTestId("register"));
      fireEvent.click(screen.getByTestId("run"));

      // The gesture is missing but the action does not require
      // one, so the watcher should keep ticking — no modal.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(
        screen.queryByRole("dialog", {
          name: "Signup in progress",
        }),
      ).not.toBeInTheDocument();

      // Once signup completes, the action fires automatically.
      await act(async () => {
        setPhase(UserSignupPhase.READY);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });

  describe("auto-execute (no gesture required)", () => {
    it("auto-executes the action without a modal when gesture expires", async () => {
      mockUserActivation(false);

      const onReady = vi.fn();

      function AutoExecConsumer() {
        const { signupAndRun, registerAction } = useSignupAction();

        return (
          <div>
            <button
              data-testid="register"
              onClick={() =>
                registerAction({
                  product: aapProduct,
                  requiresUserGesture: false,
                  canEnable: true,
                  onReady,
                })
              }
            />
            <button
              data-testid="run"
              onClick={() => signupAndRun(aapProduct.type)}
            />
          </div>
        );
      }

      const { setPhase } = renderAuthenticated(
        { userSignupPhase: UserSignupPhase.NOT_STARTED },
        <AutoExecConsumer />,
      );

      fireEvent.click(screen.getByTestId("register"));
      fireEvent.click(screen.getByTestId("run"));

      // Gesture is already expired but the action does not
      // require one. The modal should not appear.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(
        screen.queryByRole("dialog", {
          name: "Signup in progress",
        }),
      ).not.toBeInTheDocument();

      // Signup completes — the action auto-executes.
      await act(async () => {
        setPhase(UserSignupPhase.READY);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(onReady).toHaveBeenCalledTimes(1);
    });

    it("opens the modal when READY but gesture-independent action stays disabled", async () => {
      mockUserActivation(false);

      const onReady = vi.fn();

      function AutoExecDelayedConsumer() {
        const { signupAndRun, registerAction } = useSignupAction();

        return (
          <div>
            <button
              data-testid="register-disabled"
              onClick={() =>
                registerAction({
                  product: openclawProduct,
                  requiresUserGesture: false,
                  canEnable: false,
                  onReady,
                })
              }
            />
            <button
              data-testid="register-enabled"
              onClick={() =>
                registerAction({
                  product: openclawProduct,
                  requiresUserGesture: false,
                  canEnable: true,
                  onReady,
                })
              }
            />
            <button
              data-testid="run"
              onClick={() => signupAndRun(openclawProduct.type)}
            />
          </div>
        );
      }

      const { setPhase } = renderAuthenticated(
        { userSignupPhase: UserSignupPhase.NOT_STARTED },
        <AutoExecDelayedConsumer />,
      );

      fireEvent.click(screen.getByTestId("register-disabled"));
      fireEvent.click(screen.getByTestId("run"));

      // Phase reaches READY but canEnable is false. The
      // watcher opens the modal as a cancellation path so
      // the user is not stuck with disabled catalog buttons.
      await act(async () => {
        setPhase(UserSignupPhase.READY);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(onReady).not.toHaveBeenCalled();
      expect(
        screen.getByRole("dialog", {
          name: "Signup in progress",
        }),
      ).toBeInTheDocument();

      // The provider re-registers with canEnable: true.
      // registerAction closes the modal and restarts the
      // watcher, which auto-executes the action.
      fireEvent.click(screen.getByTestId("register-enabled"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(onReady).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByRole("dialog", {
          name: "Signup in progress",
        }),
      ).not.toBeInTheDocument();
    });

    it("auto-executes when a late registerAction matches the pending product", async () => {
      mockUserActivation(false);

      const onReady = vi.fn();

      function LateRegisterConsumer() {
        const { isSignupInProgress, signupAndRun, registerAction } =
          useSignupAction();

        return (
          <div>
            <span data-testid="in-progress">{String(isSignupInProgress)}</span>
            <button
              data-testid="run"
              onClick={() => signupAndRun(aapProduct.type)}
            />
            <button
              data-testid="register"
              onClick={() =>
                registerAction({
                  product: aapProduct,
                  requiresUserGesture: false,
                  canEnable: true,
                  onReady,
                })
              }
            />
          </div>
        );
      }

      const { setPhase } = renderAuthenticated(
        { userSignupPhase: UserSignupPhase.NOT_STARTED },
        <LateRegisterConsumer />,
      );

      // Start signup before registering the action. The
      // watcher defaults needsGesture to true (action is
      // undefined) so the expired gesture opens the modal.
      fireEvent.click(screen.getByTestId("run"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(
        screen.getByRole("dialog", {
          name: "Signup in progress",
        }),
      ).toBeInTheDocument();

      // Phase reaches READY.
      await act(async () => {
        setPhase(UserSignupPhase.READY);
      });

      // Late registration: the card mounts and registers
      // its gesture-independent action with canEnable true.
      // registerAction closes the modal and restarts the
      // watcher, which auto-executes immediately.
      fireEvent.click(screen.getByTestId("register"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(onReady).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByRole("dialog", {
          name: "Signup in progress",
        }),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("in-progress").textContent).toBe("false");
    });

    it("opens the modal when a gesture-independent action exceeds the watcher timeout", async () => {
      // shouldAdvanceTime moves the fake clock with wall time.
      // Under load that drift crosses the one-interval margin
      // and opens the modal before the timeout step below.
      // Manual mode keeps advanceTimersByTimeAsync exact.
      vi.setTimerTickMode("manual");

      mockUserActivation(false);

      const onReady = vi.fn();

      function TimeoutConsumer() {
        const { signupAndRun, registerAction } = useSignupAction();

        return (
          <div>
            <button
              data-testid="register"
              onClick={() =>
                registerAction({
                  product: aapProduct,
                  requiresUserGesture: false,
                  canEnable: false,
                  onReady,
                })
              }
            />
            <button
              data-testid="run"
              onClick={() => signupAndRun(aapProduct.type)}
            />
          </div>
        );
      }

      const { setPhase } = renderAuthenticated(
        { userSignupPhase: UserSignupPhase.NOT_STARTED },
        <TimeoutConsumer />,
      );

      fireEvent.click(screen.getByTestId("register"));
      fireEvent.click(screen.getByTestId("run"));

      // Move to SIGNING_UP to simulate a stuck signup.
      await act(async () => {
        setPhase(UserSignupPhase.SIGNING_UP);
      });

      // Advance just before the timeout — no modal yet.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          SIGNUP_WATCHER_TIMEOUT_MS - SIGNUP_WATCHER_INTERVAL_MS,
        );
      });

      expect(
        screen.queryByRole("dialog", {
          name: "Signup in progress",
        }),
      ).not.toBeInTheDocument();
      expect(onReady).not.toHaveBeenCalled();

      // One more tick exceeds the timeout — modal opens.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(
        screen.getByRole("dialog", {
          name: "Signup in progress",
        }),
      ).toBeInTheDocument();
      expect(onReady).not.toHaveBeenCalled();
    });

    it("does not apply the timeout to gesture-dependent actions", async () => {
      const onReady = vi.fn();

      function GestureConsumer() {
        const { signupAndRun, registerAction } = useSignupAction();

        return (
          <div>
            <button
              data-testid="register"
              onClick={() =>
                registerAction({
                  product: openshiftProduct,
                  canEnable: false,
                  onReady,
                })
              }
            />
            <button
              data-testid="run"
              onClick={() => signupAndRun(openshiftProduct.type)}
            />
          </div>
        );
      }

      const { setPhase } = renderAuthenticated(
        { userSignupPhase: UserSignupPhase.NOT_STARTED },
        <GestureConsumer />,
      );

      fireEvent.click(screen.getByTestId("register"));
      fireEvent.click(screen.getByTestId("run"));

      await act(async () => {
        setPhase(UserSignupPhase.SIGNING_UP);
      });

      // The gesture is still active (default mock), so the
      // watcher keeps ticking. Advancing past the timeout
      // should NOT open the modal for gesture-dependent
      // actions.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          SIGNUP_WATCHER_TIMEOUT_MS + SIGNUP_WATCHER_INTERVAL_MS,
        );
      });

      expect(
        screen.queryByRole("dialog", {
          name: "Signup in progress",
        }),
      ).not.toBeInTheDocument();
    });
  });

  describe("interrupt", () => {
    it("closes the modal and resets progress on an interrupt phase", async () => {
      mockUserActivation(false);

      const { setPhase } = renderAuthenticated({
        userSignupPhase: UserSignupPhase.NOT_STARTED,
      });

      fireEvent.click(screen.getByTestId("signup-and-run"));

      // Let the watcher open the modal (slow path).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(
        screen.getByRole("dialog", {
          name: "Signup in progress",
        }),
      ).toBeInTheDocument();

      // The signup moves to a phase that requires phone
      // verification, interrupting the pending action.
      await act(async () => {
        setPhase(UserSignupPhase.PENDING_PHONE_VERIFICATION);
      });

      expect(
        screen.queryByRole("dialog", {
          name: "Signup in progress",
        }),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("in-progress").textContent).toBe("false");
    });

    it("does not interrupt on NOT_STARTED when signup has not progressed yet", async () => {
      mockUserActivation(false);

      renderAuthenticated({
        userSignupPhase: UserSignupPhase.NOT_STARTED,
      });

      fireEvent.click(screen.getByTestId("signup-and-run"));

      // The watcher opens the modal.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      // The modal should stay open because
      // hasProgressedPastNotStarted is false.
      expect(
        screen.getByRole("dialog", {
          name: "Signup in progress",
        }),
      ).toBeInTheDocument();
    });
  });

  describe("modal interaction", () => {
    it("fires the action when Continue is clicked and canEnable is true", async () => {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      });
      mockUserActivation(false);

      const onReady = vi.fn();

      function ModalConsumer() {
        const { signupAndRun, registerAction } = useSignupAction();

        return (
          <div>
            <button
              data-testid="register-disabled"
              onClick={() =>
                registerAction({
                  product: openshiftProduct,
                  canEnable: false,
                  onReady,
                })
              }
            />
            <button
              data-testid="register-enabled"
              onClick={() =>
                registerAction({
                  product: openshiftProduct,
                  canEnable: true,
                  onReady,
                })
              }
            />
            <button
              data-testid="run"
              onClick={() => signupAndRun(openshiftProduct.type)}
            />
          </div>
        );
      }

      const { setPhase } = renderAuthenticated(
        { userSignupPhase: UserSignupPhase.NOT_STARTED },
        <ModalConsumer />,
      );

      // Register with canEnable: false and trigger signup.
      await user.click(screen.getByTestId("register-disabled"));
      await user.click(screen.getByTestId("run"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      // Modal should be open.
      const dialog = screen.getByRole("dialog", {
        name: "Signup in progress",
      });
      expect(dialog).toBeInTheDocument();

      // The continue button should be disabled because canEnable
      // is false.
      const continueButton = within(dialog).getByRole("button", {
        name: /Try OpenShift/,
      });
      expect(continueButton).toBeDisabled();

      // Phase advances to READY and the card re-registers with
      // canEnable: true.
      await act(async () => {
        setPhase(UserSignupPhase.READY);
      });
      await user.click(screen.getByTestId("register-enabled"));

      await waitFor(() => {
        expect(
          within(dialog).getByRole("button", {
            name: /Try OpenShift/,
          }),
        ).toBeEnabled();
      });

      await user.click(
        within(dialog).getByRole("button", {
          name: /Try OpenShift/,
        }),
      );

      expect(onReady).toHaveBeenCalledTimes(1);
    });

    it("tags the continuation button only when the action can open", async () => {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      });
      mockUserActivation(false);
      const clickAnalytics = catalogProductOpenAttributes(openshiftProduct);

      function ModalConsumer() {
        const { signupAndRun, registerAction } = useSignupAction();

        return (
          <div>
            <button
              data-testid="register-disabled"
              onClick={() =>
                registerAction({
                  product: openshiftProduct,
                  canEnable: false,
                  clickAnalytics,
                  onReady: () => {},
                })
              }
            />
            <button
              data-testid="register-enabled"
              onClick={() =>
                registerAction({
                  product: openshiftProduct,
                  canEnable: true,
                  clickAnalytics,
                  onReady: () => {},
                })
              }
            />
            <button
              data-testid="register-without-analytics"
              onClick={() =>
                registerAction({
                  product: openshiftProduct,
                  canEnable: true,
                  onReady: () => {},
                })
              }
            />
            <button
              data-testid="run"
              onClick={() => signupAndRun(openshiftProduct.type)}
            />
          </div>
        );
      }

      const { setPhase } = renderAuthenticated(
        { userSignupPhase: UserSignupPhase.NOT_STARTED },
        <ModalConsumer />,
      );

      await user.click(screen.getByTestId("register-disabled"));
      await user.click(screen.getByTestId("run"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      const progressDialog = screen.getByRole("dialog", {
        name: "Signup in progress",
      });
      expect(
        within(progressDialog).getByRole("button", { name: /Try OpenShift/ }),
      ).not.toHaveAttribute("data-analytics-text");

      await act(async () => {
        setPhase(UserSignupPhase.READY);
      });
      await user.click(screen.getByTestId("register-enabled"));

      await waitFor(() => {
        const completed = screen.getByRole("dialog", {
          name: "Signup completed",
        });
        const continueButton = within(completed).getByRole("button", {
          name: /Try OpenShift/,
        });
        expect(continueButton).toBeEnabled();
        expect(continueButton).toHaveAttribute(
          "data-analytics-text",
          "OpenShift",
        );
        expect(continueButton).toHaveAttribute(
          "data-analytics-offerid",
          clickAnalytics["data-analytics-offerid"],
        );
      });

      await user.click(screen.getByTestId("register-without-analytics"));

      expect(
        within(
          screen.getByRole("dialog", { name: "Signup completed" }),
        ).getByRole("button", { name: /Try OpenShift/ }),
      ).not.toHaveAttribute("data-analytics-text");
    });

    it("closes the modal and resets progress when the user dismisses it", async () => {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      });
      mockUserActivation(false);

      renderAuthenticated({
        userSignupPhase: UserSignupPhase.NOT_STARTED,
      });

      await user.click(screen.getByTestId("signup-and-run"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SIGNUP_WATCHER_INTERVAL_MS);
      });

      expect(
        screen.getByRole("dialog", {
          name: "Signup in progress",
        }),
      ).toBeInTheDocument();

      // Close the modal via the X button.
      await user.click(screen.getByRole("button", { name: "Close" }));

      expect(
        screen.queryByRole("dialog", {
          name: "Signup in progress",
        }),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("in-progress").textContent).toBe("false");
    });
  });

  describe("cleanup", () => {
    it("clears the watcher interval on unmount", async () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      const { unmount } = renderAuthenticated({
        userSignupPhase: UserSignupPhase.NOT_STARTED,
      });

      fireEvent.click(screen.getByTestId("signup-and-run"));

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
