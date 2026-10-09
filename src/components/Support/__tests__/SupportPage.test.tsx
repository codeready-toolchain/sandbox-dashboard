import { render, screen } from "@testing-library/react";

import { SupportPage } from "../SupportPage";

vi.mock("../SupportBanner", () => ({
  SupportBanner: () => <div data-testid="support-banner" />,
}));

vi.mock("../FrequentlyAskedQuestions", () => ({
  FAQ: () => <div data-testid="faq" />,
}));

describe("SupportPage", () => {
  it("renders the support banner", () => {
    render(<SupportPage />);
    expect(screen.getByTestId("support-banner")).toBeInTheDocument();
  });

  it("renders the FAQ section", () => {
    render(<SupportPage />);
    expect(screen.getByTestId("faq")).toBeInTheDocument();
  });
});
