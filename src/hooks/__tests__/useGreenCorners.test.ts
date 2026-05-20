import { renderHook, act } from "@testing-library/react";
import useGreenCorners from "../useGreenCorners";
import { Product } from "../useProductURLs";

describe("useGreenCorners", () => {
  beforeEach(() => {
    document.cookie =
      "triedProducts=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
  });

  const products = [
    { id: Product.OPENSHIFT_CONSOLE },
    { id: Product.DEVSPACES },
  ];

  it("initializes with all corners hidden when no cookie exists", () => {
    const { result } = renderHook(() => useGreenCorners(products));
    expect(result.current.greenCorners).toEqual([
      { show: false, id: Product.OPENSHIFT_CONSOLE },
      { show: false, id: Product.DEVSPACES },
    ]);
  });

  it("reads tried products from cookie", () => {
    document.cookie = `triedProducts=${Product.OPENSHIFT_CONSOLE};path=/`;
    const { result } = renderHook(() => useGreenCorners(products));
    expect(result.current.greenCorners[0].show).toBe(true);
    expect(result.current.greenCorners[1].show).toBe(false);
  });

  it("persists to cookie when green corner is set", () => {
    const { result } = renderHook(() => useGreenCorners(products));

    act(() => {
      result.current.setGreenCorners((prev) =>
        prev.map((gc) =>
          gc.id === Product.DEVSPACES ? { ...gc, show: true } : gc,
        ),
      );
    });

    expect(result.current.greenCorners[1].show).toBe(true);
    expect(document.cookie).toContain(Product.DEVSPACES);
  });
});
