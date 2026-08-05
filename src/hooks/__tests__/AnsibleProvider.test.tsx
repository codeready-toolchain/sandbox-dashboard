import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";

import { createAAP, deleteAAPCR, getAAP, unIdleAAP } from "../../api/aap";
import {
  deletePVCsForSTS,
  deleteSecretsAndPVCs,
  getDeployments,
  getSecret,
  getStatefulSets,
} from "../../api/kube";
import { ApiError } from "../../error/ApiError";
import { UserFacingError } from "../../error/UserFacingError";
import {
  aapFailedFixture,
  aapIdledFixture,
  aapIdledWithFailureFixture,
  aapProvisioningFixture,
  aapReadyFixture,
  aapRecoverableFailureFixture,
  deploymentFixture,
  MOCK_PROXY_URL,
  readyUserFixture,
  secretFixture,
  statefulSetFixture,
} from "../../mocks/fixtures";
import type { AAPCR, User } from "../../types";
import { AAPInstanceErrorType } from "../../utils/aap-utils";
import { useAnsibleContext } from "../AnsibleContext";
import { AnsibleProvider } from "../AnsibleProvider";
import { NotificationProvider } from "../NotificationProvider";
import type { UserContextType } from "../UserContext";
import { UserContext, UserSignupPhase } from "../UserContext";

vi.mock("../../api/aap");
vi.mock("../../api/kube");
vi.mock("../../utils/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("../../utils/retry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/retry")>();
  return {
    ...actual,
    withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  };
});

const mockedGetAAP = vi.mocked(getAAP);
const mockedCreateAAP = vi.mocked(createAAP);
const mockedUnIdleAAP = vi.mocked(unIdleAAP);
const mockedDeleteAAPCR = vi.mocked(deleteAAPCR);
const mockedGetSecret = vi.mocked(getSecret);
const mockedGetDeployments = vi.mocked(getDeployments);
const mockedGetStatefulSets = vi.mocked(getStatefulSets);
const mockedDeleteSecretsAndPVCs = vi.mocked(deleteSecretsAndPVCs);
const mockedDeletePVCsForSTS = vi.mocked(deletePVCsForSTS);

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
  const ctx = useAnsibleContext();
  const [provisionError, setProvisionError] = useState("");
  const [unidleError, setUnidleError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [credsResult, setCredsResult] = useState("");
  const [credsError, setCredsError] = useState("");

  return (
    <div>
      <span data-testid="status-kind">{ctx.instanceStatus.kind}</span>
      <span data-testid="status-error-type">
        {ctx.instanceStatus.kind === "error"
          ? ctx.instanceStatus.errorType
          : ""}
      </span>
      <button
        data-testid="provision-instance"
        onClick={async () => {
          try {
            await ctx.provisionInstance();
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
            setUnidleError(
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
        data-testid="fetch-credentials"
        onClick={async () => {
          try {
            const creds = await ctx.fetchInstanceCredentials();
            setCredsResult(JSON.stringify(creds));
          } catch (e) {
            setCredsError(e instanceof UserFacingError ? e.title : "error");
          }
        }}
      />
      <span data-testid="provision-error">{provisionError}</span>
      <span data-testid="unidle-error">{unidleError}</span>
      <span data-testid="delete-error">{deleteError}</span>
      <span data-testid="creds-result">{credsResult}</span>
      <span data-testid="creds-error">{credsError}</span>
    </div>
  );
}

function renderProvider(userCtxOverrides: Partial<UserContextType> = {}) {
  const userCtx = makeUserContext(userCtxOverrides);
  const utils = render(
    <NotificationProvider>
      <UserContext.Provider value={userCtx}>
        <AnsibleProvider>
          <TestConsumer />
        </AnsibleProvider>
      </UserContext.Provider>
    </NotificationProvider>,
  );
  return { ...utils, userCtx };
}

function Wrapper({ userCtx }: { userCtx: UserContextType }) {
  return (
    <NotificationProvider>
      <UserContext.Provider value={userCtx}>
        <AnsibleProvider>
          <TestConsumer />
        </AnsibleProvider>
      </UserContext.Provider>
    </NotificationProvider>
  );
}

describe("AnsibleProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedGetDeployments.mockResolvedValue(deploymentFixture);
    mockedGetStatefulSets.mockResolvedValue(statefulSetFixture);
    mockedDeleteSecretsAndPVCs.mockResolvedValue(undefined);
    mockedDeletePVCsForSTS.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Mount / initial fetch
  // ---------------------------------------------------------------------------

  describe("initial fetch on mount", () => {
    it("starts with 'initialFetch' status before the API call resolves", () => {
      mockedGetAAP.mockImplementation(() => new Promise(() => {}));

      renderProvider();

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "initialFetch",
      );
    });

    it("fetches the AAP CR on mount and sets 'new' when no instance exists", async () => {
      mockedGetAAP.mockResolvedValue(undefined);

      renderProvider();

      await waitFor(() => {
        expect(mockedGetAAP).toHaveBeenCalledWith(
          MOCK_PROXY_URL,
          readyUserFixture.defaultUserNamespace,
        );
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("new");
    });

    it("sets 'ready' when getAAP returns a successful instance", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );
    });

    it("sets 'provisioning' when getAAP returns a running instance", async () => {
      mockedGetAAP.mockResolvedValue(aapProvisioningFixture.items[0]);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe(
          "provisioning",
        ),
      );
    });

    it("sets 'idled' when getAAP returns an idled instance", async () => {
      mockedGetAAP.mockResolvedValue(aapIdledFixture.items[0]);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );
    });

    it("sets 'new' when getAAP returns undefined (no instance)", async () => {
      mockedGetAAP.mockResolvedValue(undefined);

      renderProvider();

      await waitFor(() => expect(mockedGetAAP).toHaveBeenCalled());
      expect(screen.getByTestId("status-kind").textContent).toBe("new");
    });

    it("sets error with INITIAL_FETCH_FAILED when the fetch throws", async () => {
      mockedGetAAP.mockRejectedValue(new Error("network down"));

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.INITIAL_FETCH_FAILED.toString(),
      );
    });

    it("sets error status when the instance has a failed condition on mount", async () => {
      mockedGetAAP.mockResolvedValue(aapFailedFixture.items[0]);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.CONDITION_REPORTS_FAILURE.toString(),
      );
    });

    it("sets 'error' when instance is idled but has a failure condition", async () => {
      mockedGetAAP.mockResolvedValue(aapIdledWithFailureFixture.items[0]);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.CONDITION_REPORTS_FAILURE.toString(),
      );
    });

    it("does not fetch when user namespace is undefined", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);

      renderProvider({ user: undefined });

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(mockedGetAAP).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // provisionInstance
  // ---------------------------------------------------------------------------

  describe("provisionInstance", () => {
    it("creates a new AAP instance when status is 'new'", async () => {
      mockedGetAAP.mockResolvedValue(undefined);
      mockedCreateAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetAAP).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(mockedCreateAAP).toHaveBeenCalledWith(
        MOCK_PROXY_URL,
        readyUserFixture.defaultUserNamespace,
      );
      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );
    });

    it("does not create when instance is already ready", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(mockedCreateAAP).not.toHaveBeenCalled();
    });

    it("does not create when instance is provisioning", async () => {
      mockedGetAAP.mockResolvedValue(aapProvisioningFixture.items[0]);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe(
          "provisioning",
        ),
      );

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(mockedCreateAAP).not.toHaveBeenCalled();
    });

    it("sets error status when createAAP fails", async () => {
      mockedGetAAP.mockResolvedValue(undefined);
      mockedCreateAAP.mockRejectedValue(new Error("creation failed"));

      renderProvider();
      await waitFor(() => expect(mockedGetAAP).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("error");
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.INSTANCE_CREATION_FAILED.toString(),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // unidleInstance
  // ---------------------------------------------------------------------------

  describe("unidleInstance", () => {
    it("unidles the instance when status is 'idled'", async () => {
      mockedGetAAP.mockResolvedValue(aapIdledFixture.items[0]);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(mockedUnIdleAAP).toHaveBeenCalledWith(
        MOCK_PROXY_URL,
        readyUserFixture.defaultUserNamespace,
      );
      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");
    });
  });

  // ---------------------------------------------------------------------------
  // deleteInstance
  // ---------------------------------------------------------------------------

  describe("deleteInstance", () => {
    it("deletes the CR and related resources", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedDeleteAAPCR.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      expect(mockedGetDeployments).toHaveBeenCalled();
      expect(mockedGetStatefulSets).toHaveBeenCalled();
      expect(mockedDeleteAAPCR).toHaveBeenCalledWith(
        MOCK_PROXY_URL,
        readyUserFixture.defaultUserNamespace,
      );
      expect(mockedDeleteSecretsAndPVCs).toHaveBeenCalled();
      expect(mockedDeletePVCsForSTS).toHaveBeenCalled();
    });

    it("sets status to 'deleting' during deletion", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);

      let resolveDelete: () => void;
      mockedDeleteAAPCR.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          }),
      );

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      act(() => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("deleting"),
      );

      await act(async () => {
        resolveDelete!();
      });
    });

    it("throws UserFacingError when CR deletion fails", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedDeleteAAPCR.mockRejectedValue(
        new ApiError("deleteAAPCR failed", 500, "Internal Server Error"),
      );

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("delete-error").textContent).toBe(
          "UserFacingError",
        ),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // fetchInstanceCredentials
  // ---------------------------------------------------------------------------

  describe("fetchInstanceCredentials", () => {
    it("fetches the secret and returns decoded credentials", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedGetSecret.mockResolvedValue(secretFixture);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      await act(async () => {
        screen.getByTestId("fetch-credentials").click();
      });

      await waitFor(() => {
        const result = screen.getByTestId("creds-result").textContent;
        expect(result).toBeTruthy();
        const parsed = JSON.parse(result!);
        expect(parsed.username).toBe("admin");
        expect(parsed.password).toBe("admin-password");
        expect(parsed.url).toBe("https://aap.apps.example.com");
      });
    });

    it("returns cached credentials on subsequent calls", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedGetSecret.mockResolvedValue(secretFixture);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      await act(async () => {
        screen.getByTestId("fetch-credentials").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("creds-result").textContent).toBeTruthy(),
      );

      // Second call should use cache.
      mockedGetSecret.mockClear();
      await act(async () => {
        screen.getByTestId("fetch-credentials").click();
      });

      expect(mockedGetSecret).not.toHaveBeenCalled();
    });

    it("rejects with an error when using the NOOP provider (user not provisioned)", async () => {
      renderProvider({ user: undefined });

      await act(async () => {
        screen.getByTestId("fetch-credentials").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("creds-error").textContent).toBe("error"),
      );
    });

    it("throws UserFacingError when CR status fields are missing", async () => {
      const crWithoutAdminSecret: AAPCR = {
        status: {
          conditions: [
            {
              type: "Successful",
              status: "True",
              reason: "Successful",
              message: "",
            },
          ],
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        spec: { idle_aap: false },
        metadata: {
          name: "sandbox-aap",
          uuid: "uuid",
          creationTimestamp: "2025-01-01",
        },
      };
      mockedGetAAP.mockResolvedValue(crWithoutAdminSecret);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      await act(async () => {
        screen.getByTestId("fetch-credentials").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("creds-error").textContent).toBeTruthy(),
      );
    });

    it("throws UserFacingError when getSecret returns an ApiError", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedGetSecret.mockRejectedValue(
        new ApiError("getSecret failed", 500, "server error"),
      );

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      await act(async () => {
        screen.getByTestId("fetch-credentials").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("creds-error").textContent).toBeTruthy(),
      );
    });

    it("throws UserFacingError when getSecret returns a non-ApiError", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedGetSecret.mockRejectedValue(new Error("network error"));

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      await act(async () => {
        screen.getByTestId("fetch-credentials").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("creds-error").textContent).toBeTruthy(),
      );
    });

    it("throws UserFacingError when secret has no password field", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedGetSecret.mockResolvedValue({
        data: { password: "" },
        metadata: {
          name: "sandbox-aap-admin-password",
          uuid: "uuid",
          creationTimestamp: "2025-01-01",
        },
      });

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      await act(async () => {
        screen.getByTestId("fetch-credentials").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("creds-error").textContent).toBeTruthy(),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------

  describe("polling", () => {
    it("polls for status when provisioning and stops when ready", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(aapProvisioningFixture.items[0])
        .mockResolvedValueOnce(aapReadyFixture.items[0]);

      mockedCreateAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetAAP).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(4_500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );
    });

    it("polls for deletion and transitions to 'new' once the CR is absent", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(aapReadyFixture.items[0])
        .mockResolvedValue(undefined);
      mockedDeleteAAPCR.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      act(() => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("deleting"),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("new"),
      );
    });

    it("keeps polling during deletion when the CR still exists", async () => {
      let resolveCleanup!: () => void;
      const cleanupPromise = new Promise<void>((resolve) => {
        resolveCleanup = resolve;
      });

      mockedGetAAP
        .mockResolvedValueOnce(aapReadyFixture.items[0])
        .mockResolvedValueOnce(aapReadyFixture.items[0])
        .mockResolvedValueOnce(aapReadyFixture.items[0])
        .mockResolvedValue(undefined);
      mockedDeleteAAPCR.mockResolvedValue(undefined);
      mockedDeleteSecretsAndPVCs.mockImplementation(() => cleanupPromise);
      mockedDeletePVCsForSTS.mockImplementation(() => cleanupPromise);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      act(() => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("deleting"),
      );

      // First poll: CR still exists, should keep deleting
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("deleting");

      // Second poll: CR is now absent, should transition to "new"
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("new"),
      );

      // Resolve cleanup to avoid dangling promises
      await act(async () => {
        resolveCleanup();
      });
    });

    it("sets error when CR disappears unexpectedly during provisioning", async () => {
      mockedGetAAP.mockResolvedValue(undefined);
      mockedCreateAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("new"),
      );

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe(
          "provisioning",
        ),
      );

      // Poll fires: CR is absent during provisioning — unexpected
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.PROVISIONING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("sets error when CR reports a failed condition during provisioning", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(undefined)
        .mockResolvedValue(aapFailedFixture.items[0]);
      mockedCreateAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("new"),
      );

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe(
          "provisioning",
        ),
      );

      // Poll fires: CR has a failure condition
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.PROVISIONING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("sets error when CR disappears unexpectedly during unidling", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockResolvedValue(undefined);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("unidling"),
      );

      // Poll fires: CR is absent during unidling — unexpected
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.UNIDLING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("retries on transient errors then sets error after retries exhausted", async () => {
      const transientError = new ApiError("server error", 500, "internal");
      mockedGetAAP
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(transientError)
        .mockRejectedValue(transientError);
      mockedCreateAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("new"),
      );

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe(
          "provisioning",
        ),
      );

      // Advance enough time to exhaust all transient retries (3 retries).
      // Each poll fires every SHORT_INTERVAL (2000ms).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.PROVISIONING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("retries on plain TypeError (network drop) then sets error after retries exhausted", async () => {
      const networkError = new TypeError("Failed to fetch");
      mockedGetAAP
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValue(networkError);
      mockedCreateAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("new"),
      );

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe(
          "provisioning",
        ),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.PROVISIONING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("stops polling on non-transient API error during provisioning", async () => {
      const permanentError = new ApiError("not found", 404, "Not Found");
      mockedGetAAP
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(permanentError);
      mockedCreateAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("new"),
      );

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe(
          "provisioning",
        ),
      );

      // First poll: non-transient error should immediately stop polling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.PROVISIONING_POLLING_REPORTS_FAILURE.toString(),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Context memoization
  // ---------------------------------------------------------------------------

  describe("context value", () => {
    it("provides all required context fields", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBeTruthy(),
      );

      expect(screen.getByTestId("provision-instance")).toBeInTheDocument();
      expect(screen.getByTestId("unidle-instance")).toBeInTheDocument();
      expect(screen.getByTestId("delete-instance")).toBeInTheDocument();
      expect(screen.getByTestId("fetch-credentials")).toBeInTheDocument();
      expect(screen.getByTestId("status-kind")).toBeInTheDocument();
    });
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

      expect(mockedGetAAP).not.toHaveBeenCalled();
      expect(screen.getByTestId("status-kind").textContent).toBe(
        "userNotReady",
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

      expect(mockedGetAAP).not.toHaveBeenCalled();
      expect(screen.getByTestId("status-kind").textContent).toBe(
        "userNotReady",
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

      expect(mockedGetAAP).not.toHaveBeenCalled();
      expect(screen.getByTestId("status-kind").textContent).toBe(
        "userNotReady",
      );
    });

    it("NOOP provisionInstance rejects", async () => {
      renderProvider({ user: undefined });

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("provision-error").textContent).toBe("other"),
      );
      expect(screen.getByTestId("status-kind").textContent).toBe(
        "userNotReady",
      );
    });

    it("NOOP unidleInstance rejects", async () => {
      renderProvider({ user: undefined });

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("unidle-error").textContent).toBe("other"),
      );
      expect(screen.getByTestId("status-kind").textContent).toBe(
        "userNotReady",
      );
    });

    it("NOOP deleteInstance rejects", async () => {
      renderProvider({ user: undefined });

      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("delete-error").textContent).toBe("other"),
      );
      expect(screen.getByTestId("status-kind").textContent).toBe(
        "userNotReady",
      );
    });

    it("NOOP fetchInstanceCredentials rejects", async () => {
      renderProvider({ user: undefined });

      await act(async () => {
        screen.getByTestId("fetch-credentials").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("creds-error").textContent).toBe("error"),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Provider transition (NOOP → Connected)
  // ---------------------------------------------------------------------------

  describe("provider transition (NOOP → Connected)", () => {
    it("switches from NOOP to Connected when user data becomes available", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);

      const { rerender } = render(
        <Wrapper userCtx={makeUserContext({ user: undefined })} />,
      );

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(mockedGetAAP).not.toHaveBeenCalled();
      expect(screen.getByTestId("status-kind").textContent).toBe(
        "userNotReady",
      );

      rerender(<Wrapper userCtx={makeUserContext()} />);

      await waitFor(() => {
        expect(mockedGetAAP).toHaveBeenCalledWith(
          MOCK_PROXY_URL,
          readyUserFixture.defaultUserNamespace,
        );
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // provisionInstance with unrecognized CR status
  // ---------------------------------------------------------------------------

  describe("provisionInstance with existing CR in unrecognized status", () => {
    it("sets status to 'provisioning' and polls when CR exists with unknown status", async () => {
      const unknownCR = {
        status: {
          conditions: [],
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        spec: { idle_aap: false },
        metadata: {
          name: "sandbox-aap",
          uuid: "aap-uuid-123",
          creationTimestamp: "2025-01-15T00:00:00Z",
        },
      };

      mockedGetAAP.mockResolvedValue(unknownCR);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("unknown"),
      );

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );
      expect(mockedCreateAAP).not.toHaveBeenCalled();
      expect(mockedUnIdleAAP).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Recoverable error grace period
  // ---------------------------------------------------------------------------

  describe("recoverable error grace period", () => {
    it("keeps polling when 'unknown playbook failure' occurs within the 30 minute window", async () => {
      vi.setSystemTime(new Date("2026-08-05T12:10:00Z"));

      mockedGetAAP
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(aapRecoverableFailureFixture.items[0])
        .mockResolvedValueOnce(aapRecoverableFailureFixture.items[0])
        .mockResolvedValueOnce(aapReadyFixture.items[0]);

      mockedCreateAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetAAP).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // First poll: recoverable failure — should stay provisioning
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // Second poll: still recoverable — should keep provisioning
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // Third poll: instance is ready
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );
    });

    it("sets error when 'unknown playbook failure' persists past the 30 minute window", async () => {
      vi.setSystemTime(new Date("2026-08-05T12:31:00Z"));

      mockedGetAAP
        .mockResolvedValueOnce(undefined)
        .mockResolvedValue(aapRecoverableFailureFixture.items[0]);

      mockedCreateAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetAAP).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // Poll fires: 31 minutes after creationTimestamp — grace period expired
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.PROVISIONING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("treats non-'unknown playbook failure' errors as immediate failures regardless of time", async () => {
      vi.setSystemTime(new Date("2026-08-05T12:05:00Z"));

      const recentFailedCR = {
        ...aapFailedFixture.items[0],
        metadata: {
          name: "sandbox-aap",
          uuid: "aap-uuid-123",
          creationTimestamp: "2026-08-05T12:00:00Z",
        },
      };

      mockedGetAAP
        .mockResolvedValueOnce(undefined)
        .mockResolvedValue(recentFailedCR);

      mockedCreateAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetAAP).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // Poll fires: only 5 minutes elapsed but the error is not recoverable
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.PROVISIONING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("sets 'provisioning' on mount when recoverable failure is within the grace period", async () => {
      vi.setSystemTime(new Date("2026-08-05T12:15:00Z"));

      mockedGetAAP.mockResolvedValue(aapRecoverableFailureFixture.items[0]);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe(
          "provisioning",
        ),
      );
    });

    it("sets 'error' on mount when recoverable failure is past the grace period", async () => {
      vi.setSystemTime(new Date("2026-08-05T12:45:00Z"));

      mockedGetAAP.mockResolvedValue(aapRecoverableFailureFixture.items[0]);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.CONDITION_REPORTS_FAILURE.toString(),
      );
    });

    it("does not apply the grace period during unidling and reports failure immediately", async () => {
      vi.setSystemTime(new Date("2026-08-05T12:10:00Z"));

      const recentRecoverableCR = {
        ...aapRecoverableFailureFixture.items[0],
        metadata: {
          ...aapRecoverableFailureFixture.items[0].metadata,
          creationTimestamp: "2026-08-05T12:00:00Z",
        },
      };

      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockResolvedValue(recentRecoverableCR);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Poll fires: even though the error is "unknown playbook failure" within
      // 30 minutes, the grace period only applies to provisioning — not
      // unidling. The failure should be reported immediately.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.UNIDLING_POLLING_REPORTS_FAILURE.toString(),
      );
    });
  });
});
