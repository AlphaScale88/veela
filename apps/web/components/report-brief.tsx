"use client";

import { useState } from "react";

import { SparkleIcon } from "./app-shell";

/**
 * An AI-written brief on the report, sitting at the top of it.
 *
 * ## What it is not
 *
 * Asked to "use AI to compute all the financials". **It doesn't, and that is the design.**
 * Every figure in this report comes from `computeVerdict` — the AVD table transcribed verbatim
 * from the IRD, rule sets versioned by transaction date, 23 tests pinning the marginal-relief
 * boundaries. A language model in that position would trade a reproducible, sourced number for
 * a plausible one, and put it on the screen a reader acts on.
 *
 * So: **the engine computes, the model explains.** What this sends is the figures the engine
 * already produced plus the amenity counts OSM already returned, as text, and asks for what
 * they mean together. That is judgement over public rules, which is the use this project's own
 * open question 2 named as the natural fit for AI here — as opposed to "dynamic pricing" and
 * "comp selection", which it deferred precisely because they need data we do not have.
 *
 * ## On demand, and honest when it fails
 *
 * A button, not an automatic fetch on report open: it spends real Anthropic tokens on a
 * public, unauthenticated endpoint, and most readers want the numbers rather than a summary of
 * them. `ANTHROPIC_API_KEY` is currently unset in production, so the honest outcome today is
 * the "not configured" sentence arriving as body text — the same zero-configuration rule the
 * chat panel, the Maps key and `DATABASE_URL` all follow. Nothing else on the report depends
 * on this.
 */

interface Props {
  /** The computed report as plain lines — the same `summariseForChat` output the assistant
   *  already receives, so the two cannot describe the property differently. */
  readonly summary: string;
  /** Nearby amenities as text, when a location is attached. Absent is fine and the prompt is
   *  told to say so rather than invent a neighbourhood. */
  readonly area?: string | undefined;
}

export function ReportBrief({ summary, area }: Props): React.JSX.Element {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function run(): Promise<void> {
    setPending(true);
    setText("");
    setDone(false);
    try {
      const res = await fetch("/api/report/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(area === undefined ? { summary } : { summary, area }),
      });
      const reader = res.body?.getReader();
      if (reader === undefined) {
        setText("The brief could not be loaded.");
        return;
      }
      /* Plain-text stream, appended as it lands — the same shape `/chat` uses, and the reason
         a 503 arrives as readable prose rather than a status code. */
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        setText((t) => t + decoder.decode(value, { stream: true }));
      }
    } catch {
      setText((t) => (t === "" ? "The brief could not be loaded." : t));
    } finally {
      setPending(false);
      setDone(true);
    }
  }

  return (
    <section className="rounded-panel border border-line bg-surfaceMuted px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <SparkleIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Read this report in plain English</h3>
            <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-muted">
              A written brief on the figures below — what they say together, and which findings
              would actually change a decision.
            </p>
          </div>
        </div>
        {text === "" && (
          <button
            type="button"
            onClick={() => void run()}
            disabled={pending}
            className="btn-secondary shrink-0 !px-4 !py-2 !text-xs disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Writing…" : "Write the brief"}
          </button>
        )}
      </div>

      {text !== "" && (
        <>
          {/* Paragraphs preserved, nothing else interpreted: the response is plain text, and
              rendering it as markdown would mean trusting model output as markup. */}
          <div className="mt-3 space-y-3">
            {text.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="text-sm leading-relaxed text-mist">
                {para}
              </p>
            ))}
          </div>
          {done && (
            <p className="mt-3 border-t border-line pt-2.5 text-[11px] leading-relaxed text-muted">
              Written by Claude from the figures in this report — it did not compute any of
              them. The yield, stamp duty and tax all come from Veela&apos;s rules engine, and
              the numbers above are the authoritative ones if the two ever read differently.
              Not financial or legal advice.
            </p>
          )}
        </>
      )}
    </section>
  );
}
