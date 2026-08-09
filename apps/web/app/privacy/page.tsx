import Link from "next/link";

import { AppShell } from "../../components/app-shell";

/**
 * The Personal Information Collection Statement `.claude/CLAUDE.md`'s open question #5
 * flagged as missing — `/account`'s aggregate-consent toggle is real, but the PDPO
 * requires notice *at or before* collection, not just a checkbox a user can find later.
 * Linked from `/login` and from the save action on `/analyse`, both points where an
 * account or a property first gets created.
 *
 * **The operating entity is deliberately not named yet.** Which entity invoices for
 * Veela is an open business decision (see the business review this page was written
 * from) — stating one here before it's settled would be worse than a placeholder,
 * since a PICS naming the wrong data controller is itself a PDPO problem. Fill in
 * CONTACT_EMAIL and OPERATOR_NAME below once that's decided; nothing else on this page
 * depends on which entity it turns out to be.
 */
const CONTACT_EMAIL = "[to be confirmed — see the note in this file's own source]";
const OPERATOR_NAME = "[the entity operating Veela — to be confirmed]";
const LAST_UPDATED = "09/08/2026";

export default function PrivacyPage(): React.JSX.Element {
  return (
    <AppShell breadcrumb="Privacy">
      <header className="max-w-prose">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          Privacy
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          What Veela collects, why, and what you can do about it — written for Hong
          Kong&apos;s Personal Data (Privacy) Ordinance (PDPO). Last updated {LAST_UPDATED}.
        </p>
      </header>

      <div className="mt-6 max-w-prose rounded-panel border border-caution/40 bg-caution/10 px-4 py-3 shadow-card">
        <p className="text-xs leading-relaxed text-muted">
          <strong className="text-mist">Placeholder notice.</strong> The operator name and
          contact address below are not filled in yet — see this page&apos;s own source
          comment for why. Don&apos;t treat this as a final, postable policy until they are.
        </p>
      </div>

      <section className="mt-8 max-w-2xl space-y-8">
        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-mist">
            Who this is
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Veela is operated by {OPERATOR_NAME}. This notice covers the Veela web app —
            the property report, the market pages, and the account features described
            below.
          </p>
        </div>

        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-mist">
            The report itself needs no account
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            You can type a property&apos;s figures into <Link href="/analyse" className="text-accent hover:underline">/analyse</Link> and
            see a live yield estimate with nothing sent anywhere but the one-off
            calculation itself. Nothing below applies until you create an account or
            paste a listing link.
          </p>
        </div>

        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-mist">
            What we collect, and why (DPP1)
          </h2>
          <dl className="mt-3 space-y-4">
            <div className="card">
              <dt className="text-[15px] font-semibold">Account — email and password</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                Held by Supabase, our authentication provider, not by us directly.
                Purpose: to know it&apos;s you when you come back, and to scope your saved
                properties to your account.
              </dd>
            </div>
            <div className="card">
              <dt className="text-[15px] font-semibold">Profile — display name, favourite districts</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                Both optional, both editable at <Link href="/account" className="text-accent hover:underline">/account</Link>.
                Purpose: personalising the app to you.
              </dd>
            </div>
            <div className="card">
              <dt className="text-[15px] font-semibold">Properties you save — price, rent, buyer situation, costs</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                Whatever you type into a report you choose to save. Purpose: so the
                report is there next time you visit, dated, with the tax rules that
                produced it. Not used for anything else unless you opt in below.
              </dd>
            </div>
            <div className="card">
              <dt className="text-[15px] font-semibold">A listing URL you paste</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                Fetched server-side to pre-fill a report; the URL and what was
                extracted from it are shown back to you on screen, not stored beyond
                your session unless you go on to save the report.
              </dd>
            </div>
            <div className="card">
              <dt className="text-[15px] font-semibold">Chat messages with the AI assistant</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                Sent to Anthropic to generate a reply and nothing else — no account
                data, no email, no saved properties are included, only the chat text
                and, if you have a report open, a plain-text summary of its figures.
                Not stored on our server; the conversation lives in your browser only
                and is gone on refresh.
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-mist">
            Aggregate use — opt-in, and off until you say so (DPP3)
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Using your saved properties beyond showing them back to you — folding them
            into aggregate market statistics — is a new purpose, and the PDPO requires
            your separate, informed consent for that. It defaults to off. You can turn
            it on or off any time at <Link href="/account" className="text-accent hover:underline">/account</Link>,
            and we record when you last changed it.
          </p>
        </div>

        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-mist">
            Who it&apos;s shared with
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Supabase (authentication and database hosting) and, only for chat replies,
            Anthropic — see above for exactly what each receives. We don&apos;t sell data,
            and we don&apos;t share it with property agents, lenders or anyone else without
            asking you first.
          </p>
        </div>

        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-mist">
            How long we keep it
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            For as long as your account exists. Saved verdicts are kept as dated
            snapshots on purpose — see <Link href="/portfolio" className="text-accent hover:underline">My properties</Link> —
            so deleting a property removes it from your list but a snapshot already
            taken isn&apos;t silently rewritten.
          </p>
        </div>

        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-mist">
            Your rights (DPP6)
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            You can access and correct your display name and consent setting directly
            at <Link href="/account" className="text-accent hover:underline">/account</Link>.
            For anything else — a full export of what we hold, correcting a saved
            property, or deleting your account entirely — email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
              {CONTACT_EMAIL}
            </a>{" "}
            and we&apos;ll handle it by hand; there&apos;s no self-serve export or delete
            button yet.
          </p>
        </div>

        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-mist">
            Changes to this notice
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            If what we collect or why changes, this page changes with it and the date
            at the top updates — the same discipline the report applies to tax rules:
            dated, not silently rewritten.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
