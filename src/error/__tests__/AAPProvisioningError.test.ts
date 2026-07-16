import type { StatusCondition } from "../../types";
import { AAPProvisioningError } from "../AAPProvisioningError";

describe("AAPProvisioningError", () => {
  const condition: StatusCondition = {
    type: "Failure",
    status: "True",
    reason: "ReconciliationFailed",
    message: "Task failed: some operator error",
  };

  it("creates an error with the condition's message", () => {
    const error = new AAPProvisioningError(condition);

    expect(error.message).toBe(
      "AAP provisioning failed: Task failed: some operator error",
    );
    expect(error.name).toBe("AAPProvisioningError");
  });

  it("is an instance of Error", () => {
    const error = new AAPProvisioningError(condition);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AAPProvisioningError);
  });

  it("formats a detailed error message with all condition fields", () => {
    const error = new AAPProvisioningError(condition);

    const formatted = error.getFormattedErrorMessage();
    expect(formatted).toContain('"type": "Failure"');
    expect(formatted).toContain('"reason": "ReconciliationFailed"');
    expect(formatted).toContain(
      '"message": "Task failed: some operator error"',
    );
    expect(formatted).toContain('"status": "True"');
  });

  it("handles a condition with empty fields", () => {
    const emptyCondition: StatusCondition = {
      type: "",
      status: "",
      reason: "",
      message: "",
    };
    const error = new AAPProvisioningError(emptyCondition);

    expect(error.message).toBe("AAP provisioning failed: ");
    expect(error.getFormattedErrorMessage()).toContain('"type": ""');
  });
});
