import { useCallback, useEffect, useRef, useState } from "react";
import logger from "../utils/logger";

/**
 * Hook to copy the contents to the clipboard, by giving
 * @param text the text to copy to the clipboard.
 * @returns the `copyToClipboard` function and the `copyToClipBoardLabel`
 * which gets updated if any error occurs.
 */
export function useCopyToClipboard(text: string | null | undefined) {
  const [label, setLabel] = useState<string>("Copy technical details");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Clears the timeout on unmount.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /**
   * Copies the given text to clipboard or logs the error.
   */
  const copyToClipboard = useCallback(async () => {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setLabel("Copied!");
    } catch (err) {
      logger.error("Failed to copy technical details", err);
      setLabel("Unable to copy");
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(
      () => setLabel("Copy technical details"),
      2000,
    );
  }, [text]);

  return { copyToClipboard, copyToClipboardLabel: label };
}
