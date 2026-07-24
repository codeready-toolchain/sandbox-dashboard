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
  aapIdledFixture,
  aapProvisioningFixture,
  aapReadyFixture,
  deploymentFixture,
  MOCK_PROXY_URL,
  readyUserFixture,
  secretFixture,
  statefulSetFixture,
} from "../../mocks/fixtures";
import { NotificationProvider } from "../../notifications/NotificationProvider";
import type { AAPCR, User } from "../../types";
import { AAPInstanceErrorType } from "../../utils/aap-utils";
import { useAnsibleContext } from "../AnsibleContext";
import { AnsibleProvider } from "../AnsibleProvider";
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

    it("polls for deletion, stays deleting until cleanup resolves, then transitions to 'new'", async () => {
      let resolveCleanup!: () => void;
      const cleanupPromise = new Promise<void>((resolve) => {
        resolveCleanup = resolve;
      });

      mockedGetAAP
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

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("deleting");

      await act(async () => {
        resolveCleanup();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("new"),
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
});
