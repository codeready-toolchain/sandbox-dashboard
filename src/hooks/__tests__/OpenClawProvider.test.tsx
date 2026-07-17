import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
  cleanupWorkspaceEnvironment,
  createSpaceRequest,
  deleteOpenClawCR,
  deleteSpaceRequest,
  getOpenClaw,
  getSpaceRequest,
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
  openClawTerminatingSpaceRequest,
} from "../../mocks/fixtures/openclaw-fixtures";
import type { User } from "../../types";
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
  const [handleResult, setHandleResult] = useState("");
  const [handleError, setHandleError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  return (
    <div>
      <span data-testid="status">{ctx.openclawStatus}</span>
      <span data-testid="ui-link">{ctx.openclawUILink ?? ""}</span>
      <span data-testid="provisioning-error">
        {ctx.openClawProvisioningErrorDetails ?? ""}
      </span>
      <span data-testid="deletion-error">
        {ctx.openClawDeletionErrorDetails ?? ""}
      </span>
      <button
        data-testid="handle-instance"
        onClick={async () => {
          try {
            const result = await ctx.handleOpenClawInstance(
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
            setHandleResult(String(result));
          } catch (e) {
            setHandleError(
              e instanceof UserFacingError ? "UserFacingError" : "other",
            );
          }
        }}
      />
      <button
        data-testid="handle-instance-no-creds"
        onClick={async () => {
          try {
            const result = await ctx.handleOpenClawInstance();
            setHandleResult(String(result));
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
            await ctx.deleteOpenClaw();
          } catch (e) {
            setDeleteError(
              e instanceof UserFacingError ? "UserFacingError" : "other",
            );
          }
        }}
      />
      <button
        data-testid="reset-provisioning-error"
        onClick={ctx.resetOpenClawProvisioningErrorDetails}
      />
      <button
        data-testid="reset-deletion-error"
        onClick={ctx.resetOpenClawDeletionErrorDetails}
      />
      <span data-testid="handle-result">{handleResult}</span>
      <span data-testid="handle-error">{handleError}</span>
      <span data-testid="delete-error">{deleteError}</span>
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

    it("NOOP handleOpenClawInstance returns false", async () => {
      renderProvider({ user: undefined });

      await act(async () => {
        screen.getByTestId("handle-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("handle-result").textContent).toBe("false"),
      );
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

    it("sets status to TERMINATING when SpaceRequest is terminating", async () => {
      mockedGetSpaceRequest.mockResolvedValue(openClawTerminatingSpaceRequest);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.TERMINATING,
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
  // handleOpenClawInstance
  // ---------------------------------------------------------------------------

  describe("handleOpenClawInstance", () => {
    it("creates a SpaceRequest when status is NEW and credentials are provided", async () => {
      mockedGetSpaceRequest.mockResolvedValue(undefined);
      mockedCreateSpaceRequest.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetSpaceRequest).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("handle-instance").click();
      });

      await waitFor(() =>
        expect(mockedCreateSpaceRequest).toHaveBeenCalledWith(
          MOCK_PROXY_URL,
          readyUserFixture.defaultUserNamespace,
        ),
      );
    });

    it("returns false when status is NEW and no credentials are provided", async () => {
      mockedGetSpaceRequest.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetSpaceRequest).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("handle-instance-no-creds").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("handle-result").textContent).toBe("false"),
      );
      expect(mockedCreateSpaceRequest).not.toHaveBeenCalled();
    });

    it("returns true when status is already READY", async () => {
      mockedGetSpaceRequest.mockResolvedValue(clawSpaceRequest);
      mockedGetOpenClaw.mockResolvedValue(openClawFixture);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.READY,
        ),
      );

      await act(async () => {
        screen.getByTestId("handle-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("handle-result").textContent).toBe("true"),
      );
    });

    it("unidles the instance when status is IDLED", async () => {
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
        screen.getByTestId("handle-instance").click();
      });

      await waitFor(() => expect(mockedUnIdleOpenClaw).toHaveBeenCalled());
      expect(screen.getByTestId("status").textContent).toBe(
        OpenClawStatus.PROVISIONING,
      );
    });

    it("throws UserFacingError when unidling fails", async () => {
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
        screen.getByTestId("handle-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("handle-error").textContent).toBe(
          "UserFacingError",
        ),
      );
    });

    it("throws UserFacingError when the initial state fetch fails unexpectedly", async () => {
      mockedGetSpaceRequest
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(
          new ApiError("fetch failed", 500, "Internal Server Error"),
        );

      renderProvider();
      await waitFor(() => expect(mockedGetSpaceRequest).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("handle-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("handle-error").textContent).toBe(
          "UserFacingError",
        ),
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
        screen.getByTestId("handle-instance").click();
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
  // handleOpenClawInstance — DELETING status
  // ---------------------------------------------------------------------------

  describe("handleOpenClawInstance with DELETING status", () => {
    it("returns false when status is DELETING", async () => {
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

      // Trigger deletion to set status to DELETING.
      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.DELETING,
        ),
      );

      // Now the SpaceRequest is gone (deletion succeeded), so
      // handleOpenClawInstance should get fresh state from the API.
      // With no SpaceRequest, currentStatus becomes NEW and the code
      // proceeds to the "no credentials" early return.
      mockedGetSpaceRequest.mockResolvedValue(undefined);

      await act(async () => {
        screen.getByTestId("handle-instance-no-creds").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("handle-result").textContent).toBe("false"),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // handleOpenClawInstance — TERMINATING status
  // ---------------------------------------------------------------------------

  describe("handleOpenClawInstance with TERMINATING status", () => {
    it("stores pending credentials and returns true when status is TERMINATING", async () => {
      mockedGetSpaceRequest.mockResolvedValue(openClawTerminatingSpaceRequest);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.TERMINATING,
        ),
      );

      await act(async () => {
        screen.getByTestId("handle-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("handle-result").textContent).toBe("true"),
      );
      expect(screen.getByTestId("status").textContent).toBe(
        OpenClawStatus.TERMINATING,
      );
    });

    it("returns false when status is TERMINATING but no credentials provided", async () => {
      mockedGetSpaceRequest.mockResolvedValue(openClawTerminatingSpaceRequest);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status").textContent).toBe(
          OpenClawStatus.TERMINATING,
        ),
      );

      await act(async () => {
        screen.getByTestId("handle-instance-no-creds").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("handle-result").textContent).toBe("false"),
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

      // Trigger deletion that partially fails.
      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("deletion-error").textContent).toBeTruthy(),
      );

      // Reset the error and verify refetch is triggered.
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

      // Reset the error and verify refetch is triggered.
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
});
