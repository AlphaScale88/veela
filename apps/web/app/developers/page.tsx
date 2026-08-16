import type { Metadata } from "next";
import Link from "next/link";

import { PLANS, formatPlanPrice } from "@veela/api/plans";

export const metadata: Metadata = {
  title: "API — Veela",
  description:
    "Hong Kong stamp duty, property tax and yield as a REST API. Ad valorem scales versioned by transaction date, tested at every marginal-relief boundary.",
};

/**
 * The developer-facing page for the commercial API.
 *
 * **Deliberately shows the request and the real response.** A B2B buyer evaluating a tax
 * engine wants to see the numbers it produces and decide whether they match their own — not
 * read adjectives about accuracy. The example below is a genuine call against a real Hong Kong
 * price, and the figures in it are what `/v1/verdict` actually returned during testing.
 *
 * **Keys are issued by hand, and that is the right answer for now.** A self-serve key
 * dashboard is real work, and the business review put the reachable API market at roughly
 * twenty relationships — not a volume that needs automation before the first customer exists.
 * Building the dashboard first would be scaffolding for demand nobody has demonstrated. The
 * schema, the auth, the quotas and the metering are all live and tested; only the sign-up
 * button is a conversation instead of a form, on purpose.
 */

const EXAMPLE_REQUEST = `curl -X POST https://veela-one.vercel.app/api/v1/verdict \\
  -H "Authorization: Bearer vk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "label": "Monterey Tower 3",
    "jurisdiction": "HK",
    "currency": "HKD",
    "priceMinor": 1298000000,
    "monthlyRentMinor": 3250000,
    "saleableAreaSqft": 692,
    "transactionDate": "2026-08-15",
    "monitored": false,
    "buyer": {
      "isPermanentResident": true,
      "ownsOtherResidentialProperty": false,
      "purchasingViaCompany": false
    },
    "costs": { "ownerPaysRates": true, "vacancyRate": 0.04 }
  }'`;

const EXAMPLE_RESPONSE = `{
  "verdict": {
    "rulesUsed": "HK rules effective 2026-02-26",
    "acquisition": {
      "stampDuty":      { "amount": 48675000,   "currency": "HKD" },
      "stampDutyScale": "AVD Scale 2 — HKPR first-time buyer",
      "total":          { "amount": 1346675000, "currency": "HKD" }
    },
    "returns": { "netYield": 0.0232, "grossYield": 0.0300, "cashOnCash": 0.0232 },
    "findings": [ { "severity": "warning", "title": "No vacancy assumed", "detail": "…" } ],
    "sources": [ "https://www.ird.gov.hk/eng/faq/avd.htm" ]
  },
  "plan": "pro"
}`;

export default function DevelopersPage(): React.JSX.Element {
  return (
    <div className="col py-12 sm:py-16">
      <header className="max-w-prose">
        <p className="eyebrow">Developers</p>
        <h1 className="mt-3 font-display text-[34px] font-extrabold leading-tight tracking-[-0.03em]">
          Hong Kong property tax, correct on the date it happened.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          One POST returns ad valorem stamp duty, the scale it fell under, total cash to
          acquire, property tax, and net and gross yield. The scales are{" "}
          <strong className="text-mist">versioned by transaction date</strong>, so a 2023
          purchase still prices under 2023&apos;s rules — including BSD, SSD and NRSD, which are
          modelled rather than deleted.
        </p>
      </header>

      <section className="card mt-8 max-w-prose">
        <h2 className="text-[15px] font-semibold">Why not just write it yourself</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Because it changes. Hong Kong&apos;s stamp duty rules have been revised repeatedly,
          and every integration that hard-codes a table is wrong the morning after a Budget.
          Veela&apos;s table is transcribed verbatim from the Inland Revenue Department and
          tested for continuity at <em className="not-italic text-mist">every marginal-relief
          band boundary</em> — the property that proves a transcription is right rather than
          merely plausible. When the rules move, you get the new dated rule set; nothing on your
          side changes.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">A request</h2>
        <pre className="mt-3 overflow-x-auto rounded-panel border border-line bg-surfaceMuted p-4 font-mono text-[11px] leading-relaxed text-mist">
          <code>{EXAMPLE_REQUEST}</code>
        </pre>
        <h2 className="mt-8 font-display text-[20px] font-semibold tracking-[-0.02em]">
          What comes back
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Money is integer minor units throughout — cents, never floats — so nothing rounds
          differently on your side than on ours.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-panel border border-line bg-surfaceMuted p-4 font-mono text-[11px] leading-relaxed text-mist">
          <code>{EXAMPLE_RESPONSE}</code>
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
          Limits, and what happens at them
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                <th className="py-2 pr-4 font-normal">Plan</th>
                <th className="py-2 pr-4 font-normal">Price</th>
                <th className="py-2 pr-4 font-normal">Calls / month</th>
                <th className="py-2 font-normal">Burst / minute</th>
              </tr>
            </thead>
            <tbody>
              {[PLANS.pro].map((p) => (
                <tr key={p.id} className="border-b border-line/60">
                  <td className="py-2.5 pr-4 font-medium text-mist">{p.name}</td>
                  <td className="tnum py-2.5 pr-4">{formatPlanPrice(p)}</td>
                  <td className="tnum py-2.5 pr-4">{p.monthlyQuota.toLocaleString("en-HK")}</td>
                  <td className="tnum py-2.5">{p.ratePerMinute}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
          <li>
            <code className="font-mono text-xs text-mist">401</code> — the key is missing,
            malformed or revoked. Checked before the body is parsed.
          </li>
          <li>
            <code className="font-mono text-xs text-mist">429</code> — burst limit. Carries a
            standard <code className="font-mono text-xs text-mist">Retry-After</code> header, so
            an ordinary HTTP client backs off without reading this page.
          </li>
          <li>
            <code className="font-mono text-xs text-mist">402</code> — the monthly quota is
            spent. Resets on the 1st.
          </li>
          <li>
            Every response carries{" "}
            <code className="font-mono text-xs text-mist">x-veela-quota-used</code> and{" "}
            <code className="font-mono text-xs text-mist">x-veela-quota-limit</code>, so you can
            watch the meter without a second call.
          </li>
        </ul>
      </section>

      <section className="card mt-10 max-w-prose">
        <h2 className="text-[15px] font-semibold">Getting a key</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Keys are issued by hand at the moment — Veela is early, and the teams this is built
          for are a small, known set. Tell us what you are building and roughly how many calls
          a month, and you will get a key and a price. If the plans above do not fit your shape,
          say so; they are a starting point, not a menu.
        </p>
        <Link href="/pricing" className="btn-primary mt-4 inline-flex !px-6 !py-2.5 !text-[13px]">
          See pricing
        </Link>
      </section>

      <p className="mt-8 max-w-prose text-xs leading-relaxed text-muted">
        The API returns computed figures from public rules and the inputs you send. It is not
        financial, tax or legal advice, and it does not replace a solicitor, a surveyor or a
        licensed adviser. Veela does not introduce parties to a transaction and is not an estate
        agency.
      </p>
    </div>
  );
}
