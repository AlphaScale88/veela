/**
 * **What Veela sells.** One file, so a price on a marketing page and a quota in a
 * rate limiter can never disagree — the same "one function, not two guesses" rule the
 * Property Finder's yield and the neighbourhood counts already follow, applied to
 * commercial terms.
 *
 * ## Why these tiers, and why this shape
 *
 * The business review that produced this found two things that decide the model:
 *
 * 1. **Hong Kong residential net yields are 1.5–2.5%.** Veela's honest answer is usually
 *    "this barely beats cash", so the free tier has to stay genuinely useful — a paywall in
 *    front of the thing that establishes credibility would trade the funnel for the fee.
 * 2. **The consumer ceiling is low** — low single-digit millions HKD a year even
 *    optimistically, against ~63,000 transactions a year in the entire market. The tax
 *    engine sold as an API to the banks, brokers and agencies that need correct stamp duty
 *    daily reaches a similar number from ~20 relationships instead of ~2,000 customers.
 *
 * ## The consumer tier moved from one-off to monthly (16/08/2026)
 *
 * This file originally argued for a **per-report** price, on the reasoning that a thin-yield
 * market makes Veela a risk-reduction purchase at the moment of transaction — and that nobody
 * renews a subscription to be told no. Changed on request, and **the original argument is
 * genuinely weaker than when it was written**, for a reason that has nothing to do with the
 * request: *Property Alerts became real*. When the reasoning was drafted there was nothing to
 * keep paying for between purchases. There now is — a saved report is watched against RVD's
 * monthly indices and the dated rule sets, and told when it goes stale.
 *
 * That flips which half of the audience the paid tier serves. A one-off report sells to
 * somebody **buying once**; a subscription sells to somebody **holding a portfolio**, which is
 * a larger and far more recurring population than annual transaction counts suggest — roughly
 * 63,000 flats change hands in a year, but well over a million are owned.
 *
 * **What has not changed:** the honest answer is still usually "this barely beats cash", so the
 * free tier must stay genuinely useful. The line is *decide on one property* (free) versus
 * *keep watching what you own* (paid) — not a paywall dropped in front of what already worked.
 *
 * The real revenue line is still **the API**.
 *
 * ## Prices are indicative until someone pays one
 *
 * Every figure below is a hypothesis, not a finding. The only evidence that matters is a
 * completed checkout, and there have been none. **The consumer price in particular is the one
 * to expect to move**: it was a one-off HK$680 a day ago and is now HK$188 a month, which is a
 * different bet about who the customer is, not a discount. Treat the first ten subscribers as
 * price discovery.
 */

export type PlanId = "free" | "investor" | "starter" | "pro";

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  /** HK cents, so money stays an integer end to end — same rule as the engine. */
  readonly priceHkdCents: number;
  readonly interval: "month" | null;
  readonly blurb: string;
  readonly features: readonly string[];
  /** API calls per calendar month. 0 means the tier has no API access at all. */
  readonly monthlyQuota: number;
  /** Requests per minute, the burst guard. Independent of the monthly quota: a month's
   *  allowance spent in one minute is an outage for everyone else on the instance. */
  readonly ratePerMinute: number;
}

export const PLANS: Readonly<Record<PlanId, Plan>> = {
  free: {
    id: "free",
    name: "Free",
    priceHkdCents: 0,
    interval: null,
    blurb: "Everything needed to decide whether a flat is worth a second look.",
    features: [
      "Live yield, stamp duty and cash-to-acquire as you type",
      "The full report — findings, tax, costs — with a free account",
      "Area profile: schools, transport, shops, mapped and itemised",
      "Import a listing link, or search by building name",
      "Market data from the RVD and the Census",
    ],
    monthlyQuota: 0,
    ratePerMinute: 20,
  },
  investor: {
    id: "investor",
    name: "Investor",
    // HK$188/month. Judged against what it replaces rather than in the abstract: a single
    // surveyor's visit or an hour of a solicitor's time costs several times this, and a
    // subscriber holding one HK$8M flat is paying roughly 0.03% of its value a year to know
    // when the figures behind it have moved.
    priceHkdCents: 18_800,
    interval: "month",
    blurb: "For a portfolio you actually own, or are actively hunting.",
    features: [
      "Everything in Free, for as many properties as you like",
      "Property alerts — told when market rents, prices or the stamp duty rules move against a saved report",
      "Verified Land Registry searches: 5 a month included",
      "Re-run any saved report against today's rules, any time",
      "A dated PDF of any report, as computed on the day",
      "Written plain-English summary on every report",
    ],
    monthlyQuota: 0,
    ratePerMinute: 30,
  },
  starter: {
    id: "starter",
    name: "API — Starter",
    priceHkdCents: 500_000, // HK$5,000/month
    interval: "month",
    blurb: "The tax engine, for one team.",
    features: [
      "REST API: stamp duty, yield, tax and total cost to acquire",
      "Ad valorem scales versioned by transaction date",
      "2,000 calls a month",
      "Rule changes tracked and dated — no re-implementation on your side",
      "Email support",
    ],
    monthlyQuota: 2_000,
    ratePerMinute: 60,
  },
  pro: {
    id: "pro",
    name: "API — Pro",
    priceHkdCents: 2_000_000, // HK$20,000/month
    interval: "month",
    blurb: "For brokers, agencies and private-bank desks.",
    features: [
      "Everything in Starter",
      "50,000 calls a month",
      "Area profiles and building lookup via API",
      "Batch valuation endpoint",
      "Priority support and a named contact",
    ],
    monthlyQuota: 50_000,
    ratePerMinute: 300,
  },
};

/** Unauthenticated public callers — the live preview, the chat panel, the free report.
 *  Generous enough that nobody legitimate meets it, tight enough that a script does. */
export const ANONYMOUS_RATE_PER_MINUTE = 20;

/** `/chat` and `/report/brief` spend real money per call, so they are held far tighter than
 *  the engine, which only spends CPU. This is the limit that stops one visitor turning into
 *  an unbounded bill. */
export const AI_RATE_PER_MINUTE = 6;

export function planFor(id: string): Plan {
  return PLANS[id as PlanId] ?? PLANS.free;
}

/** HK$ with no decimals — every price here is a whole dollar, and "HK$680.00" reads like a
 *  system that expects cents to matter. */
export function formatPlanPrice(plan: Plan): string {
  if (plan.priceHkdCents === 0) return "Free";
  const dollars = Math.round(plan.priceHkdCents / 100).toLocaleString("en-HK");
  return plan.interval === "month" ? `HK$${dollars}/mo` : `HK$${dollars}`;
}
