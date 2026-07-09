import { createContext } from "react";

/**
 * Defines the elements that the children components will be able to access
 * in the authenticated context.
 */
export interface AuthenticatedContextValue {
  token: string | undefined;
  givenName: string;
  familyName: string;
  email: string;
  username: string;
  logout: () => void;
}

/**
 * Defines the authentication context.
 */
export const AuthenticatedContext =
  createContext<AuthenticatedContextValue | null>(null);
