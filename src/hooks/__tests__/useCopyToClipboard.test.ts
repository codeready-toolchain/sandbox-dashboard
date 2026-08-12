import { act, renderHook } from "@testing-library/react";

import { useCopyToClipboard } from "../useCopyToClipboard";

const mockWriteText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });

  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mockWriteText },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCopyToClipboard", () => {
  describe("copyToClipboardLabel (keyless usage)", () => {
    it("starts with the default label", () => {
      const { result } = renderHook(() => useCopyToClipboard());
      expect(result.current.copyToClipboardLabel).toBe(
        "Copy technical details",
      );
    });

    it("changes to 'Copied!' after a successful copy", async () => {
      mockWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(() => result.current.copyToClipboard("some text"));

      expect(result.current.copyToClipboardLabel).toBe("Copied!");
      expect(mockWriteText).toHaveBeenCalledWith("some text");
    });

    it("changes to 'Unable to copy' when the clipboard write fails", async () => {
      mockWriteText.mockRejectedValue(new Error("Not allowed"));
      const { result } = renderHook(() => useCopyToClipboard());

      await act(() => result.current.copyToClipboard("some text"));

      expect(result.current.copyToClipboardLabel).toBe("Unable to copy");
    });

    it("reverts 'Unable to copy' to the default label after 2 seconds", async () => {
      mockWriteText.mockRejectedValue(new Error("Not allowed"));
      const { result } = renderHook(() => useCopyToClipboard());

      await act(() => result.current.copyToClipboard("some text"));
      expect(result.current.copyToClipboardLabel).toBe("Unable to copy");

      await act(() => vi.advanceTimersByTimeAsync(2000));
      expect(result.current.copyToClipboardLabel).toBe(
        "Copy technical details",
      );
    });

    it("reverts to the default label after 2 seconds", async () => {
      mockWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(() => result.current.copyToClipboard("some text"));
      expect(result.current.copyToClipboardLabel).toBe("Copied!");

      await act(() => vi.advanceTimersByTimeAsync(2000));
      expect(result.current.copyToClipboardLabel).toBe(
        "Copy technical details",
      );
    });

    it("does not revert before 2 seconds", async () => {
      mockWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(() => result.current.copyToClipboard("some text"));

      await act(() => vi.advanceTimersByTimeAsync(1999));
      expect(result.current.copyToClipboardLabel).toBe("Copied!");
    });

    it("resets the timeout when copying again within the 2-second window", async () => {
      mockWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(() => result.current.copyToClipboard("first"));

      await act(() => vi.advanceTimersByTimeAsync(1500));
      expect(result.current.copyToClipboardLabel).toBe("Copied!");

      await act(() => result.current.copyToClipboard("second"));

      await act(() => vi.advanceTimersByTimeAsync(1500));
      expect(result.current.copyToClipboardLabel).toBe("Copied!");

      await act(() => vi.advanceTimersByTimeAsync(500));
      expect(result.current.copyToClipboardLabel).toBe(
        "Copy technical details",
      );
    });
  });

  describe("getLabel (keyed usage)", () => {
    it("returns the default label for an unknown key", () => {
      const { result } = renderHook(() => useCopyToClipboard());
      expect(result.current.getLabel(42)).toBe("Copy technical details");
    });

    it("returns 'Copied!' only for the copied key", async () => {
      mockWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(() => result.current.copyToClipboard("text", 1));

      expect(result.current.getLabel(1)).toBe("Copied!");
      expect(result.current.getLabel(2)).toBe("Copy technical details");
      expect(result.current.getLabel(3)).toBe("Copy technical details");
    });

    it("tracks multiple keys independently", async () => {
      mockWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(() => result.current.copyToClipboard("text-a", 1));
      await act(() => result.current.copyToClipboard("text-b", 2));

      expect(result.current.getLabel(1)).toBe("Copied!");
      expect(result.current.getLabel(2)).toBe("Copied!");
      expect(result.current.getLabel(3)).toBe("Copy technical details");
    });

    it("reverts each key independently after its own 2-second timeout", async () => {
      mockWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(() => result.current.copyToClipboard("text-a", 1));

      await act(() => vi.advanceTimersByTimeAsync(1000));
      await act(() => result.current.copyToClipboard("text-b", 2));

      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(result.current.getLabel(1)).toBe("Copy technical details");
      expect(result.current.getLabel(2)).toBe("Copied!");

      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(result.current.getLabel(2)).toBe("Copy technical details");
    });

    it("resets the timeout for a specific key without affecting others", async () => {
      mockWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(() => result.current.copyToClipboard("text-a", 1));
      await act(() => result.current.copyToClipboard("text-b", 2));

      await act(() => vi.advanceTimersByTimeAsync(1500));
      await act(() => result.current.copyToClipboard("text-a-again", 1));

      await act(() => vi.advanceTimersByTimeAsync(500));
      expect(result.current.getLabel(1)).toBe("Copied!");
      expect(result.current.getLabel(2)).toBe("Copy technical details");

      await act(() => vi.advanceTimersByTimeAsync(1500));
      expect(result.current.getLabel(1)).toBe("Copy technical details");
    });

    it("handles key 0 correctly", async () => {
      mockWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(() => result.current.copyToClipboard("text", 0));

      expect(result.current.getLabel(0)).toBe("Copied!");
      expect(result.current.copyToClipboardLabel).toBe(
        "Copy technical details",
      );
    });
  });

  describe("keyed and keyless usage do not interfere", () => {
    it("keyless copy does not affect keyed labels", async () => {
      mockWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(() => result.current.copyToClipboard("keyless text"));

      expect(result.current.copyToClipboardLabel).toBe("Copied!");
      expect(result.current.getLabel(1)).toBe("Copy technical details");
    });

    it("keyed copy does not affect keyless label", async () => {
      mockWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(() => result.current.copyToClipboard("keyed text", 5));

      expect(result.current.getLabel(5)).toBe("Copied!");
      expect(result.current.copyToClipboardLabel).toBe(
        "Copy technical details",
      );
    });
  });
});
