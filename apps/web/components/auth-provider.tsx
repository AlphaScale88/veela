"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabaseBrowser } from "../lib/supabase-browser";

/**
 * Account state, site-wide — the header reads it to show "Log in" or a signed-in menu,
 * `/analyse` reads it to decide whether "Save to my portfolio" saves or redirects to
 * `/login`, and `/portfolio` reads it to know whose properties to fetch.
 *
 * `configured` is `false` when Supabase isn't set up (`supabaseBrowser()` returns
 * `null`) — every login-gated affordance should hide itself rather than show a control
 * that would just fail, the same "zero configuration" rule this project applies to the
 * Maps key and `DATABASE_URL`.
 */
interface AuthState {
  readonly user: User | null;
  readonly loading: boolean;
  readonly configured: boolean;
  readonly signInWithGoogle: (redirectTo?: string) => Promise<void>;
  readonly signInWithPassword: (email: string, password: string) => Promise<string | null>;
  readonly signUpWithPassword: (email: string, password: string) => Promise<string | null>;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(supabase !== null);

  useEffect(() => {
    if (supabase === null) return;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  const signInWithGoogle = useCallback(
    async (redirectTo?: string) => {
      if (supabase === null) return;
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo ?? "/")}`,
        },
      });
    },
    [supabase],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      if (supabase === null) return "Sign-in isn't configured on this deployment.";
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error?.message ?? null;
    },
    [supabase],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      if (supabase === null) return "Sign-up isn't configured on this deployment.";
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      return error?.message ?? null;
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (supabase === null) return;
    await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      configured: supabase !== null,
      signInWithGoogle,
      signInWithPassword,
      signUpWithPassword,
      signOut,
    }),
    [user, loading, supabase, signInWithGoogle, signInWithPassword, signUpWithPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
