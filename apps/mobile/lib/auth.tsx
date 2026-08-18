import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  authConfigured,
  clearSession,
  loadSession,
  signInWithPassword,
} from "./session";

/**
 * Whether somebody is signed in, for the screens that care.
 *
 * Deliberately the **same shape as the web's `useAuth`** — `signedIn`, `loading`, `configured`,
 * `signIn`, `signOut` — so a reader moving between `apps/web` and `apps/mobile` meets one idea
 * rather than two. It holds no user profile: the phone only ever needs to know whether it has a
 * token, because every fact about the account comes from the API, which is the thing that
 * validates the token anyway.
 *
 * `loading` starts `true` and matters: reading `SecureStore` is asynchronous, so for the first few
 * frames the app genuinely does not know. Rendering "sign in" during that window would flash a
 * form at somebody who is already signed in — the same race that, on the web, sent signed-in
 * readers to `/login` from `?property=`.
 */
interface AuthValue {
  readonly signedIn: boolean;
  readonly loading: boolean;
  readonly configured: boolean;
  readonly signIn: (email: string, password: string) => Promise<string | null>;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await loadSession();
      if (!cancelled) {
        setSignedIn(session !== null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Returns an error message, or `null` on success — the same convention the web form uses. */
  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const result = await signInWithPassword(email, password);
    if ("error" in result) return result.error;
    setSignedIn(true);
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setSignedIn(false);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ signedIn, loading, configured: authConfigured(), signIn, signOut }),
    [signedIn, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
