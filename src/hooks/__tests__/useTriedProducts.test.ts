import { renderHook, act } from "@testing-library/react";
import useTriedProducts from "../useTriedProducts";
import { ProductType, type Product } from "../../types/product";

function makeProduct(type: ProductType): Product {
  return { type, title: type, image: "", description: [] };
}

const openshiftConsole = makeProduct(ProductType.OPENSHIFT_CONSOLE);
const devSpaces = makeProduct(ProductType.DEVSPACES);
const openshiftAI = makeProduct(ProductType.OPENSHIFT_AI);

describe("useTriedProducts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const threeProducts: Product[] = [openshiftConsole, devSpaces, openshiftAI];

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
        ProductType.OPENSHIFT_CONSOLE,
        ProductType.DEVSPACES,
        ProductType.OPENSHIFT_AI,
      ];
      localStorage.setItem("tried-products", JSON.stringify(stored));

      const { result } = renderHook(() => useTriedProducts(threeProducts));

      for (const product of threeProducts) {
        expect(result.current.isProductTried(product)).toBe(true);
      }
    });
  });

  describe("markProductAsTried", () => {
    it("marks only the specified product as tried", () => {
      const { result } = renderHook(() => useTriedProducts(threeProducts));

      act(() => {
        result.current.markProductAsTried(devSpaces);
      });

      expect(result.current.isProductTried(devSpaces)).toBe(true);
      expect(result.current.isProductTried(openshiftConsole)).toBe(false);
      expect(result.current.isProductTried(openshiftAI)).toBe(false);
    });

    it("does not mark a product that is not in the enabled set as tried", () => {
      const enabledProducts: Product[] = [openshiftConsole, devSpaces];

      const { result } = renderHook(() => useTriedProducts(enabledProducts));

      act(() => {
        result.current.markProductAsTried(openshiftAI);
      });

      expect(result.current.isProductTried(openshiftAI)).toBe(false);
    });

    it("persists the tried product to localStorage", () => {
      const { result } = renderHook(() => useTriedProducts(threeProducts));

      act(() => {
        result.current.markProductAsTried(openshiftConsole);
      });

      const stored = JSON.parse(
        localStorage.getItem("tried-products") as string,
      );
      expect(stored).toContain(ProductType.OPENSHIFT_CONSOLE);
    });

    it("does not duplicate a product that is already tried", () => {
      localStorage.setItem(
        "tried-products",
        JSON.stringify([ProductType.DEVSPACES]),
      );

      const { result } = renderHook(() => useTriedProducts(threeProducts));

      act(() => {
        result.current.markProductAsTried(devSpaces);
      });

      const stored = JSON.parse(
        localStorage.getItem("tried-products") as string,
      );
      expect(
        stored.filter((p: string) => p === ProductType.DEVSPACES),
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
        result.current.markProductAsTried(devSpaces);
      });

      expect(result.current.isProductTried(devSpaces)).toBe(true);

      spy.mockRestore();
    });
  });

  describe("activeTriedProducts filtering", () => {
    it("excludes tried products that are no longer in the enabled set", () => {
      localStorage.setItem(
        "tried-products",
        JSON.stringify([
          ProductType.OPENSHIFT_CONSOLE,
          ProductType.OPENSHIFT_AI,
        ]),
      );

      const enabledProducts: Product[] = [openshiftConsole];

      const { result } = renderHook(() => useTriedProducts(enabledProducts));

      expect(result.current.isProductTried(openshiftConsole)).toBe(true);
      expect(result.current.isProductTried(openshiftAI)).toBe(false);
    });
  });
});
