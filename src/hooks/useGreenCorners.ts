import { useState, useCallback, useMemo } from "react";
import { getCookie, setCookie } from "../utils/cookie-utils";
import type { Product } from "./useProductURLs";

type GreenCorner = {
  show: boolean;
  id: Product;
};

interface ProductLike {
  id: Product;
}

function readFromCookie(productData: ProductLike[]): GreenCorner[] {
  const triedProducts = getCookie("triedProducts")?.split(",") || [];
  return productData.map((product) => ({
    show: triedProducts.includes(String(product.id)),
    id: product.id,
  }));
}

const useGreenCorners = (productData: ProductLike[]) => {
  // Stable serialization used as state version key
  const productIds = useMemo(
    () => productData.map((p) => p.id).join(","),
    [productData],
  );

  // Re-initialize from cookie whenever products change.
  // React guarantees useState initializer runs only on first render,
  // so we pass productIds as key externally if needed, but here we
  // use a combined [state, version] approach.
  const [state, setState] = useState(() => ({
    version: productIds,
    corners: readFromCookie(productData),
  }));

  // If products changed, derive new state during render (no effect needed)
  const corners =
    state.version === productIds ? state.corners : readFromCookie(productData);

  // Sync state if stale (will trigger a single re-render)
  if (state.version !== productIds) {
    setState({ version: productIds, corners });
  }

  const persistToCookie = useCallback((c: GreenCorner[]) => {
    setCookie(
      "triedProducts",
      c
        .filter((gc) => gc.show)
        .map((gc) => String(gc.id))
        .join(","),
    );
  }, []);

  const setGreenCorners = useCallback(
    (updater: GreenCorner[] | ((prev: GreenCorner[]) => GreenCorner[])) => {
      setState((prev) => {
        const next =
          typeof updater === "function" ? updater(prev.corners) : updater;
        persistToCookie(next);
        return { ...prev, corners: next };
      });
    },
    [persistToCookie],
  );

  return { greenCorners: corners, setGreenCorners };
};

export default useGreenCorners;
