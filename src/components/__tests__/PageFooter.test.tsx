import { render, screen } from "@testing-library/react";
import React from "react";
import { Environment } from "../../config/config";
import { PageFooter } from "../Layout/PageFooter";

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

vi.mock("../../config/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config/config")>();
  return { ...actual, getConfig: vi.fn() };
});

import { getConfig } from "../../config/config";
const mockedGetConfig = vi.mocked(getConfig);

describe("PageFooter", () => {
  beforeEach(() => {
    mockedGetConfig.mockReturnValue({
      environment: Environment.DEVELOPMENT,
      registrationServiceURL: "http://localhost",
      recaptchaSiteKey: "key",
    });
  });

  afterEach(() => {
    document.getElementById("trustarc")?.remove();
  });

  it("renders the full Red Hat footer", () => {
    render(<PageFooter />);
    expect(screen.getByTestId("rh-footer")).toBeInTheDocument();
    expect(screen.getByTestId("rh-footer-universal")).toBeInTheDocument();
  });

  it("renders footer copyright", () => {
    render(<PageFooter />);
    expect(screen.getByTestId("rh-footer-copyright")).toBeInTheDocument();
  });

  it("renders the consent_blackbar anchor", () => {
    render(<PageFooter />);
    expect(document.getElementById("consent_blackbar")).toBeInTheDocument();
  });

  it("renders the teconsent anchor element", () => {
    render(<PageFooter />);
    expect(document.getElementById("teconsent")).toBeInTheDocument();
  });

  it("loads the TrustArc script in production", () => {
    mockedGetConfig.mockReturnValue({
      environment: Environment.PRODUCTION,
      registrationServiceURL: "https://api.redhat.com",
      recaptchaSiteKey: "key",
    });

    render(<PageFooter />);

    const script = document.getElementById("trustarc") as HTMLScriptElement;
    expect(script).toBeInTheDocument();
    expect(script.src).toContain("trustarc/trustarc.js");
  });

  it("loads the TrustArc script in stage", () => {
    mockedGetConfig.mockReturnValue({
      environment: Environment.STAGE,
      registrationServiceURL: "https://api.stage.redhat.com",
      recaptchaSiteKey: "key",
    });

    render(<PageFooter />);

    const script = document.getElementById("trustarc") as HTMLScriptElement;
    expect(script).toBeInTheDocument();
    expect(script.src).toContain("trustarc/trustarc.js");
  });

  it("does not load the TrustArc script in development", () => {
    render(<PageFooter />);
    expect(document.getElementById("trustarc")).not.toBeInTheDocument();
  });

  it("does not inject the script twice on re-render", () => {
    mockedGetConfig.mockReturnValue({
      environment: Environment.PRODUCTION,
      registrationServiceURL: "https://api.redhat.com",
      recaptchaSiteKey: "key",
    });

    const { rerender } = render(<PageFooter />);
    rerender(<PageFooter />);

    const scripts = document.querySelectorAll("#trustarc");
    expect(scripts).toHaveLength(1);
  });
});
