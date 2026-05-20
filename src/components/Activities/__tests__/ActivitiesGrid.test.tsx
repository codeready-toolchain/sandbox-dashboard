import { render, screen } from "@testing-library/react";
import { ActivitiesGrid } from "../ActivitiesGrid";
import { articleData } from "../articleData";

describe("ActivitiesGrid", () => {
  it("renders featured section heading", () => {
    render(<ActivitiesGrid />);
    expect(screen.getByText("Featured")).toBeInTheDocument();
  });

  it("renders all featured articles", () => {
    render(<ActivitiesGrid />);
    for (const article of articleData.featured) {
      expect(screen.getByText(article.title)).toBeInTheDocument();
    }
  });

  it("renders all other articles", () => {
    render(<ActivitiesGrid />);
    for (const article of articleData.other) {
      expect(screen.getByText(article.title)).toBeInTheDocument();
    }
  });

  it("renders article links with correct href", () => {
    render(<ActivitiesGrid />);
    const allArticles = [...articleData.featured, ...articleData.other];
    for (const article of allArticles) {
      const link = screen.getByText(article.title).closest("a");
      expect(link).toHaveAttribute("href", article.link);
      expect(link).toHaveAttribute("target", "_blank");
    }
  });
});
