import { renderHook, act } from "@testing-library/react";
import useTriedProducts from "../useTriedProducts";
import { Product } from "../useProductURLs";

describe("useTriedProducts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const threeProducts = new Set<Product>([
    Product.OPENSHIFT_CONSOLE,
    Product.DEVSPACES,
    Product.OPENSHIFT_AI,
  ]);

  describe("initialization from localStorage", () => {
    it("returns an empty set when localStorage has no entry", () => {
      const { result } = renderHook(() => useTriedProducts(threeProducts));

      for (const product of threeProducts) {
        expect(result.current.isProductTried(product)).toBe(false);
      }
    });

    it("returns an empty set when localStorage contains a blank string", () => {
      localStorage.setItem("tried-products", "   ");

      const { result } = renderHook(() => useTriedProducts(threeProducts));

      for (const product of threeProducts) {
        expect(result.current.isProductTried(product)).toBe(false);
      }
    });

    it("returns an empty set when localStorage contains improperly formatted JSON", () => {
      localStorage.setItem("tried-products", "not-valid-json[{]");

      const { result } = renderHook(() => useTriedProducts(threeProducts));

      for (const product of threeProducts) {
        expect(result.current.isProductTried(product)).toBe(false);
      }
    });

    it("returns an empty set when localStorage contains an unexpected JSON structure", () => {
      localStorage.setItem(
        "tried-products",
        JSON.stringify({ unexpected: "object" }),
      );

      const { result } = renderHook(() => useTriedProducts(threeProducts));

      for (const product of threeProducts) {
        expect(result.current.isProductTried(product)).toBe(false);
      }
    });

    it("returns the stored products when localStorage has a valid JSON array", () => {
      const stored = [
        Product.OPENSHIFT_CONSOLE,
        Product.DEVSPACES,
        Product.OPENSHIFT_AI,
      ];
      localStorage.setItem("tried-products", JSON.stringify(stored));

      const { result } = renderHook(() => useTriedProducts(threeProducts));

      for (const product of stored) {
        expect(result.current.isProductTried(product)).toBe(true);
      }
    });
  });

  describe("markProductAsTried", () => {
    it("marks only the specified product as tried", () => {
      const { result } = renderHook(() => useTriedProducts(threeProducts));

      act(() => {
        result.current.markProductAsTried(Product.DEVSPACES);
      });

      expect(result.current.isProductTried(Product.DEVSPACES)).toBe(true);
      expect(result.current.isProductTried(Product.OPENSHIFT_CONSOLE)).toBe(
        false,
      );
      expect(result.current.isProductTried(Product.OPENSHIFT_AI)).toBe(false);
    });

    it("does not mark a product that is not in the enabled set as tried", () => {
      const enabledProducts = new Set<Product>([
        Product.OPENSHIFT_CONSOLE,
        Product.DEVSPACES,
      ]);

      const { result } = renderHook(() => useTriedProducts(enabledProducts));

      act(() => {
        result.current.markProductAsTried(Product.OPENSHIFT_AI);
      });

      expect(result.current.isProductTried(Product.OPENSHIFT_AI)).toBe(false);
    });

    it("persists the tried product to localStorage", () => {
      const { result } = renderHook(() => useTriedProducts(threeProducts));

      act(() => {
        result.current.markProductAsTried(Product.OPENSHIFT_CONSOLE);
      });

      const stored = JSON.parse(
        localStorage.getItem("tried-products") as string,
      );
      expect(stored).toContain(Product.OPENSHIFT_CONSOLE);
    });

    it("does not duplicate a product that is already tried", () => {
      localStorage.setItem(
        "tried-products",
        JSON.stringify([Product.DEVSPACES]),
      );

      const { result } = renderHook(() => useTriedProducts(threeProducts));

      act(() => {
        result.current.markProductAsTried(Product.DEVSPACES);
      });

      const stored = JSON.parse(
        localStorage.getItem("tried-products") as string,
      );
      expect(
        stored.filter((p: string) => p === Product.DEVSPACES),
      ).toHaveLength(1);
    });
  });

  describe("localStorage write resilience", () => {
    it("still updates state when localStorage.setItem throws", () => {
      const spy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new DOMException("QuotaExceededError");
        });

      const { result } = renderHook(() => useTriedProducts(threeProducts));

      act(() => {
        result.current.markProductAsTried(Product.DEVSPACES);
      });

      expect(result.current.isProductTried(Product.DEVSPACES)).toBe(true);

      spy.mockRestore();
    });
  });

  describe("activeTriedProducts filtering", () => {
    it("excludes tried products that are no longer in the enabled set", () => {
      localStorage.setItem(
        "tried-products",
        JSON.stringify([Product.OPENSHIFT_CONSOLE, Product.OPENSHIFT_AI]),
      );

      const enabledProducts = new Set<Product>([Product.OPENSHIFT_CONSOLE]);

      const { result } = renderHook(() => useTriedProducts(enabledProducts));

      expect(result.current.isProductTried(Product.OPENSHIFT_CONSOLE)).toBe(
        true,
      );
      expect(result.current.isProductTried(Product.OPENSHIFT_AI)).toBe(false);
    });
  });
});
