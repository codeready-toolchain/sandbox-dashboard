import { renderHook } from "@testing-library/react";
import { useAnsibleContext } from "../AnsibleContext";

describe("useAnsibleContext", () => {
  it("throws when used outside of AnsibleContext.Provider", () => {
    expect(() => renderHook(() => useAnsibleContext())).toThrow(
      "Context useAnsibleContext is not defined",
    );
  });
});
