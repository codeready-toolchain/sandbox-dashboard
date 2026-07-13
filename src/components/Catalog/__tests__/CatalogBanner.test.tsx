import { render, screen } from "@testing-library/react";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext } from "../../../hooks/UserContext";
import { readyUserFixture } from "../../../mocks/fixtures";
import { UserStatus } from "../../../types";
import { CatalogBanner } from "../CatalogBanner";

function makeContext(
  overrides: Partial<UserContextType> = {},
): UserContextType {
  return {
    userStatus: UserStatus.READY,
    userFound: true,
    userReady: true,
    verificationRequired: false,
    pendingApproval: false,
    userData: readyUserFixture,
    loading: false,
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

  it("shows skeletons while loading", () => {
    render(
      <UserContext.Provider value={makeContext({ loading: true })}>
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(screen.getByTestId("banner-skeleton")).toBeInTheDocument();
  });

  it("shows try products message when no user data", () => {
    render(
      <UserContext.Provider
        value={makeContext({ userData: undefined, userFound: false })}
      >
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(screen.getByText("Try Red Hat products")).toBeInTheDocument();
  });

  it("shows verification prompt when verification required", () => {
    render(
      <UserContext.Provider value={makeContext({ verificationRequired: true })}>
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(
      screen.getByText(/Click on "Try it" to initiate/),
    ).toBeInTheDocument();
  });

  it("shows pending approval message", () => {
    render(
      <UserContext.Provider value={makeContext({ pendingApproval: true })}>
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(
      screen.getByText("Please wait for your trial to be approved."),
    ).toBeInTheDocument();
  });

  it("shows days remaining when endDate is set", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const userData = {
      ...readyUserFixture,
      endDate: futureDate.toISOString(),
    };
    render(
      <UserContext.Provider value={makeContext({ userData })}>
        <CatalogBanner />
      </UserContext.Provider>,
    );
    expect(
      screen.getByText(/Your free trial expires in \d+ days/),
    ).toBeInTheDocument();
  });
});
