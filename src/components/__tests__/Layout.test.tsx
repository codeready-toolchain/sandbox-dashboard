import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { Layout } from "../Layout/Layout";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext";

const mockLogout = vi.fn();

const authValue: AuthContextValue = {
  authenticated: true,
  token: "test-token",
  givenName: "John",
  familyName: "Doe",
  email: "john@example.com",
  username: "johndoe",
  getToken: async () => "test-token",
  logout: mockLogout,
};

function renderLayout(route = "/") {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>Catalog Content</div>} />
            <Route path="activities" element={<div>Activities Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
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
});
