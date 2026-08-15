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
 *    "this barely beats cash." That makes it a **risk-reduction purchase at the moment of
 *    transaction**, not a subscription people renew to be told no. Hence a one-off report
 *    priced against a HK$8.3M median deal, not a monthly consumer plan.
 * 2. **The consumer ceiling is low** — low single-digit millions HKD a year even
 *    optimistically, against ~63,000 transactions a year in the entire market. The tax
 *    engine sold as an API to the banks, brokers and agencies that need correct stamp duty
 *    daily reaches a similar number from ~20 relationships instead of ~2,000 customers.
 *
 * So: free stays genuinely useful (it is the funnel and the credibility), the paid consumer
 * unit is **per report**, and the real revenue line is **the API**.
 *
 * ## Prices are indicative until someone pays one
 *
 * Every figure below is a hypothesis, not a finding. HK$680 is ~0.008% of a median deal and
 * roughly a tenth of a surveyor's fee, which is the argument for it — but the only evidence
 * that matters is a completed checkout, and there have been none. Treat the first ten
 * customers as price discovery and expect to move these.
 */

export type PlanId = "free" | "report" | "starter" | "pro";

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  /** HK cents, so money stays an integer end to end — same rule as the engine. */
  readonly priceHkdCents: number;
  readonly interval: "once" | "month" | null;
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
  report: {
    id: "report",
    name: "Verified report",
    // HK$680. Against a median HK$8.27M deal (real, from the Land Registry series in this
    // repo) that is 0.008% of the transaction, and it buys the one thing no free tool has:
    // the Land Registry's own record for this specific property.
    priceHkdCents: 68_000,
    interval: "once",
    blurb: "For the flat you are actually about to buy.",
    features: [
      "Everything in Free",
      "Verified transaction history from the Land Registry for this property",
      "Ownership and encumbrance check before you commit",
      "A dated PDF of the full report, as computed on the day",
      "Written summary of what the figures mean together",
    ],
    monthlyQuota: 0,
    ratePerMinute: 20,
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
