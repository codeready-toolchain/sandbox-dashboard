import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { Layout } from "../Layout/Layout";
import {
  AuthenticatedContext,
  type AuthenticatedContextValue,
} from "../../auth/AuthenticatedContext";
import { UserContext, type UserContextType } from "../../hooks/UserContext";
import { readyUserFixture } from "../../mocks/fixtures";
import { UserStatus } from "../../types";

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

  it("displays user name in dropdown toggle", () => {
    renderLayout();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders page content via Outlet", () => {
    renderLayout();
    expect(screen.getByText("Catalog Content")).toBeInTheDocument();
  });

  it("renders activities page when navigated to /activities", () => {
    renderLayout("/activities");
    expect(screen.getByText("Activities Content")).toBeInTheDocument();
  });

  it("shows logout option in dropdown", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByText("John Doe"));
    expect(screen.getByText("Log out")).toBeInTheDocument();

    await user.click(screen.getByText("Log out"));
    expect(mockLogout).toHaveBeenCalled();
  });

  it("shows Reset Workspaces option when user is ready", async () => {
    const user = userEvent.setup();
    renderLayout("/", { userReady: true });

    await user.click(screen.getByText("John Doe"));
    expect(
      screen.getByTestId("reset-workspaces-menu-item"),
    ).toBeInTheDocument();
  });

  it("hides Reset Workspaces option when user is not ready", async () => {
    const user = userEvent.setup();
    renderLayout("/", { userReady: false });

    await user.click(screen.getByText("John Doe"));
    expect(
      screen.queryByTestId("reset-workspaces-menu-item"),
    ).not.toBeInTheDocument();
  });
});
