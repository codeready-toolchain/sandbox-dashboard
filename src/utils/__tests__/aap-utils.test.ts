import type { AAPCR, StatusCondition } from "../../types";
import {
  AAPInstanceErrorType,
  AAPObject,
  decode,
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

    it("should return 'idled' when idle_aap is true and conditions are empty", () => {
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
      expect(status).toEqual({ kind: "idled" });
      expect(condition).toBeUndefined();
    });

    it("should return 'idled' when idle_aap is true and status.conditions is missing", () => {
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
      expect(status).toEqual({ kind: "idled" });
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
