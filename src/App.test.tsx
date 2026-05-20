import { render, screen } from "@testing-library/react";
import { App } from "./App";

beforeAll(() => {
  window.__config__ = {
    registrationServiceURL: "https://registration.example.com",
    recaptchaSiteKey: "test-site-key",
    environment: "dev",
  };
});

test("renders without crashing in dev bypass mode", () => {
  render(<App />);
  expect(screen.getByText("Developer Sandbox")).toBeInTheDocument();
});
