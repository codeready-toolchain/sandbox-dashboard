import { render, screen } from "@testing-library/react";

import {
  AnalyticsContext,
  noopAnalyticsContext,
} from "../../../hooks/AnalyticsContext";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext } from "../../../hooks/UserContext";
import { UserSignupPhase } from "../../../hooks/userSignupPhase";
import { readyUserFixture } from "../../../mocks/fixtures";
import { CatalogPage } from "../CatalogPage";

vi.mock("../CatalogBanner", () => ({
  CatalogBanner: () => <div data-testid="catalog-banner" />,
}));

vi.mock("../CatalogGrid", () => ({
  CatalogGrid: () => <div data-testid="catalog-grid" />,
}));

function renderPage(overrides: Partial<UserContextType> = {}) {
  const value: UserContextType = {
    user: readyUserFixture,
    userSignupPhase: UserSignupPhase.READY,
    refetchUserData: vi.fn(),
    signupUser: vi.fn(),
    ...overrides,
  };

  return render(
    <AnalyticsContext.Provider value={noopAnalyticsContext}>
      <UserContext.Provider value={value}>
        <CatalogPage />
      </UserContext.Provider>
    </AnalyticsContext.Provider>,
  );
}

describe("CatalogPage", () => {
  it("renders the catalog banner", () => {
    renderPage();
    expect(screen.getByTestId("catalog-banner")).toBeInTheDocument();
  });

  it("renders the catalog grid", () => {
    renderPage();
    expect(screen.getByTestId("catalog-grid")).toBeInTheDocument();
  });

  it("offers the activation code link before signup has started", () => {
    renderPage({
      user: undefined,
      userSignupPhase: UserSignupPhase.NOT_STARTED,
    });

    expect(
      screen.getByRole("button", { name: "Have an activation code?" }),
    ).toBeInTheDocument();
  });

  it("hides the activation code link once signup has started", () => {
    renderPage({ userSignupPhase: UserSignupPhase.READY });

    expect(
      screen.queryByRole("button", { name: "Have an activation code?" }),
    ).not.toBeInTheDocument();
  });
});
