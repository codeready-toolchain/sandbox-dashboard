import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  AnalyticsContext,
  noopAnalyticsContext,
} from "../../../hooks/AnalyticsContext";
import { IntentEvent } from "../../../utils/analytics";
import { frequentlyAskedQuestions } from "../../common/faqQuestions";
import { FAQ } from "../FrequentlyAskedQuestions";

const trackIntent = vi.fn();

function renderFaq() {
  return render(
    <AnalyticsContext.Provider value={{ ...noopAnalyticsContext, trackIntent }}>
      <FAQ />
    </AnalyticsContext.Provider>,
  );
}

describe("FAQ", () => {
  afterEach(() => {
    trackIntent.mockClear();
  });
  it("renders all FAQ questions", () => {
    renderFaq();

    for (const faq of frequentlyAskedQuestions) {
      expect(
        screen.getByRole("button", { name: faq.question }),
      ).toBeInTheDocument();
    }
  });

  it("starts with all items collapsed", () => {
    renderFaq();

    const toggleButtons = screen.getAllByRole("button");
    for (const button of toggleButtons) {
      expect(button).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("expands an item when its toggle is clicked", async () => {
    const user = userEvent.setup();
    renderFaq();

    const firstQuestion = frequentlyAskedQuestions[0].question;
    const toggle = screen.getByRole("button", { name: firstQuestion });

    expect(toggle).toHaveAttribute("data-analytics-text", firstQuestion);
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).not.toHaveAttribute("data-analytics-text");
    expect(trackIntent).toHaveBeenCalledWith(
      IntentEvent.supportQuestionOpened,
      "Support",
      { question: firstQuestion },
    );
  });

  it("collapses an item when its toggle is clicked again", async () => {
    const user = userEvent.setup();
    renderFaq();

    const firstQuestion = frequentlyAskedQuestions[0].question;
    const toggle = screen.getByRole("button", { name: firstQuestion });

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(trackIntent).toHaveBeenCalledTimes(1);
  });

  it("only allows one item expanded at a time", async () => {
    const user = userEvent.setup();
    renderFaq();

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
    expect(trackIntent).toHaveBeenCalledTimes(2);
  });
});
