import { render, screen } from "@testing-library/react";
import { AnalyticsContext } from "../../../hooks/AnalyticsContext";
import { ActivitiesPage } from "../ActivitiesPage";
import { articleData } from "../articleData";

vi.mock("../../Catalog/CatalogFooter", () => ({
  CatalogFooter: () => <div data-testid="catalog-footer" />,
}));

function renderWithAnalytics() {
  return render(
    <AnalyticsContext.Provider value={{ trackAnalytics: vi.fn() }}>
      <ActivitiesPage />
    </AnalyticsContext.Provider>,
  );
}

describe("ActivitiesPage", () => {
  it("renders all articles", () => {
    renderWithAnalytics();
    for (const article of articleData) {
      expect(screen.getByText(article.title)).toBeInTheDocument();
    }
  });

  it("renders article links with correct href", () => {
    renderWithAnalytics();
    for (const article of articleData) {
      const link = screen.getByText(article.title).closest("a");
      expect(link).toHaveAttribute("href", article.link);
      expect(link).toHaveAttribute("target", "_blank");
    }
  });
});
