import { useMemo } from "react";
import { Gallery, GalleryItem } from "@patternfly/react-core";
import { productData } from "./productData";
import useGreenCorners from "../../hooks/useGreenCorners";
import useProductURLs from "../../hooks/useProductURLs";
import { useSandboxContext } from "../../hooks/SandboxContext";
import { CatalogCard } from "./CatalogCard";

export function CatalogGrid() {
  const { disabledIntegrations } = useSandboxContext();
  const enabledProducts = useMemo(
    () =>
      productData.filter((p) => !(disabledIntegrations ?? []).includes(p.id)),
    [disabledIntegrations],
  );
  const { greenCorners } = useGreenCorners(enabledProducts);
  const productURLs = useProductURLs();

  if (disabledIntegrations === undefined) {
    return null;
  }

  return (
    <Gallery hasGutter minWidths={{ default: "330px" }}>
      {enabledProducts.map((product) => (
        <GalleryItem key={product.id}>
          <CatalogCard
            id={product.id}
            title={product.title}
            image={product.image}
            description={product.description}
            link={productURLs.find((pu) => pu.id === product.id)?.url || ""}
            greenCorner={
              greenCorners?.find((gc) => gc.id === product.id)?.show || false
            }
          />
        </GalleryItem>
      ))}
    </Gallery>
  );
}
