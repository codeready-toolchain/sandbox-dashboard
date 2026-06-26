import { render, screen } from "@testing-library/react";
import { ActivitiesPage } from "../ActivitiesPage";
import { articleData } from "../articleData";

vi.mock("../../Catalog/CatalogFooter", () => ({
  CatalogFooter: () => <div data-testid="catalog-footer" />,
}));

describe("ActivitiesPage", () => {
  it("renders all articles", () => {
    render(<ActivitiesPage />);
    for (const article of articleData) {
      expect(screen.getByText(article.title)).toBeInTheDocument();
    }
  });

  it("renders article links with correct href", () => {
    render(<ActivitiesPage />);
    for (const article of articleData) {
      const link = screen.getByText(article.title).closest("a");
      expect(link).toHaveAttribute("href", article.link);
      expect(link).toHaveAttribute("target", "_blank");
    }
  });
});
