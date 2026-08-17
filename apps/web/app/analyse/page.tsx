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
import { MapPinIcon } from "../../components/icons";
import { NeighbourhoodPanel, type NeighbourhoodData } from "../../components/neighbourhood-panel";
import {
  forgetLastSearch,
  LastSearchCard,
  readLastSearch,
  rememberLastSearch,
  type LastSearch,
} from "../../components/last-search";
import { ReportBrief } from "../../components/report-brief";
import { SavedReports } from "../../components/saved-reports";
import { PropertyNotes } from "../../components/property-notes";
import { PropertyPhotos } from "../../components/property-photos";
import {
  describeProblems,
  draftToApiInput,
  draftToCoreInput,
  EMPTY_DRAFT,
  PropertyForm,
  type Draft,
  type FormProblem,
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

/**
 * The area data as plain lines for the AI brief.
 *
 * Prose for the same reason `summariseForChat` is prose: the endpoint takes text, so there is
 * nothing structured for a model to recompute even if it tried. Counts plus the nearest few by
 * name — enough to say "the station is 3 minutes away and there are no schools", which is the
 * kind of thing a reader wants said out loud, and not enough to pretend it is a survey.
 *
 * The straight-line caveat travels with it. A model told "240 m" will otherwise write "a
 * three-minute walk", which is a claim the data does not support.
 */
function summariseAreaForBrief(area: NeighbourhoodData): string {
  const counts = Object.entries(area.counts)
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => `${kind}: ${n}`)
    .join(", ");
  const nearest = area.items
    .slice(0, 12)
    .map((a) => `- ${a.name} (${a.subtype.replace(/_/g, " ")}, ${a.metres} m)`)
    .join("\n");
  return [
    `Counts within walking distance — ${counts === "" ? "nothing mapped nearby" : counts}.`,
    "Distances are straight-line, not walking distance; do not convert them into walking times.",
    nearest === "" ? "" : `Closest places:\n${nearest}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
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
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Field-level failures, already translated out of Zod's vocabulary — see `describeProblems`. */
  const [problems, setProblems] = useState<readonly FormProblem[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);
  const { setContext } = useAiChat();
  const { user, loading: authLoading, configured: authConfigured } = useAuth();
  const [fromFinder, setFromFinder] = useState(false);
  const [imported, setImported] = useState<ImportedListing | null>(null);
  const [lastSubmittedDraft, setLastSubmittedDraft] = useState<Draft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const autoLoadedRef = useRef(false);
  /**
   * The saved property this report was opened from, when it was.
   *
   * Photos and notes belong to a *row*, so they can only be shown once there is one. Opening
   * `?property=<id>` is exactly that case and was the gap: the report rendered, and the reader's
   * own photographs and notes about that very flat were only reachable by going back to
   * `/portfolio`. Cleared whenever the figures stop describing that row — see `setDraft` below.
   */
  const [loadedPropertyId, setLoadedPropertyId] = useState<string | null>(null);
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
   * A submit that arrived before `useAuth` had decided whether there is a session.
   *
   * `submit()` used to treat `user === null` as "signed out" and **navigate away to /login**. On
   * a click that is right, because by then auth has long resolved. On `?property=<id>`, which
   * submits from a mount effect, it is a race the page loses more often than not — so opening a
   * saved property straight from a URL bounced a *signed-in* reader to the login screen and
   * stashed their draft. Reproduced with a browser: the report never rendered, only "Log in".
   *
   * Holding the draft and replaying it once auth resolves fixes the whole class, rather than
   * special-casing the one caller that happened to expose it.
   */
  const [deferredSubmit, setDeferredSubmit] = useState<Draft | null>(null);

  /** The previous analysis on this device, offered rather than applied. `undefined` until the
   *  mount effect has looked; `null` once looked and there was nothing (or it was dismissed). */
  const [lastSearch, setLastSearch] = useState<LastSearch | null | undefined>(undefined);

  /**
   * True once the reader accepts the RVD-derived rent estimate, false again the moment they
   * edit the rent, price or area.
   *
   * Kept in page state rather than on `Draft` deliberately: `Draft` is the API contract
   * (`createPropertySchema` would reject an unknown field), and more importantly this is a
   * fact about *where a number came from in this session*, not about the property. A saved
   * property's stored figures are just figures.
   */
  const [rentEstimated, setRentEstimated] = useState(false);

  /**
   * Today's date, set on mount rather than baked into `EMPTY_DRAFT`.
   *
   * The old default was a hardcoded day that had already gone stale, which quietly chose the
   * stamp-duty rule set for the reader. It has to be filled client-side: this component is
   * server-rendered too, and a server in UTC against a browser in Hong Kong can disagree about
   * what day it is — a `new Date()` at module scope is a hydration mismatch waiting for
   * midnight. Only fills a blank field, so it can never overwrite a date that arrived from a
   * saved property, a listing import or a restored search.
   */
  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
    setDraft((d) => (d.transactionDate === "" ? { ...d, transactionDate: today } : d));
  }, []);

  /* Read once on mount. Deliberately not shown while a report is already on screen, and
     suppressed entirely when the page was opened with figures of its own (?listing=,
     ?property=, or a draft stashed across the OAuth round trip) — offering "your last search"
     next to a form that has just been filled from somewhere else is noise. */
  useEffect(() => {
    if (autoLoadedRef.current) {
      setLastSearch(null);
      return;
    }
    /**
     * Suppressed when a draft is waiting in the OAuth stash.
     *
     * Caught in a browser, not by reading: after a gated submit sends an anonymous reader to
     * `/login`, coming back restores those same figures into the form — so the card offered
     * "your last search" directly above a form already holding it, with a Restore button that
     * would have done nothing visible. This effect is declared before the stash effect, so the
     * key is still there to check; the stash effect clears it a moment later.
     */
    if (sessionStorage.getItem(DRAFT_STASH_KEY) !== null) {
      setLastSearch(null);
      return;
    }
    setLastSearch(readLastSearch());
  }, []);

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
      setLoadedPropertyId(id);
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

  /* The effect that used to fetch the single most-recent property for a "Welcome back"
     line is gone — `SavedReports` owns that fetch now, and keeping this one would have
     meant two components requesting the same list on every visit to this page. The
     "offered, never auto-loaded" rule it existed to honour is documented in, and enforced
     by, that component. */

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

  /**
   * Bring the report into view once it exists.
   *
   * **Deferred a frame on purpose.** `VerdictView` renders a star rating and a four-cell
   * stats grid above the findings, and a smooth scroll started in the same tick as that
   * first paint animates towards a target whose height is still settling — so the scroll
   * finished somewhere *below* the report heading, which is how clicking "See the full
   * report" could leave the reader looking at the findings warning instead of the top of
   * their own report. Waiting for the next frame means the offset is measured against the
   * laid-out report, not a half-built one.
   */
  useEffect(() => {
    if (verdict === null && !reportGated) return;
    const frame = requestAnimationFrame(() => {
      reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
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

  /* Replay a submit that was held while auth was still resolving. */
  useEffect(() => {
    if (authLoading || deferredSubmit === null) return;
    const held = deferredSubmit;
    setDeferredSubmit(null);
    void submit(held);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- replays exactly once per hold
  }, [authLoading, deferredSubmit]);

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
    setProblems([]);

    /**
     * Remembered here — when a report is *asked for* — not after one successfully returns.
     *
     * The first version recorded it on success, which quietly meant "last search" only ever
     * worked for someone already logged in: the report is gated, so an anonymous reader's
     * submit redirects to `/login` and never reaches the success path. They are the reader who
     * needs this most, since they have no portfolio either. A valid price is the same bar
     * `readLastSearch` applies and the same one the live preview uses, so anything recorded
     * here is a real set of figures rather than a half-typed field.
     */
    if (submitted.price > 0) rememberLastSearch(submitted);

    /* "Still loading" is not "signed out". Deciding before auth resolves is what sent signed-in
       readers to the login page; see `deferredSubmit`. */
    if (authConfigured && authLoading) {
      setDeferredSubmit(submitted);
      return;
    }

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
        /* Translated rather than printed. The raw issues named the API's own field paths and
           Zod's predicates — "priceMinor: Number must be greater than 0" — which points a reader
           at a field that does not exist on screen and tells them nothing to do about it. */
        setProblems(describeProblems(parsed.error.issues));
        return;
      }

      const res = await fetch("/api/verdict/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        /* The server validates the same schema, so a rejection here is either a figure the client
           somehow let through or something transient. Both are translated the same way, and the
           status code goes in the fallback sentence rather than the headline. */
        const detail = await readServerProblems(res);
        if (detail.problems.length > 0) setProblems(detail.problems);
        else setError(detail.message);
        return;
      }

      const json = (await res.json()) as { verdict: Verdict };
      setVerdict(json.verdict);
      setLastSubmittedDraft(submitted);
      setSaveState({ status: "idle" });
    } catch {
      /* Almost always the network rather than anything the reader typed, so it must not read as
         though they got something wrong. The raw exception message ("Failed to fetch") said
         nothing useful and looked like a defect in their figures. */
      setError(
        "The report could not be reached — this is usually a connection problem rather than anything you entered. Check your connection and press the button again; nothing you typed has been lost.",
      );
    } finally {
      setPending(false);
    }
  }

  /**
   * A rejection from `/verdict/preview` arrives in one of two shapes and always has: Hono's
   * `HTTPException` sends plain text, `zValidator` sends a Zod error as JSON. Reading `res.json()`
   * unconditionally throws on the first and loses the reason — the same bug the listing importer's
   * toast had, and the reason this is a shared habit rather than a one-off.
   */
  async function readServerProblems(
    res: Response,
  ): Promise<{ readonly problems: readonly FormProblem[]; readonly message: string }> {
    const fallback = `The figures were refused by the server (${res.status}). If they look right, this is worth reporting.`;
    const text = await res.text().catch(() => "");
    try {
      const parsed = JSON.parse(text) as {
        error?: { issues?: { path: (string | number)[]; message: string }[] };
        message?: string;
      };
      if (parsed.error?.issues !== undefined) {
        return { problems: describeProblems(parsed.error.issues), message: fallback };
      }
      return { problems: [], message: parsed.message ?? fallback };
    } catch {
      return { problems: [], message: text === "" ? fallback : text };
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
      /* Provenance rides along at the save, the one moment it matters. Until now the
         importer read a source URL, an address and coordinates and dropped every one at the
         form boundary, so a saved property could not say which listing produced its figures
         — the first thing you want when a price is months old. */
      const parsed = createPropertySchema.safeParse(
        draftToApiInput(lastSubmittedDraft, {
          sourceUrl: imported?.sourceUrl,
          address: imported?.address ?? undefined,
          latitude: imported?.latitude ?? undefined,
          longitude: imported?.longitude ?? undefined,
        }),
      );
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

  /**
   * **Fetch the area data while the reader is still typing, not when they open the report.**
   *
   * A cold Overpass lookup is 4–35 seconds (see `neighbourhood.ts` on why the budget is that
   * generous). Asked for on click, that is a section that arrives late in a report that was
   * otherwise instant — which is exactly why it used to hide behind a *Check the area* button.
   * But the location is usually known long before the report is asked for: a listing import
   * carries coordinates, and the building search attaches them. So the work starts then, in
   * the background, and the report gets a section that is already finished.
   *
   * **Keyed by rounded coordinates, and fired once per location.** The ref guards against
   * React re-runs and against a reader nudging the same building twice; the 3-decimal key is
   * the same ~110m rounding the server caches on, so two coordinates that would hit one cache
   * row do not cost two requests. Overpass is donated infrastructure — prefetching is only
   * defensible if it stays one request per place.
   */
  const [areaData, setAreaData] = useState<NeighbourhoodData | null>(null);
  const [areaPrefetching, setAreaPrefetching] = useState(false);
  /** Attempted and did not land — Overpass refuses a cold lookup often enough that this is a
   *  normal state, not an exception. Tracked separately so the status line can say so instead
   *  of promising data the report will actually ask for with a button. */
  const [areaFailed, setAreaFailed] = useState(false);
  const prefetchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (placeLatitude === undefined || placeLongitude === undefined) return;
    const key = `${placeLatitude.toFixed(3)},${placeLongitude.toFixed(3)}`;
    if (prefetchedKeyRef.current === key) return;
    prefetchedKeyRef.current = key;

    let cancelled = false;
    setAreaData(null);
    setAreaFailed(false);
    setAreaPrefetching(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/neighbourhood?lat=${placeLatitude}&lng=${placeLongitude}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          setAreaFailed(true);
          return;
        }
        const json = (await res.json()) as NeighbourhoodData;
        if (!cancelled) setAreaData(json);
      } catch {
        if (!cancelled) setAreaFailed(true);
        /* Silent: the panel still offers its own button, so a failed prefetch costs the
           reader nothing but the wait they would have had anyway. */
      } finally {
        if (!cancelled) setAreaPrefetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placeLatitude, placeLongitude]);

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

      {/**
       * The reader's own saved reports, with an explicit empty state when there are none —
       * replacing the one-line "Welcome back — continue with <latest>" this used to show.
       *
       * Only on a cold page (`verdict === null`). Once a report is on screen, a shelf of
       * *other* properties above it competes with the thing the reader just asked for; the
       * old line hid itself for the same reason. `/portfolio` is still where these are
       * managed.
       */}
      {/* Offered above the saved-reports shelf: this is the more recent thing, and it is the
          one that needs no account. Both hide once a report is on screen. */}
      {verdict === null && lastSearch !== undefined && lastSearch !== null && (
        <LastSearchCard
          search={lastSearch}
          onRestore={() => {
            setDraft(lastSearch.draft);
            setImported(null);
            setFromFinder(false);
            setLastSearch(null);
          }}
          onDismiss={() => {
            forgetLastSearch();
            setLastSearch(null);
          }}
        />
      )}

      {verdict === null && (
        <SavedReports userId={user?.id ?? null} configured={authConfigured} />
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

      {/**
       * Naming the building **before** the report, not inside it.
       *
       * The building search used to live only in the report, in the branch that ran when no
       * coordinates were known — which meant the area data could not start loading until the
       * report already existed, and the reader met a *Check the area* button after waiting for
       * the report itself. Moving it up here is what makes the prefetch possible at all: attach
       * a location while the figures are still being typed and the lookup runs in that time.
       *
       * Hidden once a location is known, whether from here or from a listing import — there is
       * nothing left to ask.
       */}
      {placeLatitude === undefined && (
        <section className="mt-6 rounded-panel border border-line bg-surfaceMuted px-4 py-4 shadow-card">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MapPinIcon className="h-4 w-4 shrink-0 text-muted" />
            Which building?
          </h2>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
            Optional, and worth it: naming the building adds the whole area profile to your
            report — schools, transport, shops, green space and what&apos;s under construction —
            and it starts loading now rather than when you open the report.
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

      {placeLatitude !== undefined && placeLongitude !== undefined && (
        <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
          <span>
            Area data for <strong className="font-medium text-mist">{placeLabel}</strong>{" "}
            {areaPrefetching
              ? "is loading now, ready with your report."
              : areaData !== null
                ? "is ready — it appears in the full report."
                : areaFailed
                  ? "couldn't be fetched just now — OpenStreetMap was busy. You can retry it from the report."
                  : "will load with the report."}
          </span>
          {pickedPlace !== null && (
            <button
              type="button"
              onClick={() => setPickedPlace(null)}
              className="underline hover:text-mist"
            >
              change building
            </button>
          )}
        </p>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <PropertyForm
          draft={draft}
          onChange={(patch) => {
            /* Typing over the rent — or changing the price or area the estimate was derived
               from — makes the "estimated" label wrong, so it is dropped. */
            if (
              patch.monthlyRent !== undefined ||
              patch.price !== undefined ||
              patch.saleableAreaSqft !== undefined
            ) {
              setRentEstimated(false);
            }
            /* Editing the figures detaches the report from the saved row it was opened from, so
               the photos and notes go with it. They belong to that property, and leaving them
               attached to numbers that no longer describe it would quietly imply the reader's own
               photographs are of whatever is now in the form. Re-open from /portfolio to get them
               back — the row itself is untouched. */
            setLoadedPropertyId(null);
            setDraft((d) => ({ ...d, ...patch }));
          }}
          onSubmit={() => void submit()}
          pending={pending}
          error={error}
          problems={problems}
          onUseRentEstimate={(monthlyRent) => {
            setDraft((d) => ({ ...d, monthlyRent }));
            setRentEstimated(true);
          }}
        />

        <Rail preview={preview} rentMissing={draft.monthlyRent <= 0} />
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

            {/* Every yield below is only as real as the rent it came from. An estimated rent
                must be visible *on the report*, not only next to the field it was applied in
                — this is the screen someone acts on, and the engine has no idea the figure
                was derived rather than observed. */}
            {rentEstimated && (
              <p className="mt-4 rounded-card border border-caution/40 bg-caution/10 px-4 py-3 text-sm leading-relaxed text-muted">
                <strong className="text-mist">The rent in this report is an estimate.</strong>{" "}
                It was derived from the Rating and Valuation Department&apos;s published market
                yield for flats of this size, territory-wide — not from an asking rent for this
                property, and not from comparable flats nearby. Every yield below moves with it.
                Replace it with a real figure before acting on any of this.
              </p>
            )}

            {/* Above the report, because it is a way in to the figures rather than a footnote
                on them — but after the save button, so the primary action stays first. The
                summary is the *same* `summariseForChat` output the assistant already gets, so
                the brief and the chat panel cannot describe the property differently. */}
            <div className="mt-6">
              <ReportBrief
                summary={summariseForChat(draft.label, verdict)}
                area={areaData === null ? undefined : summariseAreaForBrief(areaData)}
              />
            </div>

            <div className="mt-6">
              <VerdictView verdict={verdict} />
            </div>

            {/**
             * Your own photographs and your own notes, on your own property.
             *
             * The report deliberately carries **no** photography — a stock interior beside
             * somebody's figures reads as a picture of *their* flat, which is the same false
             * claim this product refuses to make with a number. These are the exception that
             * proves the rule, and the only kind that can be: the reader took them, of the flat
             * the figures describe. Same for the notes: they are the reader's own observations,
             * not an assertion Veela is making.
             *
             * Shown only when the report was opened from a saved property (`?property=<id>`) and
             * detached the moment the figures are edited — there is no row for photos to belong
             * to otherwise, and leaving them attached to changed numbers would imply the photos
             * are of whatever is now in the form.
             */}
            {loadedPropertyId !== null && user !== null && (
              <div className="mt-8 grid gap-8 border-t border-line pt-8 lg:grid-cols-2">
                <PropertyPhotos propertyId={loadedPropertyId} ownerId={user.id} />
                <PropertyNotes propertyId={loadedPropertyId} />
              </div>
            )}

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
                  initialData={areaData}
                  prefetching={areaPrefetching}
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

        {/**
         * Photos are offered **here, after the save, and not before it.**
         *
         * A photo belongs to a property row, and until the save returns there is no row and no
         * id to file one under. Staging files in the browser and uploading them afterwards
         * would work and was the first design — it was dropped because it puts a silent,
         * failable upload behind a button that already said "Saved", and a reader who closes
         * the tab at that moment loses photos the page implied were kept. Asking after the
         * save means every photo is attached to something that exists, and the reader sees
         * each one land.
         */}
        <div className="mt-5 border-t border-line pt-4">
          <PropertyPhotos propertyId={saveState.id} ownerId={user.id} initial={[]} />
        </div>
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
function Rail({
  preview,
  rentMissing,
}: {
  readonly preview: Verdict | null;
  /**
   * True when there is a price but no rent — which is the normal state straight after
   * importing a **for-sale** listing, since those publish no rent.
   *
   * `computeVerdict` returns a perfectly correct 0.00% for zero rent, and that is exactly the
   * problem: on screen it reads as a *finding about the property* ("this yields nothing")
   * rather than a missing input, in the same red the engine uses for a genuinely bad deal.
   * The acquisition figures beside it — stamp duty, cash to acquire — are real and unaffected
   * by the missing rent, so blanking the whole rail would throw away correct information.
   * Only the rent-dependent numbers are suppressed.
   */
  readonly rentMissing: boolean;
}): React.JSX.Element {
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
          className={`tnum mt-1 font-display text-[42px] font-semibold leading-none tracking-[-0.03em] ${
            rentMissing ? "text-muted" : ""
          }`}
          style={rentMissing ? undefined : { color: standingColor[standing] }}
        >
          {rentMissing ? "—" : formatPercent(preview.returns.netYield)}
        </div>
        <div className="mt-2 text-xs leading-snug text-muted">
          {rentMissing
            ? "No monthly rent yet — a yield needs one. Enter it, or use the estimate offered under the rent field."
            : "After costs and tax, before financing"}
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
          value={rentMissing ? "—" : formatPercent(preview.returns.cashOnCash)}
        />
        <RailStat
          label="Payback"
          value={rentMissing ? "—" : formatYears(preview.returns.paybackYears)}
        />
      </dl>

      <div className="px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          Scale applied
        </div>
        <div className="mt-1 text-sm">{preview.acquisition.stampDutyScale}</div>
      </div>

      {/* Kept, but reworded to match the report's own line — "could sink this deal" was
          asked to go from the report, and leaving the identical alarm in the rail on the
          same page would have made the change cosmetic. It still says a critical finding
          exists and where to read it, which is the rail's job in the preview. */}
      {criticals > 0 && (
        <p className="border-t border-line px-5 py-3.5 text-sm text-muted">
          <strong className="font-semibold text-negative">
            {criticals} {criticals === 1 ? "issue" : "issues"}
          </strong>{" "}
          {criticals === 1 ? "is" : "are"} marked critical — named in the full report.
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
