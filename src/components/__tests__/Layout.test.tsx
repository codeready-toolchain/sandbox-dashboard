import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { Layout } from "../Layout/Layout";
import {
  AuthenticatedContext,
  type AuthenticatedContextValue,
} from "../../auth/AuthenticatedContext";
import {
  UserContext,
  UserSignupPhase,
  type UserContextType,
} from "../../hooks/UserContext";
import { readyUserFixture } from "../../mocks/fixtures";
import React from "react";

vi.mock("@rhds/elements/rh-icon/rh-icon.js", () => ({
  RhIcon: { resolve: vi.fn() },
}));

vi.mock("@rhds/icons/social/linkedin.js", () => ({ default: null }));
vi.mock("@rhds/icons/social/youtube.js", () => ({ default: null }));
vi.mock("@rhds/icons/social/facebook.js", () => ({ default: null }));
vi.mock("@rhds/icons/social/x.js", () => ({ default: null }));
vi.mock("@rhds/icons/ui/arrow-right.js", () => ({ default: null }));

vi.mock("@rhds/elements/react/rh-footer/rh-footer.js", () => ({
  Footer: (
    props: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>,
  ) =>
    React.createElement("div", {
      ...props,
      "data-testid":
        (props as Record<string, unknown>)["data-testid"] ?? "rh-footer",
    }),
}));

vi.mock("@rhds/elements/react/rh-footer/rh-footer-block.js", () => ({
  FooterBlock: (props: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props),
}));

vi.mock("@rhds/elements/react/rh-footer/rh-footer-social-link.js", () => ({
  FooterSocialLink: (props: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props),
}));

vi.mock("@rhds/elements/react/rh-cta/rh-cta.js", () => ({
  Cta: (props: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props),
}));

const mockLogout = vi.fn();

const authValue: AuthenticatedContextValue = {
  token: "test-token",
  givenName: "John",
  familyName: "Doe",
  email: "john@example.com",
  username: "johndoe",
  logout: mockLogout,
};

function makeSandboxContext(
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

function renderLayout(
  route = "/",
  sandboxOverrides: Partial<UserContextType> = {},
) {
  return render(
    <AuthenticatedContext.Provider value={authValue}>
      <UserContext.Provider value={makeSandboxContext(sandboxOverrides)}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>Catalog Content</div>} />
              <Route
                path="activities"
                element={<div>Activities Content</div>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </UserContext.Provider>
    </AuthenticatedContext.Provider>,
  );
}

describe("Layout", () => {
  it("renders the masthead with brand", () => {
    renderLayout();
    expect(screen.getByText("Developer Sandbox")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    renderLayout();
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("Activities")).toBeInTheDocument();
  });

  it("renders page content via Outlet", () => {
    renderLayout();
    expect(screen.getByText("Catalog Content")).toBeInTheDocument();
  });

  it("renders activities page when navigated to /activities", () => {
    renderLayout("/activities");
    expect(screen.getByText("Activities Content")).toBeInTheDocument();
  });

  it("displays user name in dropdown toggle", () => {
    renderLayout();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("shows logout option in dropdown", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByText("John Doe"));
    expect(screen.getByText("Log out")).toBeInTheDocument();

    await user.click(screen.getByText("Log out"));
    expect(mockLogout).toHaveBeenCalled();
  });

  it("shows Reset Workspaces option when user signup phase is READY", async () => {
    const user = userEvent.setup();
    renderLayout("/", { userSignupPhase: UserSignupPhase.READY });

    await user.click(screen.getByText("John Doe"));
    expect(
      screen.getByTestId("reset-workspaces-menu-item"),
    ).toBeInTheDocument();
  });

  it("hides Reset Workspaces option when user signup phase is not READY", async () => {
    const user = userEvent.setup();
    renderLayout("/", {
      userSignupPhase: UserSignupPhase.PROVISIONING,
    });

    await user.click(screen.getByText("John Doe"));
    expect(
      screen.queryByTestId("reset-workspaces-menu-item"),
    ).not.toBeInTheDocument();
  });

  it("falls back to givenName when familyName is missing", () => {
    renderLayout("/", {
      user: { ...readyUserFixture, familyName: "" },
    });
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
    expect(screen.getByText("John")).toBeInTheDocument();
  });

  it("falls back to 'User' when givenName is also missing", () => {
    renderLayout("/", {
      user: { ...readyUserFixture, givenName: "", familyName: "" },
    });
    expect(screen.getByText("User")).toBeInTheDocument();
  });
});
