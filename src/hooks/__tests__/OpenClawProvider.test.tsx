import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
  cleanupWorkspaceEnvironment,
  createOpenClaw,
  createSpaceRequest,
  createWorkspaceKubeconfig,
  deleteOpenClawCR,
  deleteSpaceRequest,
  getOpenClaw,
  getSpaceRequest,
  setupWorkspaceEnvironment,
  unIdleOpenClaw,
} from "../../api/openclaw";
import { ApiError } from "../../error/ApiError";
import { UserFacingError } from "../../error/UserFacingError";
import { MOCK_PROXY_URL, readyUserFixture } from "../../mocks/fixtures";
import {
  clawSpaceRequest,
  openClawFixture,
  openClawIdledFixture,
  openClawProvisioning,
} from "../../mocks/fixtures/openclaw-fixtures";
import type { OpenClawCR, User } from "../../types";
import { OpenClawStatus } from "../../utils/openclaw-utils";
import { useOpenClawContext } from "../OpenClawContext";
import { OpenClawProvider } from "../OpenClawProvider";
import type { UserContextType } from "../UserContext";
import { UserContext, UserSignupPhase } from "../UserContext";

vi.mock("../../api/openclaw");
vi.mock("../../utils/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const mockedGetSpaceRequest = vi.mocked(getSpaceRequest);
const mockedCreateSpaceRequest = vi.mocked(createSpaceRequest);
const mockedDeleteSpaceRequest = vi.mocked(deleteSpaceRequest);
const mockedGetOpenClaw = vi.mocked(getOpenClaw);
const mockedUnIdleOpenClaw = vi.mocked(unIdleOpenClaw);
const mockedDeleteOpenClawCR = vi.mocked(deleteOpenClawCR);
const mockedCleanupWorkspaceEnvironment = vi.mocked(
  cleanupWorkspaceEnvironment,
);
const mockedSetupWorkspaceEnvironment = vi.mocked(setupWorkspaceEnvironment);
const mockedCreateWorkspaceKubeconfig = vi.mocked(createWorkspaceKubeconfig);
const mockedCreateOpenClaw = vi.mocked(createOpenClaw);

function makeUserContext(
  overrides: Partial<UserContextType> = {},
): UserContextType {
  return {
    user: readyUserFixture,
    userSignupPhase: UserSignupPhase.READY,
    refetchUserData: vi.fn(),
    signupUser: vi.fn(),
    ...overrides,
  };
}

/**
 * Test consumer that exposes context values via testids and buttons so we
 * can drive the provider's callbacks from the test.
 */
function TestConsumer() {
  const ctx = useOpenClawContext();
  const [handleError, setHandleError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [provisionError, setProvisionError] = useState("");

  return (
    <div>
      <span data-testid="status">{ctx.openclawStatus}</span>
      <span data-testid="ui-link">{ctx.openclawUILink ?? ""}</span>
      <span data-testid="provisioning-error">
        {ctx.provisioningError?.technicalDetails ?? ""}
      </span>
      <span data-testid="deletion-error">
        {ctx.deletionError?.technicalDetails ?? ""}
      </span>
      <span data-testid="provisioning-error-title">
        {ctx.provisioningError?.title ?? ""}
      </span>
      <button
        data-testid="start-provisioning"
        onClick={async () => {
          try {
            await ctx.startProvisioning(
              [
                {
                  provider: {
                    id: "cred",
                    name: "cred",
                    provider: "cred",
                    category: "custom",
                    credentialType: "apiKey",
                    fields: [],
                  },
                  values: { "api-key": "token" },
                },
              ],
              false,
            );
          } catch (e) {
            setProvisionError(
              e instanceof UserFacingError ? "UserFacingError" : "other",
            );
          }
        }}
      />
      <button
        data-testid="unidle-instance"
        onClick={async () => {
          try {
            await ctx.unidleInstance();
          } catch (e) {
            setHandleError(
              e instanceof UserFacingError ? "UserFacingError" : "other",
            );
          }
        }}
      />
      <button
        data-testid="delete-instance"
        onClick={async () => {
          try {
            await ctx.deleteInstance();
          } catch (e) {
            setDeleteError(
              e instanceof UserFacingError ? "UserFacingError" : "other",
            );
          }
        }}
      />
      <button
        data-testid="reset-provisioning-error"
        onClick={ctx.clearProvisioningError}
      />
      <button
        data-testid="reset-deletion-error"
        onClick={ctx.clearDeletionError}
      />
      <span data-testid="handle-error">{handleError}</span>
      <span data-testid="delete-error">{deleteError}</span>
      <span data-testid="provision-error">{provisionError}</span>
    </div>
  );
}

function renderProvider(userCtxOverrides: Partial<UserContextType> = {}) {
  const userCtx = makeUserContext(userCtxOverrides);
  const utils = render(
    <UserContext.Provider value={userCtx}>
      <OpenClawProvider>
        <TestConsumer />
      </OpenClawProvider>
    </UserContext.Provider>,
  );
  return { ...utils, userCtx };
}

function Wrapper({ userCtx }: { userCtx: UserContextType }) {
  return (
    <UserContext.Provider value={userCtx}>
      <OpenClawProvider>
        <TestConsumer />
      </OpenClawProvider>
    </UserContext.Provider>
  );
}

describe("OpenClawProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // NOOP provider routing
  // ---------------------------------------------------------------------------

  describe("NOOP provider routing", () => {
    it("uses the NOOP provider when user is undefined", async () => {
      renderProvider({ user: undefined });

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(mockedGetSpaceRequest).not.toHaveBeenCalled();
      expect(screen.getByTestId("status").textContent).toBe(
        OpenClawStatus.USER_NOT_READY,
      );
    });

    it("uses the NOOP provider when proxyURL is missing", async () => {
      const userWithoutProxy: User = {
        ...readyUserFixture,
        proxyURL: undefined,
      };

      renderProvider({ user: userWithoutProxy });

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(mockedGetSpaceRequest).not.toHaveBeenCalled();
      expect(screen.getByTestId("status").textContent).toBe(
        OpenClawStatus.USER_NOT_READY,
      );
    });

    it("uses the NOOP provider when defaultUserNamespace is missing", async () => {
      const userWithoutNamespace: User = {
        ...readyUserFixture,
        defaultUserNamespace: undefined,
      };

      renderProvider({ user: userWithoutNamespace });

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(mockedGetSpaceRequest).not.toHaveBeenCalled();
      expect(screen.getByTestId("status").textContent).toBe(
        OpenClawStatus.USER_NOT_READY,
      );
    });

    it("uses the NOOP provider when apiEndpoint is missing", async () => {
      const userWithoutEndpoint: User = {
        ...readyUserFixture,
        apiEndpoint: undefined,
      };

      renderProvider({ user: userWithoutEndpoint });

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(mockedGetSpaceRequest).not.toHaveBeenCalled();
      expect(screen.getByTestId("status").textContent).toBe(
        OpenClawStatus.USER_NOT_READY,
      );
    });

    it("NOOP unidleInstance resolves without error", async () => {
      renderProvider({ user: undefined });

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("handle-error").textContent).toBe("");
    });

    it("NOOP deleteOpenClaw rejects with an error", async () => {
      renderProvider({ user: undefined });

      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("delete-error").textContent).toBe("other"),
      );
    });

    it("NOOP startProvisioning resolves without error", async () => {
      renderProvider({ user: undefined });

      await act(async () => {
        screen.getByTestId("start-provisioning").click();
      });

      expect(screen.getByTestId("provision-error").textContent).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Initial fetch on mount
  // ---------------------------------------------------------------------------

  describe("initial fetch on mount", () => {
    it("sets status to NEW when no SpaceRequest exists", async () => {
      mockedGetSpaceRequest.mockResolvedValue(undefined);

      renderProvider();

      await waitFor(() => {
        expect(mockedGetSpaceRequest).toHaveBeenCalledWith(
          MOCK_PROXY_URL,
          readyUserFixture.defaultUserNamespace,
        );
      });

      expect(screen.getByTestId("status").textContent).toBe(OpenClawStatus.NEW);
    });

    it("sets status to READY when SpaceRequest and OpenClaw CR are ready", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawFixture);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.READY,
        ),
      );
      expect(screen.getByTestId("ui-link").textContent).toContain(
        "openclaw.apps.example.com",
      );
    });

    it("sets status to PROVISIONING when OpenClaw CR is provisioning", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawProvisioning);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.PROVISIONING,
        ),
      );
    });

    it("sets status to IDLED when OpenClaw CR has idle spec", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawIdledFixture);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.IDLED,
        ),
      );
    });

    it("sets provisioning error details when the initial fetch fails", async () => {
      mockedGetSpaceRequest.mockRejectedValue(
        new ApiError("fetch failed", 500, "Internal Server Error"),
      );

      renderProvider();

      await waitFor(() =>
        expect(
          screen.getByTestId("provisioning-error").textContent,
        ).toBeTruthy(),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // startProvisioning
  // ---------------------------------------------------------------------------

  describe("startProvisioning", () => {
    it("creates a SpaceRequest and transitions to PROVISIONING", async () => {
      mockedGetSpaceRequest.mockResolvedValue(undefined);
      mockedCreateSpaceRequest.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetSpaceRequest).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("start-provisioning").click();
      });

      await waitFor(() =>
        expect(mockedCreateSpaceRequest).toHaveBeenCalledWith(
          MOCK_PROXY_URL,
          readyUserFixture.defaultUserNamespace,
        ),
      );
      expect(screen.getByTestId("status").textContent).toBe(
        OpenClawStatus.PROVISIONING,
      );
    });

    it("throws UserFacingError when creating SpaceRequest fails", async () => {
      mockedGetSpaceRequest.mockResolvedValue(undefined);
      mockedCreateSpaceRequest.mockRejectedValue(
        new ApiError("create failed", 500, "Internal Server Error"),
      );

      renderProvider();
      await waitFor(() => expect(mockedGetSpaceRequest).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("start-provisioning").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("provision-error").textContent).toBe(
          "UserFacingError",
        ),
      );
      expect(screen.getByTestId("status").textContent).toBe(
        OpenClawStatus.FAILED,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // unidleInstance
  // ---------------------------------------------------------------------------

  describe("unidleInstance", () => {
    it("unidles the instance and transitions to UNIDLING", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawIdledFixture);
      mockedUnIdleOpenClaw.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.IDLED,
        ),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      await waitFor(() => expect(mockedUnIdleOpenClaw).toHaveBeenCalled());
      expect(screen.getByTestId("status").textContent).toBe(
        OpenClawStatus.UNIDLING,
      );
    });

    it("throws UserFacingError when the unIdleOpenClaw API call fails", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawIdledFixture);
      mockedUnIdleOpenClaw.mockRejectedValue(
        new ApiError("unidle failed", 500, "Internal Server Error"),
      );

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.IDLED,
        ),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("handle-error").textContent).toBe(
          "UserFacingError",
        ),
      );
    });

    it("throws UserFacingError when the namespace ref is not set", async () => {
      mockedGetSpaceRequest.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.NEW,
        ),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("handle-error").textContent).toBe(
          "UserFacingError",
        ),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // deleteOpenClaw
  // ---------------------------------------------------------------------------

  describe("deleteOpenClaw", () => {
    it("deletes the CR, SpaceRequest, and cleans up workspace", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawFixture);
      mockedDeleteOpenClawCR.mockResolvedValue(undefined);
      mockedDeleteSpaceRequest.mockResolvedValue(undefined);
      mockedCleanupWorkspaceEnvironment.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.READY,
        ),
      );

      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() => {
        expect(mockedDeleteOpenClawCR).toHaveBeenCalled();
        expect(mockedDeleteSpaceRequest).toHaveBeenCalledWith(
          MOCK_PROXY_URL,
          readyUserFixture.defaultUserNamespace,
        );
        expect(mockedCleanupWorkspaceEnvironment).toHaveBeenCalledWith(
          MOCK_PROXY_URL,
          readyUserFixture.defaultUserNamespace,
        );
      });
    });

    it("sets status to DELETING during deletion", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawFixture);

      let resolveDelete: () => void;
      mockedDeleteOpenClawCR.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          }),
      );
      mockedDeleteSpaceRequest.mockResolvedValue(undefined);
      mockedCleanupWorkspaceEnvironment.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.READY,
        ),
      );

      act(() => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.DELETING,
        ),
      );

      await act(async () => {
        resolveDelete!();
      });
    });

    it("sets deletion error details when deletion partially fails", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawFixture);
      mockedDeleteOpenClawCR.mockRejectedValue(new Error("delete CR failed"));
      mockedDeleteSpaceRequest.mockResolvedValue(undefined);
      mockedCleanupWorkspaceEnvironment.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.READY,
        ),
      );

      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("deletion-error").textContent).toBeTruthy(),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------

  describe("polling", () => {
    it("polls for status when provisioning and stops when ready", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw
        .mockResolvedValueOnce(openClawProvisioning)
        .mockResolvedValue(openClawFixture);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.PROVISIONING,
        ),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.READY,
        ),
      );
    });

    it("polls during deletion and transitions to NEW when SpaceRequest disappears", async () => {
      mockedGetSpaceRequest
        .mockResolvedValueOnce(clawSpaceRequest)
        .mockResolvedValue(undefined);
      mockedGetOpenClaw.mockResolvedValue(openClawFixture);
      mockedDeleteOpenClawCR.mockResolvedValue(undefined);
      mockedDeleteSpaceRequest.mockResolvedValue(undefined);
      mockedCleanupWorkspaceEnvironment.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.READY,
        ),
      );

      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.DELETING,
        ),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.NEW,
        ),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Provider transition (NOOP → Connected)
  // ---------------------------------------------------------------------------

  describe("provider transition (NOOP → Connected)", () => {
    it("switches from NOOP to Connected when user data becomes available", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawFixture);

      const { rerender } = render(
        <Wrapper userCtx={makeUserContext({ user: undefined })} />,
      );

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(mockedGetSpaceRequest).not.toHaveBeenCalled();
      expect(screen.getByTestId("status").textContent).toBe(
        OpenClawStatus.USER_NOT_READY,
      );

      rerender(<Wrapper userCtx={makeUserContext()} />);

      await waitFor(() => {
        expect(mockedGetSpaceRequest).toHaveBeenCalledWith(
          MOCK_PROXY_URL,
          readyUserFixture.defaultUserNamespace,
        );
      });

      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.READY,
        ),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // resetOpenClawDeletionErrorDetails
  // ---------------------------------------------------------------------------

  describe("resetOpenClawDeletionErrorDetails", () => {
    it("clears the error and triggers a refetch", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawFixture);
      mockedDeleteOpenClawCR.mockRejectedValue(new Error("delete CR failed"));
      mockedDeleteSpaceRequest.mockResolvedValue(undefined);
      mockedCleanupWorkspaceEnvironment.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.READY,
        ),
      );

      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("deletion-error").textContent).toBeTruthy(),
      );

      const callCountBefore = mockedGetSpaceRequest.mock.calls.length;
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawFixture);

      await act(async () => {
        screen.getByTestId("reset-deletion-error").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("deletion-error").textContent).toBe("");
        expect(mockedGetSpaceRequest.mock.calls.length).toBeGreaterThan(
          callCountBefore,
        );
      });
    });
  });

  // ---------------------------------------------------------------------------
  // resetOpenClawProvisioningErrorDetails
  // ---------------------------------------------------------------------------

  describe("resetOpenClawProvisioningErrorDetails", () => {
    it("clears the error and triggers a refetch", async () => {
      mockedGetSpaceRequest.mockRejectedValueOnce(
        new ApiError("fetch failed", 500, "Internal Server Error"),
      );

      renderProvider();

      await waitFor(() =>
        expect(
          screen.getByTestId("provisioning-error").textContent,
        ).toBeTruthy(),
      );

      const callCountBefore = mockedGetSpaceRequest.mock.calls.length;
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawFixture);

      await act(async () => {
        screen.getByTestId("reset-provisioning-error").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("provisioning-error").textContent).toBe("");
        expect(mockedGetSpaceRequest.mock.calls.length).toBeGreaterThan(
          callCountBefore,
        );
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Deletion sets status to FAILED
  // ---------------------------------------------------------------------------

  describe("deletion error sets status to FAILED", () => {
    it("sets status to FAILED when deletion partially fails", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawFixture);
      mockedDeleteOpenClawCR.mockRejectedValue(new Error("delete CR failed"));
      mockedDeleteSpaceRequest.mockResolvedValue(undefined);
      mockedCleanupWorkspaceEnvironment.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.READY,
        ),
      );

      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.FAILED,
        );
        expect(screen.getByTestId("deletion-error").textContent).toBeTruthy();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Multi-phase provisioning flow
  // ---------------------------------------------------------------------------

  describe("multi-phase provisioning flow", () => {
    it("provisions through all phases: space request → instance → ready", async () => {
      mockedGetSpaceRequest.mockResolvedValueOnce(undefined);
      mockedCreateSpaceRequest.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetSpaceRequest).toHaveBeenCalled());
      expect(screen.getByTestId("status").textContent).toBe(OpenClawStatus.NEW);

      await act(async () => {
        screen.getByTestId("start-provisioning").click();
      });

      expect(screen.getByTestId("status").textContent).toBe(
        OpenClawStatus.PROVISIONING,
      );

      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedSetupWorkspaceEnvironment.mockResolvedValue(undefined);
      mockedCreateWorkspaceKubeconfig.mockResolvedValue(undefined);
      mockedCreateOpenClaw.mockResolvedValue(undefined);
      mockedGetOpenClaw.mockResolvedValue(openClawFixture);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      await waitFor(() => {
        expect(mockedSetupWorkspaceEnvironment).toHaveBeenCalled();
        expect(mockedCreateWorkspaceKubeconfig).toHaveBeenCalled();
        expect(mockedCreateOpenClaw).toHaveBeenCalled();
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.READY,
        );
      });
    });

    it("stays in PROVISIONING when the space request namespace is not resolved yet", async () => {
      mockedGetSpaceRequest.mockResolvedValueOnce(undefined);
      mockedCreateSpaceRequest.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetSpaceRequest).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("start-provisioning").click();
      });

      expect(screen.getByTestId("status").textContent).toBe(
        OpenClawStatus.PROVISIONING,
      );

      const pendingSpaceRequest = {
        metadata: { name: "claw" },
        spec: { tierName: "claw" },
        status: {
          conditions: [
            {
              type: "Ready",
              message: "",
              reason: "Provisioning",
              status: "False",
            },
          ],
        },
      };
      mockedGetSpaceRequest.mockResolvedValue(pendingSpaceRequest);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      expect(screen.getByTestId("status").textContent).toBe(
        OpenClawStatus.PROVISIONING,
      );
      expect(mockedSetupWorkspaceEnvironment).not.toHaveBeenCalled();
    });

    it("sets provisioningError when setupWorkspaceEnvironment fails", async () => {
      mockedGetSpaceRequest.mockResolvedValueOnce(undefined);
      mockedCreateSpaceRequest.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetSpaceRequest).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("start-provisioning").click();
      });

      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedSetupWorkspaceEnvironment.mockRejectedValue(
        new Error("workspace setup failed"),
      );
      mockedCleanupWorkspaceEnvironment.mockResolvedValue(undefined);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.FAILED,
        );
        expect(screen.getByTestId("provisioning-error-title").textContent).toBe(
          "Unable to provision your OpenClaw instance",
        );
      });
    });

    it("sets provisioningError when createWorkspaceKubeconfig fails", async () => {
      mockedGetSpaceRequest.mockResolvedValueOnce(undefined);
      mockedCreateSpaceRequest.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetSpaceRequest).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("start-provisioning").click();
      });

      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedSetupWorkspaceEnvironment.mockResolvedValue(undefined);
      mockedCreateWorkspaceKubeconfig.mockRejectedValue(
        new ApiError("kubeconfig failed", 500, "Internal Server Error"),
      );
      mockedCleanupWorkspaceEnvironment.mockResolvedValue(undefined);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.FAILED,
        );
        expect(screen.getByTestId("provisioning-error-title").textContent).toBe(
          "Unable to provision your OpenClaw instance",
        );
      });
    });

    it("sets provisioningError when createOpenClaw fails", async () => {
      mockedGetSpaceRequest.mockResolvedValueOnce(undefined);
      mockedCreateSpaceRequest.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetSpaceRequest).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("start-provisioning").click();
      });

      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedSetupWorkspaceEnvironment.mockResolvedValue(undefined);
      mockedCreateWorkspaceKubeconfig.mockResolvedValue(undefined);
      mockedCreateOpenClaw.mockRejectedValue(
        new ApiError("create failed", 500, "Internal Server Error"),
      );
      mockedCleanupWorkspaceEnvironment.mockResolvedValue(undefined);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.FAILED,
        );
        expect(screen.getByTestId("provisioning-error-title").textContent).toBe(
          "Unable to provision your OpenClaw instance",
        );
      });
    });

    it("attempts cleanup when a provisioning step fails", async () => {
      mockedGetSpaceRequest.mockResolvedValueOnce(undefined);
      mockedCreateSpaceRequest.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetSpaceRequest).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("start-provisioning").click();
      });

      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedSetupWorkspaceEnvironment.mockRejectedValue(
        new Error("setup failed"),
      );
      mockedCleanupWorkspaceEnvironment.mockResolvedValue(undefined);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      await waitFor(() => {
        expect(mockedCleanupWorkspaceEnvironment).toHaveBeenCalledWith(
          MOCK_PROXY_URL,
          readyUserFixture.defaultUserNamespace,
        );
      });
    });

    it("sets provisioningError when CR has a failure condition during polling", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValueOnce(openClawProvisioning);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.PROVISIONING,
        ),
      );

      const failedCR: OpenClawCR = {
        metadata: {
          name: "claw",
          creationTimestamp: "2025-01-15T00:00:00Z",
        },
        spec: { idle: false },
        status: {
          conditions: [
            {
              type: "Failure",
              status: "True",
              reason: "ReconciliationFailed",
              message: "Something went wrong",
            },
          ],
        },
      };
      mockedGetOpenClaw.mockResolvedValue(failedCR);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.FAILED,
        );
        expect(screen.getByTestId("provisioning-error-title").textContent).toBe(
          "Unable to provision your OpenClaw instance",
        );
      });
    });
  });

  // ---------------------------------------------------------------------------
  // UI link with device pairing path
  // ---------------------------------------------------------------------------

  describe("UI link", () => {
    it("appends device pairing path when disableDevicePairing is not set", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawFixture);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("ui-link").textContent).toContain(
          "/integration/device-pairing/",
        ),
      );
    });

    it("does not append device pairing path when disableDevicePairing is true", async () => {
      const crWithDisabledPairing: OpenClawCR = {
        ...openClawFixture,
        spec: {
          ...openClawFixture.spec,
          auth: { disableDevicePairing: true },
        },
      };
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(crWithDisabledPairing);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("ui-link").textContent).not.toContain(
          "/integration/device-pairing/",
        ),
      );
      expect(screen.getByTestId("ui-link").textContent).toContain(
        "openclaw.apps.example.com",
      );
    });
  });
});
