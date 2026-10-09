import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { frequentlyAskedQuestions } from "../../common/faqQuestions";
import { FAQ } from "../FrequentlyAskedQuestions";

describe("FAQ", () => {
  it("renders all FAQ questions", () => {
    render(<FAQ />);

    for (const faq of frequentlyAskedQuestions) {
      expect(
        screen.getByRole("button", { name: faq.question }),
      ).toBeInTheDocument();
    }
  });

  it("starts with all items collapsed", () => {
    render(<FAQ />);

    const toggleButtons = screen.getAllByRole("button");
    for (const button of toggleButtons) {
      expect(button).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("expands an item when its toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<FAQ />);

    const firstQuestion = frequentlyAskedQuestions[0].question;
    const toggle = screen.getByRole("button", { name: firstQuestion });

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses an item when its toggle is clicked again", async () => {
    const user = userEvent.setup();
    render(<FAQ />);

    const firstQuestion = frequentlyAskedQuestions[0].question;
    const toggle = screen.getByRole("button", { name: firstQuestion });

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("only allows one item expanded at a time", async () => {
    const user = userEvent.setup();
    render(<FAQ />);

    const firstQuestion = frequentlyAskedQuestions[0].question;
    const secondQuestion = frequentlyAskedQuestions[1].question;

    const firstToggle = screen.getByRole("button", {
      name: firstQuestion,
    });
    const secondToggle = screen.getByRole("button", {
      name: secondQuestion,
    });

    // Expand the first item.
    await user.click(firstToggle);
    expect(firstToggle).toHaveAttribute("aria-expanded", "true");
    expect(secondToggle).toHaveAttribute("aria-expanded", "false");

    // Expanding the second item should collapse the first.
    await user.click(secondToggle);
    expect(firstToggle).toHaveAttribute("aria-expanded", "false");
    expect(secondToggle).toHaveAttribute("aria-expanded", "true");
  });
});
