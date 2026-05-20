import { CatalogBanner } from "./CatalogBanner";
import { CatalogGrid } from "./CatalogGrid";
import { CatalogFooter } from "./CatalogFooter";

export function CatalogPage() {
  return (
    <>
      <CatalogBanner />
      <div style={{ padding: "48px 60px", minHeight: "100%" }}>
        <CatalogGrid />
      </div>
      <CatalogFooter />
    </>
  );
}
