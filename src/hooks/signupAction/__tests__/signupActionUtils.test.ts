import { UserSignupPhase } from "../../userSignupPhase";
import { isSignupActionInterrupt } from "../signupActionUtils";

describe("isSignupActionInterrupt", () => {
  it("returns true for phone verification, approval, blocked and timeout", () => {
    expect(
      isSignupActionInterrupt(
        UserSignupPhase.PENDING_PHONE_VERIFICATION,
        false,
      ),
    ).toBe(true);
    expect(
      isSignupActionInterrupt(UserSignupPhase.PENDING_MANUAL_APPROVAL, false),
    ).toBe(true);
    expect(isSignupActionInterrupt(UserSignupPhase.BLOCKED, false)).toBe(true);
    expect(
      isSignupActionInterrupt(UserSignupPhase.PROVISIONING_TIMED_OUT, false),
    ).toBe(true);
  });

  it("treats NOT_STARTED as an interrupt only after signup has progressed", () => {
    expect(isSignupActionInterrupt(UserSignupPhase.NOT_STARTED, false)).toBe(
      false,
    );
    expect(isSignupActionInterrupt(UserSignupPhase.NOT_STARTED, true)).toBe(
      true,
    );
  });

  it("returns false for in-progress and ready phases", () => {
    expect(isSignupActionInterrupt(UserSignupPhase.SIGNING_UP, true)).toBe(
      false,
    );
    expect(isSignupActionInterrupt(UserSignupPhase.PROVISIONING, true)).toBe(
      false,
    );
    expect(isSignupActionInterrupt(UserSignupPhase.READY, true)).toBe(false);
    expect(isSignupActionInterrupt(UserSignupPhase.INITIAL_FETCH, false)).toBe(
      false,
    );
  });
});
