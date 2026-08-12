import type { AAPCR, StatusCondition } from "../../types";
import {
  AAPInstanceErrorType,
  AAPObject,
  decode,
  isErrorRecoverable,
  mapAnsibleStatus,
} from "../aap-utils";

describe("aap-utils", () => {
  describe("decode", () => {
    it("should correctly decode base64 strings", () => {
      const encoded = btoa("Hello World");
      expect(decode(encoded)).toBe("Hello World");
    });

    it("should handle empty strings", () => {
      expect(decode("")).toBe("");
    });
  });

  describe("mapAnsibleStatus", () => {
    it("should return 'new' status when data is undefined", () => {
      const [status, condition] = mapAnsibleStatus(undefined);
      expect(status).toEqual({ kind: "new" });
      expect(condition).toBeUndefined();
    });

    it("should return 'unknown' status when status or conditions are missing", () => {
      const cr: AAPCR = {
        status: {
          conditions: [],
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: false },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({ kind: "unknown" });
      expect(condition).toBeUndefined();
    });

    it("should return 'unknown' when status is an empty object (partial CR)", () => {
      const cr: AAPCR = {
        status: {},
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: false },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({ kind: "unknown" });
      expect(condition).toBeUndefined();
    });

    it("should return 'unknown' when idle_aap is true but conditions are empty", () => {
      const cr: AAPCR = {
        status: {
          conditions: [],
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: true },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({ kind: "unknown" });
      expect(condition).toBeUndefined();
    });

    it("should return 'unknown' when idle_aap is true but status.conditions is missing", () => {
      const cr: AAPCR = {
        status: {},
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: true },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({ kind: "unknown" });
      expect(condition).toBeUndefined();
    });

    it("should return 'idled' status when idle_aap is true", () => {
      const cr: AAPCR = {
        status: {
          conditions: [
            {
              type: "Running",
              status: "False",
              reason: "Idled",
              message: "Instance is idled",
            },
          ],
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: true },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({ kind: "idled" });
      expect(condition).toBeUndefined();
    });

    it("should return 'ready' status with the matched condition when Successful condition is true", () => {
      const successCondition: StatusCondition = {
        type: "Successful",
        status: "True",
        reason: "Successful",
        message: "",
      };
      const cr: AAPCR = {
        status: {
          conditions: [successCondition],
          URL: "http://test.com",
          adminPasswordSecret: "secret",
          adminUser: "admin",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: false },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({ kind: "ready" });
      expect(condition).toEqual(successCondition);
    });

    it("should return 'error' with CONDITION_REPORTS_FAILURE and the matched condition when Failure condition is present", () => {
      const failureCondition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "Something went wrong",
      };
      const cr: AAPCR = {
        status: {
          conditions: [failureCondition],
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: false },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({
        kind: "error",
        errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
      });
      expect(condition).toEqual(failureCondition);
    });

    it("should return 'provisioning' status with the matched condition when only Running condition is present", () => {
      const runningCondition: StatusCondition = {
        type: "Running",
        status: "True",
        reason: "Running",
        message: "Running reconciliation",
      };
      const cr: AAPCR = {
        status: {
          conditions: [runningCondition],
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: false },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({ kind: "provisioning" });
      expect(condition).toEqual(runningCondition);
    });

    it("should return 'unknown' when no relevant conditions match", () => {
      const cr: AAPCR = {
        status: {
          conditions: [
            {
              type: "Unknown",
              status: "False",
              reason: "",
              message: "",
            },
          ],
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: false },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({ kind: "unknown" });
      expect(condition).toBeUndefined();
    });

    it("should not confuse a Running/True condition with Successful", () => {
      const conditions: StatusCondition[] = [
        {
          type: "Running",
          status: "True",
          reason: "Running",
          message: "Running reconciliation",
        },
      ];
      const cr: AAPCR = {
        status: {
          conditions,
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: false },
      };
      const [status] = mapAnsibleStatus(cr);
      expect(status).toEqual({ kind: "provisioning" });
    });

    it("should not confuse a Failure/True condition with Successful", () => {
      const failureCondition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "Something broke",
      };
      const cr: AAPCR = {
        status: {
          conditions: [failureCondition],
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: false },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({
        kind: "error",
        errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
      });
      expect(condition).toEqual(failureCondition);
    });

    it("should prioritize 'Successful' over 'Running' when both conditions are present", () => {
      const conditions: StatusCondition[] = [
        {
          type: "Running",
          status: "True",
          reason: "Running",
          message: "Running reconciliation",
        },
        {
          type: "Successful",
          status: "True",
          reason: "Successful",
          message: "",
        },
      ];
      const cr: AAPCR = {
        status: {
          conditions,
          URL: "http://test.com",
          adminPasswordSecret: "secret",
          adminUser: "admin",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: false },
      };
      const [status] = mapAnsibleStatus(cr);
      expect(status).toEqual({ kind: "ready" });
    });

    it("should return 'error' when idle_aap is true but a failure condition is present", () => {
      const failureCondition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "ReconciliationFailed",
        message: "Task failed: some operator error",
      };
      const cr: AAPCR = {
        status: {
          conditions: [failureCondition],
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: true },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({
        kind: "error",
        errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
      });
      expect(condition).toEqual(failureCondition);
    });

    it("should prioritize 'idled' over conditions when idle_aap is true", () => {
      const cr: AAPCR = {
        status: {
          conditions: [
            {
              type: "Successful",
              status: "True",
              reason: "Successful",
              message: "",
            },
          ],
          URL: "http://test.com",
          adminPasswordSecret: "secret",
          adminUser: "admin",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: true },
      };
      const [status] = mapAnsibleStatus(cr);
      expect(status).toEqual({ kind: "idled" });
    });

    it("should prioritize 'Failure' over 'Running' when both are present and no Successful match", () => {
      const failureCondition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "Provisioning failed",
      };
      const cr: AAPCR = {
        status: {
          conditions: [
            {
              type: "Running",
              status: "True",
              reason: "Running",
              message: "Running reconciliation",
            },
            failureCondition,
          ],
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: false },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({
        kind: "error",
        errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
      });
      expect(condition).toEqual(failureCondition);
    });

    it("should prioritize 'Failure' over 'Successful' when both are present", () => {
      const failureCondition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "Something went wrong",
      };
      const successCondition: StatusCondition = {
        type: "Successful",
        status: "True",
        reason: "Successful",
        message: "",
      };
      const cr: AAPCR = {
        status: {
          conditions: [successCondition, failureCondition],
          URL: "http://test.com",
          adminPasswordSecret: "secret",
          adminUser: "admin",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: false },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({
        kind: "error",
        errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
      });
      expect(condition).toEqual(failureCondition);
    });

    it("should prioritize 'Failure' when all three condition types are present", () => {
      const failureCondition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "Critical failure",
      };
      const cr: AAPCR = {
        status: {
          conditions: [
            {
              type: "Running",
              status: "True",
              reason: "Running",
              message: "Running reconciliation",
            },
            {
              type: "Successful",
              status: "True",
              reason: "Successful",
              message: "",
            },
            failureCondition,
          ],
          URL: "http://test.com",
          adminPasswordSecret: "secret",
          adminUser: "admin",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: false },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({
        kind: "error",
        errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
      });
      expect(condition).toEqual(failureCondition);
    });

    it("should return 'idled' when idle_aap is true with Running/True condition (idle beats Running)", () => {
      const cr: AAPCR = {
        status: {
          conditions: [
            {
              type: "Running",
              status: "True",
              reason: "Running",
              message: "Running reconciliation",
            },
          ],
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
        },
        spec: { idle_aap: true },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({ kind: "idled" });
      expect(condition).toBeUndefined();
    });

    it("should return 'idled' when idle_aap is true with Running/True and unidle annotation (idle still beats Running)", () => {
      const cr: AAPCR = {
        status: {
          conditions: [
            {
              type: "Running",
              status: "True",
              reason: "Running",
              message: "Running reconciliation",
            },
          ],
          URL: "",
          adminPasswordSecret: "",
          adminUser: "",
        },
        metadata: {
          name: "test",
          uuid: "123",
          creationTimestamp: "2024-01-01",
          annotations: {
            "sandbox.redhat.com/unidle-requested-at": "2026-08-05T12:00:00Z",
          },
        },
        spec: { idle_aap: true },
      };
      const [status, condition] = mapAnsibleStatus(cr);
      expect(status).toEqual({ kind: "idled" });
      expect(condition).toBeUndefined();
    });

    describe("grace period", () => {
      const recoverableCondition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "unknown playbook failure",
      };

      const nonRecoverableCondition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "Task failed: some operator error",
      };

      const baseTimestamp = "2026-08-05T12:00:00Z";
      const baseMs = new Date(baseTimestamp).getTime();

      it("should return 'provisioning' when failure is recoverable and creationTimestamp is within grace period", () => {
        const now = baseMs + 10 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({ kind: "provisioning" });
        expect(condition).toEqual(recoverableCondition);
      });

      it("should return 'error' when failure is recoverable but creationTimestamp is past grace period", () => {
        const now = baseMs + 51 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
      });

      it("should return 'unidling' when failure is recoverable and unidle annotation is within grace period", () => {
        const unidleTimestamp = "2026-08-05T13:00:00Z";
        const now = new Date(unidleTimestamp).getTime() + 10 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": unidleTimestamp,
            },
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({ kind: "unidling" });
        expect(condition).toEqual(recoverableCondition);
      });

      it("should return 'error' when failure is recoverable but unidle annotation is past grace period", () => {
        const unidleTimestamp = "2026-08-05T13:00:00Z";
        const now = new Date(unidleTimestamp).getTime() + 51 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": unidleTimestamp,
            },
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
      });

      it("should prefer 'provisioning' over 'unidling' when both timestamps are within grace period", () => {
        const now = baseMs + 10 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": baseTimestamp,
            },
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({ kind: "provisioning" });
      });

      it("should not apply grace period for non-recoverable failures even with a recent unidle annotation", () => {
        const now = baseMs + 5 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [nonRecoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": baseTimestamp,
            },
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
      });

      it("should return 'unidling' when creationTimestamp is past grace period but unidle annotation is within", () => {
        const unidleTimestamp = "2026-08-05T13:00:00Z";
        const now = baseMs + 65 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": unidleTimestamp,
            },
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({ kind: "unidling" });
        expect(condition).toEqual(recoverableCondition);
      });

      it("should return 'error' when both creationTimestamp and unidle annotation are past grace period", () => {
        const unidleTimestamp = "2026-08-05T12:30:00Z";
        const now = baseMs + 80 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": unidleTimestamp,
            },
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
      });

      it("should return 'error' at exactly the 50-minute creationTimestamp boundary", () => {
        const now = baseMs + 50 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
      });

      it("should return 'provisioning' just inside the 50-minute creationTimestamp boundary", () => {
        const now = baseMs + 49 * 60 * 1000 + 59 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({ kind: "provisioning" });
      });

      it("should return 'error' when idle_aap is true and failure is recoverable within grace period (failure beats idle)", () => {
        const now = baseMs + 51 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
          },
          spec: { idle_aap: true },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
      });

      it("should return 'provisioning' when idle_aap is true but failure is recoverable within grace period", () => {
        const now = baseMs + 10 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
          },
          spec: { idle_aap: true },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({ kind: "provisioning" });
      });

      it("should not treat a missing unidle annotation as a grace period source", () => {
        const now = baseMs + 51 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {},
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
      });

      it("should return 'error' at exactly the 50-minute unidle annotation boundary", () => {
        const unidleTimestamp = "2026-08-05T13:00:00Z";
        const unidleMs = new Date(unidleTimestamp).getTime();
        const now = unidleMs + 50 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": unidleTimestamp,
            },
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
      });

      it("should return 'unidling' just inside the 50-minute unidle annotation boundary (49m59s)", () => {
        const unidleTimestamp = "2026-08-05T13:00:00Z";
        const unidleMs = new Date(unidleTimestamp).getTime();
        const now = unidleMs + 49 * 60 * 1000 + 59 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": unidleTimestamp,
            },
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({ kind: "unidling" });
        expect(condition).toEqual(recoverableCondition);
      });

      it("should return 'unidling' when idle_aap is true but recoverable failure with unidle annotation is within grace", () => {
        const unidleTimestamp = "2026-08-05T13:00:00Z";
        const now = new Date(unidleTimestamp).getTime() + 10 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": unidleTimestamp,
            },
          },
          spec: { idle_aap: true },
        };
        const [status, condition] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({ kind: "unidling" });
        expect(condition).toEqual(recoverableCondition);
      });

      it("should return 'provisioning' when idle_aap is true and creationTimestamp grace is still active", () => {
        const now = baseMs + 10 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": baseTimestamp,
            },
          },
          spec: { idle_aap: true },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({ kind: "provisioning" });
      });

      it("should return 'error' when idle_aap is true and both creation and unidle timestamps are past grace period", () => {
        const unidleTimestamp = "2026-08-05T12:30:00Z";
        const now = baseMs + 80 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": unidleTimestamp,
            },
          },
          spec: { idle_aap: true },
        };
        const [status, condition] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
        expect(condition).toEqual(recoverableCondition);
      });
    });

    describe("unidle annotation with Running condition", () => {
      const runningCondition: StatusCondition = {
        type: "Running",
        status: "True",
        reason: "Running",
        message: "Running reconciliation",
      };

      it("should return 'unidling' when Running and unidle annotation is present", () => {
        const cr: AAPCR = {
          status: { conditions: [runningCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": "2026-08-05T12:00:00Z",
            },
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "unidling" });
        expect(condition).toEqual(runningCondition);
      });

      it("should return 'provisioning' when Running and no unidle annotation", () => {
        const cr: AAPCR = {
          status: { conditions: [runningCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "provisioning" });
        expect(condition).toEqual(runningCondition);
      });

      it("should return 'provisioning' when Running and annotations object exists but unidle key is absent", () => {
        const cr: AAPCR = {
          status: { conditions: [runningCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
            annotations: {},
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "provisioning" });
        expect(condition).toEqual(runningCondition);
      });
    });

    describe("conditions with status 'False' (resolved/inactive conditions)", () => {
      it("should not treat Failure/False as a failure — falls through to next matching condition", () => {
        const resolvedFailure: StatusCondition = {
          type: "Failure",
          status: "False",
          reason: "Failed",
          message: "Task failed: some operator error",
        };
        const successCondition: StatusCondition = {
          type: "Successful",
          status: "True",
          reason: "Successful",
          message: "",
        };
        const cr: AAPCR = {
          status: { conditions: [resolvedFailure, successCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "ready" });
        expect(condition).toEqual(successCondition);
      });

      it("should not treat Running/False as provisioning — returns unknown when no other conditions match", () => {
        const inactiveRunning: StatusCondition = {
          type: "Running",
          status: "False",
          reason: "Idle",
          message: "",
        };
        const cr: AAPCR = {
          status: { conditions: [inactiveRunning] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "unknown" });
        expect(condition).toBeUndefined();
      });

      it("should not treat Successful/False as ready — returns unknown when no other conditions match", () => {
        const inactiveSuccess: StatusCondition = {
          type: "Successful",
          status: "False",
          reason: "Pending",
          message: "",
        };
        const cr: AAPCR = {
          status: { conditions: [inactiveSuccess] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "unknown" });
        expect(condition).toBeUndefined();
      });

      it("should return 'provisioning' when Failure/False exists alongside Running/True", () => {
        const resolvedFailure: StatusCondition = {
          type: "Failure",
          status: "False",
          reason: "Recovered",
          message: "",
        };
        const runningCondition: StatusCondition = {
          type: "Running",
          status: "True",
          reason: "Running",
          message: "Running reconciliation",
        };
        const cr: AAPCR = {
          status: { conditions: [resolvedFailure, runningCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "provisioning" });
        expect(condition).toEqual(runningCondition);
      });

      it("should return 'unidling' when Failure/False exists alongside Running/True with unidle annotation", () => {
        const resolvedFailure: StatusCondition = {
          type: "Failure",
          status: "False",
          reason: "Recovered",
          message: "",
        };
        const runningCondition: StatusCondition = {
          type: "Running",
          status: "True",
          reason: "Running",
          message: "Running reconciliation",
        };
        const cr: AAPCR = {
          status: { conditions: [resolvedFailure, runningCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": "2026-08-05T12:00:00Z",
            },
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "unidling" });
        expect(condition).toEqual(runningCondition);
      });

      it("should return 'idled' when Failure/False exists and idle_aap is true without other active conditions", () => {
        const resolvedFailure: StatusCondition = {
          type: "Failure",
          status: "False",
          reason: "Recovered",
          message: "",
        };
        const cr: AAPCR = {
          status: { conditions: [resolvedFailure] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
          },
          spec: { idle_aap: true },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "idled" });
        expect(condition).toBeUndefined();
      });

      it("should return 'idled' when Failure/False and Running/True coexist with idle_aap=true (idle beats Running)", () => {
        const resolvedFailure: StatusCondition = {
          type: "Failure",
          status: "False",
          reason: "Recovered",
          message: "",
        };
        const runningCondition: StatusCondition = {
          type: "Running",
          status: "True",
          reason: "Running",
          message: "Running reconciliation",
        };
        const cr: AAPCR = {
          status: { conditions: [resolvedFailure, runningCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
          },
          spec: { idle_aap: true },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "idled" });
        expect(condition).toBeUndefined();
      });

      it("should return 'provisioning' when Running/True and Successful/False coexist (Successful/False does not count as ready)", () => {
        const inactiveSuccess: StatusCondition = {
          type: "Successful",
          status: "False",
          reason: "Pending",
          message: "",
        };
        const runningCondition: StatusCondition = {
          type: "Running",
          status: "True",
          reason: "Running",
          message: "Running reconciliation",
        };
        const cr: AAPCR = {
          status: { conditions: [inactiveSuccess, runningCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "provisioning" });
        expect(condition).toEqual(runningCondition);
      });

      it("should return 'unidling' when Running/True with unidle annotation even when Successful/False is present", () => {
        const inactiveSuccess: StatusCondition = {
          type: "Successful",
          status: "False",
          reason: "Pending",
          message: "",
        };
        const runningCondition: StatusCondition = {
          type: "Running",
          status: "True",
          reason: "Running",
          message: "Running reconciliation",
        };
        const cr: AAPCR = {
          status: { conditions: [inactiveSuccess, runningCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": "2026-08-05T12:00:00Z",
            },
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "unidling" });
        expect(condition).toEqual(runningCondition);
      });
    });

    describe("Successful condition with unidle annotation", () => {
      it("should return 'ready' when Successful condition is present even with unidle annotation", () => {
        const successCondition: StatusCondition = {
          type: "Successful",
          status: "True",
          reason: "Successful",
          message: "",
        };
        const cr: AAPCR = {
          status: { conditions: [successCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": "2026-08-05T12:00:00Z",
            },
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "ready" });
        expect(condition).toEqual(successCondition);
      });

      it("should return 'ready' when Running/True + Successful/True are both present with unidle annotation (Successful wins)", () => {
        const successCondition: StatusCondition = {
          type: "Successful",
          status: "True",
          reason: "Successful",
          message: "",
        };
        const runningCondition: StatusCondition = {
          type: "Running",
          status: "True",
          reason: "Running",
          message: "Running reconciliation",
        };
        const cr: AAPCR = {
          status: { conditions: [runningCondition, successCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": "2026-08-05T12:00:00Z",
            },
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "ready" });
        expect(condition).toEqual(successCondition);
      });
    });

    describe("multiple failure conditions", () => {
      it("should use the first matching Failure/True condition", () => {
        const firstFailure: StatusCondition = {
          type: "Failure",
          status: "True",
          reason: "Failed",
          message: "first failure message",
        };
        const secondFailure: StatusCondition = {
          type: "Failure",
          status: "True",
          reason: "ReconciliationFailed",
          message: "second failure message",
        };
        const cr: AAPCR = {
          status: { conditions: [firstFailure, secondFailure] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
        expect(condition).toEqual(firstFailure);
      });

      it("should use first Failure/True for recoverability check when multiple failures exist", () => {
        const baseTimestamp = "2026-08-05T12:00:00Z";
        const baseMs = new Date(baseTimestamp).getTime();
        const now = baseMs + 10 * 60 * 1000;
        const recoverableFailure: StatusCondition = {
          type: "Failure",
          status: "True",
          reason: "Failed",
          message: "unknown playbook failure",
        };
        const otherFailure: StatusCondition = {
          type: "Failure",
          status: "True",
          reason: "ReconciliationFailed",
          message: "some other error",
        };
        const cr: AAPCR = {
          status: { conditions: [recoverableFailure, otherFailure] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({ kind: "provisioning" });
        expect(condition).toEqual(recoverableFailure);
      });
    });

    describe("annotations undefined vs empty object", () => {
      const recoverableCondition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "unknown playbook failure",
      };

      const baseTimestamp = "2026-08-05T12:00:00Z";
      const baseMs = new Date(baseTimestamp).getTime();

      it("should return 'error' when annotations is undefined and creation grace is expired", () => {
        const now = baseMs + 51 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
      });

      it("should return 'error' when annotations is an empty object and creation grace is expired", () => {
        const now = baseMs + 51 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {},
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
      });

      it("should return 'unidling' when annotations has unidle key and creation grace is expired", () => {
        const unidleTimestamp = "2026-08-05T13:00:00Z";
        const now = baseMs + 65 * 60 * 1000;
        const cr: AAPCR = {
          status: { conditions: [recoverableCondition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
            annotations: {
              "sandbox.redhat.com/unidle-requested-at": unidleTimestamp,
            },
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({ kind: "unidling" });
        expect(condition).toEqual(recoverableCondition);
      });
    });

    describe("partial match of recoverable error message", () => {
      const baseTimestamp = "2026-08-05T12:00:00Z";
      const baseMs = new Date(baseTimestamp).getTime();

      it("should NOT treat 'unknown playbook failure occurred' as recoverable (must be exact match)", () => {
        const now = baseMs + 10 * 60 * 1000;
        const condition: StatusCondition = {
          type: "Failure",
          status: "True",
          reason: "Failed",
          message: "unknown playbook failure occurred",
        };
        const cr: AAPCR = {
          status: { conditions: [condition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
      });

      it("should NOT treat 'Unknown playbook failure' (different case) as recoverable", () => {
        const now = baseMs + 10 * 60 * 1000;
        const condition: StatusCondition = {
          type: "Failure",
          status: "True",
          reason: "Failed",
          message: "Unknown playbook failure",
        };
        const cr: AAPCR = {
          status: { conditions: [condition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
      });

      it("should NOT treat ' unknown playbook failure' (leading space) as recoverable", () => {
        const now = baseMs + 10 * 60 * 1000;
        const condition: StatusCondition = {
          type: "Failure",
          status: "True",
          reason: "Failed",
          message: " unknown playbook failure",
        };
        const cr: AAPCR = {
          status: { conditions: [condition] },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: baseTimestamp,
          },
          spec: { idle_aap: false },
        };
        const [status] = mapAnsibleStatus(cr, now);
        expect(status).toEqual({
          kind: "error",
          errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
        });
      });
    });

    describe("CR with missing status field", () => {
      it("should return 'unknown' when the CR has no status field at all", () => {
        const cr = {
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
          },
          spec: { idle_aap: false },
        } as AAPCR;
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "unknown" });
        expect(condition).toBeUndefined();
      });

      it("should return 'unknown' when conditions field is undefined within status", () => {
        const cr: AAPCR = {
          status: {
            URL: "http://test.com",
            adminPasswordSecret: "secret",
            adminUser: "admin",
          },
          metadata: {
            name: "test",
            uuid: "123",
            creationTimestamp: "2024-01-01",
          },
          spec: { idle_aap: false },
        };
        const [status, condition] = mapAnsibleStatus(cr);
        expect(status).toEqual({ kind: "unknown" });
        expect(condition).toBeUndefined();
      });
    });
  });

  describe("isErrorRecoverable", () => {
    const recoverableCondition: StatusCondition = {
      type: "Failure",
      status: "True",
      reason: "Failed",
      message: "unknown playbook failure",
    };

    const baseTimestamp = "2026-08-05T12:00:00Z";
    const baseMs = new Date(baseTimestamp).getTime();

    it("returns true for 'unknown playbook failure' within the 50 minute window", () => {
      const now = baseMs + 30 * 60 * 1000;
      expect(isErrorRecoverable(recoverableCondition, baseTimestamp, now)).toBe(
        true,
      );
    });

    it("returns false for 'unknown playbook failure' after the 50 minute window", () => {
      const now = baseMs + 51 * 60 * 1000;
      expect(isErrorRecoverable(recoverableCondition, baseTimestamp, now)).toBe(
        false,
      );
    });

    it("returns false for 'unknown playbook failure' at exactly the 50 minute boundary", () => {
      const now = baseMs + 50 * 60 * 1000;
      expect(isErrorRecoverable(recoverableCondition, baseTimestamp, now)).toBe(
        false,
      );
    });

    it("returns false for a different failure message within the 50 minute window", () => {
      const condition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "Task failed: some operator error",
      };
      const now = baseMs + 10 * 60 * 1000;
      expect(isErrorRecoverable(condition, baseTimestamp, now)).toBe(false);
    });

    it("returns false for a different failure message after the 50 minute window", () => {
      const condition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "EDA creation failed",
      };
      const now = baseMs + 60 * 60 * 1000;
      expect(isErrorRecoverable(condition, baseTimestamp, now)).toBe(false);
    });

    it("returns true just inside the 50-minute boundary (49m59s)", () => {
      const now = baseMs + 49 * 60 * 1000 + 59 * 1000;
      expect(isErrorRecoverable(recoverableCondition, baseTimestamp, now)).toBe(
        true,
      );
    });

    it("returns false for an empty failure message within the window", () => {
      const condition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "",
      };
      const now = baseMs + 10 * 60 * 1000;
      expect(isErrorRecoverable(condition, baseTimestamp, now)).toBe(false);
    });

    it("returns false for a case-different 'Unknown Playbook Failure' message", () => {
      const condition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "Unknown Playbook Failure",
      };
      const now = baseMs + 10 * 60 * 1000;
      expect(isErrorRecoverable(condition, baseTimestamp, now)).toBe(false);
    });

    it("returns true when timestamp is the same as now minus 1ms", () => {
      const now = baseMs + 1;
      expect(isErrorRecoverable(recoverableCondition, baseTimestamp, now)).toBe(
        true,
      );
    });

    it("returns true when now equals the timestamp (0ms elapsed)", () => {
      expect(
        isErrorRecoverable(recoverableCondition, baseTimestamp, baseMs),
      ).toBe(true);
    });

    it("returns false when timestamp is an invalid date string", () => {
      const now = Date.now();
      expect(isErrorRecoverable(recoverableCondition, "not-a-date", now)).toBe(
        false,
      );
    });

    it("returns false when timestamp is an empty string", () => {
      const now = Date.now();
      expect(isErrorRecoverable(recoverableCondition, "", now)).toBe(false);
    });

    it("returns true when used with a unidle annotation timestamp within window", () => {
      const unidleTimestamp = "2026-08-05T14:00:00Z";
      const unidleMs = new Date(unidleTimestamp).getTime();
      const now = unidleMs + 20 * 60 * 1000;
      expect(
        isErrorRecoverable(recoverableCondition, unidleTimestamp, now),
      ).toBe(true);
    });

    it("returns false when used with a unidle annotation timestamp past window", () => {
      const unidleTimestamp = "2026-08-05T14:00:00Z";
      const unidleMs = new Date(unidleTimestamp).getTime();
      const now = unidleMs + 51 * 60 * 1000;
      expect(
        isErrorRecoverable(recoverableCondition, unidleTimestamp, now),
      ).toBe(false);
    });

    it("returns false at exactly the 50-minute boundary for a unidle annotation timestamp", () => {
      const unidleTimestamp = "2026-08-05T14:00:00Z";
      const unidleMs = new Date(unidleTimestamp).getTime();
      const now = unidleMs + 50 * 60 * 1000;
      expect(
        isErrorRecoverable(recoverableCondition, unidleTimestamp, now),
      ).toBe(false);
    });

    it("returns true just inside the 50-minute boundary for a unidle annotation timestamp (49m59s)", () => {
      const unidleTimestamp = "2026-08-05T14:00:00Z";
      const unidleMs = new Date(unidleTimestamp).getTime();
      const now = unidleMs + 49 * 60 * 1000 + 59 * 1000;
      expect(
        isErrorRecoverable(recoverableCondition, unidleTimestamp, now),
      ).toBe(true);
    });

    it("returns false for a partial match message 'unknown playbook failure occurred'", () => {
      const condition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "unknown playbook failure occurred",
      };
      const now = baseMs + 10 * 60 * 1000;
      expect(isErrorRecoverable(condition, baseTimestamp, now)).toBe(false);
    });

    it("returns false for a message with leading whitespace ' unknown playbook failure'", () => {
      const condition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: " unknown playbook failure",
      };
      const now = baseMs + 10 * 60 * 1000;
      expect(isErrorRecoverable(condition, baseTimestamp, now)).toBe(false);
    });

    it("returns false for a message with trailing whitespace 'unknown playbook failure '", () => {
      const condition: StatusCondition = {
        type: "Failure",
        status: "True",
        reason: "Failed",
        message: "unknown playbook failure ",
      };
      const now = baseMs + 10 * 60 * 1000;
      expect(isErrorRecoverable(condition, baseTimestamp, now)).toBe(false);
    });

    it("returns true when now is before the timestamp (negative elapsed)", () => {
      const now = baseMs - 1000;
      expect(isErrorRecoverable(recoverableCondition, baseTimestamp, now)).toBe(
        true,
      );
    });
  });

  describe("AAPObject", () => {
    it("should be valid JSON", () => {
      expect(() => JSON.parse(AAPObject)).not.toThrow();
    });

    it("should have required fields", () => {
      const parsed = JSON.parse(AAPObject);
      expect(parsed.apiVersion).toBe("aap.ansible.com/v1alpha1");
      expect(parsed.kind).toBe("AnsibleAutomationPlatform");
      expect(parsed.metadata.name).toBe("sandbox-aap");
      expect(parsed.spec).toBeDefined();
    });

    it("should have correct resource configurations", () => {
      const parsed = JSON.parse(AAPObject);
      expect(parsed.spec.idle_aap).toBe(false);
      expect(parsed.spec.no_log).toBe(false);
      expect(parsed.spec.api.replicas).toBe(1);
      expect(parsed.spec.hub.storage_type).toBe("file");
      expect(parsed.spec.hub.file_storage_storage_class).toBe("efs-sc");
    });
  });
});
