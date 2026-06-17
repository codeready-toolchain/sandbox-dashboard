import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { server } from "./mocks/server";
import { setTokenGetter } from "./api/authFetch";
import { App } from "./App";

vi.mock("@rhds/elements/react/rh-footer/rh-footer.js", () => ({
  Footer: (props: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props),
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

beforeAll(() => {
  window.__config__ = {
    registrationServiceURL: "https://registration.example.com",
    recaptchaSiteKey: "test-site-key",
    environment: "dev",
  };
  setTokenGetter(async () => "test-token");
  server.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("renders without crashing in dev bypass mode", async () => {
  render(<App />);

  // "Developer Sandbox" appears in both the masthead brand and user menu toggle
  const matches = screen.getAllByText("Developer Sandbox");
  expect(matches.length).toBeGreaterThanOrEqual(1);

  // Wait for user data to load and verify the catalog renders
  await waitFor(() => {
    expect(screen.getByText("Have an activation code?")).toBeInTheDocument();
  });
});
