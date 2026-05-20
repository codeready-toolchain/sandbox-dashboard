import { decode, getReadyCondition, AnsibleStatus, AAPObject } from "../aap-utils";
import type { AAPData, StatusCondition } from "../../types";

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

  describe("getReadyCondition", () => {
    const mockSetError = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return NEW status when data is undefined", () => {
      expect(getReadyCondition(undefined, mockSetError)).toBe(
        AnsibleStatus.NEW,
      );
      expect(mockSetError).not.toHaveBeenCalled();
    });

    it("should return NEW status when items array is empty", () => {
      const data: AAPData = { items: [] };
      expect(getReadyCondition(data, mockSetError)).toBe(AnsibleStatus.NEW);
      expect(mockSetError).not.toHaveBeenCalled();
    });

    it("should return UNKNOWN status when status or conditions are missing", () => {
      const data: AAPData = {
        items: [
          {
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
          },
        ],
      };
      expect(getReadyCondition(data, mockSetError)).toBe(
        AnsibleStatus.UNKNOWN,
      );
      expect(mockSetError).not.toHaveBeenCalled();
    });

    it("should return IDLED status when idle_aap is true", () => {
      const data: AAPData = {
        items: [
          {
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
          },
        ],
      };
      expect(getReadyCondition(data, mockSetError)).toBe(AnsibleStatus.IDLED);
      expect(mockSetError).not.toHaveBeenCalled();
    });

    it("should return READY status when Successful condition is true", () => {
      const conditions: StatusCondition[] = [
        {
          type: "Successful",
          status: "True",
          reason: "Successful",
          message: "",
        },
      ];
      const data: AAPData = {
        items: [
          {
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
          },
        ],
      };
      expect(getReadyCondition(data, mockSetError)).toBe(AnsibleStatus.READY);
      expect(mockSetError).not.toHaveBeenCalled();
    });

    it("should return UNKNOWN and set error when Failure condition is true", () => {
      const msg = "Something went wrong";
      const conditions: StatusCondition[] = [
        {
          type: "Failure",
          status: "True",
          reason: "Failed",
          message: msg,
        },
      ];
      const data: AAPData = {
        items: [
          {
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
          },
        ],
      };
      expect(getReadyCondition(data, mockSetError)).toBe(
        AnsibleStatus.UNKNOWN,
      );
      expect(mockSetError).toHaveBeenCalledWith(msg);
    });

    it("should return PROVISIONING when Running condition is true", () => {
      const conditions: StatusCondition[] = [
        {
          type: "Running",
          status: "True",
          reason: "Running",
          message: "Running reconciliation",
        },
      ];
      const data: AAPData = {
        items: [
          {
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
          },
        ],
      };
      expect(getReadyCondition(data, mockSetError)).toBe(
        AnsibleStatus.PROVISIONING,
      );
      expect(mockSetError).not.toHaveBeenCalled();
    });

    it("should return UNKNOWN when no relevant conditions are true", () => {
      const conditions: StatusCondition[] = [
        {
          type: "Unknown",
          status: "False",
          reason: "",
          message: "",
        },
      ];
      const data: AAPData = {
        items: [
          {
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
          },
        ],
      };
      expect(getReadyCondition(data, mockSetError)).toBe(
        AnsibleStatus.UNKNOWN,
      );
      expect(mockSetError).not.toHaveBeenCalled();
    });

    it("should handle multiple conditions and prioritize them correctly", () => {
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
      const data: AAPData = {
        items: [
          {
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
          },
        ],
      };
      expect(getReadyCondition(data, mockSetError)).toBe(AnsibleStatus.READY);
      expect(mockSetError).not.toHaveBeenCalled();
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
