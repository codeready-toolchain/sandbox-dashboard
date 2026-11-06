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
import { IntentEvent } from "../../../utils/analytics";
import { CatalogBanner } from "../CatalogBanner";

const trackIntent = vi.fn();

function makeContext(
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
 * Renders the banner with the required authentication and user
 * context providers.
 */
function renderBanner(userCtxOverrides: Partial<UserContextType> = {}) {
  return render(
    <AnalyticsContext.Provider value={{ ...noopAnalyticsContext, trackIntent }}>
      <UserContext.Provider value={makeContext(userCtxOverrides)}>
        <CatalogBanner />
      </UserContext.Provider>
    </AnalyticsContext.Provider>,
  );
}

describe("CatalogBanner", () => {
  it("renders welcome message with user name", () => {
    renderBanner();
    expect(screen.getByText(/Welcome, John/)).toBeInTheDocument();
  });

  it("shows skeletons while fetching data", () => {
    renderBanner({
      userSignupPhase: UserSignupPhase.INITIAL_FETCH,
    });
    expect(screen.getByTestId("banner-skeleton")).toBeInTheDocument();
  });

  it("shows try products message when signup has not started", () => {
    renderBanner({
      user: undefined,
      userSignupPhase: UserSignupPhase.NOT_STARTED,
    });
    expect(screen.getByText("Try Red Hat products")).toBeInTheDocument();
  });

  it("shows suspended message when phase is BLOCKED", () => {
    renderBanner({
      user: undefined,
      userSignupPhase: UserSignupPhase.BLOCKED,
    });
    expect(
      screen.getByText(
        "Your account is no longer allowed to use the Developer Sandbox.",
      ),
    ).toBeInTheDocument();
  });

  it("shows verification prompt when pending phone verification", () => {
    renderBanner({
      userSignupPhase: UserSignupPhase.PENDING_PHONE_VERIFICATION,
    });
    expect(
      screen.getByText(/verify your phone to be able to gain access/),
    ).toBeInTheDocument();
  });

  it("shows pending approval message", () => {
    renderBanner({
      userSignupPhase: UserSignupPhase.PENDING_MANUAL_APPROVAL,
    });
    expect(
      screen.getByText(/manual verification to use the products/),
    ).toBeInTheDocument();
  });

  it("shows welcome banner when signup phase is PROVISIONING and user exists", () => {
    renderBanner({
      userSignupPhase: UserSignupPhase.PROVISIONING,
    });
    expect(screen.getByText(/Welcome, John/)).toBeInTheDocument();
  });

  it("shows welcome banner when signup phase is SIGNING_UP and user exists", () => {
    renderBanner({
      userSignupPhase: UserSignupPhase.SIGNING_UP,
    });
    expect(screen.getByText(/Welcome, John/)).toBeInTheDocument();
  });

  it("shows 'Try Red Hat products' when signup phase is SIGNING_UP and user is undefined", () => {
    renderBanner({
      user: undefined,
      userSignupPhase: UserSignupPhase.SIGNING_UP,
    });
    expect(screen.getByText("Try Red Hat products")).toBeInTheDocument();
  });

  it("falls back to username when givenName is missing", () => {
    renderBanner({
      user: { ...readyUserFixture, givenName: "" },
    });
    expect(screen.getByText(/Welcome, johndoe/)).toBeInTheDocument();
  });

  it("shows days remaining when endDate is set", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const user = {
      ...readyUserFixture,
      endDate: futureDate.toISOString(),
    };
    renderBanner({ user });
    expect(
      screen.getByText(/Your free trial expires in \d+ days/),
    ).toBeInTheDocument();
  });

  it("trial-expiration popover contains a documentation link with the correct href", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const user = {
      ...readyUserFixture,
      endDate: futureDate.toISOString(),
    };
    renderBanner({ user });

    await userEvent.click(
      screen.getByRole("button", { name: "Show trial information" }),
    );

    const docLink = await screen.findByRole("link", {
      name: /View documentation/,
    });
    expect(docLink).toHaveAttribute(
      "href",
      "https://developers.redhat.com/learn/openshift/move-your-developer-sandbox-objects-another-cluster",
    );
  });

  it("tracks the Contact sales button", async () => {
    renderBanner();

    const button = screen.getByRole("button", { name: "Contact sales" });
    expect(button).toHaveAttribute("data-analytics-text", "Contact sales");
    expect(button).toHaveAttribute(
      "data-analytics-category",
      "Developer Sandbox|Catalog",
    );

    await userEvent.click(button);
    expect(trackIntent).toHaveBeenCalledWith(
      IntentEvent.contactSalesClicked,
      "Catalog",
      { surface: "catalog" },
    );
  });
});
