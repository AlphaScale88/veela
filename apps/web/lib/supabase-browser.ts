import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One client per browser tab (`createBrowserClient` is itself a singleton across
 * calls, but wrapping it means every caller — `auth-provider.tsx`, `/login`,
 * `/portfolio` — asks this file for "not configured" rather than each re-deriving the
 * same env-var check.
 *
 * `null` when Supabase isn't configured, not a thrown error — the rest of the product
 * runs with zero configuration (see `DATABASE_URL` and the Google Maps key for the
 * same pattern), and login is a feature to be *offered*, not a requirement to boot.
 */
export function supabaseBrowser(): SupabaseClient | null {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (url === undefined || url === "" || key === undefined || key === "") return null;
  return createBrowserClient(url, key);
}
