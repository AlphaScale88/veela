import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Where Google OAuth and every email link land.
 *
 * ## Two arrival shapes, and only one used to be handled
 *
 * - **`?code=…`** — the PKCE code, used by OAuth and by email links that route through
 *   Supabase's own `/auth/v1/verify` endpoint. Exchanging it **requires the `code_verifier`
 *   cookie written by the browser that started the flow**, so it only works in that same
 *   browser.
 * - **`?token_hash=…&type=…`** — the stateless form. `verifyOtp` needs nothing from the
 *   browser, so it works when the link is opened somewhere else entirely: a different
 *   device, or a mail app's in-app webview with its own cookie jar.
 *
 * Only the first was handled, which made a confirmation link opened anywhere other than the
 * signing-up browser fail with a message claiming it had expired. **Reported from a phone,
 * clicked within five minutes.** The second shape is now handled, and it is the one worth
 * preferring for email: switch the Supabase "Confirm signup" template to the `{{ .TokenHash }}`
 * URL and cross-browser confirmation simply works.
 *
 * ## Failures are told apart rather than flattened
 *
 * Every failure used to redirect to `?error=auth_failed`, which `/login` renders as "it may
 * have expired". For a link clicked a minute after it arrived that is not just unhelpful, it
 * is **wrong** — it sends someone to request another link that will fail exactly the same way.
 * The reason is now distinguished, and the underlying Supabase message is logged so the next
 * report can be diagnosed from the server logs instead of guessed at.
 */

/** The `type` values Supabase sends on an email link. Anything else is not ours to verify. */
const EMAIL_OTP_TYPES = new Set<string>([
  "signup",
  "email",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
]);

/**
 * Same shape guard as `/login`'s, and for the same reason: an open redirect through a page
 * carrying our own certificate is the classic phishing hand-off. Whitelisting the shape means
 * a new way of writing an absolute URL fails closed rather than sneaking through.
 */
function safeNext(raw: string | null): string {
  if (raw === null || raw === "") return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));

  const fail = (reason: string, detail?: string): NextResponse => {
    // Server-side only: the reason reaches the reader as a sentence, never as a raw message.
    console.error(`[auth/callback] ${reason}${detail === undefined ? "" : ` — ${detail}`}`);
    return NextResponse.redirect(`${origin}/login?error=${reason}`);
  };

  // Supabase can refuse before ever reaching us and pass its own error through.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError !== null) return fail("link_used", providerError);

  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (url === undefined || url === "" || key === undefined || key === "") {
    return fail("not_configured");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });

  // Stateless first: when both shapes are present this is the one that works in any browser.
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (tokenHash !== null && type !== null && EMAIL_OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error === null) return NextResponse.redirect(`${origin}${next}`);
    return fail("link_used", error.message);
  }

  const code = searchParams.get("code");
  if (code !== null) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error === null) return NextResponse.redirect(`${origin}${next}`);

    /*
     * A missing or mismatched verifier is a *different fact* from an expired link: the code was
     * fine, this browser simply never held the other half of it. Telling those apart is the
     * whole point of this branch — "try again" is useless advice for the first and correct for
     * the second.
     */
    const pkceFailure = /verifier|code[_ ]?challenge|pkce/i.test(error.message);
    return fail(pkceFailure ? "wrong_browser" : "link_used", error.message);
  }

  return fail("no_code");
}
