import { render, screen } from "@testing-library/react";
import React from "react";
import {
  SandboxContext,
  type SandboxContextType,
} from "../../../hooks/SandboxContext";
import { readyUserFixture } from "../../../mocks/fixtures";
import { UserStatus } from "../../../types";
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
  overrides: Partial<SandboxContextType> = {},
): SandboxContextType {
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
    disabledIntegrations: [],
    ...overrides,
  };
}

function renderFooter() {
  return render(
    <SandboxContext.Provider value={makeSandboxContext()}>
      <CatalogFooter />
    </SandboxContext.Provider>,
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
