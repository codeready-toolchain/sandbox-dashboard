import { useCallback, useMemo } from "react";
import type { Product, URLTemplateVars } from "../types/product";
import { useUserContext } from "./UserContext";

/**
 * Resolves the URL for the products taking into account the user's data.
 */
const useProductURLResolver = () => {
  const { userData } = useUserContext();

  /**
   * Computes the URL template variables for the user.
   */
  const userURLTemplateVars = useMemo((): URLTemplateVars => {
    return {
      cheDashboardURL: userData?.cheDashboardURL ?? "",
      consoleURL: userData?.consoleURL ?? "",
      defaultUserNamespace: userData?.defaultUserNamespace ?? "",
      rhodsMemberURL: userData?.rhodsMemberURL ?? "",
    };
  }, [userData]);

  /**
   * Computes the URL for the given product.
   * @param product the product to compute the URL for.
   * @returns the product's URL.
   */
  const getProductURL = useCallback(
    (product: Product): string => {
      if (!userData?.status?.ready) {
        return "";
      }

      // When the product has a custom resolver, simply execute it.
      if (product.resolveURL) {
        return product.resolveURL(userURLTemplateVars);
      }

      // When a URL template is given, replace the "{{placeholders}}" with each
      // of the URL template variables that we have available.
      if (product.urlTemplate) {
        return product.urlTemplate.replace(
          /\{\{(\w+)\}\}/g,
          (_: string, capturedkey: string): string => {
            // When the template variables do not have the key, return an
            // empty string.
            if (!Object.hasOwn(userURLTemplateVars, capturedkey)) {
              return "";
            }

            return userURLTemplateVars[capturedkey as keyof URLTemplateVars];
          },
        );
      }

      return "";
    },
    [userData?.status?.ready, userURLTemplateVars],
  );

  return { getProductURL };
};

export default useProductURLResolver;
