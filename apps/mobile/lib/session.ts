import * as SecureStore from "expo-secure-store";

/**
 * The signed-in session on the phone.
 *
 * ## Why this talks to Supabase over plain `fetch` instead of using `@supabase/supabase-js`
 *
 * The web uses `@supabase/ssr` because it has cookies to manage. The phone has none, and all it
 * needs from Supabase are two documented endpoints: exchange a password for a session, and exchange
 * a refresh token for a new one. Adding the full client to get those brings a dependency that
 * historically needs URL and stream polyfills under React Native, for behaviour this file
 * implements in about forty lines.
 *
 * The trade-off, stated plainly: **we own refresh.** `supabase-js` would schedule it in the
 * background; here it happens on demand, when a request is about to be made and the token is
 * within `REFRESH_MARGIN_S` of expiry, plus once reactively if the API still says 401. That is
 * simpler to reason about than a timer, and it cannot fire while the app is asleep — which is
 * fine, because a request is the only thing that needs a valid token.
 *
 * ## Tokens are stored separately, not as one JSON blob
 *
 * `SecureStore` values are capped (2 KB on Android). An access token is often close to a kilobyte
 * on its own, so a single `{access, refresh, expiry}` blob is a size limit waiting to be hit in
 * production on exactly the devices hardest to debug. Three small keys cannot.
 */

const ACCESS_KEY = "veela.access_token";
const REFRESH_KEY = "veela.refresh_token";
const EXPIRY_KEY = "veela.expires_at";

/** Refresh this far before actual expiry, so a slow request cannot land after the token dies. */
const REFRESH_MARGIN_S = 120;

const SUPABASE_URL = process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";
const SUPABASE_ANON_KEY = process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"] ?? "";

/**
 * Whether sign-in can work at all on this build.
 *
 * The same zero-configuration rule the web follows: without keys the app must still run and the
 * Analyse tab must still work, because that flow needs no account. The Portfolio tab says so
 * rather than showing a form that cannot succeed.
 */
export function authConfigured(): boolean {
  return SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
}

export interface StoredSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Unix seconds. */
  readonly expiresAt: number;
}

interface TokenResponse {
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly expires_in?: number;
  readonly error_description?: string;
  readonly msg?: string;
  readonly error?: string;
}

async function persist(t: TokenResponse): Promise<StoredSession | null> {
  if (t.access_token === undefined || t.refresh_token === undefined) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + (t.expires_in ?? 3600);
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, t.access_token),
    SecureStore.setItemAsync(REFRESH_KEY, t.refresh_token),
    SecureStore.setItemAsync(EXPIRY_KEY, String(expiresAt)),
  ]);
  return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt };
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, expiry] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
    SecureStore.getItemAsync(EXPIRY_KEY),
  ]);
  if (accessToken === null || refreshToken === null) return null;
  return { accessToken, refreshToken, expiresAt: Number(expiry ?? 0) };
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(EXPIRY_KEY),
  ]);
}

/** The message a reader can act on, rather than Supabase's `invalid_credentials` code. */
function readableError(t: TokenResponse, status: number): string {
  if (t.error_description !== undefined) return t.error_description;
  if (t.msg === "Invalid login credentials") {
    return "That email and password do not match an account.";
  }
  if (t.msg !== undefined) return t.msg;
  return `Sign-in failed (${status}).`;
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ session: StoredSession } | { error: string }> {
  if (!authConfigured()) {
    return { error: "Sign-in is not configured on this build." };
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const body = (await res.json()) as TokenResponse;
  const session = res.ok ? await persist(body) : null;
  return session === null ? { error: readableError(body, res.status) } : { session };
}

/**
 * A usable access token, refreshing first if it is expired or about to be.
 *
 * Returns `null` when there is no session, or when the refresh token itself has been rejected —
 * in which case the stored session is cleared, because keeping a refresh token the server has
 * already refused only produces the same failure on every subsequent request.
 */
export async function currentAccessToken(): Promise<string | null> {
  const stored = await loadSession();
  if (stored === null) return null;

  const now = Math.floor(Date.now() / 1000);
  if (stored.expiresAt - REFRESH_MARGIN_S > now) return stored.accessToken;

  const refreshed = await refresh(stored.refreshToken);
  return refreshed?.accessToken ?? null;
}

export async function refresh(refreshToken: string): Promise<StoredSession | null> {
  if (!authConfigured()) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    await clearSession();
    return null;
  }
  const next = await persist((await res.json()) as TokenResponse);
  if (next === null) await clearSession();
  return next;
}

/** Forces a refresh regardless of the stored expiry — used once after an unexpected 401. */
export async function forceRefresh(): Promise<string | null> {
  const stored = await loadSession();
  if (stored === null) return null;
  return (await refresh(stored.refreshToken))?.accessToken ?? null;
}
