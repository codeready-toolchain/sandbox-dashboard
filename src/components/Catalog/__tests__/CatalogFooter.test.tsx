import { render, screen } from "@testing-library/react";
import { CatalogFooter } from "../CatalogFooter";

describe("CatalogFooter", () => {
  it("renders activation code link", () => {
    render(<CatalogFooter />);
    expect(screen.getByText("Have an activation code?")).toBeInTheDocument();
    expect(screen.getByText("Click here")).toBeInTheDocument();
  });

  it("renders the Red Hat universal footer", () => {
    render(<CatalogFooter />);
    expect(screen.getByTestId("rh-footer-universal")).toBeInTheDocument();
  });

  it("renders footer copyright", () => {
    render(<CatalogFooter />);
    expect(screen.getByTestId("rh-footer-copyright")).toBeInTheDocument();
  });
});
