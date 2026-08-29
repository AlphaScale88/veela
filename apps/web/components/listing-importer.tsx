"use client";

import type { ImportedListing } from "@veela/types";
import { useEffect, useRef, useState } from "react";

import { ErrorToast } from "./toast";

/**
 * "Paste a link" — reads whatever the page publishes as Open Graph tags and structured
 * data (`packages/api/src/listing-extract.ts`), never its rendered layout. That's
 * usually partial: most Hong Kong listing sites don't publish price and area as
 * metadata the way they show it on the page. This component's job is just the fetch and
 * the honest reporting of what came back — `app/analyse/page.tsx` decides what to do
 * with a successful result.
 */
interface Props {
  readonly onImported: (listing: ImportedListing) => void;
  /** A link handed over by the landing page's search box, fetched once on mount. */
  readonly initialUrl?: string | undefined;
}

/**
 * The server rejects a link two different ways, and they arrive as two different
 * shapes — reading both mattered directly: assuming JSON silently swallowed the
 * clearer of the two. `HTTPException` (an unreachable, unsafe, or unreadable URL —
 * `ssrf-safe-fetch.ts` and `spacious-stealth-fetch.ts`) sends its `message` as plain
 * text, the Hono default. `zValidator` (a URL that fails `z.string().url()` before the
 * handler ever runs) sends a Zod error as JSON. Reading the body as text first works
 * for both — JSON is valid text too — then this tries to parse it and only falls back
 * to the raw text (capped, in case something unrelated ever returns an HTML error page)
 * if that fails or doesn't look like either known shape.
 */
async function readRejectionMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");

  try {
    const body = JSON.parse(text) as { message?: string; error?: { issues?: { message?: string }[] } };
    if (typeof body.message === "string" && body.message.trim() !== "") return body.message;
    const firstIssue = body.error?.issues?.[0]?.message;
    if (typeof firstIssue === "string" && firstIssue.trim() !== "") {
      return `That doesn't look like a valid link (${firstIssue}).`;
    }
  } catch {
    // Not JSON — the plain-text HTTPException case, handled below.
  }

  const trimmed = text.trim();
  if (trimmed !== "" && trimmed.length < 300) return trimmed;
  return `The server rejected that link (${res.status}).`;
}

export function ListingImporter({ onImported, initialUrl }: Props): React.JSX.Element {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* The landing page's search box hands the link over through `?import=`, so the fetch runs
     without a second click on a button the reader has already effectively pressed.
     **This runs the import, not the report** — the distinction this file is built around: an
     imported listing is real but partial, so its figures land in the form for a human to
     confirm. Guarded by a ref rather than a dependency list because it must happen once per
     visit, and a re-render is not a new request. */
  const autoRunRef = useRef(false);

  useEffect(() => {
    if (autoRunRef.current) return;
    if (initialUrl === undefined || initialUrl.trim() === "") return;
    autoRunRef.current = true;
    setUrl(initialUrl);
    void submit(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  /* `overrideUrl` exists because the auto-run below fires when the prop arrives, which is one
     render *after* mount: reading `url` from state there gets the empty initial value and the
     fetch silently does nothing. Passing the target in is the fix; the button still passes
     nothing and uses what was typed. */
  async function submit(overrideUrl?: string): Promise<void> {
    const target = (overrideUrl ?? url).trim();
    if (target === "") return;
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/listing/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: target }),
      });

      if (!res.ok) {
        setError(await readRejectionMessage(res));
        return;
      }

      const { listing } = (await res.json()) as { listing: ImportedListing };
      onImported(listing);
      setUrl("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card">
      <p className="text-sm font-semibold">Or import from a listing link</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Paste a link to a Hong Kong property listing. This reads only what the page
        publishes as metadata — often just the title and photo, sometimes price and
        size too — never a full page scrape. Whatever isn't found, you fill in
        yourself.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="mt-3 flex flex-col gap-2 sm:flex-row"
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          required
          className="flex-1 rounded-card border border-line bg-surfaceMuted px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:bg-surface"
        />
        <button
          type="submit"
          disabled={pending || url.trim() === ""}
          className="btn-secondary !px-5 !py-2.5 !text-sm disabled:pointer-events-none disabled:opacity-40"
        >
          {pending ? "Reading…" : "Import"}
        </button>
      </form>

      {error !== null && <ErrorToast message={error} onDismiss={() => setError(null)} />}
    </div>
  );
}
