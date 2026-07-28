import { createContext } from "react";

/**
 * Defines the elements that the children components will be able to access
 * in the authenticated context.
 */
export interface AuthenticatedContextValue {
  email: string;
  familyName: string;
  givenName: string;
  logout: () => void;
  token: string | undefined;
  username: string;
}

/**
 * Defines the authentication context.
 */
export const AuthenticatedContext =
  createContext<AuthenticatedContextValue | null>(null);
