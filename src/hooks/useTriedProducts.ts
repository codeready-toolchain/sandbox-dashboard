import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product, ProductType } from "../types/product";

/**
 * Key used for the "tried-products" record in local storage.
 */
const localStorageKey = "tried-products";

/**
 * Tracks which products the user has launched at least once.
 *
 * Tried products are persisted to localStorage and filtered against the
 * currently enabled product set so that disabled products are never reported
 * as tried.
 *
 * @param enabledProducts The list of products currently available in the
 * catalog.
 */
const useTriedProducts = (enabledProducts: Product[]) => {
  /**
   * Loads previously tried products from localStorage. Only runs on mount.
   */
  const [triedProducts, setTriedProducts] = useState<Set<ProductType>>(() => {
    const triedProductsRaw = localStorage.getItem(localStorageKey);

    if (!triedProductsRaw || !triedProductsRaw.trim()) {
      return new Set<ProductType>();
    }

    try {
      return new Set<ProductType>(JSON.parse(triedProductsRaw));
    } catch {
      return new Set<ProductType>();
    }
  });

  /**
   * Subset of the tried products that are currently enabled. Recomputed when
   * either the tried set or the enabled set changes.
   */
  const activeTriedProducts = useMemo<Set<ProductType>>(() => {
    const enabledTypes = new Set(
      enabledProducts.map((product: Product) => product.type),
    );
    const finalSet = new Set<ProductType>();

    for (const triedProduct of triedProducts) {
      if (enabledTypes.has(triedProduct)) {
        finalSet.add(triedProduct);
      }
    }

    return finalSet;
  }, [enabledProducts, triedProducts]);

  /**
   * Effect to store the tried products in the localStorage every time they
   * are updated. The goal is to keep the "markProductAsTried" updater pure.
   */
  useEffect(() => {
    try {
      localStorage.setItem(localStorageKey, JSON.stringify([...triedProducts]));
    } catch {
      // Storage full or unavailable. State still works, but it just will not
      // persist.
    }
  }, [triedProducts]);

  /**
   * Marks the given product as tried.
   */
  const markProductAsTried = useCallback<(product: Product) => void>(
    (product: Product) => {
      setTriedProducts((prev: Set<ProductType>) => {
        if (prev.has(product.type)) {
          return prev;
        }

        const next = new Set(prev);
        next.add(product.type);

        return next;
      });
    },
    [],
  );

  /**
   * Returns whether an enabled product has been tried.
   */
  const isProductTried = useCallback<(product: Product) => boolean>(
    (product: Product): boolean => activeTriedProducts.has(product.type),
    [activeTriedProducts],
  );

  return { isProductTried, markProductAsTried };
};

export default useTriedProducts;
