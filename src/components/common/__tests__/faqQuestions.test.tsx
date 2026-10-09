import { frequentlyAskedQuestions } from "../faqQuestions";

describe("frequentlyAskedQuestions", () => {
  it("has at least one FAQ entry", () => {
    expect(frequentlyAskedQuestions.length).toBeGreaterThan(0);
  });

  it("every entry has a non-empty question", () => {
    for (const faq of frequentlyAskedQuestions) {
      expect(faq.question).toBeTruthy();
      expect(typeof faq.question).toBe("string");
    }
  });

  it("every entry has a defined answer", () => {
    for (const faq of frequentlyAskedQuestions) {
      expect(faq.answer).toBeDefined();
    }
  });
});
