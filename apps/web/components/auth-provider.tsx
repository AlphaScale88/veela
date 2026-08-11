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
  /** Resolves to an error message, or `null` on success. Supabase sends a confirmation
   *  link to the **new** address; the change only lands once that link is clicked, which
   *  is why the caller must say so rather than reporting "email changed". */
  readonly updateEmail: (email: string) => Promise<string | null>;
  readonly updatePassword: (password: string) => Promise<string | null>;
  readonly signOut: () => Promise<void>;
  /** True when this account has a password to change at all. A Google-only account has
   *  no `email` identity, and offering it a "change password" form is offering something
   *  that cannot work — Supabase would accept the call and the user still could not sign
   *  in with the result. */
  readonly hasPasswordIdentity: boolean;
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

  const updateEmail = useCallback(
    async (email: string): Promise<string | null> => {
      if (supabase === null) return "Account settings aren't configured on this deployment.";
      const { error } = await supabase.auth.updateUser(
        { email },
        // Back to the settings page, not the site root — someone changing their address is
        // mid-task, and dropping them on the landing page loses that context.
        { emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Faccount` },
      );
      return error?.message ?? null;
    },
    [supabase],
  );

  const updatePassword = useCallback(
    async (password: string): Promise<string | null> => {
      if (supabase === null) return "Account settings aren't configured on this deployment.";
      const { error } = await supabase.auth.updateUser({ password });
      return error?.message ?? null;
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (supabase === null) return;
    await supabase.auth.signOut();
  }, [supabase]);

  /* `identities` lists how this account can authenticate. Google-only accounts have no
     "email" identity and therefore no password. Defaults to true while the session is
     still loading, so the form doesn't flicker away from a password user. */
  const hasPasswordIdentity =
    user === null || user.identities === undefined
      ? true
      : user.identities.some((i) => i.provider === "email");

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      configured: supabase !== null,
      signInWithGoogle,
      signInWithPassword,
      signUpWithPassword,
      updateEmail,
      updatePassword,
      signOut,
      hasPasswordIdentity,
    }),
    [
      user,
      loading,
      supabase,
      signInWithGoogle,
      signInWithPassword,
      signUpWithPassword,
      updateEmail,
      updatePassword,
      signOut,
      hasPasswordIdentity,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
