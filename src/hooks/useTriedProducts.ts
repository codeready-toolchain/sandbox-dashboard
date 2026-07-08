import { useCallback, useEffect, useMemo, useState } from "react";
import { Product } from "./useProductURLs";

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
 * @param enabledProducts The set of products currently available in the
 * catalog.
 */
const useTriedProducts = (enabledProducts: Set<Product>) => {
  /**
   * Loads previously tried products from localStorage. Only runs on mount.
   */
  const [triedProducts, setTriedProducts] = useState<Set<Product>>(() => {
    const triedProductsRaw = localStorage.getItem(localStorageKey);

    if (!triedProductsRaw || !triedProductsRaw.trim()) {
      return new Set<Product>();
    }

    try {
      return new Set<Product>(JSON.parse(triedProductsRaw));
    } catch {
      return new Set<Product>();
    }
  });

  /**
   * Subset of the tried products that are currently enabled. Recomputed when
   * either the tried set or the enabled set changes.
   */
  const activeTriedProducts = useMemo<Set<Product>>(() => {
    const finalSet = new Set<Product>();
    for (const triedProduct of triedProducts) {
      if (enabledProducts.has(triedProduct)) {
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
  const markProductAsTried = useCallback<(productId: Product) => void>(
    (productId: Product) => {
      setTriedProducts((prev: Set<Product>) => {
        if (prev.has(productId)) {
          return prev;
        }

        const next = new Set(prev);
        next.add(productId);

        return next;
      });
    },
    [],
  );

  /**
   * Returns whether an enabled product has been tried.
   */
  const isProductTried = useCallback<(productId: Product) => boolean>(
    (productId: Product): boolean => activeTriedProducts.has(productId),
    [activeTriedProducts],
  );

  return { isProductTried, markProductAsTried };
};

export default useTriedProducts;
