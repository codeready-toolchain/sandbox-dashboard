import { CatalogBanner } from "./CatalogBanner";
import { CatalogGrid } from "./CatalogGrid";
import { CatalogFooter } from "./CatalogFooter";

export function CatalogPage() {
  return (
    <>
      <CatalogBanner />
      <div style={{ padding: "0 100px 0 100px", minHeight: "100%" }}>
        <CatalogGrid />
      </div>
      <CatalogFooter />
    </>
  );
}
