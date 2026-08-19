import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";

import {
  createAAP,
  deleteAAPCR,
  getAAP,
  removeUnidleAnnotation,
  unIdleAAP,
} from "../../api/aap";
import {
  deletePVCsForSTS,
  deleteSecretsAndPVCs,
  getDeployments,
  getSecret,
  getStatefulSets,
} from "../../api/kube";
import {
  AAP_OPERATOR_LABEL_SELECTOR,
  LONG_INTERVAL,
  SHORT_INTERVAL,
  UNIDLE_REQUESTED_AT_ANNOTATION,
} from "../../const";
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
import type { AAPCR, StatusCondition, User } from "../../types";
import { AAPInstanceErrorType } from "../../utils/aap-utils";
import { useAnsibleContext } from "../AnsibleContext";
import { AnsibleProvider } from "../AnsibleProvider";
import { NotificationProvider } from "../NotificationProvider";
import type { UserContextType } from "../UserContext";
import { UserContext } from "../UserContext";
import { UserSignupPhase } from "../userSignupPhase";

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
const mockedRemoveUnidleAnnotation = vi.mocked(removeUnidleAnnotation);

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

const RUNNING_CONDITIONS: StatusCondition[] = [
  {
    type: "Running",
    status: "True",
    reason: "Running",
    message: "Running reconciliation",
  },
];

const RECOVERABLE_FAILURE_CONDITIONS: StatusCondition[] = [
  {
    type: "Failure",
    status: "True",
    reason: "Failed",
    message: "unknown playbook failure",
  },
];

function makeAnnotatedAAPCR({
  conditions,
  creationTimestamp,
  unidleRequestedAt = "2026-08-05T14:00:00Z",
}: {
  conditions: StatusCondition[];
  creationTimestamp: string;
  unidleRequestedAt?: string;
}): AAPCR {
  return {
    status: { conditions },
    spec: { idle_aap: false },
    metadata: {
      name: "sandbox-aap",
      uuid: "aap-uuid-123",
      creationTimestamp,
      annotations: {
        [UNIDLE_REQUESTED_AT_ANNOTATION]: unidleRequestedAt,
      },
    },
  };
}

function makeReadyCRWithAnnotation(
  unidleRequestedAt = "2026-08-05T14:00:00Z",
): AAPCR {
  return {
    ...aapReadyFixture.items[0],
    metadata: {
      ...aapReadyFixture.items[0].metadata,
      annotations: {
        [UNIDLE_REQUESTED_AT_ANNOTATION]: unidleRequestedAt,
      },
    },
  };
}

const unidlingRunningCR = makeAnnotatedAAPCR({
  conditions: RUNNING_CONDITIONS,
  creationTimestamp: "2025-01-15T00:00:00Z",
});

const annotatedRecoverableFailureCR = makeAnnotatedAAPCR({
  conditions: RECOVERABLE_FAILURE_CONDITIONS,
  creationTimestamp: "2026-01-15T00:00:00Z",
});

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
    window.__config__ = {
      registrationServiceURL: "https://registration.example.com",
      recaptchaSiteKey: "test-site-key",
      // Non-dev so provisioning/unidling keep LONG_INTERVAL as the tests expect.
      environment: "prod",
    };
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

    it("sets 'unidling' when getAAP returns a Running instance with unidle annotation", async () => {
      mockedGetAAP.mockResolvedValue(unidlingRunningCR);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("unidling"),
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
  // unidleInstance error handling
  // ---------------------------------------------------------------------------

  describe("unidleInstance error handling", () => {
    it("throws UserFacingError and keeps 'idled' status when unIdleAAP rejects", async () => {
      mockedGetAAP.mockResolvedValue(aapIdledFixture.items[0]);
      mockedUnIdleAAP.mockRejectedValue(new Error("network failure"));

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("unidle-error").textContent).toBe(
          "UserFacingError",
        ),
      );
      expect(screen.getByTestId("status-kind").textContent).toBe("idled");
    });

    it("throws UserFacingError when unIdleAAP rejects with an ApiError", async () => {
      mockedGetAAP.mockResolvedValue(aapIdledFixture.items[0]);
      mockedUnIdleAAP.mockRejectedValue(
        new ApiError("unIdleAAP failed", 500, "Internal Server Error"),
      );

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("unidle-error").textContent).toBe(
          "UserFacingError",
        ),
      );
      expect(screen.getByTestId("status-kind").textContent).toBe("idled");
    });
  });

  // ---------------------------------------------------------------------------
  // deleteInstance
  // ---------------------------------------------------------------------------

  describe("deleteInstance", () => {
    it("deletes the CR and related resources using the broad AAP label selector", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedDeleteAAPCR.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      expect(mockedGetDeployments).toHaveBeenCalledWith(
        MOCK_PROXY_URL,
        readyUserFixture.defaultUserNamespace,
        AAP_OPERATOR_LABEL_SELECTOR,
      );
      expect(mockedGetStatefulSets).toHaveBeenCalledWith(
        MOCK_PROXY_URL,
        readyUserFixture.defaultUserNamespace,
        AAP_OPERATOR_LABEL_SELECTOR,
      );
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

    it("reverts status to previous state when CR deletion fails", async () => {
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
      expect(screen.getByTestId("status-kind").textContent).toBe("ready");
    });

    it("sets DELETION_RESOURCES_ERROR when resource cleanup fails", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedDeleteAAPCR.mockResolvedValue(undefined);
      mockedDeleteSecretsAndPVCs.mockRejectedValue(new Error("cleanup failed"));

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
      expect(screen.getByTestId("status-kind").textContent).toBe("error");
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.DELETION_RESOURCES_ERROR.toString(),
      );
    });

    it("sets 'deleted' when CR deletion succeeds but no resource cleanup errors", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedDeleteAAPCR.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("deleted"),
      );
    });

    it("passes fetched deployments and statefulSets to the cleanup functions", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedDeleteAAPCR.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      expect(mockedDeleteSecretsAndPVCs).toHaveBeenCalledWith(
        MOCK_PROXY_URL,
        deploymentFixture,
        readyUserFixture.defaultUserNamespace,
      );
      expect(mockedDeleteSecretsAndPVCs).toHaveBeenCalledWith(
        MOCK_PROXY_URL,
        statefulSetFixture,
        readyUserFixture.defaultUserNamespace,
      );
      expect(mockedDeletePVCsForSTS).toHaveBeenCalledWith(
        MOCK_PROXY_URL,
        statefulSetFixture,
        readyUserFixture.defaultUserNamespace,
      );
    });

    it("completes deletion when no deployments or statefulSets are found", async () => {
      mockedGetDeployments.mockResolvedValue({ items: [] });
      mockedGetStatefulSets.mockResolvedValue({ items: [] });
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedDeleteAAPCR.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      await act(async () => {
        screen.getByTestId("delete-instance").click();
      });

      expect(mockedDeleteAAPCR).toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("deleted"),
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
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL * 2 + 500);
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
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
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
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.PROVISIONING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("keeps polling during deletion when the CR reports failure conditions", async () => {
      let resolveCleanup!: () => void;
      const cleanupPromise = new Promise<void>((resolve) => {
        resolveCleanup = resolve;
      });

      mockedGetAAP
        .mockResolvedValueOnce(aapReadyFixture.items[0])
        .mockResolvedValueOnce(aapFailedFixture.items[0])
        .mockResolvedValueOnce(aapFailedFixture.items[0])
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

      // First poll: CR has failure condition — should keep deleting (ignores failure)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("deleting");

      // Second poll: still failed — should keep deleting
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("deleting");

      // Third poll: CR absent — deletion successful
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("new"),
      );

      await act(async () => {
        resolveCleanup();
      });
    });

    it("polls with unidling status when CR has Running condition with unidle annotation", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockResolvedValueOnce(unidlingRunningCR)
        .mockResolvedValueOnce(unidlingRunningCR)
        .mockResolvedValue(aapReadyFixture.items[0]);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // First poll: Running + annotation → unidling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Second poll: still Running + annotation → still unidling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Third poll: ready
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
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
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.UNIDLING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("sets UNIDLING_POLLING_REPORTS_FAILURE when a non-recoverable failure occurs during unidling", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockResolvedValue(aapFailedFixture.items[0]);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Poll fires: non-recoverable failure during unidling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.UNIDLING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("retries on transient errors during unidling then sets error after retries exhausted", async () => {
      const transientError = new ApiError("server error", 500, "internal");
      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(transientError)
        .mockRejectedValue(transientError);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Advance enough time to exhaust all transient retries (3 retries).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL * 4 + 500);
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
      // Each poll fires every LONG_INTERVAL during provisioning.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL * 4 + 500);
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
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL * 4 + 500);
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
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.PROVISIONING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("stops polling on non-transient API error during deletion", async () => {
      const permanentError = new ApiError("forbidden", 403, "Forbidden");
      mockedGetAAP
        .mockResolvedValueOnce(aapReadyFixture.items[0])
        .mockRejectedValue(permanentError);
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
        await vi.advanceTimersByTimeAsync(SHORT_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.DELETING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("retries on transient errors during deletion then sets error after retries exhausted", async () => {
      const transientError = new ApiError("server error", 500, "internal");
      mockedGetAAP
        .mockResolvedValueOnce(aapReadyFixture.items[0])
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(transientError)
        .mockRejectedValue(transientError);
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
        await vi.advanceTimersByTimeAsync(SHORT_INTERVAL * 4 + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.DELETING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("resets the transient retry counter after a successful poll", async () => {
      const transientError = new ApiError("server error", 500, "internal");
      mockedGetAAP
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce(aapProvisioningFixture.items[0])
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(transientError)
        .mockResolvedValue(aapReadyFixture.items[0]);

      mockedCreateAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetAAP).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // Polls 1-2: transient errors (retries used: 2)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL * 2 + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // Poll 3: success — resets the retry counter
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // Polls 4-5: two more transient errors — should still be fine
      // because the counter was reset
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL * 2 + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // Poll 6: success again — becomes ready
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );
    });

    it("polls from mount-detected unidling (Running + annotation) through to ready", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(unidlingRunningCR)
        .mockResolvedValueOnce(unidlingRunningCR)
        .mockResolvedValue(aapReadyFixture.items[0]);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("unidling"),
      );

      // First poll: still Running + annotation → unidling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Second poll: ready
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );
    });

    it("sets error when CR disappears during mount-detected unidling", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(unidlingRunningCR)
        .mockResolvedValue(undefined);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("unidling"),
      );

      // Poll: CR absent during unidling — unexpected
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.UNIDLING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("sets error when failure occurs during mount-detected unidling polling", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(unidlingRunningCR)
        .mockResolvedValue(aapFailedFixture.items[0]);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("unidling"),
      );

      // Poll: non-recoverable failure during unidling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.UNIDLING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("stops polling on non-transient API error during unidling", async () => {
      const permanentError = new ApiError("forbidden", 403, "Forbidden");
      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockRejectedValue(permanentError);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.UNIDLING_POLLING_REPORTS_FAILURE.toString(),
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
  // provisionInstance with existing CR
  // ---------------------------------------------------------------------------

  describe("provisionInstance with existing CR", () => {
    it("sets status to 'provisioning' without calling createAAP when CR exists in error state", async () => {
      mockedGetAAP.mockResolvedValue(aapFailedFixture.items[0]);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );
      expect(mockedCreateAAP).not.toHaveBeenCalled();
    });

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
    it("keeps polling when 'unknown playbook failure' occurs within the 50 minute window", async () => {
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
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // Second poll: still recoverable — should keep provisioning
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // Third poll: instance is ready
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );
    });

    it("sets error when 'unknown playbook failure' persists past the 50 minute window", async () => {
      vi.setSystemTime(new Date("2026-08-05T12:51:00Z"));

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

      // Poll fires: 51 minutes after creationTimestamp — grace period expired
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
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
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
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
      vi.setSystemTime(new Date("2026-08-05T12:55:00Z"));

      mockedGetAAP.mockResolvedValue(aapRecoverableFailureFixture.items[0]);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.CONDITION_REPORTS_FAILURE.toString(),
      );
    });

    it("keeps polling when recoverable failure occurs during unidling within the grace window", async () => {
      vi.setSystemTime(new Date("2026-08-05T14:10:00Z"));

      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockResolvedValueOnce(annotatedRecoverableFailureCR)
        .mockResolvedValueOnce(annotatedRecoverableFailureCR)
        .mockResolvedValueOnce(aapReadyFixture.items[0]);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // First poll: recoverable failure with unidle annotation within grace
      // period — should stay unidling.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Second poll: still recoverable — should keep unidling.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Third poll: instance is ready.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );
    });

    it("sets error when recoverable failure persists past the unidling grace window", async () => {
      vi.setSystemTime(new Date("2026-08-05T14:51:00Z"));

      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockResolvedValue(annotatedRecoverableFailureCR);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Poll fires: 51 minutes past the unidle annotation — grace period
      // expired. Should report failure.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.UNIDLING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("sets 'unidling' on mount when CR has unidle annotation and recoverable failure within grace period", async () => {
      vi.setSystemTime(new Date("2026-08-05T14:15:00Z"));

      mockedGetAAP.mockResolvedValue(annotatedRecoverableFailureCR);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("unidling"),
      );
    });

    it("sets 'error' on mount when CR has unidle annotation but grace period is expired", async () => {
      vi.setSystemTime(new Date("2026-08-05T14:55:00Z"));

      mockedGetAAP.mockResolvedValue(annotatedRecoverableFailureCR);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.CONDITION_REPORTS_FAILURE.toString(),
      );
    });

    it("sets error when recoverable failure transitions to non-recoverable during unidling polling", async () => {
      vi.setSystemTime(new Date("2026-08-05T14:10:00Z"));

      const nonRecoverableCR = makeAnnotatedAAPCR({
        conditions: [
          {
            type: "Failure",
            status: "True",
            reason: "ReconciliationFailed",
            message: "Task failed: some operator error",
          },
        ],
        creationTimestamp: "2026-01-15T00:00:00Z",
      });

      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockResolvedValueOnce(annotatedRecoverableFailureCR)
        .mockResolvedValue(nonRecoverableCR);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // First poll: recoverable failure within grace → stays unidling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Second poll: non-recoverable failure → error
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.UNIDLING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("mounts with unidling grace, polls, and becomes ready end-to-end", async () => {
      vi.setSystemTime(new Date("2026-08-05T14:10:00Z"));

      const readyCRWithAnnotation = makeReadyCRWithAnnotation();

      mockedGetAAP
        .mockResolvedValueOnce(annotatedRecoverableFailureCR)
        .mockResolvedValueOnce(annotatedRecoverableFailureCR)
        .mockResolvedValue(readyCRWithAnnotation);
      mockedRemoveUnidleAnnotation.mockResolvedValue(undefined);

      renderProvider();

      // On mount: recoverable failure with unidle annotation → "unidling"
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("unidling"),
      );

      // First poll: still recoverable → stays unidling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Second poll: ready → "ready" + annotation cleanup
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );
    });

    it("sets error when recoverable failure transitions to non-recoverable during provisioning polling", async () => {
      vi.setSystemTime(new Date("2026-08-05T12:10:00Z"));

      const nonRecoverableFailureCR: AAPCR = {
        status: {
          conditions: [
            {
              type: "Failure",
              status: "True",
              reason: "ReconciliationFailed",
              message: "EDA creation failed",
            },
          ],
        },
        spec: { idle_aap: false },
        metadata: {
          name: "sandbox-aap",
          uuid: "aap-uuid-123",
          creationTimestamp: "2026-08-05T12:00:00Z",
        },
      };

      mockedGetAAP
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(aapRecoverableFailureFixture.items[0])
        .mockResolvedValue(nonRecoverableFailureCR);
      mockedCreateAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(mockedGetAAP).toHaveBeenCalled());

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // First poll: recoverable failure within grace → stays provisioning
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // Second poll: non-recoverable failure → error
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
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
  // removeUnidleAnnotation cleanup
  // ---------------------------------------------------------------------------

  describe("removeUnidleAnnotation cleanup", () => {
    it("calls removeUnidleAnnotation on initial fetch when instance is ready and has the annotation", async () => {
      mockedGetAAP.mockResolvedValue(
        makeReadyCRWithAnnotation("2026-08-05T12:00:00Z"),
      );
      mockedRemoveUnidleAnnotation.mockResolvedValue(undefined);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      expect(mockedRemoveUnidleAnnotation).toHaveBeenCalledWith(
        MOCK_PROXY_URL,
        readyUserFixture.defaultUserNamespace,
      );
    });

    it("does NOT call removeUnidleAnnotation on initial fetch when instance is ready without the annotation", async () => {
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedRemoveUnidleAnnotation.mockResolvedValue(undefined);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      expect(mockedRemoveUnidleAnnotation).not.toHaveBeenCalled();
    });

    it("calls removeUnidleAnnotation when instance becomes ready during unidling polling", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockResolvedValue(makeReadyCRWithAnnotation());
      mockedUnIdleAAP.mockResolvedValue(undefined);
      mockedRemoveUnidleAnnotation.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Poll fires: instance is ready with annotation
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      expect(mockedRemoveUnidleAnnotation).toHaveBeenCalledWith(
        MOCK_PROXY_URL,
        readyUserFixture.defaultUserNamespace,
      );
    });

    it("does NOT call removeUnidleAnnotation when instance becomes ready during provisioning polling", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(undefined)
        .mockResolvedValue(aapReadyFixture.items[0]);
      mockedCreateAAP.mockResolvedValue(undefined);
      mockedRemoveUnidleAnnotation.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("new"),
      );

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      expect(mockedRemoveUnidleAnnotation).not.toHaveBeenCalled();
    });

    it("calls removeUnidleAnnotation when becoming ready from mount-detected unidling (Running + annotation)", async () => {
      const readyCRWithAnnotation = makeReadyCRWithAnnotation();

      mockedGetAAP
        .mockResolvedValueOnce(unidlingRunningCR)
        .mockResolvedValue(readyCRWithAnnotation);
      mockedRemoveUnidleAnnotation.mockResolvedValue(undefined);

      renderProvider();

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("unidling"),
      );

      expect(mockedRemoveUnidleAnnotation).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      expect(mockedRemoveUnidleAnnotation).toHaveBeenCalledWith(
        MOCK_PROXY_URL,
        readyUserFixture.defaultUserNamespace,
      );
    });

    it("does NOT call removeUnidleAnnotation during unidling polling when ready CR has no annotation", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockResolvedValue(aapReadyFixture.items[0]);
      mockedUnIdleAAP.mockResolvedValue(undefined);
      mockedRemoveUnidleAnnotation.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      expect(mockedRemoveUnidleAnnotation).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // provisionInstance from non-standard states
  // ---------------------------------------------------------------------------

  describe("provisionInstance from non-standard states", () => {
    it("sets 'provisioning' without calling createAAP when status is 'idled' and CR exists", async () => {
      mockedGetAAP.mockResolvedValue(aapIdledFixture.items[0]);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );
      expect(mockedCreateAAP).not.toHaveBeenCalled();
    });

    it("sets 'provisioning' without calling createAAP when status is 'unidling' and CR exists", async () => {
      mockedGetAAP.mockResolvedValue(aapIdledFixture.items[0]);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      expect(mockedCreateAAP).not.toHaveBeenCalled();
      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Provider state reset on prop changes
  // ---------------------------------------------------------------------------

  describe("provider state reset on prop changes", () => {
    it("resets state and re-fetches when proxyURL changes", async () => {
      const altProxyURL = "https://proxy-alt.example.com";
      const altReadyCR: AAPCR = {
        ...aapReadyFixture.items[0],
        metadata: {
          ...aapReadyFixture.items[0].metadata,
          uuid: "alt-uuid",
        },
      };

      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);

      const initialCtx = makeUserContext();
      const { rerender } = render(<Wrapper userCtx={initialCtx} />);

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );
      expect(mockedGetAAP).toHaveBeenCalledWith(
        MOCK_PROXY_URL,
        readyUserFixture.defaultUserNamespace,
      );

      mockedGetAAP.mockReset();
      mockedGetAAP.mockResolvedValue(altReadyCR);

      const altUser: User = {
        ...readyUserFixture,
        proxyURL: altProxyURL,
      };
      rerender(<Wrapper userCtx={makeUserContext({ user: altUser })} />);

      await waitFor(() =>
        expect(mockedGetAAP).toHaveBeenCalledWith(
          altProxyURL,
          readyUserFixture.defaultUserNamespace,
        ),
      );

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );
    });

    it("resets state and re-fetches when userNamespace changes", async () => {
      const altNamespace = "janedoe-dev";
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);

      const initialCtx = makeUserContext();
      const { rerender } = render(<Wrapper userCtx={initialCtx} />);

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );
      expect(mockedGetAAP).toHaveBeenCalledWith(
        MOCK_PROXY_URL,
        readyUserFixture.defaultUserNamespace,
      );

      mockedGetAAP.mockReset();
      mockedGetAAP.mockResolvedValue(undefined);

      const altUser: User = {
        ...readyUserFixture,
        defaultUserNamespace: altNamespace,
      };
      rerender(<Wrapper userCtx={makeUserContext({ user: altUser })} />);

      await waitFor(() =>
        expect(mockedGetAAP).toHaveBeenCalledWith(MOCK_PROXY_URL, altNamespace),
      );

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("new"),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Grace period expiry mid-polling
  // ---------------------------------------------------------------------------

  describe("grace period expiry mid-polling", () => {
    it("transitions from 'unidling' to error when the unidling grace period expires during polling", async () => {
      vi.setSystemTime(new Date("2026-08-05T14:10:00Z"));

      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockResolvedValueOnce(annotatedRecoverableFailureCR)
        .mockResolvedValue(annotatedRecoverableFailureCR);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // First poll at T+10min: within grace → stays unidling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Advance time past the 50min mark from unidle annotation
      vi.setSystemTime(new Date("2026-08-05T14:51:00Z"));

      // Second poll: grace expired → error
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.UNIDLING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("transitions from 'provisioning' to error when the creation grace period expires during polling", async () => {
      vi.setSystemTime(new Date("2026-08-05T12:10:00Z"));

      mockedGetAAP
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(aapRecoverableFailureFixture.items[0])
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

      // First poll within grace → stays provisioning
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe(
        "provisioning",
      );

      // Advance time past the 50min mark from creation
      vi.setSystemTime(new Date("2026-08-05T12:51:00Z"));

      // Second poll: grace expired → error
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("error"),
      );
      expect(screen.getByTestId("status-error-type").textContent).toBe(
        AAPInstanceErrorType.PROVISIONING_POLLING_REPORTS_FAILURE.toString(),
      );
    });

    it("falls back from creation grace to unidling grace when creation expires but unidle annotation is still valid", async () => {
      vi.setSystemTime(new Date("2026-08-05T14:10:00Z"));

      const crWithBothTimestamps = makeAnnotatedAAPCR({
        conditions: RECOVERABLE_FAILURE_CONDITIONS,
        creationTimestamp: "2026-08-05T13:00:00Z",
      });

      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockResolvedValueOnce(crWithBothTimestamps)
        .mockResolvedValue(aapReadyFixture.items[0]);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Advance time so creation grace (from 13:00) is expired but unidle
      // annotation (from 14:00) is still valid.
      vi.setSystemTime(new Date("2026-08-05T14:20:00Z"));

      // Poll: creation grace expired (80min), but unidle grace still valid (20min)
      // → mapAnsibleStatus returns "unidling", which keeps us in unidling.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Next poll: ready
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Credential cache invalidation
  // ---------------------------------------------------------------------------

  describe("credential cache invalidation", () => {
    it("invalidates cached credentials when the instance is deleted", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(aapReadyFixture.items[0])
        .mockResolvedValue(undefined);
      mockedGetSecret.mockResolvedValue(secretFixture);
      mockedDeleteAAPCR.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      // Fetch credentials — should call getSecret
      await act(async () => {
        screen.getByTestId("fetch-credentials").click();
      });
      await waitFor(() =>
        expect(screen.getByTestId("creds-result").textContent).toBeTruthy(),
      );

      expect(mockedGetSecret).toHaveBeenCalledTimes(1);

      // Delete the instance → credentials are cleared
      act(() => {
        screen.getByTestId("delete-instance").click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("deleting"),
      );

      // Poll: CR absent → transitions to "new"
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("new"),
      );

      // Re-provision → polls → gets ready
      mockedGetAAP.mockResolvedValue(aapReadyFixture.items[0]);
      mockedCreateAAP.mockResolvedValue(undefined);

      await act(async () => {
        screen.getByTestId("provision-instance").click();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("ready"),
      );

      // Fetch credentials again — should call getSecret again (cache was cleared)
      await act(async () => {
        screen.getByTestId("fetch-credentials").click();
      });
      await waitFor(() =>
        expect(screen.getByTestId("creds-result").textContent).toBeTruthy(),
      );

      expect(mockedGetSecret).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Polling interval selection
  // ---------------------------------------------------------------------------

  describe("polling interval", () => {
    it("uses LONG_INTERVAL when unidling", async () => {
      mockedGetAAP
        .mockResolvedValueOnce(aapIdledFixture.items[0])
        .mockResolvedValueOnce(aapProvisioningFixture.items[0])
        .mockResolvedValue(aapReadyFixture.items[0]);
      mockedUnIdleAAP.mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("idled"),
      );

      await act(async () => {
        screen.getByTestId("unidle-instance").click();
      });

      expect(screen.getByTestId("status-kind").textContent).toBe("unidling");

      // Advance by less than LONG_INTERVAL — should NOT have polled yet
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_INTERVAL + 500);
      });

      expect(mockedGetAAP).toHaveBeenCalledTimes(1);

      // Advance to reach LONG_INTERVAL — should now poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LONG_INTERVAL - SHORT_INTERVAL);
      });

      expect(mockedGetAAP).toHaveBeenCalledTimes(2);
    });

    it("uses SHORT_INTERVAL when deleting", async () => {
      let resolveDelete!: () => void;
      mockedDeleteAAPCR.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          }),
      );

      mockedGetAAP
        .mockResolvedValueOnce(aapReadyFixture.items[0])
        .mockResolvedValueOnce(aapReadyFixture.items[0])
        .mockResolvedValue(undefined);

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

      const callCountAfterMount = mockedGetAAP.mock.calls.length;

      // Advance by SHORT_INTERVAL — should trigger a poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_INTERVAL + 500);
      });

      expect(mockedGetAAP.mock.calls.length).toBeGreaterThan(
        callCountAfterMount,
      );

      // Resolve the deletion and let the next poll find CR absent
      await act(async () => {
        resolveDelete();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_INTERVAL + 500);
      });

      await waitFor(() =>
        expect(screen.getByTestId("status-kind").textContent).toBe("new"),
      );
    });
  });
});
