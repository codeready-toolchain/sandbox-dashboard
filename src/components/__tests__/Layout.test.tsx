import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router";

import * as registrationApi from "../../api/registration";
import {
  AuthenticatedContext,
  type AuthenticatedContextValue,
} from "../../auth/AuthenticatedContext";
import {
  AnalyticsContext,
  noopAnalyticsContext,
} from "../../hooks/AnalyticsContext";
import { NotificationProvider } from "../../hooks/NotificationProvider";
import { ThemeProvider } from "../../hooks/ThemeProvider";
import { UserContext, type UserContextType } from "../../hooks/UserContext";
import { UserSignupPhase } from "../../hooks/userSignupPhase";
import { readyUserFixture } from "../../mocks/fixtures";
import { Layout } from "../Layout/Layout";

vi.mock("../../api/registration", async (importOriginal) => {
  const actual = await importOriginal<typeof registrationApi>();
  return { ...actual, resetWorkspaces: vi.fn() };
});

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

vi.mock("@rhds/elements/react/rh-footer/rh-footer-copyright.js", () => ({
  FooterCopyright: (props: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props),
}));

vi.mock("@rhds/elements/react/rh-footer/rh-footer-universal.js", () => ({
  FooterUniversal: (
    props: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>,
  ) =>
    React.createElement("div", {
      ...props,
      "data-testid":
        (props as Record<string, unknown>)["data-testid"] ??
        "rh-footer-universal",
    }),
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
    refetchUserData: vi.fn().mockResolvedValue(undefined),
    signupUser: vi.fn(),
    ...overrides,
  };
}

function renderLayout(
  route = "/",
  sandboxOverrides: Partial<UserContextType> = {},
  authOverrides: Partial<AuthenticatedContextValue> = {},
) {
  const auth: AuthenticatedContextValue = {
    ...authValue,
    ...authOverrides,
  } as AuthenticatedContextValue;

  return render(
    <AnalyticsContext.Provider value={noopAnalyticsContext}>
      <NotificationProvider>
        <AuthenticatedContext.Provider value={auth}>
          <UserContext.Provider value={makeSandboxContext(sandboxOverrides)}>
            <ThemeProvider>
              <MemoryRouter initialEntries={[route]}>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<div>Catalog Content</div>} />
                    <Route
                      path="activities"
                      element={<div>Activities Content</div>}
                    />
                    <Route
                      path="support"
                      element={<div>Support Content</div>}
                    />
                  </Route>
                </Routes>
              </MemoryRouter>
            </ThemeProvider>
          </UserContext.Provider>
        </AuthenticatedContext.Provider>
      </NotificationProvider>
    </AnalyticsContext.Provider>,
  );
}

describe("Layout", () => {
  it("renders the masthead with brand", () => {
    renderLayout();
    expect(screen.getByText("Developer Sandbox")).toBeInTheDocument();
  });

  it("renders the theme selector toggle", () => {
    renderLayout();
    expect(
      screen.getByRole("button", { name: "Theme selection" }),
    ).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    renderLayout();
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("Activities")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
  });

  it("renders page content via Outlet", () => {
    renderLayout();
    expect(screen.getByText("Catalog Content")).toBeInTheDocument();
  });

  it("renders activities page when navigated to /activities", () => {
    renderLayout("/activities");
    expect(screen.getByText("Activities Content")).toBeInTheDocument();
  });

  it("renders support page when navigated to /support", () => {
    renderLayout("/support");
    expect(screen.getByText("Support Content")).toBeInTheDocument();
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
      screen.getByRole("menuitem", { name: "Reset Workspaces" }),
    ).toBeInTheDocument();
  });

  it("hides Reset Workspaces option when user signup phase is not READY", async () => {
    const user = userEvent.setup();
    renderLayout("/", {
      userSignupPhase: UserSignupPhase.PROVISIONING,
    });

    await user.click(screen.getByText("John Doe"));
    expect(
      screen.queryByRole("menuitem", { name: "Reset Workspaces" }),
    ).not.toBeInTheDocument();
  });

  it("falls back to auth context names when signup user names are missing", () => {
    renderLayout("/", {
      user: { ...readyUserFixture, givenName: "", familyName: "" },
    });
    // The signup user has no names, so the auth context names are
    // used instead.
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("falls back to givenName when familyName is missing from both user and auth", () => {
    renderLayout(
      "/",
      { user: { ...readyUserFixture, givenName: "", familyName: "" } },
      { givenName: "Jane", familyName: "" },
    );
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
    expect(screen.getByText("Jane")).toBeInTheDocument();
  });

  it("falls back to 'User' when all names are empty", () => {
    renderLayout(
      "/",
      { user: { ...readyUserFixture, givenName: "", familyName: "" } },
      { givenName: "", familyName: "" },
    );
    expect(screen.getByText("User")).toBeInTheDocument();
  });

  it("shows warning alert when refetchUserData rejects after workspace reset", async () => {
    vi.mocked(registrationApi.resetWorkspaces).mockResolvedValue();

    const refetchUserData = vi
      .fn()
      .mockRejectedValue(new Error("network failure"));

    const user = userEvent.setup();
    renderLayout("/", {
      userSignupPhase: UserSignupPhase.READY,
      refetchUserData,
    });

    await user.click(screen.getByText("John Doe"));
    await user.click(
      screen.getByRole("menuitem", { name: "Reset Workspaces" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Reset workspaces" }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "I understand and I want to reset" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Reset my workspaces" }),
    );

    await waitFor(() => {
      expect(refetchUserData).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.getByText("Unable to refresh your user's details"),
      ).toBeInTheDocument();
    });
  });
});
