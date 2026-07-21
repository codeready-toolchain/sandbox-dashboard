import type { StatusCondition } from "../../types";
import { ProvisioningError } from "../ProvisioningError";

describe("ProvisioningError", () => {
  const condition: StatusCondition = {
    type: "Failure",
    status: "True",
    reason: "ReconciliationFailed",
    message: "Task failed: some operator error",
  };

  describe("with AAP product", () => {
    it("creates an error with the condition's message", () => {
      const error = new ProvisioningError("AAP", condition);

      expect(error.message).toBe(
        "AAP provisioning failed: Task failed: some operator error",
      );
      expect(error.name).toBe("ProvisioningError");
    });

    it("is an instance of Error", () => {
      const error = new ProvisioningError("AAP", condition);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ProvisioningError);
    });

    it("formats a detailed error message with all condition fields", () => {
      const error = new ProvisioningError("AAP", condition);

      const formatted = error.getFormattedErrorMessage();
      expect(formatted).toContain("AAP provisioning failed:");
      expect(formatted).toContain('"type":"Failure"');
      expect(formatted).toContain('"reason":"ReconciliationFailed"');
      expect(formatted).toContain(
        '"message":"Task failed: some operator error"',
      );
      expect(formatted).toContain('"status":"True"');
    });

    it("handles a condition with empty fields", () => {
      const emptyCondition: StatusCondition = {
        type: "",
        status: "",
        reason: "",
        message: "",
      };
      const error = new ProvisioningError("AAP", emptyCondition);

      expect(error.message).toBe("AAP provisioning failed: ");
      expect(error.getFormattedErrorMessage()).toContain('"type":""');
    });
  });

  describe("with OpenClaw product", () => {
    it("creates an error with the OpenClaw product prefix", () => {
      const error = new ProvisioningError("OpenClaw", condition);

      expect(error.message).toBe(
        "OpenClaw provisioning failed: Task failed: some operator error",
      );
      expect(error.name).toBe("ProvisioningError");
    });

    it("formats a detailed error message with the OpenClaw prefix", () => {
      const error = new ProvisioningError("OpenClaw", condition);

      const formatted = error.getFormattedErrorMessage();
      expect(formatted).toContain("OpenClaw provisioning failed:");
      expect(formatted).toContain('"type":"Failure"');
      expect(formatted).toContain('"reason":"ReconciliationFailed"');
    });
  });
});
