import { useCallback, useEffect, useRef, useState } from "react";

import logger from "../utils/logger";

/**
 * Hook to copy the contents to the clipboard.
 * @returns the `copyToClipboard`, `copyToClipBoardLabel` and `getLabel`
 * functions. The first and last functions have an optional key argument that
 * it is used to keep track of which copyable objects have been copied. The
 * goal is to only show label updates for the things that the user copies,
 * which is what the identifier is used for.
 */
export function useCopyToClipboard() {
  // Keeps track of the keys for which the label should be kept changed,
  // because the user copied the text.
  const [copiedKeys, setCopiedKeys] = useState<Set<number>>(new Set());

  // Also keep track of which things we weren't able to copy, to show proper
  // feedback to the user.
  const [failedKeys, setFailedKeys] = useState<Set<number>>(new Set());

  // Contains a map of timeouts for each label, so that if the user clicks
  // on two or more "Copy technical details" at once, the label gets changed
  // back taking into account their own timeout, and not just a global one
  // that would override all of the labels back.
  const timeoutMap = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // An internal key reference that we can use when no key has been provided,
  // which can happen when we are showing a static alert in a modal, for
  // example. In that case we manage the key for the caller.
  const INTERNAL_KEY = -1;

  // Clears all the timeouts on unmount.
  useEffect(() => {
    // The timeout map's reference does not change in this hook, so in theory
    // we do not need this, but TypeScript gives us a warning anyway so we do
    // it to satisfy the compiler.
    const timeouts = timeoutMap.current;

    return () => {
      for (const timeout of timeouts.values()) {
        clearTimeout(timeout);
      }
    };
  }, []);

  /**
   * Copies the given text to clipboard or logs the error.
   *
   * @param text the text to be copied to the clipboard.
   * @param key the key that helps to keep track of which text has already
   * been copied, to show proper feedback to the user. If none is provided, an
   * internal one is used, assuming that there's only one copyable element to
   * keep track of.
   */
  const copyToClipboard = useCallback(
    async (text: string, key?: number) => {
      // Use an internal key if none has been provided.
      const resolvedKey = key ?? INTERNAL_KEY;

      try {
        await navigator.clipboard.writeText(text);
        setCopiedKeys(
          (prev: Set<number>): Set<number> => new Set(prev).add(resolvedKey),
        );
        setFailedKeys((prev: Set<number>): Set<number> => {
          const next = new Set(prev);
          next.delete(resolvedKey);
          return next;
        });
      } catch (err) {
        logger.error("Failed to copy technical details", err);
        setFailedKeys(
          (prev: Set<number>): Set<number> => new Set(prev).add(resolvedKey),
        );
      }

      // In case the user clicks the "Copy" more than once within the 2-second
      // window, we need to clear the previous timeout to avoid having an
      // inconsistent "return back to original label".
      const existing = timeoutMap.current.get(resolvedKey);
      if (existing) {
        clearTimeout(existing);
      }

      // Set a timeout that fires in 2 seconds. It removes the given key from
      // the "copied" or "failed" group so that the label can return back to
      // its initial state. We also remove the timeout from the map since it
      // has already fired.
      timeoutMap.current.set(
        resolvedKey,
        setTimeout(() => {
          setCopiedKeys((prev: Set<number>): Set<number> => {
            const next = new Set(prev);
            next.delete(resolvedKey);
            return next;
          });
          setFailedKeys((prev: Set<number>): Set<number> => {
            const next = new Set(prev);
            next.delete(resolvedKey);
            return next;
          });

          timeoutMap.current.delete(resolvedKey);
        }, 2000),
      );
    },
    [INTERNAL_KEY],
  );

  /**
   * Get the "Copy" label. It gets updated to "Copied!" once the user clicks
   * the "copy" button.
   * @param key the identifier of the copyable instance, to make sure that
   * only the clicked text changes.
   */
  const getLabel = useCallback(
    (key: number): string => {
      if (copiedKeys.has(key)) {
        return "Copied!";
      }

      if (failedKeys.has(key)) {
        return "Unable to copy";
      }

      return "Copy technical details";
    },
    [copiedKeys, failedKeys],
  );

  return {
    copyToClipboard,
    copyToClipboardLabel: getLabel(INTERNAL_KEY),
    getLabel,
  };
}
