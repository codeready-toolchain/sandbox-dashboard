import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext, UserSignupPhase } from "../../../hooks/UserContext";
import { readyUserFixture } from "../../../mocks/fixtures";
import { CatalogBanner } from "../CatalogBanner";

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

describe("CatalogBanner", () => {
  it("renders welcome message with user name", () => {
    render(
      <UserContext.Provider value={makeContext()}>
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(screen.getByText(/Welcome, John/)).toBeInTheDocument();
  });

  it("shows skeletons while fetching data", () => {
    render(
      <UserContext.Provider
        value={makeContext({
          userSignupPhase: UserSignupPhase.FETCHING_DATA,
        })}
      >
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(screen.getByTestId("banner-skeleton")).toBeInTheDocument();
  });

  it("shows try products message when signup has not started", () => {
    render(
      <UserContext.Provider
        value={makeContext({
          user: undefined,
          userSignupPhase: UserSignupPhase.NOT_STARTED,
        })}
      >
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(screen.getByText("Try Red Hat products")).toBeInTheDocument();
  });

  it("shows verification prompt when pending phone verification", () => {
    render(
      <UserContext.Provider
        value={makeContext({
          userSignupPhase: UserSignupPhase.PENDING_PHONE_VERIFICATION,
        })}
      >
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(
      screen.getByText(/Click on "Try it" to initiate/),
    ).toBeInTheDocument();
  });

  it("shows pending approval message", () => {
    render(
      <UserContext.Provider
        value={makeContext({
          userSignupPhase: UserSignupPhase.PENDING_MANUAL_APPROVAL,
        })}
      >
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(
      screen.getByText("Please wait for your trial to be approved."),
    ).toBeInTheDocument();
  });

  it("shows welcome banner when signup phase is PROVISIONING and user exists", () => {
    render(
      <UserContext.Provider
        value={makeContext({
          userSignupPhase: UserSignupPhase.PROVISIONING,
        })}
      >
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(screen.getByText(/Welcome, John/)).toBeInTheDocument();
  });

  it("shows welcome banner when signup phase is SIGNING_UP and user exists", () => {
    render(
      <UserContext.Provider
        value={makeContext({
          userSignupPhase: UserSignupPhase.SIGNING_UP,
        })}
      >
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(screen.getByText(/Welcome, John/)).toBeInTheDocument();
  });

  it("shows 'Try Red Hat products' when signup phase is SIGNING_UP and user is undefined", () => {
    render(
      <UserContext.Provider
        value={makeContext({
          user: undefined,
          userSignupPhase: UserSignupPhase.SIGNING_UP,
        })}
      >
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(screen.getByText("Try Red Hat products")).toBeInTheDocument();
  });

  it("falls back to username when givenName is missing", () => {
    render(
      <UserContext.Provider
        value={makeContext({
          user: { ...readyUserFixture, givenName: "" },
        })}
      >
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(screen.getByText(/Welcome, johndoe/)).toBeInTheDocument();
  });

  it("shows days remaining when endDate is set", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const user = {
      ...readyUserFixture,
      endDate: futureDate.toISOString(),
    };
    render(
      <UserContext.Provider value={makeContext({ user })}>
        <CatalogBanner />
      </UserContext.Provider>,
    );
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
    render(
      <UserContext.Provider value={makeContext({ user })}>
        <CatalogBanner />
      </UserContext.Provider>,
    );

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
});
