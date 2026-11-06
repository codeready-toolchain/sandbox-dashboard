import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  AnalyticsContext,
  noopAnalyticsContext,
} from "../../../hooks/AnalyticsContext";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext } from "../../../hooks/UserContext";
import { UserSignupPhase } from "../../../hooks/userSignupPhase";
import { readyUserFixture } from "../../../mocks/fixtures";
import { ActivationCodeLink } from "../ActivationCodeLink";

/**
 * Covers when the catalog activation-code link is shown, and that
 * choosing it opens the activation code dialog.
 */
function makeContext(
  overrides: Partial<UserContextType> = {},
): UserContextType {
  return {
    user: undefined,
    userSignupPhase: UserSignupPhase.NOT_STARTED,
    refetchUserData: vi.fn().mockResolvedValue(undefined),
    signupUser: vi.fn(),
    ...overrides,
  };
}

function renderLink(overrides: Partial<UserContextType> = {}) {
  return render(
    <AnalyticsContext.Provider value={noopAnalyticsContext}>
      <UserContext.Provider value={makeContext(overrides)}>
        <ActivationCodeLink />
      </UserContext.Provider>
    </AnalyticsContext.Provider>,
  );
}

describe("ActivationCodeLink", () => {
  it("shows the activation code link before signup has started", () => {
    renderLink();

    expect(
      screen.getByRole("button", { name: "Have an activation code?" }),
    ).toBeInTheDocument();
  });

  it("opens the activation code dialog from the link", async () => {
    const user = userEvent.setup();
    renderLink();

    expect(
      screen.queryByRole("dialog", { name: "Enter the activation code" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Have an activation code?" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Enter the activation code" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["INITIAL_FETCH", UserSignupPhase.INITIAL_FETCH],
    ["BLOCKED", UserSignupPhase.BLOCKED],
    ["SIGNING_UP", UserSignupPhase.SIGNING_UP],
    ["PENDING_PHONE_VERIFICATION", UserSignupPhase.PENDING_PHONE_VERIFICATION],
    ["PENDING_MANUAL_APPROVAL", UserSignupPhase.PENDING_MANUAL_APPROVAL],
    ["PROVISIONING", UserSignupPhase.PROVISIONING],
    ["PROVISIONING_TIMED_OUT", UserSignupPhase.PROVISIONING_TIMED_OUT],
    ["READY", UserSignupPhase.READY],
  ] as const)(
    "hides the link when signup phase is %s",
    (_, userSignupPhase) => {
      renderLink({
        user:
          userSignupPhase === UserSignupPhase.INITIAL_FETCH
            ? undefined
            : readyUserFixture,
        userSignupPhase,
      });

      expect(
        screen.queryByRole("button", { name: "Have an activation code?" }),
      ).not.toBeInTheDocument();
    },
  );
});
