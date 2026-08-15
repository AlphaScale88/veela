import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "../../components/app-shell";
import { PLANS, formatPlanPrice, type Plan } from "@veela/api/plans";

export const metadata: Metadata = {
  title: "Pricing — Veela",
  description:
    "Free to check a property. HK$680 for a verified report on the one you are buying. An API for teams that need Hong Kong stamp duty right every day.",
};

/**
 * The offer, in one place.
 *
 * **Rendered from `PLANS`, the same object the rate limiter enforces against** — so a price
 * or a quota shown here cannot drift from what a customer actually gets. That is the same
 * "one function, not two guesses" rule the neighbourhood counts and the Property Finder's
 * yield already follow, applied to commercial terms, and it is the whole reason `plans.ts`
 * lives in `@veela/api` rather than being retyped in the marketing page.
 *
 * ## Why the shape is free / one-off / API rather than a consumer subscription
 *
 * Two findings from the business review drove it, both grounded in this repo's own data:
 *
 * 1. Hong Kong net yields run **1.5–2.5%**, so Veela's honest answer is usually "this barely
 *    beats cash." That makes it a **risk-reduction purchase at the moment of transaction** —
 *    people pay to avoid an HK$8.3M mistake, once. They do not renew a subscription monthly
 *    to be told no.
 * 2. The consumer ceiling is low: ~63,000 residential transactions a year in the *entire*
 *    market. The same engine sold to banks, brokers and agencies reaches comparable revenue
 *    from about twenty relationships.
 *
 * Hence: free stays genuinely useful because it is the funnel and the credibility, the paid
 * consumer unit is per report, and the revenue line is the API.
 */

export default function PricingPage(): React.JSX.Element {
  const consumer = [PLANS.free, PLANS.report];
  const api = [PLANS.starter, PLANS.pro];

  /**
   * **Whether anything can actually be bought yet.**
   *
   * No payment processor is configured, so a "Buy a report" button would take a reader to a
   * page that cannot charge them — a promise the product cannot keep, which is the one thing
   * this codebase refuses to do anywhere else (the same rule that put "not configured" text
   * behind the AI panel rather than a broken chat box). Until a key exists the card says what
   * is true: the price is set, the checkout is not built, and saying so is more likely to
   * produce a useful reply than a dead button.
   *
   * Read at request time on the server, so adding the key is a redeploy away from a live
   * checkout with no code change here.
   */
  const paymentsLive =
    (process.env["STRIPE_SECRET_KEY"] ?? "") !== "";

  return (
    <AppShell breadcrumb="Pricing">
      <header className="max-w-prose">
        <p className="eyebrow">Pricing · Hong Kong</p>
        <h1 className="mt-3 font-display text-[34px] font-extrabold leading-tight tracking-[-0.03em]">
          Free to look. Paid when it matters.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Checking whether a flat stacks up should cost nothing — that is most of what Veela
          does, and it stays free. You pay at the two moments money is genuinely on the line:
          the property you are actually buying, and the API a team runs its own numbers
          through.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
          For an investor
        </h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {consumer.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              cta={
                p.id === "free"
                  ? "Analyse a property"
                  : paymentsLive
                    ? "Buy a report"
                    : "Not on sale yet"
              }
              disabled={p.id === "report" && !paymentsLive}
              note={
                p.id === "report" && !paymentsLive
                  ? "Checkout isn't built yet. The price is real and the report exists — tell us if you'd pay it and you'll be first in line."
                  : undefined
              }
              href="/analyse"
            />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
            For a team — the tax engine as an API
          </h2>
          <Link href="/developers" className="text-sm font-medium text-accent hover:underline">
            Read the API docs
          </Link>
        </div>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Hong Kong&apos;s ad valorem scales change, repeatedly. Every integration that
          hard-codes a stamp duty table is wrong the morning after a Budget. Veela&apos;s is
          versioned by transaction date and tested at every marginal-relief boundary — a 2023
          purchase still prices under 2023&apos;s rules.
        </p>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {api.map((p) => (
            <PlanCard key={p.id} plan={p} cta="Talk to us" href="/developers" />
          ))}
        </div>
      </section>

      {/* Said plainly rather than buried: a price nobody has paid yet is a hypothesis, and
          pretending otherwise is the kind of small dishonesty this product does not do
          elsewhere. It also invites the conversation that sets the real number. */}
      <section className="card mt-12 max-w-prose">
        <h2 className="text-[15px] font-semibold">If these numbers are wrong, say so</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Veela is early, and these prices are a considered guess rather than a tested one.
          HK$680 is about 0.008% of a median Hong Kong flat and roughly a tenth of a
          surveyor&apos;s fee, which is the argument for it — but the only evidence that counts
          is somebody paying. If the API is priced wrong for your team, tell us what it is
          worth and we will talk. Early customers get that conversation, and the price it
          lands on.
        </p>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Prices in Hong Kong dollars. Veela computes figures from public rules and your own
        inputs; it is not financial, tax or legal advice, and it is not a substitute for a
        solicitor or a licensed adviser. See the{" "}
        <Link href="/terms" className="underline decoration-line underline-offset-4 hover:text-mist">
          terms
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className="underline decoration-line underline-offset-4 hover:text-mist">
          privacy statement
        </Link>
        .
      </p>
    </AppShell>
  );
}

function PlanCard({
  plan,
  cta,
  href,
  disabled = false,
  note,
}: {
  readonly plan: Plan;
  readonly cta: string;
  /** Typed from `Link` rather than `string`: Next's typed routes reject an arbitrary string,
   *  and taking the type from the component keeps this correct as routes are added. */
  readonly href: React.ComponentProps<typeof Link>["href"];
  /** Renders the CTA inert rather than hiding the tier — the price is the message, and a
   *  missing card says less than a priced one that admits it cannot take money yet. */
  readonly disabled?: boolean;
  readonly note?: string | undefined;
}): React.JSX.Element {
  const highlighted = plan.id === "report" || plan.id === "starter";
  return (
    <article
      className={`card flex h-full flex-col ${highlighted ? "border-accent/40 shadow-lift" : ""}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{plan.name}</h3>
        <span className="tnum font-display text-[24px] font-semibold tracking-[-0.02em]">
          {formatPlanPrice(plan)}
          {plan.interval === "once" && (
            <span className="ml-1.5 text-xs font-normal text-muted">per report</span>
          )}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-muted">{plan.blurb}</p>

      <ul className="mt-4 flex-1 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2 text-sm leading-relaxed">
            <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span className="text-mist">{f}</span>
          </li>
        ))}
      </ul>

      {plan.monthlyQuota > 0 && (
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
          {plan.monthlyQuota.toLocaleString("en-HK")} calls/mo · {plan.ratePerMinute}/min burst
        </p>
      )}

      {note !== undefined && (
        <p className="mt-4 rounded-card border border-caution/40 bg-caution/10 px-3 py-2 text-xs leading-relaxed text-muted">
          {note}
        </p>
      )}

      {disabled ? (
        <span
          aria-disabled="true"
          className="btn-secondary mt-4 inline-flex cursor-not-allowed justify-center !py-2.5 !text-[13px] opacity-60"
        >
          {cta}
        </span>
      ) : (
        <Link
          href={href}
          className={`mt-5 inline-flex justify-center ${highlighted ? "btn-primary" : "btn-secondary"} !py-2.5 !text-[13px]`}
        >
          {cta}
        </Link>
      )}
    </article>
  );
}
