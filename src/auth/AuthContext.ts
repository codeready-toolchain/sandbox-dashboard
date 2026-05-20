import { createContext } from "react";

export interface AuthContextValue {
  authenticated: boolean;
  token: string | undefined;
  givenName: string;
  familyName: string;
  email: string;
  username: string;
  getToken: () => Promise<string>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
