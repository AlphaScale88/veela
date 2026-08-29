"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

/**
 * The hero's primary action, as a search box rather than a pair of buttons — the pattern the
 * reference product leads with, and it is the right one: a box you can type into asks for one
 * thing, where two buttons ask you to choose first.
 *
 * **What it takes is a listing link, not an address, and that difference is the whole honesty of
 * it.** The reference product's box accepts an address, a neighbourhood, a city or a ZIP, because
 * behind it sits an MLS-scale listings database. Hong Kong has no such thing at any price — the
 * Land Registry sells sale records one at a time at HK$10 with no bulk option, and this project
 * has repeatedly declined to harvest the portals that hold the rest. A box here promising "enter
 * an address" would return nothing about that address's price or yield, which is the one failure
 * this product refuses everywhere else: a promise the data cannot keep.
 *
 * A pasted listing link *can* be honoured, because the importer reads the metadata a page
 * publishes about itself and the engine does the rest. So the box asks for what it can use.
 *
 * Submitting runs the **import**, never the report. That distinction is deliberate and already
 * established in `listing-importer.tsx`: an imported listing is real but partial and unverified,
 * so its figures land in the form for a human to confirm rather than producing a verdict nobody
 * checked. Pressing this button is an explicit request to fetch, which is not the same as an
 * explicit request to be told a yield.
 */
export function HeroSearch(): React.JSX.Element {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  function submit(): void {
    const raw = url.trim();
    if (raw === "") return;

    // Somebody pasting from a browser bar often drops the scheme; assuming https is a kinder
    // default than a validation error, and the server re-validates the URL either way.
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      setHint("That does not look like a link — paste the web address of a listing page.");
      return;
    }
    if (!parsed.hostname.includes(".")) {
      setHint("That does not look like a link — paste the web address of a listing page.");
      return;
    }

    setHint(null);
    router.push(`/analyse?import=${encodeURIComponent(parsed.toString())}`);
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2 rounded-full border border-line bg-surface p-2 shadow-lift sm:gap-3"
      >
        <label className="sr-only" htmlFor="hero-listing-url">
          Listing link
        </label>
        <input
          id="hero-listing-url"
          type="text"
          inputMode="url"
          autoComplete="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (hint !== null) setHint(null);
          }}
          placeholder="Paste a listing link"
          className="min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted sm:px-4"
        />
        <button type="submit" className="btn-primary shrink-0 whitespace-nowrap">
          Analyse it
        </button>
      </form>

      {hint !== null ? (
        <p role="alert" className="mt-2 px-1 text-sm text-negative">
          {hint}
        </p>
      ) : (
        /* Naming the sites is not decoration: the importer reads published metadata, so it works
           on some portals and not others, and a reader who pastes from a site that publishes
           nothing should know that before they conclude the product is broken. */
        <p className="mt-2 px-1 text-sm text-muted">
          Works with Centanet, Squarefoot, 28Hse, Midland and Spacious. No link?{" "}
          <Link href="/analyse" className="text-accent underline underline-offset-2">
            Enter the figures yourself
          </Link>
          .
        </p>
      )}
    </div>
  );
}
