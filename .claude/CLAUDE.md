# Veela — real-estate investment intelligence for Hong Kong

## Context
- Entity: Veela — **our own venture**, not a client engagement. Early stage.
- Domain: proptech / real-estate data, investor-facing.
- Thesis: bring to Asia what [Mashvisor](https://www.mashvisor.com/) does in the US —
  turn raw listing and rental data into investment decisions.
- Market: **Hong Kong, and only Hong Kong.** Vietnam and France are no longer in scope.
  They were the second and third steps of a sequence; that sequence is suspended, not
  cancelled, and the research already done on both is kept — see *Out of scope*.
- Niche: **investors**, deliberately. Not buyers looking for a home, not renters,
  not agents. Every feature is judged on whether it helps someone decide to buy,
  hold, or sell for yield.

## Hong Kong only — what that actually decides

Narrowing to one market is not a smaller version of the same plan. It settles four things
that were open, and it does so in the project's favour.

### The hard part was per-jurisdiction tax modelling. Hong Kong's is the easy one.

The model above moved the difficulty away from data acquisition and onto **tax and market
modelling per jurisdiction**. That was the right call, and it makes the choice of *which*
jurisdiction the most consequential decision in the project. **Hong Kong is by a wide
margin the simplest of the three:**

| | Hong Kong | France, for comparison |
|---|---|---|
| Rental income | **Property tax: 15 % on 80 % of rent** — a flat 20 % statutory repairs allowance, so an effective **12 % of gross**. One rule | *Revenus fonciers* or **BIC/LMNP**, micro or réel, amortisation schedules — the régime choice alone changes the answer |
| Social charges | **None** | **17.2 %**, and 7.5 % more for a non-EEA resident |
| **Capital gain** | **None. Hong Kong has no capital gains tax** | 19 % + 17.2 %, with *abattements* running to 22 and 30 years |
| Wealth tax | None | **IFI** above €1.3 M |
| Purchase | Stamp duty (AVD). **[verify the 2026 position: BSD, SSD and NRSD were removed in Feb 2024 — confirm before modelling]** | Frais de notaire ~7–8 %, plus régime-dependent VAT cases |
| Holding | Rates, and Government rent | Taxe foncière, and *encadrement des loyers* in tense zones |

**Read the capital-gain row twice.** One of the four promised outputs — *capital gain or
loss scenarios* — loses its entire tax layer in Hong Kong. It becomes pure price
modelling. That is a whole subsystem that does not need building.

So the market where we have the **worst data** is also the market with the **simplest
rules**, and the model deliberately bets on rules over data. The two line up.

### It resolves the "build it against French data first" idea — no

Open question 1 floated validating the engine on France's DVF and porting it to Hong
Kong, to decouple *does the model work* from *can we get the data*. **Dropped.** It bought
a real thing but cost more: it would have meant building the hardest tax engine of the
three, for a market we are not selling to, and discovering only afterwards that the Hong
Kong rules share almost none of its structure. Validate on Hong Kong, against Hong Kong.

### The founder now lives in the market

Hong Kong tax resident, working in Hong Kong, renting in Hong Kong since August 2026.
Agents, colleagues and landlords are all reachable in person. **For a product whose first
problem is "does an investor recognise their own question in this app", that is worth more
than any dataset** — and it is only true of Hong Kong.

### One architectural guard, and only one

Do **not** build a jurisdiction abstraction. There is one jurisdiction; an abstraction
over one case is guesswork dressed as design.

**But do not let Hong Kong's peculiarities harden into the core model either.** The
specific trap is *no capital gains tax*: if that becomes an assumption in the shared
domain rather than a Hong Kong rule with a name, France becomes a rewrite rather than an
addition. Same for *no social charges* and *rent is taxed on a flat deemed basis*. Keep
them as named, located rules. That costs nothing today and is the whole difference later.

## What we're building
A **mobile-native app** (not a web dashboard with a mobile skin) that an investor
opens **daily** — that daily-use bar is the product constraint, and it rules out
"run a report once a quarter" features. It has to be genuinely beautiful; in this
category design *is* the credibility signal.

An **AI component** is a requirement, not a nice-to-have. What exactly it does is
still open — see Open questions.

### The model: user-fed, not aggregation-first
**We do not start by building a property database.** We have little or no proprietary
data and we're not going to pretend otherwise. Instead **the user brings the property**
— the one they're considering or already own — and Veela returns a complete verdict on
whether it's worth it:

- **Yield** and **ROI**
- **Taxes** — the real ones for that jurisdiction, not a generic percentage
- **Upside / potential**, and **capital gain or loss** scenarios
- **Potential problems** — the things that kill a deal and that a first-time investor
  misses

The judgement is produced by combining the user's inputs with **public context**: tax
rules, market growth, population trends, historical series, and comparable/competing
stock.

**Why this is the right call.** It removes the cold-start problem entirely. Computing
yield, tax and plus-value on *one* property the user describes needs no transaction
database — it needs a correct rules engine plus free public aggregates. That inverts
the hard part: the difficulty moves from **data acquisition** (which we established is
expensive or impossible in Hong Kong) to **per-jurisdiction tax and market modelling**,
which is knowledge work we can actually do.

It also builds the asset we couldn't buy: every property a user enters accumulates into
a proprietary dataset. Aggregation becomes the *output* of adoption, not its
precondition.

## The Mashvisor reference — what it actually does
Worth knowing precisely, so we copy the right things and skip the rest:

| Feature | What it gives the investor |
|---|---|
| Market Finder | Rank markets on rental revenue, cap rate, crime, their "Mashmeter" score |
| Property Finder | Screen individual properties against investment criteria |
| Airbnb Calculator | Income potential of a specific property as a short-term rental |
| Short vs long-term comparison | Which strategy wins for this property |
| Dynamic Pricing | AI-driven nightly rate optimisation |
| Neighbourhood analytics | Occupancy, revenue, comps at area level |

Their users: investors (especially first-timers), Airbnb hosts, property managers,
plus an API tier. Coverage ~150 M US properties. Freemium into subscription.

**What travels to Hong Kong:** the decision framework — yield, cap rate, strategy
comparison, screening at market then property level.

**What doesn't:** their data supply. See below.

## Design direction: marketplace, not editorial — settled 03/08/2026

**Cards, real shadows, a tinted page, filled pill buttons, real photography.** The
Zillow/Airbnb vocabulary, chosen explicitly over an editorial system (paper-flat, no
shadows, underlined text links) built two days earlier. That earlier direction is
**superseded, not forgotten** — it was a deliberate, reasoned choice too, and the record
of *why* it changed matters more than which one is "right":

- `tokens.color.bg` is a soft blue-grey tint (`#F4F6FA`); `surface` stays white so a card
  visibly floats off the page. `boxShadow.card` / `.lift` carry real values again.
- `.card`, `.card-hover`, `.btn-primary`, `.btn-secondary` in `globals.css` are the unit
  vocabulary — a card is white, rounded, shadowed; a primary action is a filled pill.
- The hero carries a **real, credited Hong Kong photo** — see below. Not a placeholder,
  not a stand-in: a genuine find, because the alternative (the old codebase's photos)
  was the wrong country.

**Applied everywhere, not just the landing page.** `/analyse`, the property form and the
verdict view all carry the same card/shadow/pill treatment — two visual languages on one
product reads as an accident, and that reasoning survives whichever direction is current.

### The hero photo — and why nothing from `C:\Veela` was usable

The 2024 codebase's only photography is Ho Chi Minh City and Hanoi district shots
(`quan-1.jpg`, `HCM-night.jpg`, `bt.jpg`, …) — see the section on that codebase above.
Wrong country for a Hong Kong-only product, and using an unrelated city's skyline as
generic "atmosphere" would have contradicted the product's own promise never to invent a
plausible-looking number: a fake skyline is that same lie, in a photograph.

Used instead: **[Colorful apartment buildings in Hong Kong](https://commons.wikimedia.org/wiki/File:Colorful_apartment_buildings_in_Hong_Kong.jpg)**,
Raita Futo, **CC BY 2.0**. Downloaded at 6,844×4,563, EXIF stripped, resized to 2,400 px
wide (12.4 MB → 803 KB) with ImageMagick, at `apps/web/public/hero/`.
**`CREDITS.md` in that folder is not optional reading** — CC BY requires visible
attribution, which is why the photo carries two on-page credits (a caption and a direct
source link), and why deleting the image without also removing the credit would leave an
orphaned attribution making a claim about nothing.

### The logo — the one asset from `C:\Veela` that *was* reused directly

Different case from the photos entirely, and worth being explicit about why. The photos
were **third-party content** (someone else's Vietnamese street photography) used in the
**wrong country**. The logo is **the founders' own mark from their own earlier venture**
— no licensing question, no geography question. "Read it, do not merge it" was a verdict
on that codebase's *code and content*; a brand mark the founders own outright was never
in that category.

Three files at `apps/web/public/brand/`, from `frontend-web/{real-estate-fe,real-estate-bo}`:
the blue wordmark (`veela-logo.svg`, header and footer), the house mark alone
(`veela-icon.svg`, extracted from the same path data — `app/icon.svg` for the favicon), and
a white variant for dark surfaces (`veela-logo-white.svg`, not yet placed). `SOURCE.md` in
that folder has the detail.

**The brand blue (`#006AFF`) and the UI's interactive accent (`#0B5BD3`) are deliberately
two different blues.** The logo is reproduced in its own colour, unchanged — WCAG exempts
logotypes from its contrast rule. The UI accent stays the colour chosen for a **6.1:1**
contrast against white; the brand blue alone manages **4.4:1**, under the 4.5:1 AA
threshold a button label needs. Matching them would have quietly cost the accessibility
margin the accent was chosen for. Full reasoning in `SOURCE.md`.

## The AI chat — a first, general answer to open question 2

Added 03/08/2026: a floating chat button on every page (`components/ai-chat.tsx`,
mounted once in `app/layout.tsx`), backed by `POST /api/chat` in `packages/api`, which
streams from Claude (`claude-sonnet-5` via `@anthropic-ai/sdk`). This is **not** one of
the three specific AI ideas open question 2 lists — it doesn't extract figures from an
upload, sanity-check inputs, or explain a verdict's findings line by line. It's the
general case underneath all three: *ask it anything*. Those three remain open and would
each narrow this into a specific, structured interaction rather than free-form chat.

**Stateless server, contextual client.** The whole conversation rides in every request
(`chatRequestSchema` in `@veela/types` — `messages`, capped at 40 turns of 4,000 chars
each) exactly like any direct Anthropic Messages API call; nothing is persisted
server-side. `AiChatProvider` (`components/ai-chat-provider.tsx`) holds history in React
state only — refresh the tab and it's gone, consistent with the product's own "no
account, nothing saved" copy. `/analyse` pushes a plain-text summary of the current
`Verdict` into that provider's `context` field (`summariseForChat()` in
`app/analyse/page.tsx`) whenever the report changes, so a question asked mid-analysis can
reference the actual figures on screen. **Prose, not the `Verdict` type itself** — the
schema comment in `@veela/types` explains why: coupling the chat contract to the engine's
output shape would make every `Verdict` change a chat-endpoint break too.

**The system prompt is grounded in the app's own rules, not generic.** `systemPrompt()`
in `packages/api/src/index.ts` repeats the same constraints the verdict engine encodes —
AVD, the 15%-on-80%-of-rent property tax, no capital gains tax on investment property
(but frequent trading risks being assessed under Profits Tax), and Cap. 349's 28-day
short-let rule — and tells the model to name the IRD or the RVD rather than invent a
number, the same "an unsourced rate is a bug" ethos as everywhere else in this app.

**Streamed as plain text, not SSE.** `hono/streaming`'s `stream()` helper pipes
`content_block_delta` text chunks straight through; the client reads
`response.body.getReader()` in a loop and appends to the last assistant bubble. Simpler
than framing SSE events for a single-purpose panel with no need to multiplex event types.

**Runs with zero configuration — the same rule as the Maps key and `DATABASE_URL`.**
`ANTHROPIC_API_KEY` is read lazily inside the request handler, never at module scope (a
`next build` with no key configured must still succeed — the pattern already established
by `realDb()`). Without it, the button still renders; the first message gets a plain,
readable "not configured yet" reply in the chat panel instead of a crash. No separate
status-probe endpoint — the failure surfaces the same way a real error would, on send.

## Property Finder — a Mashvisor pattern, on data we don't have

Added 03/08/2026, on an explicit request to build "the exact same Property Finder tool
as Mashvisor." Worth recording the tension that request runs into, because it's
permanent, not a one-time caveat: Mashvisor's Property Finder screens *individual
listings* from an aggregated database at US-MLS scale. Veela has no such thing for Hong
Kong, on purpose — see "Hong Kong data landscape" above. The Land Registry sells
transactions one at a time at HK$10 each, no bulk option; licensing Centaline or Midland
is a deferred decision. Building the literal feature meant choosing between fabricating
listings or pausing to source real ones. **Asked, and the answer was: build it with
clearly-fake listings** — the full screening UI, populated with generated data that says
plainly it isn't real, rather than pausing on data acquisition or quietly implying real
inventory.

**No fake addresses.** `packages/fixtures/src/listings.ts` generates ~3 listings per
district (54 total, mulberry32-seeded like `observations.ts`) with a price, size, rent
and yield shaped plausibly for Hong Kong — but every card is labelled by what it is
("2-bed sample flat — Sham Shui Po"), never given a building name or street. A
generic-but-plausible building name was the one choice ruled out early: something like
"Harbour Court" risks coincidentally matching a real Hong Kong building, which would be
worse than the thing this is trying to avoid.

**Photos: originally none, added 09/08/2026 — the one honesty rule here that was
deliberately reversed.** The original rule was "no photos", on the reasoning that *a
photo next to a fabricated address reads as a real listing; a deliberately abstract
graphic cannot*. Reversed on direct request, with the tension flagged first rather than
silently reversed or silently refused. What holds now: sixteen **CC0** interiors in
`public/listings/` (see that folder's `CREDITS.md`), the page-level `LISTINGS_NOTICE`
disclosure stays, cards still say "sample flat", and **no photo shows an identifiable
Hong Kong building** — Commons offered plenty of CC-licensed shots of named towers and
all were rejected, because attaching a real named building to a fabricated listing in an
unrelated district makes a specific false claim about a real property, which is worse
than a generic interior. Alt text says what the image is, not what the listing is.

Selection is by **rank in the filtered-and-sorted list**, not a hash of the listing id.
Two hash attempts shipped visible duplicates first: `hash * 31 + c` (fine mod 360 for the
old hue picker, broken mod 16 — `31 ≡ -1 (mod 16)` cancels the entropy, and ids are
adjacent by construction, so three of six cards matched), then FNV-1a with avalanche
(clustering fixed, still one duplicate per page — a hash spreads probabilistically and
cannot guarantee six particular listings don't collide). A page is 6 consecutive ranks
and 6 ≤ 16, so `rank % 16` cannot repeat within a page. The trade-off, stated in the code:
a photo is no longer bound to a listing, so re-sorting can change a card's image —
acceptable only because these were never photos of the property.

**The engine is real; only the input is fabricated.** `PropertyFinder` computes each
card's net yield with the actual `computeVerdict` against a fixed, documented
cash-purchase assumption set (`listingToDraft` in `property-finder.tsx`) — the
fabrication stops at the numbers going in, never at the arithmetic. Screening on
*unlevered* net yield, not cash-on-cash, is deliberate too: it's Mashvisor's own reason
for screening on cap rate rather than a financed return — a number comparable across
listings regardless of how any one of them might actually be financed.

**One function, not two guesses.** A card's yield and the report `/analyse?listing=<id>`
opens into must agree, or the product's own "both call `computeVerdict`, so they cannot
disagree" principle breaks for the one feature meant to feed `/analyse` its inputs.
`listingToDraft` is exported from `property-finder.tsx` and imported directly by
`app/analyse/page.tsx`'s prefill effect — not re-derived. **This was a real bug caught
before shipping**, not a hypothetical: an early draft of the prefill spread
`INITIAL_DRAFT` and only overrode price/rent/size, which silently kept `INITIAL_DRAFT`'s
fixed 4,000,000 HKD loan (able to exceed a cheap listing's own price) and its unrelated
80,000/10,000 agency-fee/other-costs defaults — both of which would have made the report
compute a different yield than the card the user had just clicked. Caught by tracing
the numbers through by hand, fixed by making the two call sites share one function.

**Colour is shared too.** Map pins in `listings-map.tsx` and the yield chip on each card
both key off `standingColor`/`gradeNetYield` from `@veela/ui` — the same bands the
`/analyse` rail uses — so a red pin, a red chip and a "weak" verdict always mean the same
thing everywhere on the site.

**The stronger disclosure this needed.** `DEMO_NOTICE` (existing, for the district-level
map) discloses fabricated *statistics*. `LISTINGS_NOTICE` (new) discloses fabricated
*properties* — a bigger claim to get wrong — and both the finder page and every listing
label repeat it, rather than relying on one banner at the top of the page to cover
fifty-four individual claims.

### The heatmap and hover pass — and the two Mashvisor features deliberately not built

Asked, immediately after the first pass, to "use the same design and features" —
prompting an actual look at what Mashvisor's Property Finder and Real Estate Heatmap do,
rather than working from a general impression of the category. Two things came back and
were added; two others came back and were not, on purpose.

**Added: the heatmap wash and hover quick-stats.** `listings-map.tsx` now draws a soft,
low-opacity circle per district underneath the listing pins — coloured by the *average*
net yield of whatever is currently passing the filter bar, live — matching Mashvisor's
own "set filters, see the hotspots" heatmap behaviour. It uses a fixed radius and is
captioned as a wash, not a boundary, for the same reason the individual pins carry no
address: nothing here should look more precise than a generated dataset can support.
Hovering a pin raises a small quick-stat card (price, net yield, beds/sqft) — Mashvisor's
"hover for projected ROI" — built as a plain positioned div inside the marker's own
content rather than the Maps SDK's `InfoWindow`, since `InfoWindow` anchors to one
specific marker instance and wiring a ref through fifty-four list items for one popup
style bought nothing `AdvancedMarker`'s own `onMouseEnter`/`onMouseLeave` didn't already
give for free.

**Not built: the Traditional/Airbnb strategy toggle.** Mashvisor's signature interaction
is flipping one property between long-term and short-term numbers. Hong Kong makes that
toggle mean something it doesn't mean in the US: letting under 28 consecutive days
without a guesthouse licence is a criminal offence here (Cap. 349, up to HK$200,000 and
two years — see "Hong Kong data landscape" above). That finding is why this product is a
long-term-yield tool in the first place, not a scoping afterthought, so the toggle stayed
out rather than being quietly added because the reference tool has one.

**Not built: multi-city search.** Mashvisor lets you compare up to five US metros at
once. Veela's market is "Hong Kong, and only Hong Kong" — a settled decision, not an
open one (see "Hong Kong only — what that actually decides" above) — so a feature whose
entire premise is comparing across cities doesn't have a second city to point at here.

**Not built: a Mashmeter-style composite score.** Mashvisor rolls several metrics into
one proprietary number per neighbourhood. Considered and set aside: every input behind
it here would itself already be synthetic (fabricated listings, generated yields), and
compressing two invented numbers into a third, more authoritative-*looking* one is the
wrong direction for a product whose whole standard is "an unsourced rate is a bug." The
existing per-metric bands (yield, standing colour) say as much as this dataset can
honestly say.

### The sidebar shell — `/finder` only, a real fork that got asked rather than assumed

Shown an actual screenshot of Mashvisor's dashboard next and asked to "build a finder
like this." The screenshot is a logged-in SaaS shell — dark left sidebar (Dashboard,
Search, AI Assistant, Market Finder, …), no marketing header at all — which is a
different thing from a page inside a marketing site, not a styling detail. Adopting it
could mean three different scopes: the whole site's new navigation, this one page only,
or not at all. **Asked, and the answer was this page only.**

`components/site-chrome.tsx` is the mechanism: a client component reading the current
pathname, rendering the marketing `SiteHeader`/`SiteFooter` (now in `site-nav.tsx`, moved
out of `app/layout.tsx` so this could switch on them) everywhere *except* `/finder`,
which renders bare so `app/finder/page.tsx` can supply its own shell —
`components/finder-shell.tsx`, a dark sidebar plus a top bar (collapse toggle, a
district-name search box, a Map/Table view toggle). The result is two different
navigation systems in one product depending which route you're on. That inconsistency
was the explicit trade-off in the choice, not an oversight.

**What's in the screenshot that isn't in `FinderShell`, because the thing it would
represent doesn't exist here:** a workspace switcher / user avatar (no accounts —
`/analyse` is anonymous by design), a second tab row for "Airbnb Comps" (out of scope,
Cap. 349), an "Upgrade Now" button and an upsell banner (no paid tier), and
decorative alert/compare/save-filter icons that wouldn't do anything if clicked. Built
instead: the district search box actually filters (via `matchDistrictByQuery`, shared
with the breadcrumb so the two can't disagree about what matched), Map/Table actually
switches between the map view and a full sortable table, and Export actually downloads
a CSV of whatever's currently visible — every control in the shell does something, or
it isn't there.

**The "Heat Map Filters" dropdown** (inside `PropertyFinder`, floating over the map)
picks which metric colours the district wash: net yield uses the same `standingColor`
bands as everywhere else on the page; price per square foot has no "good/bad" reading,
so it takes the sequential ramp instead (`sequentialBin`) — magnitude, not standing,
per this workspace's own dataviz convention of never using a status colour for a
value that isn't a status.

## Listing import — "paste a link", and why it doesn't scrape the page

Added 03/08/2026: a box on `/analyse` (`components/listing-importer.tsx`) that fetches a
pasted URL and pre-fills whatever it can find. Two things made this worth building
carefully rather than quickly:

**It reads published metadata, not the rendered page.** `packages/api/src/listing-extract.ts`
parses Open Graph tags and JSON-LD structured data — content a site publishes on purpose,
for search engines and social previews — and a couple of bounded regex fallbacks over
the visible text for price/area/bedrooms. It does **not** parse a site's own proprietary
layout to lift figures out of a rendered table. That distinction is the whole reason this
was buildable at all: this exact file already treats scraping Centaline/Midland's
transaction databases as carrying real ToS and legal exposure (see "Hong Kong data
landscape"), and a generic "fetch anyone's listing page and parse its markup" feature
would be the same problem at product scale. Reading metadata a page chose to publish is a
different, much safer thing. The trade-off: most Hong Kong listing sites don't publish
price and area as metadata the way they show it on the page, so extraction is often
partial — expected, not a bug, and every gap is named in `warnings` rather than filled
with a guess.

**Accepting a pasted URL for the server to fetch is textbook SSRF, and it's handled as
such.** `packages/api/src/ssrf-safe-fetch.ts`: the hostname is resolved and the *address*
validated as public before anything connects — not the hostname, because validating a
hostname and then handing it to `fetch()` a second time re-resolves DNS at connection
time, and a domain that resolved to a public IP during validation can resolve to a
private one moments later ("DNS rebinding"). The actual socket connects to the
already-validated IP address literally, with `Host` and TLS `servername` still carrying
the real hostname so the destination and certificate check behave normally. Every
redirect hop re-validates from scratch — a public URL redirecting to a private one is
the same attack one step later. Bounded throughout: 3 redirects, an 8s timeout, a 3MB
cap, HTML content-type only. Verified against real rejections, not just code review:
`localhost`, `127.0.0.1`, `169.254.169.254` (the cloud-metadata address), a `10.x`
private address, and a `file://` scheme were all fetched against the running server and
each came back a clean 400 rather than a fetch attempt; `https://example.com` — a
real public domain reserved by IANA for exactly this kind of test — came back 200 with
an honestly-empty extraction (that page publishes no title, price or area).

**Never auto-submitted.** The Property Finder → `/analyse` handoff auto-submits because
its data, though fabricated, is complete and internally consistent by construction. An
imported listing is neither — it's real but partial and unverified — so `handleImported`
in `app/analyse/page.tsx` only patches the fields actually found (title → label, price,
saleable area; monthly rent is left alone, since a for-sale listing essentially never
publishes one) and stops there. `ImportBanner` names the source URL, the fetch time,
exactly which fields were filled in, and repeats every extraction warning, so nothing
pulled from a link is presented as more certain than it is.

### Made to actually work on named sites (04/08/2026) — and two real bugs it found

Asked directly to make the import work with Centanet, Squarefoot, House730, Spacious,
28Hse. **Centanet is the one this file already names as carrying real ToS/scraping
exposure** ("Hong Kong data landscape," above) — the line held: this was not turned into
a site-specific DOM scraper for any of them. What changed is testing the existing
metadata-only approach against real listings on each site and fixing what that testing
found, which is a different thing from building per-site parsers.

**Result, tested against one real listing per site, verified against each listing's own
published figures, not assumed:**

| Site | Result |
|---|---|
| Centanet | Price and bedrooms from structured data. No area published. |
| Squarefoot | Area and bedrooms correct, from the page's own `og:description`. No price published. |
| 28Hse | Same as Squarefoot — same underlying platform, confirmed by the JSON-LD looking identical between them. |
| House730 | **403 on every attempt** — the site's own infrastructure refuses the request outright. Not pursued further: matching a browser's User-Agent to get past that would be posing as a human user specifically to defeat a site's own access control, a materially more aggressive posture than reading what a page publishes, and not one this project takes. |
| Spacious | Same 403 wall. Same reasoning, not pursued. |

**Bug 1 — the text fallback scanned the whole page, not the listing.** `AREA_RE`/
`BEDROOM_RE` ran against all visible text, and every site tested also renders "similar
properties" and filters full of *other* listings' numbers. Result on Squarefoot/28Hse:
**1,282 sqft read as 4,853, 3 bedrooms read as 1** — confidently wrong rather than
absent, the worse failure by this product's standard. Scoped to `og:title` +
`og:description` + `twitter:description`: still author-published metadata, but the field
meant to summarise *this* listing. (Same pass: the area pattern matched "sq ft"/"sqft"
but not the "ft²" these sites actually use.)

**Bug 2 — `numberOfRooms` is not "bedrooms."** Squarefoot published a correct `floorSize`
next to `"numberOfRooms":1` on a listing whose own description said "3 Bedrooms."
Schema.org's room count and a marketing bedroom count are legitimately different numbers;
treating them as synonyms produced a wrong answer *from structured data*, which is the
lesson — structured does not mean trustworthy. Only fields actually named for bedrooms
count now.

Neither fix required looking at how any site lays out its rendered page: both came from
reading the same meta tags and JSON-LD the importer already read, more carefully, and
verifying against real output instead of assuming.

### Midland Realty added (05/08/2026) — a third source, and a new sentinel bug

Asked to extend the same six-site list with Midland Realty. Tested against two real
`deluxe.midland.com.hk` listings and found it publishes **neither Open Graph price/area
nor JSON-LD** — `og:description` is generic boilerplate ("Learn more on … transaction
records, facilities…"), not a per-listing summary the way Centanet's or Squarefoot's is.
What it does publish is `__NEXT_DATA__`, the standard Next.js hydration payload every
Next.js page embeds as a `<script>` tag so the client can resume server-rendered state
without refetching — `extractNextDataProperty()` in `listing-extract.ts`. Still the site
handing over structured data verbatim in the page source, no rendering or DOM parsing
needed, so it sits in the same category as JSON-LD rather than the "parse the rendered
layout" category this file refuses to enter — but it is a real third tier, not a variant
of the first two, so it is named as such in every warning it produces.

**Scoped to `props.pageProps.property` only, deliberately — the same discipline as Bug 1
above.** The full payload also carries `recommendedProperties`, `estateData` and
filter-range data, each with their own `price`/`net_area`-shaped fields describing a
*different* property or no property at all. Searching the whole blob would let it
silently return a recommended listing's price instead of the one on screen; `property`
is the one object that describes the page's own subject.

**Bug 3 — `findField` returned whichever key the object listed first, not the key the
caller asked for.** Correct for JSON-LD, where no object tested carried two candidates at
once; wrong for Midland's `property`, which carries `net_area` (saleable, 1,280) and
`area` (gross, 1,683) as siblings. `["net_area", "area"]` returned the right one *purely
because `net_area` is serialised first* — key order, not a guarantee. Now checks the
caller's keys in the caller's priority order before descending.

**Bug 4 — Midland uses a literal `0`, not a missing key, as "not entered."** A Ma Wan
village house carried `net_area: 0, area: 0` alongside a real price. Nothing here is
legitimately zero — no listing costs HK$0 or measures 0 sqft — so treating `0` as "found"
printed a false zero next to a "read from the listing" claim. `toPositiveNumber()` now
guards all three `__NEXT_DATA__` fields.

**Verified against both listings after both fixes**, by hand against the raw payload:
HK$27,000,000 / 1,280 sqft / 4 bed; and HK$22,880,000 with area correctly *absent* rather
than `0`. Centanet, 28Hse and Squarefoot re-run: no regression.

**House730 and Spacious re-tested, this time with a real browser, not just the Node
fetcher.** Previously found `403 on every attempt` and not pursued, reasoned from this
project's own honest `VeelaListingImporter/1.0` User-Agent being refused. Re-tested
today with full headless Chromium carrying an ordinary browser User-Agent, on the theory
that the earlier block might have been UA-based rather than a real bot wall — it wasn't.
Both return Cloudflare's own **"performing security verification"** / **"you have been
blocked"** interstitial to a real browser too. That's a materially stronger finding than
the original one: it rules out the cheap fix (send a browser-like UA) and confirms the
block is an active bot challenge, not a header check. The original reasoning stands and
now rests on firmer ground — defeating a Cloudflare challenge server-side would mean
building genuine anti-bot-evasion infrastructure, not adjusting a request header, and
that is a materially more aggressive posture than reading what a page publishes. Not
pursued, and flagged back to the requester rather than silently skipped or silently
attempted.

Neither Midland fix required looking at how the site lays out its rendered page — both
came from reading the same kind of thing this importer already reads (a script tag's own
JSON), just a new one, and verified against real output instead of assumed to work.

### Spacious made to work too (05/08/2026) — a stealth browser, asked for explicitly

The finding above — Spacious 403s a real browser, not just this app's own honest fetcher
— was reported back rather than acted on, because crossing it is a different kind of
decision than anything else in this file: not reading more carefully, but defeating a
site's own anti-bot product. **Given three explicit options — leave it blocked, a stealth
headless browser, or a paid unblocking API — the answer was the stealth browser.** Built
on that instruction, not assumed.

**It works, and cleanly — verified against a real listing, not assumed.** A headless
Chromium with a handful of navigator patches (`navigator.webdriver` hidden, a plausible
`navigator.plugins`/`languages`, `window.chrome.runtime` present) passed spacious.hk's
Cloudflare **Managed Challenge** on the first attempt. That is a materially lighter tier
than House730's, which held even against the same patches — the two sites are not
equally protected, so "House730 next" would not be the same job over again.

**Once the challenge clears, spacious.hk turns out to publish rich, clean metadata** — a
per-listing `og:title`/`og:description` (bedrooms and area both stated: "4 Bed, 2212
Sqft") and six JSON-LD blocks, one a schema.org `Product` with `offers.price`. Every
figure came from the *existing*, unmodified `extractListing()` — price from JSON-LD, area
and bedrooms from the text-summary fallback, the same mechanism Squarefoot and 28Hse
already use. **The entire job was reaching the page; nothing about reading it needed to
change.**

**Domain-allowlisted, not a generic "try a browser" fallback.** `spacious-stealth-fetch.ts`
checks the hostname against exactly `{spacious.hk, www.spacious.hk}` before a browser is
even launched; `index.ts` routes only those two hosts to it, `isSpaciousUrl()`. Every
other site keeps using `fetchHtmlSafely`'s honest, SSRF-safe fetch, untouched.

**Playwright runs in a subprocess, not imported from `@veela/api` — and that took three
failed attempts to land on.** Importing `playwright` directly broke Next's webpack build:
playwright-core reads its own `package.json` by a real filesystem path and reaches for an
optional BiDi module (Firefox/WebKit only, never used here) via a dynamic `require()` —
both ordinary Node module resolution, both incompatible with being bundled.
`serverExternalPackages` (the documented fix for exactly this class of problem) did not
resolve it for this route handler, tried directly rather than assumed, including marking
`@veela/api` itself external. An `IgnorePlugin` cleared the BiDi symptom and immediately
exposed the deeper one — the `package.json`-by-real-path failure — confirming the whole
package genuinely cannot be bundled, not just that one call site. **The fix that actually
worked: move the browser entirely out of `@veela/api`, into
`apps/web/scripts/spacious-fetch-worker.mjs`, invoked via `child_process.execFile("node",
...)`.** A file nothing in `app/` imports is invisible to webpack by construction, and a
plain `node` subprocess resolves `playwright` for real, from `apps/web`'s own
`node_modules` — sidestepping the bundler rather than continuing to fight it. Protocol is
one JSON line on stdout either way, `{ok:true, html, finalUrl}` or `{ok:false, errorType,
message}`, so `spacious-stealth-fetch.ts` can still raise the same `UnsafeUrlError` /
`FetchFailedError` classes every other path in this file uses.

**What this trade-off actually is, restated plainly rather than left implicit in the
code:** every other site in this importer is read by asking politely and taking no for an
answer. This one browses in disguise. Both the domain scope and the reasoning are in
`spacious-stealth-fetch.ts` itself, not only here, so the decision travels with the code
that makes it real.

**Real limitations, not addressed here:** a browser process per import, not a pool —
acceptable for one person pasting links occasionally, not at any real scale. Verified in
local dev only; a serverless deployment would need a Chromium build meant for that
environment (e.g. `@sparticuz/chromium`), which this is not. And Cloudflare's own
challenge tier can change — what passed today is not a permanent guarantee.

### The importer used to treat a rental's rent as a purchase price (05/08/2026)

Every fix above assumed the one number a listing publishes is a purchase price. It isn't,
always: a rental's headline figure is a monthly rent, and every site tested (bar Midland)
publishes exactly one number either way, undifferentiated in the data itself — an
HK$18,000 rent and an HK$18,000 price look identical to `findField`. Filing a rent as `priceMinor`
would have shown a net yield computed against a purchase price a few hundred times too
low, silently — the same "confidently wrong" shape as the zero-sentinel and
`numberOfRooms` bugs above, just not yet caught because nothing had tested a rental link.

**`isRentalListing()` decides sale-vs-rent before the figure is assigned anywhere.**
Every HK portal tested encodes it in the URL: Centanet's `?theme=buy` / `?theme=rent`,
28Hse's and Squarefoot's `/buy/` / `/rent/` path segment — cheaper to check than the page
body, and exactly as reliable for the sites tested, verified against a real Squarefoot
rental (`/en/rent/residential/property-24847`) as well as real sale URLs. The page's own
summary text ("For Sale" / "For Rent" / "To Let") is the fallback for a permalink that
doesn't say either way, as Spacious's don't.

**Midland doesn't need the guess at all, and is more precise than the other four
because of it.** Its `__NEXT_DATA__` `property` object carries `price` and `rent` as
independent fields — `tx_type` can be `["S"]`, `["L"]`, or `["S","L"]`, and a
dual-listed unit states both real numbers at once (verified against a real listing:
`price: 178,000,000`, `rent: 380,000`, both correct). Both are read unconditionally,
regardless of what the URL/text guess would have said, and `0` is filtered by the same
`toPositiveNumber()` the earlier area fix uses — Midland's "not offered" sentinel for
whichever of the two doesn't apply to a given listing.

**What actually happens with the number once it's classified:**

| Found | Shown in the form as | Yield |
|---|---|---|
| Price only (a sale) | Price | Computed if a rent is separately on hand |
| Rent only (a pure rental) | Monthly rent | **Not computable from this import alone** — the banner says so explicitly, and names it a rental rather than leaving a blank field to explain itself |
| Both (Midland dual-listed) | Both | Computed directly from this one listing |

**Then the yield lied anyway — two more root causes, and a misleading green test.**
Wiring `monthlyRentMinor` into `draft.monthlyRent` looked sufficient, and a first test
"passed": importing a rental over a draft still holding its *default* price produced a
plausible number. **That test was misleading rather than wrong — a default price is real
money, so the result looked unremarkable.** Reported for real, with a screenshot: a
Spacious rental (HK$26,000/month) showed Price *and* rent both at HK$26,000 and a net
yield of **186%**, with the rental warning banner correctly displayed right next to it.

1. **`handleImported` only ever patched, never cleared.** Patch-only was deliberate, so
   an incidental import wouldn't clobber a manual edit — but it also let a **stale price
   from a different listing** survive into a rental import and combine with its rent.
   Fixed: `price` and `monthlyRent` now **clear each other**; a listing stating both
   (Midland) still sets both; fields the import didn't touch at all still only patch.
2. **Zeroing the price wasn't enough** — the preview still showed **176%**. `ratio()`
   already guards division by zero, so the bug wasn't there: **net yield is net income
   over *cash to acquire***, and that is price **plus** stamp duty (which floors at a
   nonzero minimum) plus flat agency and legal fees. Zero price still left ~HK$95k of
   real, price-independent cost in the denominator, so `computeVerdict` "succeeded" with
   a finite, fictitious percentage. Fixed above the engine: `preview` refuses when
   `draft.price <= 0`, reusing the `null` state `Rail` already renders.

Verified with the exact reported shape, not a simplified one; sale-only imports and
Midland dual listings re-checked for regression.

### A clear rejection reason, and an address on the map (06/08/2026)

Two requests, both about the paste-a-link importer: show *why* the server rejected a
link, in a popup rather than easy-to-miss inline text; and pull the listing's address
out of the page too, plotted on a map.

**The toast worked before its message did.** `ErrorToast` (`components/toast.tsx`) sits
`top-20 right-5`, clear of `ai-chat.tsx`'s floating trigger and `site-nav.tsx`'s sticky
header. Its first version showed "The server rejected that link (400)" for *every*
rejection, discarding the specific reason the fetchers already raise (e.g.
`"169.254.169.254 resolves only to private/internal addresses"`). Cause: the client called
`res.json()` unconditionally, but rejections arrive in **two shapes** — Hono's
`HTTPException` sends **plain text**, `zValidator` (a URL failing `z.string().url()`
before the handler runs) sends a **Zod error as JSON**. `res.json()` threw on the first,
was silently caught, and fell through to the generic message. Confirmed by curling both
paths and reading the `content-type`. `readRejectionMessage()` now reads text first,
attempts JSON, and only then falls back.

**Address and coordinates came from the same three sources already being read** — no new
source, a deeper read. Each site nests them differently: Centanet puts `PostalAddress` +
`GeoCoordinates` three levels down in `RealEstateListing.mainEntity` (objects, which
`findField`'s leaf-matching never reached); Spacious has a bare `address` string beside a
flat `geo`; Midland's `property.building` carries `latitude`/`longitude` directly, next to
`streetview_latitude`/`streetview_longitude` — a real but different pair, kept apart by
exact key name rather than prefix. `findAddressText()` and `findGeoCoordinates()` are
bounded recursive walks handling all three generically (the first assembles and
deduplicates `PostalAddress` parts — Centanet repeats "Tsuen Wan West" in two fields).
Squarefoot and 28Hse publish neither JSON-LD nor `__NEXT_DATA__` but do carry the old
ICBM `<meta name="geo.position">`, tried last.

**All five sites returned an address and coordinates** — including the two not expected
to. Every coordinate passes `isPlausibleHongKong()` before it is trusted; a hit outside
the territory is discarded with a warning, because **a wrong pin on a real map reads as
data, never as the parsing bug it is**.

**Found on the way**: Centanet's `floorSize` uses schema.org's `QuantitativeValue`
wrapper (`{"@type":"QuantitativeValue","value":947,…}`), not a bare number, so area came
back "not found" on every Centanet import despite being published. Fixed generically in
`findField` — a matched key whose value is an object carrying its own `value` is
unwrapped — not a Centanet branch, since that wrapper is schema.org convention.

**The pin is its own small component.** `ImportedListingMap` is one `AdvancedMarker`,
deliberately not `DistrictMap` (which resolves *demo* centroids and carries
sizing/selection machinery this doesn't need). It reuses `DistrictMap`'s exported
`MAP_STYLE` so the two read as one product. **Noted, not chased**: at close zoom the
muted styling doesn't suppress Google's POI icons, because a `mapId` makes Google prefer
Cloud-console styling over the inline `styles` array. Pre-existing to that prop
combination, not introduced here; fixing it means dropping `mapId` (losing Advanced
Markers) or configuring a Cloud Console style this project doesn't have.

## The star rating — a formula shown next to the number, not a score behind it

`rateVerdict` in `@veela/ui` turns a verdict into 0–5 stars: net yield sets a base on a
continuum (not `gradeNetYield`'s three bands, so two "strong" yields can still be told
apart), and each finding pulls it down — a critical finding costs a full star, a warning
half of one. Displayed via `components/star-rating.tsx`, in `VerdictView`, always with
its one-sentence explanation directly underneath.

**Deliberately not a "Mashmeter"-style composite.** The distinction from the composite
score ruled out earlier in this file (see "Not built: a Mashmeter-style composite
score") is that this reuses numbers already computed and already on screen, and shows
its formula in plain language every time it's displayed, rather than compressing several
metrics into one opaque, branded number. A rating that hides its own arithmetic reads as
an opinion; this one reads as a restatement of the report above it.

## Login — added 03/08/2026

**The "login is not a paywall" decision this section originally recorded was reversed on
06/08/2026 — see "The paywall, after all" below.** The reasoning is worth one paragraph
because it is what made the reversal a real decision rather than a casual one: this
product's identity, restated every time a feature landed, was "no account, nothing
saved," so gating the report would reverse that rather than extend it. It was asked, not
assumed, and the answer *at the time* was that login adds a portfolio and unlocks nothing
that used to be free. Only the conclusion changed; the standard for changing it didn't.

**The backend was already most of the way there.** `packages/db/src/schema.ts` already
had `profiles`, `properties` and `verdicts` (snapshots, not a cache — a stored verdict
keeps the rules that produced it, because tax rules change), all RLS-scoped, and
`packages/api`'s `/properties` CRUD already required a user. Missing was everything
upstream: no login page, no browser Supabase client, no session-refresh middleware — the
route handler's own comment said "token refresh happens in middleware" for a middleware
that didn't exist yet.

**Both login methods, not just the simpler one.** Google OAuth and email+password, both
on `/login` (`components/auth-provider.tsx` wraps `@supabase/ssr`'s browser client).
Email+password needed real UI (a mode toggle, a confirm-email state); Google needed
`middleware.ts` for session refresh and `app/auth/callback/route.ts` to exchange the
code. Both converge on the same session: `useAuth()` client-side, `getUser()` server-side.

**Unconfigured Supabase is not an error anywhere in this chain** — same rule as
`DATABASE_URL`, the Maps key and `ANTHROPIC_API_KEY`: the header hides "Log in",
`/login` and `/portfolio` show "not configured" instead of a broken form, and
`GET /api/properties` 401s cleanly via `requireUser` without touching `DATABASE_URL`.
That path was the one actually exercised for the first week, when no real project
existed. One does now — see "Live infrastructure" — so the *configured* path is now the
default and the fallback is the one to keep testing deliberately.

**What logging in actually gets you**, built on top of the untouched report:

- **A portfolio** (`/portfolio`) — every property saved from a report, each showing its
  stored net yield, star rating and price, with "Save to my portfolio" on `/analyse`
  always creating a **new** saved snapshot rather than updating one in place. That's
  deliberate, not a missed dedup: recomputing in place risked a real bug (updating
  against the *stored* property's old figures, not whatever was just edited in the
  form), and "every save is a dated snapshot" is exactly the report-history half of what
  was asked for, not a workaround for it.
- **Loading a saved property back into `/analyse`** (`?property=<id>`) — the inverse of
  saving, converting `properties` row → `Draft` the same way `?listing=` and the
  listing importer already populate a `Draft` from a different source. Auto-submits,
  like the Property Finder handoff and unlike the link importer: this is the user's own
  previously-confirmed real data, not fabricated or unverified.
- **"Welcome back"** — a logged-in visitor who opens `/analyse` cold (no `?listing=`,
  no `?property=`, nothing typed yet) is *offered* their most recent saved property, via
  a plain `<a>` (not `next/link`) so the same-route navigation actually remounts the
  page and the loading effect fires — never auto-loaded silently. A blank form that
  stays blank until asked is a smaller surprise than one that quietly fills itself in.

## The paywall, after all (06/08/2026)

Asked directly, a second time, to gate the full report and Property Finder behind
login — the same shape of request the section above turned down, from a screenshot of
Mashvisor's own account menu. **Flagged the tension explicitly before building
anything**, quoting the earlier decision back rather than silently reversing it or
silently refusing the new instruction — asked, and confirmed: yes to gating the report
(the live preview stays free), and Finder blocked outright rather than browsable.
That's the record of *why* this is a deliberate second decision, not the first one
quietly eroding.

**The live preview is the part that stays free, and it was never the thing being
gated.** `Rail`'s recompute-on-every-keystroke (`app/analyse/page.tsx`) already ran
client-side against `computeVerdict` directly — no network call, so there was nothing
for a login wall to sit in front of. Only `POST /api/verdict/preview` — the
authoritative, submitted report — needed the gate; the two were already architecturally
separate, which is what made "preview free, report gated" a clean line rather than a
new distinction invented for this.

**`submit()` gates itself, not the button** — deliberate, because a report can also be
requested by three other paths that don't go through the "See the full report" click:
the Property Finder handoff (`?listing=`, auto-submits), a saved property
(`?property=`, auto-submits — though that path already 401s upstream at
`GET /properties/:id` for an anonymous visitor, so this is defence in depth, not the
only thing stopping it), and the retry described below. Gating inside `submit()` itself
catches all of them from one place rather than four.

**The gate had to not throw away what was already typed.** A `<Link>` to `/login` would
have worked and would have been much less code — and would have meant a reader who
filled in eleven fields lost every one of them the moment they clicked "log in."
`ReportLoginGate` renders *inline*, exactly where the report would have gone, on top of
a form and a live preview that stay fully mounted and untouched. `LoginForm`
(`components/login-form.tsx`) is `/login`'s own form extracted so both places share one
implementation rather than two that drift — the page wrapper still redirects on success
(nothing to preserve there), the inline one doesn't.

**Google OAuth is a real navigation away and back, and that's the one case draft
preservation can't just be "don't navigate."** Email/password sign-in never leaves
`/analyse` at all, so `useAuth()`'s reactive `user` state is enough — an effect watching
`[user, reportGated]` clears the gate and calls `submit()` again the instant a session
appears, no callback plumbing needed. Google's redirect through `/auth/callback` can't
avoid leaving the page, so `onBeforeGoogleRedirect` stashes the current `draft` into
`sessionStorage` first; a mount effect on `/analyse` restores it once, deletes the key,
and re-arms `reportGated` so the same retry effect fires again the moment the returning
session lands — the round trip ends with the report computed, not a second click asked
for.

**`/finder` was gated in middleware, and was reopened on 09/08/2026.** It was the
opposite mechanism from `/analyse` — a server-side redirect in `middleware.ts` via
`AUTH_REQUIRED_PREFIXES`, chosen because that page has no per-visitor state worth
preserving. It came out again after a business review made the obvious point: the finder
shows *fabricated* listings, so it is marketing for the real report, not the product —
gating it walled off the weakest asset while the strongest demo (the live preview) stayed
free, and charging for it later would raise a Trade Descriptions Ordinance (Cap. 362)
question that giving it away does not. `AUTH_REQUIRED_PREFIXES` is now empty; the
mechanism is left in place because the next thing worth gating will want it.
**`/analyse`'s report gate is untouched** — that one is the user's own figures, not
fabricated data.

**Unconfigured Supabase still isn't an error** — neither gate can enforce anything
without an account system to check against, so both fall back to ungated behaviour when
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` aren't set, the same rule
`/portfolio` lives by. (This was originally verified with temporary fake credentials
because no real Supabase project existed; one does now — see "Live infrastructure".)

**Copy updated to stop asserting the thing that's no longer true.** `/analyse`'s own
header used to say "Nothing is saved and no account is needed" — flatly wrong now for
the report half of that sentence, so it was rewritten rather than left as a stale claim
next to the feature that contradicts it. `/login`'s description follows the same rule.

## The rest of the sidebar — what got a real page, what didn't, and why

Asked to replicate every item on Mashvisor's left sidebar (Dashboard, Search, AI
Assistant, Market Finder, Research & Analyze, My Workspace, Manage, Marketing,
Services, Resources) as its own page. Mapped each one honestly rather than building a
literal copy of all ten:

**Already existed, wired into the sidebar rather than duplicated:** Search → `/finder`.
Market Finder → `/map`. AI Assistant → the existing floating chat, plus a new
`/assistant` full-page view that shares the *same* conversation (`useAiChat()` reads
the one global `AiChatProvider`) rather than starting a second one. My Workspace →
`/portfolio`.

**Built new, because the gap was real:**
- **`/dashboard`** — quick-link tiles to every tool, plus a portfolio count when logged
  in. Deliberately not a metrics dashboard: at personal-portfolio scale (single digits
  of saved properties), a count and a link say what a chart would, without a chart's
  implied precision over so few points.
- **Research & Analyse → Market Performance** (`/research/market-performance`) — price
  and rent index trends, new synthetic metrics (`price_index`, `rent_index` in
  `@veela/fixtures/observations.ts`, same mulberry32-seeded convention as vacancy and
  transactions). Answers a different question than `/map`: that page is "where is
  supply loosening," this is "how has the market moved" — not a relabelling of the
  same chart. Fixed a real bug surfaced while building it: `series-chart.tsx`'s y-axis
  floored at 0 for anything not literally `%`-denominated, which would have compressed
  an index rebased to 100 into a flat line near the top of the chart — generalised the
  "pad around the actual range" behaviour to any non-zero-anchored metric.
- **Research & Analyse → Market Regulations** (`/research/market-regulations`) — reads
  `HK_RULE_SETS` directly, the same object `computeVerdict` prices every report
  against. Deliberately a Server Component reading the rules object straight, not a
  hand-copied summary: if a stamp duty band ever changes in the rule set, this page is
  already right, because it was never a second source of truth to keep in sync.
- **Manage → `/account`** — the real gap here wasn't Mashvisor's property-management
  tools (this product doesn't do that), it was that `profiles.displayName` and
  `profiles.aggregateConsent` already existed as columns with no page to edit them, and
  `aggregateConsent` specifically was already flagged in this file's open questions as
  needing a PDPO consent UI. New `GET`/`PATCH /profile` routes; `homeJurisdiction`
  stayed out of the UI on purpose — there's only one jurisdiction to set it to.
- **Resources → `/resources`** — a glossary (net yield, cash-on-cash, the 28-day rule,
  …) and links to the same government sources the rules page cites, explicitly *not* a
  vetted-provider list — see below.

**Not built, and not stubbed either:**
- **Marketing.** Mashvisor's version is flyer/listing-marketing tools for agents and
  hosts. Veela's stated audience is "investors, deliberately — not buyers looking for a
  home, not renters, not agents" (see "Context," above). Building this would mean
  building a tool for the one audience this product explicitly excludes.
- **Services.** Mashvisor's version is a vetted marketplace of lenders, insurers and
  contractors. Veela has vetted no one — a page presenting unvetted names as trusted
  services would be inventing authority the product doesn't have, the same failure mode
  already ruled out for the Mashmeter-style score and the fabricated listings. What
  survives of the idea is on `/resources`: links to the real regulators (Law Society,
  HKMA) instead of a curated list.

Both of those were flagged in the same turn they were skipped, not silently dropped —
worth restating, since "replicate everything" was the literal instruction and two items
were deliberately not replicated.

## My Workspace's four sub-pages — the one group Mashvisor itself nests

Shown a second screenshot of "My Workspace" expanded: Property Compare, Property
Alerts, My Favorite Markets, Saved Properties. Mashvisor draws this one specifically as
a dropdown, not a flat link, so `app-shell.tsx`'s sidebar mirrors that — a
`workspaceOpen` toggle, auto-expanded when the current path is under `/portfolio`,
collapsed elsewhere — rather than adding expand/collapse to every group. Research &
Analyse's two items stay a flat pair; four items under one label is the case that
actually reads better collapsed by default.

- **Saved Properties** was already `/portfolio` — just relabelled as the group's first
  sub-link.
- **Property Compare** (`/portfolio/compare`) — no new computation or schema: pick up to
  three saved properties, see their stored snapshots side by side. Everything it shows
  was already being fetched for `/portfolio`; this just lays it out differently.
- **My Favorite Markets** (`/portfolio/favorites`) — the one genuine schema change:
  `profiles.favorite_districts`, a plain `jsonb` array (`packages/db/migrations/
  0002_favorite_districts.sql`), not a join table — there's no per-favourite metadata
  to justify one. Hand-written migration rather than `drizzle-kit generate`: this repo
  has no migration journal checked in (only the hand-written PostGIS/RLS one), so
  `generate` would have no baseline to diff against and would try to recreate every
  table from scratch. A star toggle on Market Performance
  (`use-favorite-districts.ts`, shared between the toggle and this list so the two
  can't disagree about what's starred) writes to it via the existing `PATCH /profile`.
- **Property Alerts** (`/portfolio/alerts`) — scoped to what's actually true rather
  than built to match the screenshot. Mashvisor's version watches live data and
  notifies on change; Veela has neither the ingestion job nor a notification pipeline
  (Tier 4 — "don't scaffold... unless a live data feed forces it," per the boilerplate
  taxonomy this workspace already follows). What's real: `properties.monitored` already
  existed as a column with no UI. This page is that toggle, described as what it is —
  "tracking is real, the alert isn't wired up yet" is printed on the page itself, not
  left for someone to discover by clicking a dead button.

## Fixed: Market Finder went empty after navigating there from the sidebar

Reported directly: `/map` worked on a fresh load or reload, but came up empty after
clicking "Market Finder" in the app sidebar from another page — pointing at the
client-side navigation specifically, not the page itself.

**Root cause: three independent `<APIProvider>` mounts.** `district-map.tsx`,
`listings-map.tsx` and their three call sites (`market-explorer.tsx` on `/map`,
`property-finder.tsx` on `/finder`, `map-preview.tsx` on the landing page) each wrapped
their own map in its own `APIProvider`. A full page load only ever mounts one of them,
so it always looked fine that way. A client-side SPA navigation between any two of
those pages — which is what clicking a sidebar link is — mounts a second `APIProvider`
while the first either hasn't unmounted yet or already loaded the Google Maps script,
and the library's own example (`@vis.gl/react-google-maps`'s own README) wraps *one*
`APIProvider` around the *entire app*, never one per component. Two independent
instances racing to load the same script in one page session is exactly the shape of
bug that pattern exists to prevent.

**Fix: `components/maps-provider.tsx`, one `APIProvider` at the root layout**, wrapping
everything above `SiteChrome`. `DistrictMap` and `ListingsMap` no longer take an
`apiKey` prop or mount their own provider — they now assume they're already inside one,
which they always are once a caller has already checked the key exists (the same
`mapsKey === undefined` guard each call site already had, unchanged). Unconfigured
Supabase-style: no key means `MapsProvider` renders nothing but its children, same "runs
with zero configuration" rule as everywhere else this key is read.

**What this doesn't claim:** it wasn't possible to reproduce the exact client-side
navigation in this environment (no browser here) — the fix is confirmed by removing the
only plausible cause down to a single, correctly-scoped `APIProvider` (verified there is
now exactly one in the whole codebase) and by the library's own documented usage
pattern, not by watching the original failure happen and then not happen.

## Finder results and mobile navigation (09/08/2026)

**Cards rebuilt to Zillow's own proportions**, measured off a reference screenshot rather
than approximated: a landscape 16:9 photo that dominates *because the text block under it
is four short lines*, price-first, with the yield badge over the photo where Zillow puts
its favourite-heart. The map/cards split moved from 1:1.3 to 1:1 to match. Two earlier
passes missed by guessing at "photo-forward" instead of measuring — the correction came
from being shown the actual card.

**A third view, and pagination.** Map / **List** / Table: the list is compact horizontal
rows for vertical scanning, distinct from both the card grid and the dense table. Cards
and list paginate at 6; the table doesn't, because it already reads fine at any length.
Page resets to 1 whenever filters, search or view change — otherwise a filter that
shortens the result set strands the reader on an empty page.

**Mobile navigation existed nowhere before this.** Both shells were desktop-only:
`AppShell`'s sidebar was a fixed 224px column that ate a phone screen, and the marketing
header's links were `hidden sm:inline` with *no alternative*, so a phone got a header
containing no navigation at all. Now: the sidebar becomes an off-canvas drawer below `lg`
with a hamburger and a tap-dismiss backdrop, auto-closing on navigation; the marketing
header gets a hamburger dropdown. The desktop collapse-chevron and the mobile hamburger
swap at the breakpoint, never both.

One subtlety worth keeping: `collapsed` now hides sidebar labels via `lg:hidden` rather
than by not rendering them. Conditional rendering applies at every width, so a sidebar
collapsed on desktop produced a label-less, unusable drawer on a phone — an icons-only
rail is a desktop space-saving trick and has no business applying to an overlay.

## The hero headline, and the display face — both asked for directly

Two related requests landed back to back. **The headline treatment**: dropped the
two-tone (bold clause + `text-muted` clause) for one solid colour at `font-extrabold`
(800) — Bricolage Grotesque's heaviest cut — asked for after being shown the two-tone
version read as hedging on a line meant to be the whole pitch in one breath. Applied to
every headline at this "big statement" tier (`/`, `/analyse`, `/map`), not just the
landing page, for the consistency asked for directly.

**The display face**: asked to "use the same font as Airbnb." Airbnb's actual face,
Cereal, is proprietary and not licensed for third-party use — flagged before doing
anything, since that's a hard constraint, not a style opinion. Swapped in **DM Sans**
instead, the free alternative most commonly cited for Cereal's specific quality (rounded
terminals, humanist-geometric warmth) — not Inter or Manrope, which read closer to
Cereal in general shape but miss that particular roundness. Bricolage Grotesque is gone
from the codebase entirely, not just overridden per-page.

## "Could not reach OpenStreetMap" in production — two causes, one of them ours (12/08/2026)

Reported from production with a screenshot: the full report's neighbourhood section showed
**"Could not reach OpenStreetMap: The operation was aborted due to timeout"** when
searching a neighbourhood. Two independent causes, and the first is the more embarrassing —
**the error blamed OpenStreetMap for our own timeout.**

**1. Vercel functions default to a 10-second ceiling.** `AbortSignal.timeout(20_000)`
allowed 20s per attempt across two mirrors, so the *function* was killed at 10s, well
before Overpass had been given the time the code thought it was giving it. Locally there is
no such ceiling, which is exactly why this never appeared in development.
`export const maxDuration = 60` in `app/api/[[...route]]/route.ts` — the ceiling this plan
allows. Nothing is expected to take that long; it is headroom so a slow upstream fails on
its own terms with a true message instead of being guillotined. The listing importer has
the same shape (someone else's slow page, and `spacious-stealth-fetch` launches a whole
browser), so this was never neighbourhood-specific.

Attempt budget brought inside the new ceiling rather than left to chance: three mirrors ×
8s = 24s, with Overpass's own server-side `timeout:` at 6s.

**2. Nothing was cached — and the comment explaining why was wrong.** Both
`neighbourhood.ts` and the route handler asserted that a cache was *deliberately* absent
because "a stale cached amenity list would be worse than a slow fresh one." Production
disproved the premise: the alternative to stale data was never fresh data, it was **a red
error sentence where a neighbourhood should be**, and a month-old school list is plainly
worth more than that. Both comments were rewritten rather than left standing next to the
cache that contradicts them — the same rule applied when `/analyse`'s "nothing is saved"
copy went stale.

`packages/db/migrations/0004_neighbourhood_cache.sql`: coordinates **rounded to 3 decimals
(~110m)**, which is the decision that makes the cache actually hit — full precision would
give each of the 54 flats in an estate its own miss, while amenities within an 800–900m
radius barely differ across 110m. `payload` is the response body as a `jsonb` blob,
denormalised on purpose: this caches an external service's *answer*, and normalising it
would create a second schema to keep in step with OSM's tags.

**Four outcomes, each verified against the running app rather than reasoned about:**

| Situation | Result | Measured |
|---|---|---|
| Fresh row (< 30 days) | Served from cache | **0.76s** local / 2.6s production, vs 23.8s cold — and a coordinate 50m away hits the same row |
| Miss or expired | Fetch Overpass, store | 4–10s typically in production |
| Overpass down **and** an older row exists | That row, `stale: true` + its age | 200, `ageDays: 40` |
| Overpass down, nothing cached | Honest 502 naming the cause | still an error, deliberately |

The last two rows were verified by **temporarily pointing `OVERPASS_ENDPOINTS` at an
unreachable host and rebuilding** — a forced outage, not an assumption that the fallback
branch works because it typechecks. Endpoints restored and re-verified afterwards.

**3. Mirrors were tried in strict order, so every request paid for the dead ones first.**
This turned out to be the largest single cause, and it was found only by testing each
mirror by hand: the mirror listed **first** accepted the connection and returned **zero
bytes for 40s**, and a third failed TLS, so a healthy answer could not arrive before the
attempt timeout expired. An earlier comment in the file asserted that mirror was
"measurably the more reliable" — true where it had been measured, false elsewhere, and
that mismatch *is* the argument: **which mirror is healthy differs by network, so no static
ordering fixes this.** The ordering was the bug.

Mirrors are now **hedged**: each is started 1.2s after the previous, the first valid answer
wins, and the losers are aborted. Staggered rather than fired all at once on purpose —
Overpass is donated infrastructure whose usage policy asks for moderate use, so a healthy
first mirror is still normally the only one contacted, and the extra load lands only when a
mirror is actually failing, which is the case we would have contacted all three for anyway.

**A generous timeout is correct *because* of the cache — the two changes are not
independent.** A first 14s budget was measured in production cutting off lookups that
would have succeeded (3 of 5 cold points failed at exactly the budget, and the same
coordinates returned real data seconds later). Raised to 35s overall and 20s server-side,
inside the 60s `maxDuration`. Without a cache that would mean everyone waits; with one,
**only the first visitor to an area ever pays it** and every later view is ~1s — so a slow
success happens once, where a fast failure would happen to everyone until it stopped
failing. Half a minute of waiting is also now *named in the panel* rather than shown as a
bare "Checking…", which at that length reads as a hung page.

**Measured cold-lookup success in production: 6 of 8, at 4–10s** (against 2 of 5 before the
budget change, and 1 of 4 before hedging). **Not 8 of 8, and it will not be** — the
remaining failures are Overpass genuinely refusing under load, and the same coordinates
succeed on retry moments later. That residue is why the cache and the stale fallback, not
the mirror list, are what make this section dependable.

**The staleness is shown, not hidden.** `neighbourhood-panel.tsx` renders a caution banner
("Showing a saved copy… OpenStreetMap didn't answer just now") with the age in days.
Serving old data silently as though it were current would be the worse failure, not the
safer one — the whole reason the cache is defensible is that the reader is told.

**The fetcher stayed storage-free.** Caching lives in the `/neighbourhood` handler, not in
`neighbourhood.ts`, which remains a pure Overpass client that knows nothing about a
database — it is called from paths that have no `db` in scope, and it is the one module
that must keep working without one, per this project's zero-configuration rule.

## Every count in the neighbourhood report opens the list behind it (12/08/2026)

Asked for a report on the neighbourhood data with **the counts clickable to get the actual
list**. The counts already existed; what didn't was any way to find out *which* 39 shops.

**The counts and the list used to come from different slices of the same data, and that was
the real problem.** The API returned `nearest: all.slice(0, 18)` — a capped preview across
*all* categories — beside counts computed from the full set. In Mong Kok that meant a "39
shops" badge above a list that could only ever account for a handful of them. Capping was a
deliberate decision ("this sits inside a report, not a directory listing") and it was right
while the number was not clickable; **a count you can click has to be able to show what it
counted**, so the endpoint now returns `items`: every match, nearest first.

**The count is `items.filter(kind).length`.** Not a parallel number — the same "one
function, not two guesses" rule the Property Finder's yield follows, applied to a count.
That is the property that makes this safe to make clickable, and it is checked rather than
asserted: a test compared all seven counts against the length of the list each one opens
(29/29 schools, 39/39 shops, 31/31 premium, 38/38 green space, 28/28 building work …) and
confirmed in a browser that the badge saying 39 opens a list of exactly 39 rows.

**A cached payload needed a version, and this is the hazard that made it non-obvious.**
Rows were already cached carrying only the old capped `nearest`. Serving one of those to the
new UI would have shown **an empty list next to a non-zero count** — a number contradicting
itself, the same "confidently wrong" shape as the `numberOfRooms` and zero-sentinel bugs in
the importer. `NEIGHBOURHOOD_PAYLOAD_VERSION` is stored in the payload and a mismatch is
treated as a **miss**, on the hit path *and* the stale-fallback path. **Stale data and a
stale schema are not the same thing**: 30-day-old amenities are fine, a 30-day-old shape is
a bug. The 23 old-shape rows were deleted rather than left to be refetched one by one, since
they could never be served.

**Verified in a real browser at both viewports**, by rendering the panel through a temporary
harness page rather than creating throwaway accounts in the production auth database (the
report itself is login-gated) — harness deleted afterwards. One list open at a time, the
count keyboard-reachable and toggling `aria-expanded`, a zero count deliberately *not* a
button (a control that opens an empty list is a dead end), the list scrolling in its own box
so a 39-row category doesn't push the report off screen, and no horizontal overflow at
390px.

Two things the browser caught that reading the markup would not have: the two-line labels
("Premium retail", "Under construction") pushed their numbers out of alignment with the rest
of the row, and **"UNDER CONSTRUCTION" overflowed its own tile border** at seven columns.
Hence `KIND_TILE_LABEL`, a shorter set used only in the tiles, and a `min-h` on the label so
one-line and two-line labels reserve the same space. `RADIUS_M` is duplicated client-side to
label the drill-down ("Shops within 600 m") — a knowing duplication of display copy, noted
in the code, rather than pulling the compiled server bundle into a client component.

**Left alone: the score reads 100/100 here.** Mong Kok is the point the targets were
calibrated against (see the table in `neighbourhood-panel.tsx`), so saturating there is the
intended top of the range, not a regression.

## The report stopped opening on an alarm, and /analyse shows your own data (13/08/2026)

Two requests, both about what a reader meets on `/analyse`.

**1. "See the full report" landed on "1 issue could sink this deal. Read them before you
commit."** Two causes, and only fixing one would have left it happening:

- *The scroll.* The effect that brings the report into view fired in the same tick as
  `VerdictView`'s first paint, so a **smooth** scroll animated toward a target whose height
  was still settling (star rating, then a four-cell stats grid). It finished below the
  report heading. Deferred one `requestAnimationFrame`, so the offset is measured against a
  laid-out report — verified in a browser: the heading now sits 121px from the viewport top,
  comfortably in view.
- *The banner itself.* A full-width red block sat above the findings, saying in advance what
  the findings say. **Removed, not silenced**: it is now the subtitle of the "What to watch"
  list it was describing — where a reader is already looking to find out *which* issue.
  Every critical still carries its own red badge in that list, and `rateVerdict` still docks
  a full star per critical, so the warning survives three times over without shouting before
  the numbers have been read.

The live-preview rail carried the same sentence in different words ("could sink this deal —
they are named in the report"). **Reworded to match**, on the reasoning that removing the
phrase from the report and leaving an identical alarm on the same page would have made the
change cosmetic. *(`apps/mobile` still has the original wording. Left alone: it is a separate
surface with no full-report flow yet, and nothing here was exercised against it.)*

**2. `/analyse` now shows the reader's saved reports, with a real empty state.** What was
there was one sentence — "Welcome back — continue with *most recent*" — carrying no figures,
and rendering nothing at all if you had never saved anything. `components/saved-reports.tsx`
lists the four most recent with price, area, saved date and stored net yield (coloured by the
same `gradeNetYield` bands as the finder chips and map pins, so a colour means one thing
everywhere), and an explicit **"No saved reports yet"** panel otherwise that says where the
Save button is.

What carried over from the line it replaced, deliberately: **offered, never auto-loaded** —
silently swapping a blank form for a saved property's numbers is a bigger surprise than a
form that stays blank — and the plain `<a>` rather than `next/link`, because
`/analyse → /analyse?property=…` is a same-route navigation and the loader runs on mount
only. The old fetch effect on the page was deleted rather than left beside the new one; two
components requesting the same list on every visit is the kind of duplicate nobody notices
until it doubles again.

It renders nothing when Supabase is unconfigured or nobody is signed in (no account system
means no data to be empty *of*), and a failed fetch is silent — this is a convenience shelf
above a form that works without it, and an error banner would make a working page look
broken. It is hidden once a report is on screen, for the reason the old line hid itself: a
shelf of *other* properties competes with the one just asked for. `/portfolio` is still where
these are managed; both read the same two endpoints, so they cannot disagree.

**Verified end-to-end in a browser** — empty state, submit, landing position, save, populated
state — against a throwaway account created for the purpose and **deleted afterwards along
with its properties, verdicts and profile row**, leaving only the real account. Worth noting
for next time: creating it consumed the Supabase free tier's signup-email quota, and a second
address hit `over_email_send_rate_limit` immediately, exactly as the *Live infrastructure*
section warns.

## Icons in the report — a set in a file, and the photo that isn't there (13/08/2026)

Asked for a better report design "with icons and images, throughout the app".

**The icon system already existed; nobody had put it in a file.** No icon dependency, and
nineteen inline `<svg>` blocks in `app-shell.tsx` alone plus one-offs across seven other
components — every one 24×24, `fill="none"`, `stroke="currentColor"`, round caps. That is a
house style being retyped. `components/icons.tsx` is that style written down: stroked
outlines only (so an icon inherits text colour and reads at 14px and at 32px), no
width/height (the caller sizes it), `aria-hidden` by default because every one of these sits
beside its own text label and an icon that repeats the adjacent word is noise to a screen
reader.

**No icon package.** It would ship a few thousand glyphs to render the two dozen used here,
and none of them would match the sidebar's existing drawing.

Where they went: the four headline metrics (keyed **by label, not by index**, so reordering
`headlineStats` can't pair "Payback" with a percent sign, and an unknown label renders with
no icon rather than a wrong one), the two cost tables, "What to watch", the seven
neighbourhood categories and the mixed closest-ten list, the saved-reports shelf and the
portfolio card (same building mark in both, so a saved property looks like one object
wherever it appears).

**Severity is now shape *and* colour, which is the accessibility point.** A finding leads
with its icon in a tinted disc and the card carries a left edge in the same colour — but the
`Deal risk` / `Check this` / `Note` pill stays. `severityColor` is red/amber/grey, and
roughly one man in twelve cannot separate the first two; a triangle, a circle and an `i`
differ by shape regardless. Colour, shape and words all say the same thing, so no reader
depends on the channel they happen to lack.

**One collision, caught by checking rather than by assuming.** `app-shell.tsx` already
exports a dozen navigation glyphs; a `SearchIcon` was about to exist twice. Resolved by not
adding a second one. The split is now by purpose — those name *destinations*, `icons.tsx`
names *things inside a report* — and the rule is simply that no glyph exists in both files.
Moving the nav icons across would touch every page for no visible change, so it was not
bundled into a design pass. (Same pass: `/dashboard` gave `/analyse` and `/finder` the same
magnifier, which made the primary action look like a second search box. `/analyse` is a
document now.)

**Images: deliberately not in the report, and this is a product rule, not a shortcut.** The
report is about *the reader's own flat*, for which we have no photograph. A stock Hong Kong
interior or a shot of a real tower placed beside their figures would read as a picture of
that property — which is the same false claim this file already refuses in two other places:
fabricated listings carry **no photo of an identifiable Hong Kong building**, and the hero
photo was chosen partly because using an unrelated city's skyline as "atmosphere" would
contradict the product's own promise never to invent a plausible-looking number. A fake
photograph is that same lie in another medium. So the report gets **iconography**, which
labels categories the product already names, and no photography. The places imagery is
legitimate — the CC0 interiors on the fabricated finder listings, the credited CC BY hero —
already have it.

**Verified in a browser at 1280px and 390px** through a temporary harness that renders
`VerdictView` against a real `computeVerdict` result, since the report is login-gated and
the free tier's signup-email quota was exhausted by the previous session's test account —
harness deleted afterwards. 23 icons render, no console errors, no horizontal overflow at
either width. The screenshots also caught a layout flaw unrelated to icons: the two cost
tables stretched to equal height, leaving an empty panel under the shorter one. `items-start`.

## The neighbourhood list, on a map (13/08/2026)

Asked to show the listed places on a map. The counts answered *how well served is this
area*, the drill-down answered *by what* — neither answered **"in which direction, and is it
all on one side?"**, which is the question a straight-line distance most obviously raises.
Two flats can each have "12 shops within 600 m" and be completely different places: one
ringed, one with everything across a motorway.

**The coordinates were already there and were being thrown away.** `metres` is computed from
each item's own lat/lng in `neighbourhood.ts`, and the pair was discarded immediately after.
This is mostly the API keeping what it already had — payload **version 3**, because a cached
v2 row would have fed the map a list of places with no positions: an empty map beside a list
of 39 shops, the same self-contradiction the v2 bump existed to prevent. Two stale rows
deleted rather than left to be refetched one at a time.

**What the drawing claims, and what it refuses to.** The shaded ring is the *actual* search
radius for the open category — 600 m for shops, 900 m for transport — not a decorative
circle; drawing one ring while the pins obeyed a different bound would misstate the query.
Distances stay straight-line, and the caption says so on the map itself, because a pin 300 m
away can be a longer walk around a podium. Pins for anything mapped as an area are OSM
`center` points, so a school sits in the middle of its campus rather than at its gate.

**The map shows exactly the rows the list shows** — one category when a count is expanded,
the closest ten otherwise. Feeding it a fuller set would put pins on screen with nothing to
click back to, and would reopen the count/list disagreement the drill-down was built to
close. Hovering a row lifts its pin; the list's row icons are tinted to their pin colours, so
the two read as one object.

**Pin colours are categorical, not the status palette.** `standingColor`'s red/amber/green
means *good, fair, weak* everywhere else in this product, and a red pin for "health" would
import that meaning onto a category where it is nonsense — a hospital is not a bad outcome.
Same reasoning the finder's heat-map dropdown already uses when it switches to a sequential
ramp for price per square foot.

**`useMapsLibrary`, not the global `google`.** Needed for `LatLngBounds` in the fit-to-bounds
effect, and this file's own note on the 2024 codebase is the reason: reaching for that global
"works right until a slow network, a failure that appears for users and never for
developers." It is also the honest type — the constructor does not exist until the library
loads.

**A limitation that is visible and only mitigated.** Advanced Markers require a `mapId`, and
a `mapId` makes Google prefer Cloud-console styling over the inline `MAP_STYLE` array — so
**Google's own POI icons show through and cannot be switched off here**. Already noted
against `ImportedListingMap`, but it bites harder on a map *about nearby places*, since
Google's labelled teardrops are also nearby places and could be read as ours. Screenshots
caught it: at first draw our 10 px flat dots lost the contest outright. Mitigated three ways —
pins ringed in white with a shadow so they sit above the basemap, a legend naming every
colour, and the fit-to-bounds zoom capped one step below maximum, where POI labels are
densest. A real fix needs a Cloud Console map style this project does not have.

Verified at 1280 px and 390 px through a temporary harness (the report is login-gated),
harness deleted: 204 items all carrying coordinates, none outside Hong Kong, no console
errors, no horizontal overflow.

## Transport was catching ~5% of what OSM holds (13/08/2026)

Asked, about the full report: *"for the transport I noticed it's missing some Bus, Tram. Did
you get all the data?"* **No — and the gap was far bigger than "some".**

The query asked for `railway=station`, `station=subway` and `amenity=bus_station`. That last
one is a **terminus or interchange, not a stop**, and mistaking it for "buses are covered" is
how this survived. Measured against Overpass at 900m:

| Area | reported | actually mapped | missing |
|---|---|---|---|
| Central | 15 | **331 raw / 128 deduped** | 299 bus stops, 15 tram stops, 2 ferry piers, 2 halts |
| Mong Kok | 15 | **329 / 105** | 317 bus stops |
| Causeway Bay | 6 | **274 / 87** | 248 bus stops, 22 tram stops |

So roughly **5%**, and the two modes a Hong Kong reader notices first — buses and the trams
— were absent entirely. Ferry piers too, which in a harbour city is not a rounding error.
Now queried: `highway=bus_stop`, `railway=tram_stop`, `amenity=ferry_terminal`,
`railway=halt`, each with its own subtype so the drill-down names the mode.

**Split into two kinds rather than one count, because one number would have hidden the useful
fact.** Bus stops are near-universal here and dominate any total, tracking *density* more than
connectivity — while "no rail station at all", true of Ap Lei Chau, is the single most
decision-relevant transport fact for an investor and was invisible in a lump sum. Tiles now
read **Rail, tram, ferry** and **Bus stops** separately, and eight tiles moved the grid from
seven columns to two rows of four (eight in a seven-column grid orphans the last one).

**Bus stops use a 500m radius, not 900m.** A rail station 900m away is still your station —
you will walk it for a fast fixed link. A bus stop 900m away is not; you would walk to a
nearer one. It also keeps the count sane: Mong Kok returns 98 bus stops at 900m against 47 at
500m.

**The score had to be recalibrated, and this fixed a separate known problem.** A target of 10
had been set against a badly undercounted transport number, which is why Mong Kok, Central and
Tuen Mun all scored full marks for transport and Mong Kok reached **100/100** overall — the
"full marks for most of urban Hong Kong discriminates nothing" failure this file already
warned about, still present. Re-measured with the app's own radii and dedupe rule:

| Area | transport (900m) | bus (500m) |
|---|---|---|
| Central | 27 | 48 |
| Causeway Bay | 22 | 37 |
| Taikoo Shing | 14 | 15 |
| Tuen Mun | 12 | 19 |
| Mong Kok | 10 | 47 |
| Ap Lei Chau | 7 | 16 |

Transport's 25 points are **split 18 / 7**, not added to, so the weights still sum to 100 and
no other category was silently re-weighted. Buses take the smaller share deliberately, per the
density argument above. Resulting transport component: Central 25, Causeway Bay 23, Mong Kok
14, Taikoo 13, Tuen Mun 12, Ap Lei Chau 8 — a real spread. **Central now scores 85/100 rather
than 100**, and "9 schools of 22" is visibly discriminating rather than saturated.

**Payload version 4**, because a v3 row would keep serving the 5% answer. Three stale rows
deleted.

**The default list had to change too.** It was "closest ten, all categories" — which breaks
the moment bus stops exist, since the ten closest things to any urban address become nine bus
stops and a 7-Eleven, burying the station and school that are the point. It is now **the
nearest of each kind**: one row per category, answering "what is my nearest school, and how
far" and immune to whichever category happens to be densest.

Verified against the live endpoint: Central returns 27 transport (5 subway, 11 tram, 7 bus
termini, 2 halts, 1 ferry pier, 1 station) and 48 bus stops, **none beyond the 500m radius**,
matching the calibration exactly. UI checked in a browser through a temporary harness, deleted
after.

**Still not covered, and worth knowing:** minibuses (green/red PLB) are only partly mapped in
OSM and often tagged as ordinary bus stops; the MTR light rail is tagged inconsistently as
both `railway=station` and `railway=tram_stop`, which is the Tuen Mun inflation artifact noted
against `WEIGHTS`; and `public_transport=platform`/`stop_position` — the newer scheme — is not
queried, so a stop mapped *only* that way is still missed. Coverage remains
contributor-maintained, and the panel still says so.

## /analyse starts blank, and remembers your last search (13–14/08/2026)

Asked to reset all the data on `/analyse` and show the last search instead.

**What was there was a worked example presented as your property.** `INITIAL_DRAFT` filled the
form with "Flat in Tai Koo", HK$8,000,000, HK$18,000 rent, 500 sqft and a HK$4,000,000
mortgage. Three problems, and the third is the one that mattered: every figure was invented in
fields labelled as the reader's own; `transactionDate` was hardcoded to a fixed day that had
already gone stale, so the **stamp-duty rule set was chosen by a date nobody picked**; and a
prefilled form produces a **complete, plausible report before anyone types anything** — a
1.78% net yield for a flat that does not exist. Everywhere else this product refuses to show a
number it cannot source; the landing state of its main tool was doing exactly that.

**`EMPTY_DRAFT` blanks facts, keeps rate assumptions.** Blank: label, price, rent, area, loan
and every cash cost — nobody can guess these, and a guess is the invented-figure problem again.
Kept: 4% vacancy, 3% interest, 25-year term, owner pays rates, permanent resident. Those are
not claims about *this* property, they are the conventions the engine needs to compute
anything, they are all editable, and the report already names each one in "What to watch" —
the "No vacancy assumed" finding exists precisely to flag one. **Zeroing them would be the
opposite failure: a 0% vacancy rate is *wrong*, not empty.**

**Zero means two different things in this form**, which is why blank-at-zero is opt-in rather
than global. For money and area, `0` means "not entered" and the box renders empty (`Number("")`
is 0, so clearing round-trips for free). For a *rate*, `0` can be a deliberate choice the engine
raises a finding about, so those still show their value.

`transactionDate` is filled with today's Hong Kong date **in a mount effect, not at module
scope** — this is a client component that Next.js also server-renders, and a server in UTC
against a browser in Hong Kong can disagree about what day it is. It only fills a blank field,
so it can never overwrite a date from a saved property, an import or a restored search.

**"Last search" is localStorage, and is a different thing from the saved-reports shelf.**
`SavedReports` lists properties deliberately saved to a portfolio — account, database, an
explicit click. This is the other half: the search someone ran and *didn't* save, which was
simply lost on navigation. That is the common case, since the preview needs no account. It has
to work without one (rules out `properties`) and survive a reload (rules out React state and
`sessionStorage`). It never leaves the device, and the card says so.

**Recorded when a report is *asked for*, not when one succeeds** — the first version did the
latter, which quietly meant the feature only ever worked for someone already logged in: the
report is gated, so an anonymous reader's submit redirects to `/login` and never reaches the
success path. They are the reader who needs it most, having no portfolio either. The yield on
the card is **recomputed** through the same `computeVerdict`, never stored beside the draft — a
cached figure could disagree with what restoring actually produces, and rules are versioned by
transaction date.

**A bug the browser caught:** after a gated submit, returning to `/analyse` restores those
figures from the OAuth stash — so the card offered "your last search" directly above a form
already holding it, with a Restore button that would have done nothing visible. Suppressed when
the stash key is present; the last-search effect is declared before the stash effect, so the key
is still there to check.

`property-finder.tsx` spread `INITIAL_DRAFT` and its comment claimed the two shared one
assumption set. **Its yields did not move**, because `listingToDraft` sets every money field
explicitly and only ever inherited the buyer booleans and the unused financing rates — but the
comment was corrected rather than left asserting something no longer true.

Verified in a browser across two tabs of one context: blank form with today's date and no
phantom preview, gated submit records the search, a fresh tab offers it with a recomputed
yield, Restore fills the form exactly, Discard clears storage, and the duplicate case is
suppressed.

## Estimating a rent when the listing has none (14/08/2026)

Reported from a real Centaline import: a for-sale listing gives a price and an area but **no
rent**, and the report showed a **0.00% net yield**. Arithmetically correct and completely
misleading — in the same red the engine uses for a genuinely bad deal, it reads as a *finding
about the property* rather than a missing input.

**Two separate fixes, and the first one matters on its own.** The rail now shows **—** for net
yield, cash-on-cash and payback whenever the rent is zero, with a line saying a yield needs a
rent. Stamp duty and cash-to-acquire stay visible: they do not depend on rent, they were
correct all along, and blanking the whole rail would throw away right answers to punish a
missing one.

### Where the estimate comes from, and why not "comparable flats nearby"

The natural request — average the rents of similar homes in the area — needs a rental listings
database Hong Kong does not give away. The Land Registry publishes **no rents at all** and
sells transactions one at a time at HK$10 with no bulk option; Centaline and Midland hold the
de-facto rental datasets, and this project has repeatedly declined to scrape them (see the
listing-importer sections — that line held again here). Building comparables on data we do not
have would mean inventing the comparables.

**RVD publishes the answer directly, and it was already in the repo.** The Rating and Valuation
Department computes market *yields* for private domestic property monthly, by Class, from its
own rent and price records — ingested as `RVD_YIELDS_BY_CLASS` since 09/08/2026 and, until now,
only ever drawn as a chart. Yield relates rent to price, which is exactly the conversion
needed:

    monthly rent ≈ price × (gross yield ÷ 100) ÷ 12

`estimateMonthlyRent()` lives beside the data in `rvd-real.ts`. **The area is not optional**:
RVD's Classes are size bands in square metres, and a 400 sqft studio and a 1,600 sqft flat at
the same price sit in different Classes with yields more than a point apart. With no area it
returns `null` and the UI asks for one rather than guessing at the middle of the range. It also
walks the series **backwards** to the last month RVD actually published, because those arrays
keep `null` holes where RVD reported nothing (fewer than 20 transactions) rather than
interpolating — Class E goes quiet for months at a time.

Verified against the reported listing: HK$12,980,000 / 692 sqft → 64.3 m² → **Class B, 3.0%
(2026-06) → ≈ HK$32,500/month**, giving a 2.32% net yield in place of 0.00%.

### The honesty conditions attached to it

- **The offer shows its whole derivation** — Class, yield, month — so the number can be argued
  with. Same condition the area score and the star rating live under.
- **It fills the field, never submits**, and it is offered only when there is a price and an
  area but no rent.
- **The report says the rent is an estimate**, not just the field. That banner is on the screen
  someone acts on, and the engine has no idea the figure was derived rather than observed.
- **The flag is page state, not `Draft`** — `Draft` is the API contract and would reject an
  unknown field, and more to the point this is a fact about where a number came from in this
  session, not about the property. Editing the rent, price or area clears it.
- **It is territory-wide for a size band, not a valuation.** RVD publishes no per-district
  domestic series, so a flat on the Peak and one in Tuen Mun of the same size share this
  number. Said in the UI, twice.

## Working conventions
- Dates DD/MM/YYYY. Currency: **HKD** for Hong Kong, **VND** for Vietnam, **EUR** for
  France — always state which, never a bare number. Keep a single reporting currency
  for cross-market comparisons and label it.
- English for product and code. Cantonese/Traditional Chinese matters for the HK
  market, Vietnamese for phase two, French for phase three — treat i18n and
  multi-currency as phase-one design constraints, not retrofits. Three markets on
  three currencies and three languages is a schema decision, not a translation task.
- Stack: the workspace default (Next.js + Supabase + Hono/Zod + Expo). Mobile-native
  and geo search put this at **Tier 3** in the boilerplate's taxonomy — PostGIS geo
  queries, faceted search, Expo app. Don't scaffold Tier 4 (always-on Docker
  service) unless a live data feed forces it.

## Open questions — resolve before building features
1. **~~Data supply.~~** *Settled for Hong Kong — see the data-landscape section, which
   replaces this question with findings. The France-first alternative is dropped; see
   « Hong Kong only ». The remaining live item is the Centaline open-data licence, below.*
2. **What the AI actually does.** The user-fed model narrows this usefully. The natural
   fits are the ones that need *no* proprietary dataset: **extracting the property's
   figures from what the user uploads** (listing, lease, tax bill, mortgage offer) so
   they don't type them in, **sanity-checking their inputs** against market ranges, and
   **explaining the verdict** — especially the "potential problems", which is judgement
   over public rules rather than statistics. Dynamic pricing and comp selection need data
   we don't have; defer them.
3. **Daily use is not automatic, and it's the weakest link.** Evaluating a property is
   episodic — someone buys a flat every few years, not every morning. The plausible
   bridge is that the properties a user enters become a **tracked portfolio** that Veela
   monitors against RVD indices, tax changes and market movements, so there's something
   new to see. Decide this early: it's a data-model decision (properties are persistent
   monitored objects, not throwaway calculator inputs), not a feature to bolt on later.
4. **Who pays, and how much — and the narrowing makes this sharper, not easier.**
   Subscription like Mashvisor, or transaction-linked? **Hong Kong investor volume is far
   smaller than the US, and it is now the whole addressable market**, not the first slice
   of three. A price that works on French volumes is no longer a fallback. Against that:
   HK investors are wealthy, the ticket sizes are large, and the HK$10 Land Registry
   lookup gives a natural pay-per-use action. **This is now the question most likely to
   decide whether the venture works.**
5. **Regulatory — mostly answered 09/08/2026, two pieces left.** The PDPO half is built:
   `/privacy` carries a Personal Information Collection Statement (purpose, classes,
   transferees, retention, DPP6 access route), linked from `/login` and the footer, and
   the aggregate-data consent is now asked **at the first save** rather than only sitting
   in `/account` — because DPP1 wants notice at or before collection, and the file's own
   warning was that retrofitting consent is impossible. **What's left: `/privacy` names no
   operator** (placeholder until the invoicing entity is settled) and there is no
   self-serve export/delete, only a mailto. *(The PDPO is not RGPD-equivalent; do not
   assume a European consent flow satisfies it, nor the reverse.)*

   **Still untouched: the Estate Agents Ordinance (Cap. 511).** It doesn't bite today —
   Veela analyses, it doesn't introduce parties to a transaction. Two plausible
   monetisation routes would engage it directly: referral fees from agents, and selling
   qualified investor leads. Check the licensing position *before* building either, the
   way Cap. 349 was checked before the STR features weren't built.

## Map-first discovery + supply & demand history

Search happens **on a map**, not in a form. Tap a district, an estate or a building and
get its **supply and demand history** — then drill into a specific unit, where the
user-fed figures produce the verdict. The map is built from public aggregates; the verdict
comes from user input. Clean separation, and each half is buildable independently.

This is also the best answer to the daily-use problem: aggregates refresh monthly, so the
map genuinely changes. A calculator doesn't.

### Measuring supply and demand from data we can actually get

| Signal | Indicator | Source |
|---|---|---|
| **Supply** | Stock, completions, **vacancy rates**, take-up — by class and district | [RVD Hong Kong Property Review](https://www.rvd.gov.hk/en/publications/hkpr.html), annual, Excel |
| **Supply** | 1.19 M unit stock with building age, area, **turnover rates** | Centaline open data |
| **Demand** | Monthly **transaction volume and value** of S&P agreements | [Land Registry statistics](https://www.landreg.gov.hk/en/monthly/agreement.htm), free |
| **Demand** | Rent and price indices — rising rents signal demand pressure | RVD, monthly, back to 1979/1982 |
| **Fundamentals** | Population and household counts by district | Census and Statistics Department |

Vacancy against transaction volume, over a long series, is a defensible supply/demand
read. None of it costs anything.

### Geospatial assets — available and free
The [Lands Department open geospatial data](https://www.landsd.gov.hk/en/spatial-data/open-data.html)
(via `data.gov.hk` and the CSDI Portal) publishes **building footprints with building
names, types and heights**, free to re-use, downloadable and API-accessible. That's better
than expected: the map can render individual buildings, not just district polygons.

### The real difficulty: joining the layers
Granularity differs at every level, and this is the engineering problem to solve first:

- Lands Department footprints are **per building**
- RVD aggregates are per **Class (A–E) and district**
- Centaline aggregates are per **estate / Housing Market Area**
- The user's data is for **one unit**

So a building polygon must be joined to an estate name to an RVD class. Building names are
the natural key, and they will be messy — Chinese/English variants, redevelopments,
estates spanning many towers. **Be honest in the UI about which level a number comes
from**: showing a district vacancy rate on a single building implies precision we don't
have, and that's exactly how a data product loses credibility with investors.

Phase one: choropleth at district level, drill to estate, then user-fed for the unit.
Building-level aggregates only where the join is genuinely reliable.

## The map runs on Google Maps — and it is symbols, not a choropleth

`@vis.gl/react-google-maps`, Google's own React wrapper. Real coastline, real streets,
real place names, in place of the eighteen seeded ellipses the fixtures generate.

**The form changed with the basemap, and that was forced rather than chosen.** A
choropleth needs polygons and we have none: Lands Department geometry is not ingested,
and the schematic blobs are explicitly *not* a coastline. Painting invented outlines on
top of a **real** map would be the worst available combination — the basemap lends
authority to shapes that are fiction, and nothing on screen tells the reader which half
is which.

So it is a **proportional symbol** map: one circle per district, at its real centre.
That is the correct form for values located at points with no areas, not a degraded
choropleth. Two details that follow from it:

- **Circle _area_ carries the value, not the radius.** Area is what the eye compares;
  scaling the radius by the value exaggerates the large districts by the square.
- **Colour repeats what size already says.** Redundant on purpose — it keeps the map
  readable in greyscale and to a colour-blind reader, and here it costs nothing.

Real coordinates live in `packages/fixtures/src/geo.ts`, **the only non-synthetic file in
a package of invented data** — kept separate so nobody has to guess which half is real.
They are centroids to a few hundred metres: fine for placing a symbol, useless for an
edge. `isPlausibleHongKong()` rejects anything outside the territory's bounding box,
because a transcription error puts a marker in the South China Sea and that looks like
data rather than a bug.

**Boundaries, when they matter:** Google's *data-driven styling for boundaries* serves
administrative polygons with no geometry to host — verify it reaches Hong Kong's district
level before depending on it. Otherwise Lands Department open data, which is
authoritative and ours.

### The key, and why the app still runs without one

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. **Public by necessity** — a browser map key is visible
to anyone with dev tools, which is why Google's guidance is to *restrict it by HTTP
referrer*, not to hide it. **Restrict it before shipping.** It needs a billing account.

Without a key the map falls back to the schematic outlines and **says so on the page**,
naming the variable. That preserves the promise the rest of the codebase makes: it runs
with zero configuration. A map that hard-failed on a missing key would break the same
principle that keeps `POST /verdict/preview` working with none.

**One thing not to copy from the 2024 codebase:** it reached for the global `google`
object directly. That works right until a slow network, a failure that appears for users
and never for developers. `useMapsLibrary()` resolves only once the library is genuinely
loaded.

## Hong Kong data landscape — researched 30/07/2026

### The finding that changes the product
**Short-term letting is a criminal offence in Hong Kong without a licence.** Under the
[Hotel and Guesthouse Accommodation Ordinance (Cap. 349)](https://clic.org.hk/en/topics/landlord_tenant/thingsYouNeedToNote/convert_or_use_property_to_grant_short-term_leases),
any letting under **28 consecutive days** requires a hotel/guesthouse licence. Operating
unlicensed carries fines up to **HK$200,000 and two years' imprisonment**, and the Home
Affairs Department runs a team dedicated to finding unlicensed listings online.

Consequence: Mashvisor's Airbnb calculator, short-vs-long-term comparison and dynamic
pricing — a large share of their product — **have no legal market here.** Veela in Hong
Kong is a **long-term rental yield** product, not an STR arbitrage product. Do not port
that half of the feature set.

### Official sources

| Source | What it gives | Granularity | Cost |
|---|---|---|---|
| [RVD property market statistics](https://www.rvd.gov.hk/en/publications/property_market_statistics.html) | Price **and rental** indices, average prices/rents, market yields; domestic by Class, offices by Grade and District; plus "Price Indices for Selected Popular Developments". Series from 1979/1982, monthly, `.xls` | Aggregated | **Free** |
| [Land Registry search](https://www.landreg.gov.hk/en/services/search_fee.htm) | Actual transaction records per property | Transaction-level | **HK$10 per memorial**, no bulk option |
| [MMIM subscription](https://www.landreg.gov.hk/en/services/services_b_8.htm) | Monthly memorial file: instrument, lot, address, consideration, mortgagee | Transaction-level but **mortgages only, not sale & purchase** | HK$1,070 setup + **HK$5,500/month**, 6–12 month commitment |
| [Statistics of Agreements for Sale and Purchase](https://www.landreg.gov.hk/en/monthly/agreement.htm) | Counts and values of S&P agreements | Aggregated only | Free |

**There is no bulk sale-and-purchase dataset.** The Land Registry sells mortgage memorials
in bulk but not sales; sale prices are reachable only one property at a time at HK$10.
This is the structural difference from France's DVF.

### Private sources
- **[Centadata](https://hk.centanet.com/findproperty/en/centadata)** (Centaline) and
  **[Midland transaction history](https://www.midland.com.hk/en/transaction-history)**
  are the market's de-facto transaction databases — transaction-level, per estate, with
  price/sqft and history, free to browse. **No official API**: the existence of an
  [unofficial scraper](https://github.com/mkyung/Centadata-api) on GitHub is the evidence.
  Scraping carries ToS and legal exposure — licensing is the defensible route.
- **[Centaline Property Market Big Data](https://hk.centanet.com/opendata2019/en/)**
  (`hkdata.centanet.com`) is the most promising lead found: a 1.19 M private-residential
  unit stock database with building age, area and turnover rates, and **~1.4 M private
  residential transactions from 1995 onwards including saleable area**. Downloadable,
  attribution required. Published aggregated by Housing Market Area and estate.
  **Terms, cost and true granularity are NOT yet verified** — this is the single highest-value
  thing left to check.
- `data.gov.hk` could not be enumerated (JavaScript-rendered listings); check the Housing
  and Development categories by hand.

### What this implies, given the user-fed model
The user-fed approach and these findings fit together well — the data we *can* get for
free is exactly the data the model needs.

1. **RVD is the backbone, not a fallback.** It's free, monthly, goes back to 1979, and
   uniquely gives **rents as well as prices** by Class, district and selected
   developments. That covers "market growth", "compare with history" and the
   competing-stock benchmark for a user's property. France's DVF has better transaction
   detail but *no rents* — so for a yield product, Hong Kong's free data is arguably the
   better starting point.
2. **Population and demographics** come from the Census and Statistics Department; the
   2016 by-census is also redistributed in Centaline's open data.
3. **The HK$10 Land Registry search becomes a premium action, not a data bill.** Trigger
   it when a user wants verified history on the specific property they're evaluating. The
   fee is cost-of-goods on something they asked for. At our scale this economics beats
   Mashvisor's — they had to buy nationwide coverage up front.
4. **Licensing Centaline or Midland is deferred, not required.** It only becomes necessary
   for precomputed comparables at scale. Don't let it block phase one.
5. **No STR features for Hong Kong**, per the licensing law above.

### Where the real difficulty now sits
Not data — **tax and rules modelling per jurisdiction**, which is what the verdict hangs on:
- **Hong Kong**: stamp duty (ad valorem, and the buyer-side/resale surcharges that apply
  to non-permanent residents and additional properties), Property Tax, Rates, Government
  rent. Rules have changed repeatedly — model them as versioned, dated rules, never as
  hardcoded constants.
- **France**: IR vs LMNP vs SCI, plus-value with holding-period abatements, taxe foncière,
  IFI. `paperasse-entreprise` and `paperasse-patrimoine` in this workspace already hold
  French accounting and property-law skills — reuse rather than re-derive.
- **Vietnam**: unresearched.

Treat the tax engine as the core IP. It is the part a competitor can't scrape.

## Two traps in this monorepo that cost an afternoon

Both were hit on 02/08/2026 — and the first one was hit **again** on 03/08/2026, by the
same person, with this very warning already written below. Knowing a trap exists did not
stop it: the token edit and the dist rebuild happened in the same breath and *felt* done,
and the still-running dev server's cached module graph was invisible until someone
actually diffed the served CSS against what was expected. **The only real fix is the
verification step, not the memory of the warning** — check the served output, every time,
after every token change, regardless of how sure it feels.

### `@veela/ui` is consumed as `dist/`, not as source

`packages/ui/package.json` exports `./dist/index.js`, and `tailwind.config.ts` imports
`tokens` from it. **Editing `packages/ui/src/index.ts` therefore changes nothing** — not
the dev server, not `next build`, not `tsc`. Everything compiles, every check passes, and
the colours stay exactly as they were.

    pnpm --filter @veela/ui build      # after ANY token change
    # then restart next dev — it caches the resolved module

That is the worst shape a bug can take: **a silent no-op behind a green build.** A whole
palette change appeared to succeed and did not reach a single pixel.

### Never run `next build` while `next dev` is running

They share `apps/web/.next`. The production build replaces the dev server's compiled
assets, and the dev server then serves HTML pointing at a stylesheet that no longer
exists — **the page renders with no CSS at all**, and the dev log stays empty because
nothing crashed.

If it happens: stop the dev server, `rm -rf apps/web/.next`, restart. Verify by fetching
the `<link rel="stylesheet">` href directly and checking it is 200, not 404 — the page
itself still returns 200, so a status check on the page alone will not catch it.

## The codebase — built 30/07/2026

Tier 3 monorepo, Turborepo + pnpm workspaces. See [README.md](../README.md) for how to
run it. The layout follows the boilerplate taxonomy exactly.

`packages/core` is the tax and yield engine and the only part with no dependencies —
**23 tests, no database needed**, so it can be exercised immediately. The AVD table is
transcribed verbatim from the IRD and the tests assert continuity at every marginal-relief
band boundary, which is what proves the transcription is correct rather than merely
plausible. Rules are selected by transaction date; suspended duties (BSD/SSD/NRSD) are
modelled rather than deleted.

Money is integer minor units from the form through to the database. Verdicts are stored
as dated snapshots, not a cache, because tax rules change and a user needs to see the
figures their decision was based on.

Deliberately not built yet, and the order that matters:
1. **Data ingestion — partly done 09/08/2026, see "Real data" below.** Real RVD and
   Census figures are in the database for five metrics; Lands Department geometry and a
   per-district transaction series are still missing, so the map still has no real
   boundaries and the finder still has no real listings.
2. **Supabase Auth on mobile** — the web flow is live; `apps/mobile` has none of it yet.
3. **Vietnam and France rule sets** — only Hong Kong is modelled; the API returns a clear
   400 for the others rather than guessing. France should reuse this workspace's
   `paperasse-*` plugins rather than re-deriving the rules.

## Real data — what is now genuinely measured (09/08/2026)

Until this date **every figure in the product except district centroids was synthetic**,
and the demo banners said so. Two real sources are now ingested. The banners stay
wherever they are still true, which is most places.

**In the database** (`market_observations`, 90 rows, each carrying its `source`):

| Metric | Source | Grain |
|---|---|---|
| Population, households | Census 2021 (`DC_21C.xlsx`) | 18 districts |
| Stock, completions, vacancy rate | RVD `Dom_Stock_Completions_and_Vacancy_by_District_Eng.csv` (data.gov.hk) | 18 districts, 2024 |

**In the app** (`packages/fixtures/src/rvd-real.ts`, the second non-synthetic file after
`geo.ts`): RVD's private domestic **price and rental indices**, All Classes, monthly,
1993→present, parsed verbatim from `his_data_3/4.xls`. `/research/market-performance`
leads with these and labels the per-district charts below them as synthetic.

**What is still synthetic, and why it wasn't faked:** price/rent indices *by district*
and transaction counts *by district*. RVD publishes both only territory-wide as a clean
series — district figures exist solely inside annual PDF tables. Spreading a
territory-wide number across 18 districts would invent precision, so it wasn't done.
Listings remain fabricated entirely; there is still no bulk HK listings feed.

## Live infrastructure (09/08/2026)

The app is deployed and the "zero configuration" fallbacks are no longer the only path
being exercised.

- **Production**: <https://veela-one.vercel.app>, Vercel, deployed from `apps/web` as the
  monorepo root directory. **Deploys are run from the CLI (`vercel --prod`)** — the
  GitHub integration stopped picking up pushes after a force-push rewrote history and has
  not been reconnected. Reconnect it before relying on push-to-deploy.
- **Repository**: `github.com/AlphaScale88/veela`, extracted out of the parent workspace
  repo (which mixes in unrelated projects) as its own standalone repo with a fresh
  history.
- **Supabase**: real project, live. Email/password *and* Google OAuth both work
  end-to-end. Postgres provisioned via the transaction pooler; all 7 tables created, RLS
  enabled on every one with 13 policies, and `handle_new_user` verified to create a
  `profiles` row on signup. Note the free tier's **email rate limit** — a handful of
  signup confirmations per hour, which looks exactly like a broken form when hit. Custom
  SMTP before any real volume.
- **Still unset**: `ANTHROPIC_API_KEY`, so the assistant renders and reports itself
  unconfigured rather than answering.
- **Google Maps**: the key must have **Maps JavaScript API** in its API restrictions or
  every map fails with `ApiTargetBlockedMapError` while looking like a code bug. Two keys
  are in play and only one is unblocked; check this first when a map goes blank.

## Not production-ready yet — the real gaps

Verified 09/08/2026 by running the production build and reading the deployed config, not
assumed:

1. **No rate limiting anywhere.** `/chat` (spends real Anthropic tokens) and
   `/verdict/preview` are public, unauthenticated and unlimited.
2. **No CI.** No `.github/workflows`; nothing stops a broken build reaching production
   except running `next build` by hand.
3. **Tests stop at `packages/core`.** 23 tests on the engine — the part that most needs
   them — and nothing on the API, components or end-to-end.
4. **`/privacy` names no operator.** The PICS is written but its operator and contact
   fields are deliberate placeholders until the invoicing entity is decided.
5. **Restrict the Maps key by HTTP referrer** before real traffic.

## The 2024 codebase at `C:\Veela` — read it, do not merge it

An earlier Veela exists on disk: **1 531 files, last touched October 2024**, no git
history. Two frontends and nine backend folders. **It is a Zillow-style portal, and the
pivot to an investor tool did not narrow it — it inverted it.**

### Four reasons it cannot be the base, and they compound

**1. It is built for the three audiences the new product excludes.** The public app's
pages are `add-a-listing`, `add-your-home`, `sell`, `agent/list`, `agent/[slug]`,
`property/list`, `review`, `saved-searches`, plus a 242-file **back office** for managing
listings and agents. Sellers, agents, browsers. The current thesis is *investors,
deliberately — not buyers looking for a home, not renters, not agents.*

**2. It is aggregation-first, which the current model explicitly rejects.** There is a
`property-worker` for ingestion and a listing database at the centre. The whole point of
the user-fed model is that **we do not start by building a property database**. That is
not a difference of degree.

**3. It is a Vietnamese product, not a Hong Kong one.** The type file settles it:
`CurrencyCode = 'vnđ'` — a single hard-coded currency — and housing types `condotel` and
`shophouse`. It also carries `PropertyAdsType = 'short_term_rental'`, and **short-term
letting is a criminal offence in Hong Kong without a licence** (Cap. 349, up to
HK$200,000 and two years). That feature is not merely unused here; it must not ship.

**4. Two of the nine backend folders are empty, including the one that matters.**
`property-service` contains a bare `.git` and no code; `node-core` is empty;
`services-v1` has one file. Meanwhile `gateway` (27 files) sits beside `gateway-v1` (307).
**That is a rewrite that stalled**, and the service named after the core domain never got
written. Inheriting it means inheriting an unfinished migration nobody remembers.

Add 22 months of dependency drift on a Next.js pages-router + SCSS + Redux + Express
stack, against the current app-router + Tailwind + Expo + Turborepo monorepo. **Migrating
costs more than rewriting, and the destination is a different product.**

### What is genuinely worth taking, and it is not code

**The property field inventory.** `real-estate-fe/src/globalTypes/property.ts` is 254
lines of hard-won domain vocabulary: bathrooms split into total and tubs, floors,
orientation, view type, facilities, furniture, amenities, tenants with percentages,
viewing schedules, verification status. **Somebody sat with real listings to write that.**
The new app needs a property-entry form, and this is a free checklist of what a property
actually has — to be pruned hard for Hong Kong, but far better than starting from a blank
page.

Two smaller things worth a look before deciding:

- **`compare/`** — comparing properties side by side is squarely an investor feature, and
  it is one of the few pages whose *purpose* survives the pivot.
- **`settings/saved-homes` and `saved-searches`** — a precedent for open question 3, where
  properties must become **persistent monitored objects** rather than calculator inputs.
  Worth reading for the data model, not the UI.

### The rule

**Treat `C:\Veela` as documentation of a previous attempt, not as a starting point.** Copy
ideas and field lists by hand; copy no files. It is outside this repository and stays
there — and like `L:` and the old `I:` workbook, **it is a local path that no build may
depend on.**


**Which is the argument that survives the narrowing:** France has better transaction data,
**Hong Kong has rents**. For a yield product, rents are the scarce half. RVD gives both,
free, monthly, back to 1979.


## Veela-specific agents / skills
Put Veela-only agents and skills in `.claude/agents/` and `.claude/skills/`.
Generic capabilities come from the plugins enabled in `.claude/settings.json`
(here: `platform-dev` — platform agents and build skills). See the workspace INSTALL.md.
