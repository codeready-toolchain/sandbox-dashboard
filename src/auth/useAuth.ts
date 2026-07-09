import { useContext } from "react";
import {
  AuthenticatedContext,
  type AuthenticatedContextValue,
} from "./AuthenticatedContext";

/**
 * Get the authenticated context's elements.
 * @returns the authenticanticated context's elements to be used.
 */
export function useAuth(): AuthenticatedContextValue {
  const ctx = useContext(AuthenticatedContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthenticatedContext");
  }
  return ctx;
}
