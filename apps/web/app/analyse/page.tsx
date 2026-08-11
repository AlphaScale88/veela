"use client";

import type { User } from "@supabase/supabase-js";
import { computeVerdict, HK_RULE_SETS, type Verdict } from "@veela/core";
import { DEMO_DISTRICTS, DEMO_LISTINGS } from "@veela/fixtures";
import { createPropertySchema, type CreatePropertyInput, type ImportedListing } from "@veela/types";
import {
  criticalCount,
  formatCompactMoney,
  formatPercent,
  formatYears,
  gradeNetYield,
  standingColor,
} from "@veela/ui";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { useAiChat } from "../../components/ai-chat-provider";
import { useAuth } from "../../components/auth-provider";
import { BuildingSearch } from "../../components/building-search";
import { ImportedListingMap } from "../../components/imported-listing-map";
import { ListingImporter } from "../../components/listing-importer";
import { NeighbourhoodPanel } from "../../components/neighbourhood-panel";
import {
  draftToApiInput,
  draftToCoreInput,
  INITIAL_DRAFT,
  PropertyForm,
  type Draft,
} from "../../components/property-form";
import { listingToDraft } from "../../components/property-finder";
import { VerdictView } from "../../components/verdict-view";

/**
 * The property summary the chat assistant reads. Prose, not the `Verdict` shape itself
 * — see `chatRequestSchema`'s `context` field in `@veela/types` for why. Only the report
 * (not the live keystroke preview) is worth grounding the assistant in; a half-typed
 * draft would make it confidently wrong about numbers the user hasn't finished entering.
 */
function summariseForChat(label: string, verdict: Verdict): string {
  const lines = [
    `Property: ${label} (${verdict.rulesUsed})`,
    `Price paid, incl. stamp duty and fees: ${formatCompactMoney(verdict.acquisition.total)}`,
    `Stamp duty: ${formatCompactMoney(verdict.acquisition.stampDuty)} (${verdict.acquisition.stampDutyScale})`,
    `Net yield: ${formatPercent(verdict.returns.netYield)}, cash-on-cash: ${formatPercent(verdict.returns.cashOnCash)}, payback: ${formatYears(verdict.returns.paybackYears)}`,
  ];

  const findings = verdict.findings
    .filter((f) => f.severity !== "info")
    .slice(0, 5)
    .map((f) => `- [${f.severity}] ${f.title}: ${f.detail}`);
  if (findings.length > 0) {
    lines.push("Findings:", ...findings);
  }

  return lines.join("\n");
}

/** sessionStorage, not localStorage — this only needs to survive the few seconds of a
 *  Google OAuth round trip, not linger indefinitely on a shared machine. See the
 *  restore effect in `AnalysePage` for why it exists at all. */
const DRAFT_STASH_KEY = "veela:analyse-draft-stash";

/**
 * The tool. Two things are happening at once and they are deliberately different:
 *
 * - The **rail** recomputes locally on every keystroke. It is a preview, so it is
 *   allowed to be wrong about a field you have half-typed, and it never touches the
 *   network.
 * - The **report** comes from `POST /api/verdict/preview`. It is the authoritative
 *   answer, Zod-validated on both sides, and it is what a user would act on.
 *
 * Both call the same `computeVerdict`, so they cannot disagree on arithmetic — only on
 * whether the input was valid, which is exactly the distinction worth surfacing.
 */
export default function AnalysePage(): React.JSX.Element {
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const { setContext } = useAiChat();
  const { user, loading: authLoading, configured: authConfigured } = useAuth();
  const [fromFinder, setFromFinder] = useState(false);
  const [imported, setImported] = useState<ImportedListing | null>(null);
  const [lastSubmittedDraft, setLastSubmittedDraft] = useState<Draft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [welcomeBack, setWelcomeBack] = useState<{ readonly id: string; readonly label: string } | null>(null);
  const autoLoadedRef = useRef(false);
  /**
   * A location attached by hand, via the building search below.
   *
   * The neighbourhood section needs coordinates, and the form does not collect any — so
   * before this existed the section only ever appeared for a property that arrived from a
   * listing link, which is a minority of reports. Typing figures in, the normal path, got
   * nothing. This lets a reader say *which building* they are analysing and get the area
   * profile on any report.
   */
  const [pickedPlace, setPickedPlace] = useState<
    { readonly label: string; readonly latitude: number; readonly longitude: number } | null
  >(null);

  /** `undefined` until loaded, `null` once loaded if the user has never decided either
   *  way. Drives whether `SaveToPortfolio` asks the aggregate-consent question inline
   *  right after a save — surfaced at the point data actually gets collected, not only
   *  buried in `/account`'s settings. See `/privacy`'s DPP3 section for why this can't
   *  just default to on. */
  const [aggregateConsentAt, setAggregateConsentAt] = useState<string | null | undefined>(undefined);
  /** Set when `submit()` was asked for a report but no session exists yet — the report
   *  gate below renders instead of the report, and the auto-retry effect further down
   *  clears it and re-submits the moment `user` stops being `null`. */
  const [reportGated, setReportGated] = useState(false);

  /**
   * A link import is partial and unverified by construction — see
   * `listing-importer.tsx` — so unlike the Property Finder handoff below, this never
   * auto-submits. Most fields are only ever patched, leaving everything else at whatever
   * the form already had, and it hands the raw result to `ImportBanner` so every
   * extracted figure is shown next to its source rather than quietly folded into the
   * form as if it were as reliable as a typed-in number.
   *
   * **`price` and `monthlyRent` are the one deliberate exception — they clear each
   * other, not just patch.** `extractListing` decides which one a listing's headline
   * figure actually is: a sale's price, or a rental's monthly rent, never both guessed
   * from one number. Patch-only semantics here would leave a stale price sitting in the
   * form from whatever was imported *before*, silently combined with a freshly-imported
   * rent into a "net yield" that describes two unrelated listings — a real bug, caught
   * on a Spacious rental that showed 186% because an old price never got cleared. So
   * importing a rent-only listing zeroes `price`, and a price-only listing zeroes
   * `monthlyRent`; a listing that states both (Midland's dual sale+rent pages) sets
   * both, and one that finds neither touches neither. If the resulting combination is
   * enough to compute a yield, the live preview below shows it automatically; if not,
   * `ImportBanner` says plainly that yield can't be estimated from this import alone.
   */
  function handleImported(listing: ImportedListing): void {
    setImported(listing);
    setFromFinder(false);
    setDraft((d) => ({
      ...d,
      ...(listing.title !== undefined && { label: listing.title }),
      price: listing.priceMinor !== undefined ? listing.priceMinor / 100 : listing.monthlyRentMinor !== undefined ? 0 : d.price,
      monthlyRent:
        listing.monthlyRentMinor !== undefined ? listing.monthlyRentMinor / 100 : listing.priceMinor !== undefined ? 0 : d.monthlyRent,
      ...(listing.saleableAreaSqft !== undefined && {
        saleableAreaSqft: listing.saleableAreaSqft,
      }),
    }));
  }

  /**
   * The live preview. A throw here means the draft is mid-edit, not that anything broke.
   *
   * **`price <= 0` is refused explicitly, not left to the core engine's own guards.**
   * `computeVerdict` still "succeeds" at price zero — stamp duty floors at a minimum,
   * agency and legal fees are flat amounts independent of price — so cash-to-acquire
   * stays a small but real, nonzero number, and net yield (net income over that) comes
   * out as a huge, technically-finite percentage rather than the `null`/blank result a
   * reader would expect from "no price." Caught on a cleared-price rental import: net
   * income against a ~HK$95k fee floor alone produced 176%. A price of zero describes no
   * real transaction, so this stops it before `computeVerdict` ever sees it — the same
   * "Finish the figures" placeholder a mid-edit throw already shows.
   */
  const preview = useMemo<Verdict | null>(() => {
    if (draft.price <= 0) return null;
    try {
      return computeVerdict(draftToCoreInput(draft), HK_RULE_SETS);
    } catch {
      return null;
    }
  }, [draft]);

  /** Turns a saved `properties` row back into a `Draft` — the inverse of what
   *  `draftToApiInput` sends when saving one. Money fields are minor units on the
   *  wire, major units in a `Draft`; `buyer`/`costs`/`financing` are stored as JSONB, so
   *  they arrive typed as `unknown` and are cast the same way the API's own
   *  `/properties/:id/verdict` route already casts them. */
  function draftFromSavedProperty(property: {
    readonly label: string;
    readonly priceMinor: number;
    readonly monthlyRentMinor: number;
    readonly saleableAreaSqft: number | null;
    readonly transactionDate: string;
    readonly buyer: unknown;
    readonly costs: unknown;
    readonly financing: unknown;
  }): Draft {
    const buyer = property.buyer as CreatePropertyInput["buyer"];
    const costs = property.costs as CreatePropertyInput["costs"];
    const financing = property.financing as CreatePropertyInput["financing"] | null;
    return {
      label: property.label,
      price: property.priceMinor / 100,
      monthlyRent: property.monthlyRentMinor / 100,
      saleableAreaSqft: property.saleableAreaSqft ?? 0,
      transactionDate: property.transactionDate,
      isPermanentResident: buyer.isPermanentResident,
      ownsOtherResidentialProperty: buyer.ownsOtherResidentialProperty,
      purchasingViaCompany: buyer.purchasingViaCompany,
      monthlyManagementFee: (costs.monthlyManagementFeeMinor ?? 0) / 100,
      annualOtherCosts: (costs.annualOtherCostsMinor ?? 0) / 100,
      agencyFee: (costs.agencyFeeMinor ?? 0) / 100,
      legalFees: (costs.legalFeesMinor ?? 0) / 100,
      vacancyRate: (costs.vacancyRate ?? 0) * 100,
      ownerPaysRates: costs.ownerPaysRates,
      loanAmount: financing ? financing.loanAmountMinor / 100 : 0,
      annualInterestRate: financing ? financing.annualInterestRate * 100 : 0,
      termYears: financing ? financing.termYears : 25,
    };
  }

  async function loadSavedProperty(id: string): Promise<void> {
    try {
      const res = await fetch(`/api/properties/${id}`);
      if (!res.ok) {
        setError(`Could not load that saved property (${res.status}).`);
        return;
      }
      const { property } = (await res.json()) as { property: Parameters<typeof draftFromSavedProperty>[0] };
      const loaded = draftFromSavedProperty(property);
      setDraft(loaded);
      void submit(loaded);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    }
  }

  // Three ways this page can open with data already decided: a Property Finder card
  // (`?listing=`), a saved property (`?property=`), or blank. Read straight off
  // `window.location` rather than `useSearchParams` — this page is a client component
  // wholesale, so there's no SSR/Suspense boundary to satisfy. Runs once: the query
  // string is how the page was *opened*, not a live filter to keep syncing.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const listingId = params.get("listing");
    const propertyId = params.get("property");

    if (listingId !== null) {
      autoLoadedRef.current = true;
      const listing = DEMO_LISTINGS.find((l) => l.id === listingId);
      if (listing === undefined) return;
      const districtLabel =
        DEMO_DISTRICTS.find((d) => d.id === listing.districtId)?.nameEn ?? listing.districtId;
      // The same function `property-finder.tsx` uses to price the card in the first
      // place — not a second guess at its assumptions. See that file's doc comment for
      // why re-deriving them here would risk the report disagreeing with the card.
      const listingDraft = listingToDraft(listing, districtLabel);
      setDraft(listingDraft);
      setFromFinder(true);
      void submit(listingDraft);
      return;
    }

    if (propertyId !== null) {
      autoLoadedRef.current = true;
      void loadSavedProperty(propertyId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally once, see above
  }, []);

  // A logged-in visitor who didn't arrive via either link above and hasn't started a
  // report yet gets offered their most recent saved property — offered, not loaded:
  // silently swapping a blank form for someone else's numbers would be a more confusing
  // surprise than a landing page that's still blank.
  useEffect(() => {
    if (authLoading || user === null || autoLoadedRef.current) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/properties");
      if (!res.ok || cancelled) return;
      const { properties } = (await res.json()) as {
        properties: readonly { id: string; label: string }[];
      };
      const latest = properties[0]; // GET /properties already orders by updatedAt desc
      if (latest !== undefined && !cancelled) setWelcomeBack(latest);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  // Loaded once a session exists, purely so SaveToPortfolio knows whether to ask the
  // aggregate-consent question — the save itself doesn't need this.
  useEffect(() => {
    if (user === null) return;
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { profile: { aggregateConsentAt: string | null } } | null) => {
        if (json !== null && !cancelled) setAggregateConsentAt(json.profile.aggregateConsentAt);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (verdict !== null || reportGated) {
      reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [verdict, reportGated]);

  // Gating on `submit()` (see its own doc comment) is a real navigation to `/login` and
  // back, not an inline form — so the draft has to survive the round trip the same way
  // Google's OAuth redirect always needed to. `submit()` stashes it into sessionStorage
  // right before navigating away; this restores it once on the way back, then clears the
  // key so a later, unrelated visit doesn't pick up a stale draft.
  useEffect(() => {
    const stashed = sessionStorage.getItem(DRAFT_STASH_KEY);
    if (stashed === null) return;
    sessionStorage.removeItem(DRAFT_STASH_KEY);
    try {
      setDraft(JSON.parse(stashed) as Draft);
      setReportGated(true); // re-armed so the effect below retries once the session lands
    } catch {
      // Malformed sessionStorage value — leave the form blank rather than crash on it.
    }
  }, []);

  // The whole reason `reportGated` exists: once a session actually shows up — the
  // email/password form resolved in place, or a stashed draft's Google round-trip just
  // landed — retry automatically rather than making the reader click "See the full
  // report" a second time.
  useEffect(() => {
    if (reportGated && user !== null) {
      setReportGated(false);
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retry keys off user/reportGated
    // transitioning, not every keystroke that changes `draft` (submit reads current draft).
  }, [user, reportGated]);

  useEffect(() => {
    setContext(verdict === null ? undefined : summariseForChat(draft.label, verdict));
    // Clears the assistant's grounding when this page unmounts, so a later chat on
    // another route doesn't quietly answer using a report that's no longer on screen.
    return () => setContext(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft.label is read at the
    // moment `verdict` changes, not on every keystroke; the effect should not re-fire
    // for label edits alone (that would race the chat context against the live report).
  }, [verdict, setContext]);

  /**
   * The full report requires a session — the live preview above it doesn't, and never
   * will (see its own doc comment). `authConfigured && user === null` is deliberately
   * optimistic about `authLoading`: if the session check just hasn't resolved yet, this
   * gates anyway, but the auto-retry effect above immediately un-gates and re-submits
   * the moment `user` turns out to be non-null — self-correcting rather than adding a
   * second loading state to coordinate.
   *
   * **Gating navigates to `/login`, it doesn't render in place.** The draft is stashed
   * first — the same `DRAFT_STASH_KEY` mechanism Google's OAuth round trip already
   * needed, since that path can't avoid leaving the page either — so `/login?next=/analyse`
   * lands back here with the form exactly as it was, the mount effect restores it and
   * re-arms `reportGated`, and the retry effect below fires `submit()` again the moment
   * the new session shows up. No click-to-continue: the report just appears.
   */
  async function submit(overrideDraft?: Draft): Promise<void> {
    const submitted = overrideDraft ?? draft;
    setError(null);

    if (authConfigured && user === null) {
      sessionStorage.setItem(DRAFT_STASH_KEY, JSON.stringify(submitted));
      window.location.assign("/login?next=/analyse");
      return;
    }
    setReportGated(false);
    setPending(true);

    try {
      const parsed = createPropertySchema.safeParse(draftToApiInput(submitted));
      if (!parsed.success) {
        setError(
          parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        );
        return;
      }

      const res = await fetch("/api/verdict/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        setError(`The server rejected the figures (${res.status}).`);
        return;
      }

      const json = (await res.json()) as { verdict: Verdict };
      setVerdict(json.verdict);
      setLastSubmittedDraft(submitted);
      setSaveState({ status: "idle" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  /**
   * Always creates a new saved property rather than updating one in place — see
   * `app/portfolio/page.tsx`'s doc comment: each save is a dated snapshot, and that IS
   * the report-history benefit logging in is for. `lastSubmittedDraft`, not `draft`,
   * because the two can differ the moment someone edits the form after running a
   * report — this must save exactly what the report on screen shows, not whatever is
   * currently, possibly mid-edit, sitting in the form.
   */
  async function saveToPortfolio(): Promise<void> {
    if (lastSubmittedDraft === null) return;
    setSaveState({ status: "saving" });

    try {
      const parsed = createPropertySchema.safeParse(draftToApiInput(lastSubmittedDraft));
      if (!parsed.success) {
        setSaveState({ status: "error", message: "The saved figures didn't validate — try re-running the report first." });
        return;
      }
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        setSaveState({ status: "error", message: `The server rejected the save (${res.status}).` });
        return;
      }
      const created = (await res.json()) as { property: { id: string } };
      setSaveState({ status: "saved", id: created.property.id });
    } catch (cause) {
      setSaveState({
        status: "error",
        message: cause instanceof Error ? cause.message : "Something went wrong.",
      });
    }
  }

  // Same "the caller decides whether there's a key" rule as market-explorer.tsx and
  // map-preview.tsx — ImportedListingMap renders unconditionally once mounted.
  const mapsKey = process.env["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"];
  const hasMapsKey = mapsKey !== undefined && mapsKey !== "";
  const importedLatitude = imported?.latitude;
  const importedLongitude = imported?.longitude;

  /* A hand-picked building wins over an imported one: it is the more deliberate signal —
     someone searched for it — and an import's coordinates can be a building's estate
     centroid rather than the unit itself. */
  const placeLatitude = pickedPlace?.latitude ?? importedLatitude;
  const placeLongitude = pickedPlace?.longitude ?? importedLongitude;
  const placeLabel = pickedPlace?.label ?? imported?.address ?? draft.label;

  return (
    /* In `AppShell` since 10/08/2026 — this is the core action of the product and it sat
       behind a marketing header that reached three destinations, so from here you could
       not get to your portfolio, the assistant or research at all. See
       `components/site-chrome.tsx`. */
    <AppShell breadcrumb="Analyse a property · Hong Kong">
      <header className="max-w-prose">
        <p className="eyebrow">Analyse · Hong Kong</p>
        {/* font-extrabold to match the landing hero's weight — see app/page.tsx —
            this is the same "big statement" headline tier, not a form label. */}
        <h1 className="mt-3 font-display text-[34px] font-extrabold leading-tight tracking-[-0.03em]">
          Is this property worth it?
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Enter the figures for a Hong Kong flat and see a live yield estimate with no
          account. The full report — findings, stamp duty, cash to acquire — needs a
          free login, so it can be saved to your portfolio.
        </p>
      </header>

      {welcomeBack !== null && verdict === null && (
        <p className="mt-6 max-w-prose rounded-panel border border-line bg-surfaceMuted px-4 py-3 text-sm shadow-card">
          Welcome back —{" "}
          {/* A plain anchor, not next/link: this is a same-route navigation
              (/analyse → /analyse?property=…), and the mount-only load effect above
              needs a real remount to fire, not a soft client-side transition that
              would leave the query-param effect not re-running. */}
          <a
            href={`/analyse?property=${welcomeBack.id}`}
            className="font-medium text-accent hover:underline"
          >
            continue with {welcomeBack.label}
          </a>
          , or start a new one below.
        </p>
      )}

      {fromFinder && (
        <p className="mt-6 max-w-prose rounded-panel border border-caution/40 bg-caution/10 px-4 py-3 text-xs leading-relaxed text-muted shadow-card">
          <strong className="text-mist">Prefilled from a Property Finder sample.</strong>{" "}
          These figures are a generated example, not a real property — edit anything
          below before drawing a conclusion from it.
        </p>
      )}

      <div className={imported === null ? "mt-6" : "mt-6 grid gap-4 lg:grid-cols-2 lg:items-stretch"}>
        <ListingImporter onImported={handleImported} />
        {imported !== null && <ImportSummaryCard listing={imported} />}
      </div>

      {hasMapsKey && importedLatitude !== undefined && importedLongitude !== undefined && (
        <div className="mt-4">
          <ImportedListingMap
            latitude={importedLatitude}
            longitude={importedLongitude}
            label={imported?.address ?? imported?.title ?? "Imported listing"}
          />
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <PropertyForm
          draft={draft}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onSubmit={() => void submit()}
          pending={pending}
          error={error}
        />

        <Rail preview={preview} />
      </div>

      <div ref={reportRef} className="scroll-mt-20">
        {verdict !== null && (
          <section className="mt-14 border-t border-line pt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-[26px] font-semibold tracking-[-0.025em]">
                The full report
              </h2>
              <span className="font-mono text-xs text-muted">{draft.label}</span>
            </div>

            {authConfigured && (
              <div className="mt-4">
                <SaveToPortfolio
                  user={user}
                  saveState={saveState}
                  onSave={() => void saveToPortfolio()}
                  aggregateConsentAt={aggregateConsentAt}
                  onConsentDecided={(consentedAt) => setAggregateConsentAt(consentedAt)}
                />
              </div>
            )}

            <div className="mt-6">
              <VerdictView verdict={verdict} />
            </div>

            {/* Only when coordinates are actually known. The report is computed from
                figures typed into the form, which carry no location — so this appears for
                a property that arrived from a listing link (or a building search) and not
                otherwise. Better an absent section than one that asks "which
                neighbourhood?" and guesses. */}
            <div className="mt-6">
              {placeLatitude !== undefined && placeLongitude !== undefined ? (
                <NeighbourhoodPanel
                  latitude={placeLatitude}
                  longitude={placeLongitude}
                  label={placeLabel}
                />
              ) : (
                /* Rather than silently omitting the section — which is what used to happen
                   and made the whole feature invisible on a typed-in report — say it needs
                   a location and offer the way to give one. */
                <section className="card">
                  <h3 className="text-[15px] font-semibold">The neighbourhood</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Schools, transport, shops, premium retail and green space — this part
                    needs to know <em className="not-italic text-mist">where</em> the flat
                    is, and the figures above don&apos;t say. Name the building and it
                    appears here.
                  </p>
                  <div className="mt-3">
                    <BuildingSearch
                      onSelect={(m) =>
                        setPickedPlace({
                          label: m.label,
                          latitude: m.latitude,
                          longitude: m.longitude,
                        })
                      }
                    />
                  </div>
                </section>
              )}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

type SaveState =
  | { readonly status: "idle" | "saving" }
  | { readonly status: "saved"; readonly id: string }
  | { readonly status: "error"; readonly message: string };

/**
 * The one addition login makes to this page — the report itself is identical either
 * way, per the decision recorded in `.claude/CLAUDE.md`. Signed out, this is a plain
 * invitation, not a locked control standing in front of something.
 */
function SaveToPortfolio({
  user,
  saveState,
  onSave,
  aggregateConsentAt,
  onConsentDecided,
}: {
  readonly user: User | null;
  readonly saveState: SaveState;
  readonly onSave: () => void;
  /** `undefined` while loading, `null` if never decided, an ISO timestamp once granted. */
  readonly aggregateConsentAt: string | null | undefined;
  readonly onConsentDecided: (consentedAt: string | null) => void;
}): React.JSX.Element {
  if (user === null) {
    return (
      <p className="text-sm text-muted">
        <Link href="/login?next=/analyse" className="font-medium text-accent hover:underline">
          Log in
        </Link>{" "}
        to save this report to your portfolio and see it again later.
      </p>
    );
  }

  if (saveState.status === "saved") {
    return (
      <div>
        <p className="text-sm text-muted">
          Saved.{" "}
          <Link href="/portfolio" className="font-medium text-accent hover:underline">
            View in your portfolio →
          </Link>
        </p>
        {aggregateConsentAt === null && (
          <ConsentPrompt onDecided={onConsentDecided} />
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onSave}
        disabled={saveState.status === "saving"}
        className="btn-secondary !px-4 !py-2 !text-sm disabled:pointer-events-none disabled:opacity-50"
      >
        {saveState.status === "saving" ? "Saving…" : "Save to my portfolio"}
      </button>
      {saveState.status === "error" && (
        <p role="alert" className="mt-1.5 text-xs text-negative">
          {saveState.message}
        </p>
      )}
    </div>
  );
}

/**
 * Asked once, right after the first save that ever finds `aggregateConsentAt` still
 * `null` — the point data actually gets collected, per `/privacy`'s DPP3 section, not
 * only reachable later in `/account`'s settings where it's easy to never see. Either
 * answer writes through the same `PATCH /profile` route `/account` uses, so the two
 * can't disagree about the current setting.
 */
function ConsentPrompt({
  onDecided,
}: {
  readonly onDecided: (consentedAt: string | null) => void;
}): React.JSX.Element {
  const [pending, setPending] = useState(false);

  async function decide(consent: boolean): Promise<void> {
    setPending(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aggregateConsent: consent }),
      });
      if (res.ok) onDecided(consent ? new Date().toISOString() : null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 rounded-card border border-line bg-surfaceMuted px-3.5 py-3 text-xs leading-relaxed">
      <p className="text-mist">
        Also let this property feed Veela&apos;s aggregate market data?{" "}
        <Link href="/privacy" className="text-accent hover:underline">What that means</Link>.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={() => void decide(true)}
          disabled={pending}
          className="font-medium text-accent hover:underline disabled:pointer-events-none disabled:opacity-50"
        >
          Yes, opt in
        </button>
        <button
          type="button"
          onClick={() => void decide(false)}
          disabled={pending}
          className="text-muted hover:text-mist disabled:pointer-events-none disabled:opacity-50"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}

/**
 * Sits next to `ListingImporter` in a two-up row rather than below it as a full-width
 * block. Just the source, the fetch date, and the address — the field-by-field "found
 * and filled in" summary and the warnings list this used to carry were dropped rather
 * than trimmed, on direct request; the form itself already shows which fields came
 * through, and the map right below carries the address visually too, so this line is
 * the text confirmation next to it. `h-full` plus the grid's own `items-stretch` is what
 * makes this match `ListingImporter`'s height exactly rather than guessing a pixel value
 * that drifts the moment either card's copy changes.
 */
function ImportSummaryCard({ listing }: { readonly listing: ImportedListing }): React.JSX.Element {
  return (
    <div className="card flex h-full flex-col justify-center text-xs leading-relaxed text-muted">
      <p>
        <strong className="text-mist">Imported from</strong>{" "}
        <a
          href={listing.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="font-mono underline decoration-line underline-offset-4 hover:text-mist"
        >
          {new URL(listing.sourceUrl).hostname}
        </a>
        , fetched {new Date(listing.fetchedAt).toLocaleString("en-HK")}.
      </p>
      {listing.address !== undefined && (
        <p className="mt-1.5 font-mono text-[11px] text-mist">{listing.address}</p>
      )}
    </div>
  );
}

/**
 * The sticky rail. Sticky is the whole reason it works: the stamp duty consequence of
 * a checkbox three sections down is only a teaching moment if you can see it move
 * without scrolling back up. `ImportedListingMap` used to be grouped in here too, sharing
 * this sticky context — it now renders separately, below the importer, so this owns its
 * own `lg:sticky` again.
 */
function Rail({ preview }: { readonly preview: Verdict | null }): React.JSX.Element {
  if (preview === null) {
    return (
      <aside className="rounded-panel border border-line bg-surface p-5 text-sm text-muted shadow-card lg:sticky lg:top-24">
        Finish the figures and the preview will appear here.
      </aside>
    );
  }

  const criticals = criticalCount(preview);
  const standing = gradeNetYield(preview.returns.netYield);

  return (
    <aside className="overflow-hidden rounded-panel border border-line bg-surface shadow-lift lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <span className="eyebrow">Live preview</span>
        <span className="font-mono text-[11px] text-muted">{preview.rulesUsed}</span>
      </div>

      <div className="px-5 py-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          Net yield
        </div>
        <div
          className="tnum mt-1 font-display text-[42px] font-semibold leading-none tracking-[-0.03em]"
          style={{ color: standingColor[standing] }}
        >
          {formatPercent(preview.returns.netYield)}
        </div>
        <div className="mt-2 text-xs leading-snug text-muted">
          After costs and tax, before financing
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px border-y border-line bg-line">
        <RailStat
          label="Stamp duty"
          value={formatCompactMoney(preview.acquisition.stampDuty)}
        />
        <RailStat
          label="Cash to acquire"
          value={formatCompactMoney(preview.acquisition.total)}
        />
        <RailStat
          label="Cash-on-cash"
          value={formatPercent(preview.returns.cashOnCash)}
        />
        <RailStat label="Payback" value={formatYears(preview.returns.paybackYears)} />
      </dl>

      <div className="px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          Scale applied
        </div>
        <div className="mt-1 text-sm">{preview.acquisition.stampDutyScale}</div>
      </div>

      {criticals > 0 && (
        <p className="border-t border-line bg-negative/5 px-5 py-3.5 text-sm text-negative">
          <strong className="font-semibold">{criticals}</strong>{" "}
          {criticals === 1 ? "issue" : "issues"} could sink this deal — they are named in
          the report.
        </p>
      )}
    </aside>
  );
}

function RailStat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="bg-surface px-5 py-3.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        {label}
      </dt>
      <dd className="tnum mt-1 font-display text-[18px] font-semibold tracking-[-0.02em]">
        {value}
      </dd>
    </div>
  );
}
