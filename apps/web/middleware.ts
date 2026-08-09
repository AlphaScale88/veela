import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes that don't work at all without an account — redirected server-side, before any
 * client component mounts. Empty for now: `/finder` was gated here on 06/08/2026
 * alongside `/analyse`'s report, on the reasoning that both were "the full product."
 * Reopened on 09/08/2026, following a business review — the finder shows clearly-labelled
 * *fabricated* listings (see `LISTINGS_NOTICE`), so it's marketing for the real report,
 * not something worth an account wall, and charging for access to it later would raise a
 * real Trade Descriptions Ordinance (Cap. 362) question that giving it away for free
 * doesn't. `/analyse`'s own report gate is untouched — that one is real user-fed figures,
 * not fabricated data, and it needs to keep the reader's half-typed form on screen, which
 * a redirect would throw away — see `components/login-form.tsx`'s doc comment.
 */
const AUTH_REQUIRED_PREFIXES: readonly string[] = [];

/**
 * Refreshes the Supabase session cookie on every request. The route handler
 * (`app/api/[[...route]]/route.ts`) reads the session but — as its own comment says —
 * "route handlers can't always set cookies; token refresh happens in middleware". This
 * is that middleware: without it, an access token quietly expires and every signed-in
 * request eventually starts failing `getUser()` with no visible cause.
 *
 * Unconfigured Supabase is not an error here either — same "runs with zero
 * configuration" rule as everywhere else this project touches Supabase. It also means
 * `AUTH_REQUIRED_PREFIXES` cannot be enforced without an account system to check
 * against, so an unconfigured deployment leaves those routes open rather than bricking
 * them — the same trade-off `/portfolio` already makes for itself.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (url === undefined || url === "" || key === undefined || key === "") {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        // Cookies must be written to both the incoming request (so a Server Component
        // rendered later in this same request sees the refreshed session) and the
        // outgoing response (so the browser actually receives it).
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Also the refresh trigger — this call is what rewrites the cookie via setAll above
  // if a refresh was needed — but its return value is now used too, for the redirect.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (user === null && AUTH_REQUIRED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /* Run on everything except static assets and Next's own internals — those never
       carry a session cookie that needs refreshing. */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
