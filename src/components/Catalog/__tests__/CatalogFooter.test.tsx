import { render, screen } from "@testing-library/react";
import React from "react";
import {
  UserContext,
  UserSignupPhase,
  type UserContextType,
} from "../../../hooks/UserContext";
import { readyUserFixture } from "../../../mocks/fixtures";
import { CatalogFooter } from "../CatalogFooter";

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

function renderFooter() {
  return render(
    <UserContext.Provider value={makeSandboxContext()}>
      <CatalogFooter />
    </UserContext.Provider>,
  );
}

describe("CatalogFooter", () => {
  it("renders activation code link", () => {
    renderFooter();
    expect(screen.getByText("Have an activation code?")).toBeInTheDocument();
    expect(screen.getByText("Click here")).toBeInTheDocument();
  });

  it("renders the full Red Hat footer", () => {
    renderFooter();
    expect(screen.getByTestId("rh-footer")).toBeInTheDocument();
    expect(screen.getByTestId("rh-footer-universal")).toBeInTheDocument();
  });

  it("renders footer copyright", () => {
    renderFooter();
    expect(screen.getByTestId("rh-footer-copyright")).toBeInTheDocument();
  });
});
