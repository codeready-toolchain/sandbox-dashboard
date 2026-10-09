import { render, screen } from "@testing-library/react";

import { SUPPORT_EMAIL } from "../../../const";
import { SupportBanner } from "../SupportBanner";

describe("SupportBanner", () => {
  it("renders the 'Need help?' heading", () => {
    render(<SupportBanner />);

    expect(
      screen.getByRole("heading", { name: "Need help?" }),
    ).toBeInTheDocument();
  });

  it("renders the support email as a mailto link", () => {
    render(<SupportBanner />);

    const emailLink = screen.getByRole("link", { name: SUPPORT_EMAIL });
    expect(emailLink).toBeInTheDocument();
    expect(emailLink).toHaveAttribute("href", `mailto:${SUPPORT_EMAIL}`);
  });

  it("renders the bookshelf image", () => {
    render(<SupportBanner />);

    expect(screen.getByRole("img", { name: "Book shelf" })).toBeInTheDocument();
  });

  it("renders the chat bubbles image", () => {
    render(<SupportBanner />);

    expect(
      screen.getByRole("img", { name: "Chat bubbles" }),
    ).toBeInTheDocument();
  });

  it("renders the descriptive text about FAQ and email", () => {
    render(<SupportBanner />);

    expect(
      screen.getByText(/Find answers to the frequently asked questions/),
    ).toBeInTheDocument();
  });
});
