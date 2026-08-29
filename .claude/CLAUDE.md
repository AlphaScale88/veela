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

## Prefetched area data, and an AI brief that does not do the maths (14/08/2026)

Asked to preload area and building data before the report is opened, and to "use AI to compute
all the financials and data gathering."

### The preload

A cold Overpass lookup is 4–35s, which is why the area section used to hide behind a *Check the
area* button. That constraint never changed — what changed is **when the work can start.** The
location is usually known long before the report is asked for, so `/analyse` now fires the
lookup the moment it has coordinates and hands the result to the panel as `initialData`. By the
time the report opens, the section is simply there.

**The building search moved out of the report and onto the form**, which is what makes the
prefetch possible at all: it used to live only in the report's no-coordinates branch, so nothing
could load until the report already existed. There is now a "Which building?" card above the
form, and once a location is known it collapses to a one-line status with a *change building*
link.

**One request per place, guarded twice.** A ref keyed on coordinates **rounded to 3 decimals** —
the same ~110m rounding the server caches on — so React re-runs and a reader nudging the same
building do not each cost a request. Prefetching a donated service is only defensible if it
stays one fetch per location.

**Three end states, and the browser caught the third.** Loading, ready, and *attempted and
failed* — Overpass refuses cold lookups often enough that the last one is normal, not
exceptional. The first version reported failure as "will load with the report", which was a
promise the report does not keep (it shows the button instead). `areaFailed` is tracked
separately so the line says OpenStreetMap was busy and points at the retry.

Verified in a browser: picking a building fires exactly **one** `/api/neighbourhood` request
with no report click, the card collapses, and the status line tracks all three states.

### The AI part, and the line it does not cross

**The model does not compute the financials, and that is a decision rather than an omission.**
The yield, stamp duty and tax come from `computeVerdict` — the AVD table transcribed verbatim
from the IRD, rule sets versioned by transaction date, 23 tests pinning every marginal-relief
boundary. Substituting a language model there would trade a reproducible, *sourced* figure for a
plausible one, break the invariant this app leans on everywhere ("the rail and the report call
the same function, so they cannot disagree"), and put an unsourceable number on the screen a
reader acts on. This codebase treats an unsourced rate as a bug.

So the division is **the engine computes, the model explains** — which is precisely the use
open question 2 identified as the natural fit ("explaining the verdict… judgement over public
rules"), as against dynamic pricing and comp selection, which it deferred for needing data we
do not have.

`POST /report/brief` takes **prose, not a `Verdict`** — same reasoning as the chat endpoint's
`context`, plus a second benefit: handed figures as text, the model has nothing structured to
recompute. It receives what the engine produced and what OSM returned, and is told explicitly
to treat every number as given, to say a figure is absent rather than estimate it, and **not to
convert straight-line metres into walking times** (a claim the data cannot support, and the
first thing a model reaches for).

`ReportBrief` sits at the top of the report behind a button — it spends real tokens on a public
endpoint, and most readers want the numbers rather than a summary of them. Model output is
rendered as **plain paragraphs, never markdown**: interpreting it as markup would mean trusting
model output as markup. Every brief carries a footer saying Claude wrote it from the figures and
computed none of them, and that the numbers above win if the two ever read differently.

**`ANTHROPIC_API_KEY` is still unset**, so today the honest outcome is the "not configured"
sentence arriving as body text — verified, along with a 400 on an empty summary. Same
zero-configuration rule as the Maps key and `DATABASE_URL`; nothing else on the report depends
on it.

## Free AI providers, with failover (15/08/2026)

Asked to connect to free models and switch when a connection fails. `packages/api/src/ai.ts`
is a provider chain — the same shape as the Overpass mirror problem, several interchangeable
upstreams none of which is reliable alone.

**Order is free-first, paid last**: a configurable OpenAI-compatible endpoint (`AI_BASE_URL`,
for Ollama/LM Studio/a gateway — an explicit choice should beat any default), then Groq,
Gemini, Cerebras, Mistral, OpenRouter, then Anthropic. The paid key sits last because the
normal failure mode of a free tier is a rate limit, and that is exactly when something has to
answer. Anthropic's default dropped from Sonnet to **Haiku**: three paragraphs over figures
that are already computed do not need the larger model, and a fallback should be cheap.

**One adapter, one special case.** Almost every provider speaks the OpenAI `/chat/completions`
wire format, so this is a `fetch` + SSE parser plus the existing Anthropic SDK — not six SDKs.

**It fails over before the first token and never after, and that distinction is the whole
design.** The Overpass hedging races mirrors and discards losers because a JSON body is atomic.
**A token stream is not.** Once text has reached the reader, switching providers would splice
two different answers into one paragraph — worse than any error. So a provider is abandoned
only while nothing has been emitted; after that a failure is reported as an interruption and the
partial answer kept. Also **sequential, not raced**, unlike Overpass: these are accounts, not
public mirrors, and firing five in parallel would burn five rate-limit budgets per request —
scarcest exactly on the free tiers this was built for.

**Model ids are overridable** (`GROQ_MODEL`, …) because third-party ids drift far faster than
this file gets edited. A retired id returns a 404, which the chain treats as a failure and steps
past — a stale default degrades to "one fewer provider", not an outage. Upstream error bodies
are kept in the failure message, which is what makes that diagnosable rather than mysterious.

**Verified, four paths, against the running app:**

| Case | Result |
|---|---|
| Nothing configured | Names every key, including which are free tiers |
| Two bad keys | Both tried in listed order, each with the upstream's own message |
| Working provider (mock SSE server on `AI_BASE_URL`) | Streamed in order, paragraph breaks intact, `AI_MODEL` honoured |
| Refused connection + two bad keys | Walks all three, distinguishing `fetch failed` from HTTP errors |

The success path was testable at all *because* the custom provider's base URL is configurable —
a mock SSE server on localhost is a valid provider. No real free-tier key was needed.

**The brief's footer names no vendor.** The server picks whichever provider answers, so naming
one in the client would be a claim it cannot check. It says an AI model wrote it and computed
none of the figures, which is always true.

**Still the deciding factor, and it is not price.** A brief is well under a cent even paid. Free
tiers generally reserve the right to train on inputs, and these requests carry a real person's
price, rent and building location. `/privacy`'s PICS names classes of transferees — **update it
before pointing this at real users' data.** Recorded in `ai.ts` and in `.env.example` so it
cannot be switched on without meeting the warning.

## A local model works — in dev (15/08/2026)

Asked whether a local model could be used instead. **Yes, and the support was already there** —
`AI_BASE_URL` accepts any OpenAI-compatible endpoint and is tried first. Ollama and LM Studio
both serve that API, so it is a two-line configuration:

    ollama serve && ollama pull llama3.1:8b
    AI_BASE_URL=http://127.0.0.1:11434/v1
    AI_MODEL=llama3.1:8b

**It is the only option that sends nothing anywhere.** The property figures never leave the
machine, which *answers* the training-on-inputs concern rather than managing it — no new PDPO
transferee, nothing to add to `/privacy`. For a task deliberately scoped to "explain figures the
engine already computed", a small local model is also a reasonable fit; it is not being asked to
know anything.

**Two things the question exposed, both now fixed.**

1. **A keyless endpoint was silently skipped.** `keyFor()` required `AI_API_KEY` to be non-empty
   before the custom provider was even considered — but local runtimes have no key at all, so
   every local model was excluded by the one check meant to validate configuration. For a custom
   endpoint the **URL** is what makes it configured; the key is optional, and the `Authorization`
   header is now omitted entirely rather than sent as junk (Ollama ignores it, but LM Studio and
   some proxies reject a malformed one).
2. **`localhost` is unreachable from Vercel, and nothing said so.** Setting
   `AI_BASE_URL=http://127.0.0.1:…` in production means the function tries to reach a laptop from
   Vercel's servers, records `fetch failed`, and falls through to the next provider — correct
   behaviour, completely mystifying without a warning. Now stated in `.env.example` and `ai.ts`:
   **local dev only**, unless the model gets a public HTTPS address or the app is hosted where it
   can see the model.

Verified against a keyless mock on `11434` with **no `AI_API_KEY` set**: it streamed, sent no
`Authorization` header, and honoured `AI_MODEL=llama3.1:8b`.

## The commercial layer — making the business concrete (15/08/2026)

A business review grounded in this repo's own RVD/Land Registry series produced three findings,
and the build that followed acts on all three.

**The findings.** Hong Kong residential net yields run **1.5–2.5%**, so Veela's honest answer
is usually "this barely beats cash" — which makes it a **risk-reduction purchase at the moment
of transaction**, not a subscription anyone renews to be told no. The consumer ceiling is
therefore low: ~63,000 residential transactions a year in the *entire* market, average deal
HK$8.27M, giving low single-digit millions HKD even optimistically. **The same engine sold as
an API reaches comparable revenue from ~20 relationships instead of ~2,000 customers** — and
the engine is the one asset a competitor cannot scrape.

**`plans.ts` is the single source of truth for what Veela sells.** The pricing page renders
from the same object the rate limiter enforces against, so a price on a marketing page cannot
drift from the quota a customer actually gets — the "one function, not two guesses" rule
applied to commercial terms.

**Rate limiting (blocker #1, now closed).** Postgres-backed fixed windows, not Redis: a second
stateful dependency would break the zero-configuration rule for a counter table that is nowhere
near being the bottleneck at Hong Kong's transaction volumes. The count is returned by the
`insert … on conflict do update … returning` that wrote it, so there is **no read-then-write
race between serverless invocations** — which is exactly what an in-memory counter cannot
avoid, since every lambda would keep its own tally and the real limit would be `N × instances`.
**Verified under 90 concurrent requests against a 60/min plan: exactly 60 allowed, 30 refused.**
It **fails open** if the database blips — a limiter that takes the product down when its own
storage hiccups has caused more damage than the abuse it guards against.

**API keys.** Only a sha256 hash is stored; the plaintext is shown once and is unrecoverable.
**sha256 rather than bcrypt on purpose**: a password is low-entropy and needs a slow hash, but
an API key is 32 bytes from a CSPRNG — there is nothing to guess, and a slow KDF on every call
would be a self-inflicted latency tax on the hot path of the thing being sold.

**A real flaw the testing caught: auth ran *after* body validation.** With the check inside the
handler, `zValidator` fired first and an unauthenticated caller got a **400 describing our
schema** instead of a 401 — leaking the API's shape and spending parsing on a request that was
never going to be served. Auth is now middleware, so it runs before anything reads the body.
Found by curling with no key and reading the status code.

**`/v1` is versioned from the first day it exists.** Consumer routes can change with the UI
that calls them; a customer's integration cannot, and retrofitting a version prefix after
someone has shipped against it is a breaking change disguised as housekeeping.

**Keys are issued by hand, deliberately.** A self-serve dashboard is real work for a market the
review put at ~20 relationships. The schema, auth, quotas and metering are all live and tested;
only the sign-up button is a conversation instead of a form.

**CI (blocker #2, now closed).** Four checks that have actually caught things — typecheck,
lint, the 23 engine tests, and a production build **with no secrets set at all**, which is the
check that proves the zero-configuration rule still holds rather than being folklore. Verified
locally: 23/23 tests pass and the build completes clean with `DATABASE_URL` and both Supabase
keys unset. Packages build before checks run, because they are consumed as `dist/` — the trap
that cost an afternoon twice.

**Honesty about what cannot be bought yet.** No payment processor is configured, so the report
tier renders **"Not on sale yet"** with an inert button and a line saying the price is real and
the checkout is not. A "Buy" button that leads nowhere is the same failure as a fabricated
figure, and the pricing page says outright that these prices are a considered guess until
somebody pays one.

**`/terms` written, `/privacy` transferees enumerated** — Supabase, Vercel, the AI provider
(**including that a free tier may train on inputs**), a payment processor, and the Land
Registry. Maps and market data are lookups *we* make about a place, with no personal data
attached, and that distinction is now stated.

### The blocker only the founder can clear

**`/terms` and `/privacy` name no operator entity.** A contract needs a counterparty and a Hong
Kong payment processor will ask for the same details, so **Veela cannot lawfully take money
until an invoicing entity exists and is named in both.** This was already the outstanding item
in the open questions; it now blocks revenue rather than compliance tidiness. Neither document
has been reviewed by a Hong Kong solicitor, and section 4 of the terms — the Cap. 511 position
that selling software is not practising estate agency — is doing real work and deserves that
review.

## Property Alerts became real, and Resources got the numbers (15/08/2026)

Asked to finish My Workspace and Resources for real users. Compare and Favorites were already
complete. **Alerts was the gap — and its stated reason for not existing had quietly expired.**

### The blocker had already been removed by other work

The page carried this since it was built: *"Tracking is real; the alert itself isn't wired up
yet. There's no live market feed to compare a tracked property against."* True when written.
**False for weeks**, because the repo had since gained `RVD_RENT_INDEX` and `RVD_PRICE_INDEX`
(monthly, official, back to 1993) and `HK_RULE_SETS` versioned by effective date. Those are
exactly the two ways a saved snapshot goes stale: **the market moved, or the rules moved.**
Neither needs a listings feed, a scraper or a data licence — the thing that was blocking this
was an assumption nobody had rechecked.

`packages/api/src/alerts.ts` fires on four conditions, thresholds stated in the file: market
rents ±3%, prices ±5%, a stamp duty rule set that no longer matches the one a snapshot cites,
and a snapshot past six months. Thresholds are set so an alert means *a figure you rely on has
probably moved* rather than *an index twitched* — the actual failure mode of alerting products
is training the reader to ignore them.

**The rules check recomputes through the same engine with the same inputs**, so a difference can
only come from the rule set. It is not an estimate of drift; it is the drift.

**Every alert carries its own evidence** — series, both dates, both values — the same condition
the area score and star rating live under. And **no alerts is the good outcome, said as such**:
the feed distinguishes "nothing has moved" from "nothing is being watched", because rendering
one empty box for both teaches a reader to distrust the page.

Server-side on purpose, so the same alerts can be emailed as a digest later without rewriting
the UI. Computed on read rather than stored: the inputs change monthly at most and are the same
for everyone, so a materialised alert table would be a cache that goes stale in the one place
staleness is the entire subject.

**Verified against real database rows**, not just unit-style calls: a seeded tracked property
with a January 2025 snapshot produced *rents +6.7%*, *prices +12.5%* and *19 months old*, each
citing the RVD series and both dates. A property saved yesterday produced none. Test row deleted
afterwards.

**A latent bug this surfaced.** `toEngineInput` was extracted from `index.ts` so the alert engine
could recompute without a cycle — and immediately threw. It guarded optional fields with
`!== undefined`, which was right when it was only ever fed Zod-validated wire bodies, but it is
now also fed **rows straight out of Postgres, where absent means `null`**. `null` sailed past the
check and then dereferenced. Now `!= null`. It would have hit any saved property without a
mortgage.

### Resources: it explained the terms but never showed the numbers

Nine glossary entries and five links. Now twenty entries — adding the Hong Kong-specific ones
that cost people money when misread (**saleable vs gross area**, which scale you fall under,
rateable value vs Government rent, marginal relief, the provisional/formal agreement sequence) —
and twelve sources including the EAA licence check and the Law Society list.

**The stamp duty scales are now on the page, read from `HK_RULE_SETS` rather than retyped.**
That is the same discipline `/research/market-regulations` already follows: a hand-copied duty
table is a second source of truth that goes wrong at the next Budget and nobody notices. The
page says outright that if it and a report ever disagree, the report is right and this is a bug.
Bands render by kind — flat, percentage, marginal relief — rather than being flattened into one
"rate" column that would misdescribe two of the three.

### Worth knowing

**`HK_RULE_SETS` holds five dated rule sets covering 22/02/2023 onwards** (22/02/2023,
25/10/2023, 28/02/2024, 26/02/2025, 26/02/2026), added 22/08/2026 on the market study's
recommendation 3. The rules-changed alert can now fire, and a 2023 or 2025 purchase computes.
`hk.test.ts` asserts the five periods tile the timeline with no gap and no overlap; a date before
22/02/2023 is still rejected, now with a message naming the earliest date held.

Two things the historical sets changed beyond adding tables. **Buyer's Stamp Duty is now
computed**, not merely displayed: a non-permanent resident buying in 2023 paid 15% BSD on top of
a 15% flat AVD, and adding the rule sets without charging it would have produced a confidently
wrong acquisition total for exactly the users the sets exist to serve. And the
`stamp-duty-full-rate` finding now fires only when the two scales actually differ — since
28/02/2024 they are the same table, so the old unconditional warning was inventing a cost that no
longer exists.

## The mortgage page was asking about a suspended test (24/08/2026)

Market study recommendation 4. `HK_LENDING_DEFAULT` shipped a value-banded LTV cap (70% to
HK$30M, 60% above) and applied the +2-point stress test to the income limit. The banding was
removed by the HKMA on **16/10/2024** and the stress test suspended on **28/02/2024**; both
defaults had been wrong for roughly two years, and both in the direction of telling a buyer they
could borrow less than the rules allow — HK$24M against HK$28M on a HK$40M flat, which is HK$4M
of deposit that is not required.

Now: one LTV band at 70% with no threshold, and `stressTestSuspendedSince: "2024-02-28"`.

### Worth knowing

**Suspension is recorded, not encoded as `stressPoints: 0`.** "There is no test" and "the test
adds nothing" are different statements and only the first is true, so the margin survives and
reinstating the test is a one-field change — the same treatment the tax engine gives BSD and SSD.
The stressed payment is still computed and still shown, because a rate rise would still cost
that; it simply no longer caps the loan. `passesStressTest` is `null` while suspended, and the UI
must not render `null` as a verdict — it reads as a refusal. `withinDsr` is the live test.

**The framing was the bug, not the numbers.** The page's headline asked "Would the stress test let
this through?" and its benefit cards called +2 points "what a bank actually checks". Correcting
two constants under that copy would have left the page confidently answering a question that
stopped existing in February 2024. Hero, cards, FAQ and the result panel all moved to the
servicing limit.

**Clearing `unverified` would have deleted the disclaimer.** The whole caveat block was wrapped in
`{HK_LENDING_DEFAULT.unverified && ...}`, so doing what the recommendation asked — sourcing the
figures and clearing the flag — would have silently removed it, including the part saying a bank
lends inside the HKMA's ceiling at its own discretion. Sourcing a cap does not make it an offer.
That sentence is now unconditional and only the "these are working assumptions" clause is keyed
off the flag.

**DSR is compared in cents with a one-unit tolerance**, matching `withinLtv`. Borrowing exactly
`maxLoanByIncome` puts the payment precisely on the ceiling, where a strict float comparison is
decided by a half-cent of rounding — and it lands on "refused" often enough to tell a borrower
their own computed maximum is refused.

**Still not from the primary instrument.** hkma.gov.hk does not render to an automated fetch, so
the source line cites the Government Information Services releases of 16/10/2024 and 28/02/2024,
which carry the measures verbatim. The HKMA's circular to authorised institutions is a letter and
is not published. `maxTermYears: 30` remains market practice rather than a rule, which is why
`unverified` stays a per-policy flag rather than being deleted.

## Consent at signup, pricing on the landing page, and a monthly tier (16/08/2026)

### Terms and privacy are now accepted and recorded

Signup previously *linked* to `/privacy` in passing. Nothing was presented for acceptance and
nothing was recorded, so there was no answer to "what did this user agree to" beyond "whatever
the page said that day" — the exact gap DPP1 addresses, and one this file has warned since the
beginning is impossible to retrofit.

**Versioned by date** (`packages/types/src/legal.ts`). A semantic version implies a judgement
about whether a change was breaking; for a legal document the only question anyone asks is
*which wording did they see*, and a date answers that and sorts correctly. Both `/terms` and
`/privacy` now render their version **from that constant rather than a hardcoded string** — which
was already drifting: the terms page said "15 August" beside a recorded version of 2026-08-16.

**`consent_records` is append-only**, one row per (user, document, version), unique so a refresh
or double-submit cannot manufacture a second record of one event. Never updated: the question is
historical, and a row overwritten when the terms change destroys the evidence it exists to hold.
Writes bypass RLS via the service connection — a client that could write its own consent record
could forge one, and this is evidence rather than a preference.

**Deliberately no IP address or user agent.** Both are conventionally stored as "consent
evidence". `user_id + document + version + timestamp` already identifies the person, the exact
wording and the moment; an IP adds marginal evidentiary value while being personal data itself,
so collecting it creates a new disclosure obligation on the very page whose acceptance is being
recorded. DPP1's minimisation principle points the other way.

**The checkbox is unticked and gates the button.** A pre-ticked box is not consent, and "by
continuing you agree" claims agreement from someone who may never have looked. Verified in a
browser: with a valid email and password but the box unticked, the button stays disabled.

**Superseded 16/08/2026 — see below.** ~~A gate in `AppShell` catches everyone the form
cannot~~ — existing accounts, Google sign-ups
(which never touch the signup form), and anyone who accepted superseded wording. All three are
one condition, *the current versions are not on record*, so they get one mechanism rather than
three special cases. A banner rather than a trapping modal, because the reader has to be able to
open the documents they are being asked to accept.

**The server checks the version rather than trusting the client**, and 409s a stale one — a tab
left open across a deploy would otherwise record agreement to wording nobody is being shown.

### Pricing moved to the landing page, and the consumer tier became monthly

Pricing now appears on `/` as a **summary rendered from the same `PLANS` object**, not a copy —
price, one-line pitch, link. Placed last, before the closing call to action: a visitor who has
seen what the product does can judge a price; one who meets it first is being asked to value
something they have not seen.

**The consumer tier changed from a one-off HK$680 report to HK$188/month, on request — and the
original argument for one-off is genuinely weaker than when it was made.** That reasoning said a
thin-yield market makes Veela a risk-reduction purchase at the moment of transaction, and nobody
renews a subscription to be told no. What changed has nothing to do with the request: **Property
Alerts became real earlier the same day.** There was previously nothing to keep paying for
between purchases; there now is.

It also moves which half of the audience the paid tier serves. A one-off report sells to someone
**buying once**; a subscription sells to someone **holding a portfolio** — roughly 63,000 flats
change hands in a year against well over a million owned.

**What did not change:** the free tier stays genuinely useful. The line is *decide on one
property* (free) versus *keep watching what you own* (paid), not a paywall dropped in front of
what already worked. The API is still the real revenue line.

Knock-on corrections, each of which would have shipped a false statement: the terms' billing
clause described a one-off purchase and discretionary refunds (now monthly billing, cancel any
time, no part-month refunds, but **defect refunds are not discretionary**, and saved reports stay
readable after cancellation); and `/pricing`'s **metadata description still advertised HK$680**,
which is what a search result or a shared link would have shown.

## Consent at signup only, and three plans (16/08/2026)

**The app-shell consent gate was removed on request.** Consent is asked for at signup and
nowhere else. What that costs, stated rather than glossed: **accounts created before this
existed have no record**, and a future change to the wording will not re-ask. Both are
recoverable — the versioned records make it possible to say exactly who is missing which
document — but until something re-asks, "accepted" means *accepted at signup, on the version in
force that day*.

**What signup-only must not mean is Google escaping the checkbox**, which it would have: that
path leaves `/signup` before a session exists, so the acceptance would be given and never
recorded — or never given at all. Both buttons are now gated on the same acceptance, and the
checkbox moved **above both**, because underneath the email form it left the Google button
disabled for a reason the reader had to scroll to find. `ConsentRecorder` renders nothing and
exists only to write the record when the session lands after the OAuth round trip; it is not a
gate and never asks anything.

**Pricing collapsed from four tiers to three: Free, Investor, Pro.** The two published API tiers
differed only in a call quota, which asks a buyer to forecast usage before they have integrated
anything — a question nobody can answer and a reason to delay. One published team price with
*"tell us what you need and we will price it"* is how this is actually sold, and it puts the
negotiation in a conversation with the ~20 relationships this market contains. Pro is HK$5,000/mo
with 10,000 calls; higher volume is a conversation.

Knock-ons swept: `createApiKeySchema`'s enum, the highlight rule on the pricing cards, the
plan-limits table in the API docs, and the `"plan": "starter"` in the documented example
response — which would have shown developers a plan id that no longer exists.

## The marketing header: one nav language, and an account menu (16/08/2026)

**"Analyse a property" stopped being a pill.** It sat between Finder and Market Explorer as a
button, which made one nav item look like a different *kind* of thing from its neighbours —
three destinations of equal standing, one of them wearing a call to action. It is a plain link
now. The header's job is navigation, and the landing hero already carries the primary action for
anyone who needs one.

**"Sign out" became an avatar menu**, from a Mashvisor reference. The reasoning holds
independently of the reference: sign out was **the only account action in the header**, which
made the action a reader wants least often the most prominent one in the bar. The avatar
collapses identity and every account destination into one control, and it now holds both "My
Properties" and "Sign out".

**Two things in the reference are deliberately absent: Billing, and "Upgrade Now".** Neither
exists — there is no payment processor — and a menu item that opens nothing is worse than an
absent one, because it spends the reader's trust to look finished. The plan line reads **"Free
plan"** and links to `/pricing`, which is honest on both counts: every account genuinely is on
free, and that page says outright the subscription is not on sale yet.

Closes on outside click **and** Escape — a pointer user expects clicking away to dismiss, a
keyboard user has no "away" to click. Listeners are bound only while open.

**Verified in a browser against a real session** (throwaway account, deleted after): logged out
the header has exactly one button, "Sign in"; signed in it has **none** — every nav item is now
the same kind of thing — plus the avatar. Menu renders identity, plan, three destinations and
sign out; Escape and outside-click both dismiss it.

## Services — built, and the objection to it answered rather than dropped (16/08/2026)

This file recorded Services as **deliberately not built**: the reference product's version is a
vetted marketplace of lenders, insurers and contractors, and "Veela has vetted no one — a page
presenting unvetted names as trusted services would be inventing authority the product
doesn't have."

Built on request, and **that objection shapes every page rather than being overridden.** There
is no marketplace: each page either computes something from published rules, or points at the
official register that is authoritative in a way a curated list never could be. Nobody is
recommended and no money passes with any provider.

That is also the only lawful shape, and each page names its own line:

- **Mortgage** — a real stress-test calculator. Introducing a borrower to a lender for a fee is
  a different activity from computing a number; this stays on the computing side.
- **Insurance** — advising on or arranging insurance needs an Insurance Authority licence.
  The page explains what a mortgage obliges you to hold and links to the IA register.
- **Agent Finder** — introducing parties to a transaction is estate agency work under Cap. 511.
  So it **checks** agents rather than finding them: the EAA register, plus what Form 3 and
  Form 4 actually commit you to.
- **Home Valuation** — a valuation is a surveyor's professional opinion. This applies the RVD
  price index to what you paid, shows its working, and says three times that it is not a
  valuation. Links to HKIS for a real one.

### The mortgage calculator, and why its numbers are inputs

`packages/core/src/mortgage.ts` computes the payment, the payment at **+2 points**, the
debt-servicing ratio under both, and the largest loan the LTV cap and the income each allow —
solving the payment formula backwards for principal, so the income cap is exact rather than
searched for.

**Every policy number is a parameter, shown on screen and editable.** The HKMA has revised LTV
caps and servicing limits repeatedly; hardcoding a cap that cannot be cited is the "unsourced
rate is a bug" failure with a worse consequence than usual — telling someone they qualify when
they do not. `HK_LENDING_DEFAULT` is flagged `unverified`, and the UI's "confirm these with a
bank" caveat is **keyed off that flag**, so clearing the flag without checking the source would
also remove the warning. A test asserts the flag is still set, for that reason.

**13 new engine tests, 36 total.** They pin the arithmetic and never the policy — a test
asserting "the cap is 70%" would fail for the right reason and be deleted for the wrong one, so
policy-shaped tests pass a policy in and check it is honoured.

Verified in a browser: defaults clear the test at 36.9% DSR; a loan over the LTV cap is flagged
with the excess; income of 30k fails and 200k passes; the valuation page reports the market
down 18.0% since 2021-06 with its disclaimer present.

## Services, restyled on the reference — and the one thing not copied (16/08/2026)

Sent the four Mashvisor pages to work from. Fetched and read them: Mortgage, Insurance, Agent
Finder and Home Valuation share one architecture — centred hero with an icon, headline and
subheadline; three benefit cards; a strip of trust statistics; a numbered "how it works"; an
FAQ; a closing call to action. **That architecture is adopted almost exactly**, in
`components/service-page.tsx`, so the four pages share it rather than each inventing a layout.

**What is not adopted is what fills it.** All three are lead-generation funnels for a partner —
*"Get Matched Now"* hands you to a lender, valuations go to Akrivis at $275, agents come from
BiggerPockets. Veela has no partners, takes no referral fee, and could not lawfully run the
agent one.

**The trust strip is the sharpest case.** Theirs reads *"Trusted by 50,000+ investors"* and
*"10,000+ successful matches"*. **Veela has no users, so any number of that kind would be
invented** — the precise failure this codebase refuses everywhere else. `FactBar` therefore
carries only claims checkable from the repository: the IRD transcription, the test count, the
span of the RVD series, and what we do *not* do. For this product those are the stronger claim
anyway — someone deciding whether to trust a stamp duty figure cares more that it is tested
than that other people liked it.

**Agent Finder inverts the reference's promise rather than matching it.** Theirs finds you an
agent; this one helps you check the agent who already found you. Not a stylistic choice:
introducing parties to a transaction is estate agency work under Cap. 511, and doing it for a
fee without a licence is an offence. It is also the more useful page in a market where agents
are abundant and verification is the scarce step.

Each page now carries a five-question FAQ, written to answer what a reader would actually ask
— including, on every one, "why won't you just recommend someone". The FAQ uses native
`<details>` rather than a JavaScript accordion: keyboard-accessible, works before hydration,
and findable by in-page search, none of which a hand-rolled version gives for free.

Verified at 1400px and 390px: all four render, five FAQ items each, **no horizontal overflow
anywhere**, no console errors. 36 engine tests still pass.

## Pricing in the nav, and more finder criteria (16/08/2026)

**Pricing was missing from the header entirely.** The landing page reached it only through the
mid-page section's button and the footer — never from the nav, which is the first place anyone
looks. Added to the marketing header and the mobile drawer.

**Four more search criteria on `/finder`**, behind a "More filters" disclosure like the
reference's: saleable area, floor band, building age and a management-fee ceiling. Behind a
disclosure rather than widening the bar because four controls are scannable and eight are a
form; the button carries a badge counting active extras, so a reader who has forgotten why the
list is short can see something is on without opening it. A Reset appears once anything is set.

**Every filter reads a field the listings genuinely carry** — `saleableAreaSqft`, `floor`,
`yearBuilt`, `monthlyManagementFeeHkd`. That constraint decided the list. The reference's own
panel also offers **Renovation** and **Furniture**; neither is here, because `DemoListing` has
no such fields and generating them would mean inventing renovation states for fifty-four
properties that do not exist — deepening the fabrication this page already discloses rather
than adding a criterion. **A filter that invents the thing it filters on is worse than a missing
filter**, and the panel says so on screen rather than leaving a reader to hunt for it.
*(**That last argument was wrong and was withdrawn the same day — see "Twelve criteria in three
tabs" below.** The paragraph is kept as written because the correction is the point.)*

Age is computed from a `CURRENT_YEAR` fixed at module load, not per render: a result set that
changed halfway through a session because the clock passed midnight would be baffling.

Verified in the table view, where every row is countable: 54 listings → 10 under 500 sq ft → 3
also above floor 26 → 2 also under 20 years old; the badge reached 4; Reset restored 54. Card
view alone would have hidden this — page size is 6, so page one looks identical whether a
filter narrowed 54 to 50 or not.

## Services moved to top-level marketing pages (16/08/2026)

Asked to publish them the way the reference does — `/mortgage`, `/insurance`,
`/home-valuation`, and Agent Finder as its own page. They were at `/services/*` inside the app
shell; they are now `/mortgage`, `/insurance`, `/agent-finder` and `/home-valuation`, rendered
with the **marketing header and footer** rather than the product sidebar.

**The chrome change is the substantive half, not the URL.** These are the pages someone arrives
on from a search or a shared link, before they have an account — and a stranger's first screen
should be a header they can navigate from, not a logged-out product sidebar. Nested three
levels deep behind app chrome they were also effectively unfindable to anyone not already
inside the product, which is the opposite of what a page about mortgages is for.

`/services` stays in the app shell as the in-product index; the sidebar group links straight to
the four pages. `servicesActive` now lists the leaves explicitly rather than matching a prefix —
`/mortgage` and `/insurance` share none, so a single `startsWith` would have quietly stopped
lighting the group.

**Old paths 308 to the new ones.** Permanent rather than temporary because the move is settled:
a 308 transfers the old URL's standing to the new one, where a 307 would leave both competing
indefinitely. `/services/valuation → /home-valuation` is the one that changed *name* as well as
depth, which is why the four are listed rather than generated from a pattern — a pattern would
have sent it to `/valuation`, a route that does not exist.

Verified at 1400px and 390px: all four render with a header and footer and **no product
sidebar**, five FAQ items each, no horizontal overflow, no console errors; all four old paths
return 308 to the right destination.

## Pricing and the API docs left the product shell too (16/08/2026)

Asked to put pricing on a standalone page rather than a logged-in one. `/pricing` and
`/developers` were rendering inside `AppShell` — the product sidebar, breadcrumb and all — which
is the same mistake the Services pages had just been moved out of, one section up.

**A price list is read by someone deciding whether to have an account at all.** Wrapping it in
the furniture of a product they have not bought asks them to navigate a workspace before they
have decided to want one, and it is the page most likely to be reached from a search result or a
shared link — a stranger's first screen. Both now render as plain content under the marketing
header and footer, added to `MARKETING_ROUTES` in `site-chrome.tsx`.

**They moved as a pair, deliberately.** Pricing's Pro card ends in "Talk to us" and its closing
paragraph links to "Read the API docs" — both go to `/developers`. Moving one and not the other
would flip the page furniture halfway through a single decision, which reads as a bug rather than
a boundary. The reasoning is in the `MARKETING_ROUTES` comment, not only here, so a future
addition to that set knows what the set is *for*.

Nothing else changed: same content, same `PLANS` source of truth, no new routes and no
redirects — these URLs did not move, only their chrome.

Verified at 1400px and 390px: both render with the marketing header and footer, **zero product
sidebars**, no horizontal overflow, no console errors.

## Twelve criteria in three tabs — and an argument of ours that did not hold (16/08/2026)

Sent a screenshot of Spacious's **More Filters** panel and asked for more criteria like it.
That panel is three tabs — *Listing Features, Building Features, Other Features* — of radio
groups, closing with **Reset** and **Show 15,511 listings**. All of that is adopted. `/finder`
now carries twelve extra criteria against four.

### The reasoning that had to be withdrawn first

The previous pass added four filters and recorded, on the page and in this file, that
**Renovation and Furniture were deliberately excluded**: `DemoListing` had no such fields, and
generating them would deepen the fabrication the page discloses. *"A filter that invents the
thing it filters on is worse than a missing filter."*

**That argument does not survive being applied consistently, and it was ours, not a constraint.**
`floor`, `yearBuilt` and `monthlyManagementFeeHkd` are every bit as generated as a renovation
state — and the same commit that wrote the sentence shipped filters on all three. There was
never a principled line between an invented number and an invented category; the line only
looked principled because numbers feel like measurements. What actually makes any of this
defensible is `LISTINGS_NOTICE`, which discloses the whole dataset and covers eight new fields
exactly as it covered the prices. The old paragraph is left standing in the section above with
a pointer here, because a withdrawn argument is more useful than a quietly deleted one.

**What has *not* changed is the rule underneath it**: no listing gets a building name, a street
or a unit number, and no photo shows an identifiable Hong Kong building. Those refuse to make a
false claim about a *real* property, which is a different thing from generating an attribute of
an admittedly invented one.

### The generated attributes, and two things that made them non-trivial

Renovation, furnishing, outdoor space, view, car park, facilities, pets and tenancy. Odds lean
on the figures already drawn rather than being uniform — rooftops only above floor 30 and
gardens only at the bottom, sea views weighted by region and height, facilities and refurbishment
likelier in newer stock. Not realism for its own sake: a screening tool that returns a
ground-floor flat for "sea view, high floor", or a building with a pool and no clubhouse, looks
broken to anyone who knows the market, and judging the screening tool is the only reason this
data exists. Facilities are drawn as a **tier**, not three coin flips, for the same reason.

**A bug caught by measuring rather than reasoning.** The new draws were appended after the
existing ones, with a comment claiming that left every prior figure byte-identical. It did not:
mulberry32 is one sequence shared by all three listings in a district, so the extra draws shifted
listings 2 and 3 everywhere — **"under 500 sq ft" moved from 10 to 13**, and the filter counts
this page had been verified against silently stopped matching. Fixed with a **second independent
PRNG stream** (`attrRand`, `d.seed + 90000`); the documented chain is 54 → 10 → 3 → 2 again, and
either group can gain a field later without disturbing the other.

**Every new criterion is visible on the result.** A filter you cannot see the effect of gives a
reader no way to tell a working one from a broken one — the same reasoning that made every
neighbourhood count open the list behind it. Cards and list rows carry up to three feature chips
(capped: uneven card heights in a grid read as a layout bug), the table carries all of them
uncapped, and the CSV gains **one column per criterion** rather than a joined blob, because a CSV
is opened to be sorted and filtered again.

### Choices inside the panel

**Radio groups, not selects.** A `<select>` hides its options until clicked, so eight of them
would show a reader nothing about what can actually be filtered on. Native `<input type="radio">`
rather than styled `role="radio"` buttons: arrow-key roving, group announcement and exclusivity
all come free. The main bar keeps its selects, where compactness beats discoverability.

**Facilities is the one multi-select, and it means AND.** Ticking Gym and Pool asks for a building
with both — verified, since it is the one place an OR would look plausible and be wrong. It counts
as **one** active criterion in the badge however many boxes are ticked, because the badge answers
"how many things am I filtering on".

**"Show N listings" makes the panel a preview of its own effect** — a filter combination that
leaves nothing is visible before it is applied rather than after.

**Not copied: the reference's floor-plan / video-tour / virtual-staging checkboxes.** Those
describe the *advertisement*, and there is no advertisement here to describe. **Tenancy earns its
place for the opposite reason** — vacant possession versus buying with a tenant in place changes
what is being bought, not how it is marketed, and the panel says so: you inherit the rent and the
term and cannot vary either until it expires, while the report treats the rent you enter as the
rent you get.

**Spacious itself could not be read.** It 403s a plain fetch behind Cloudflare. The stealth
browser built for the listing importer would have got through, and was not used: that bypass
exists for a listing a user pasted, and pointing it at a competitor's app to study their UI is a
different purpose than the one it was authorised for. Worked from the screenshot instead.

Verified in the table view, where every row is countable, at 1400px and 390px — counts checked
against the fixture data computed independently, not just read off the screen: 54 → renovation
refined **17** → also tenanted **10** → also has a gym **6** → also has a pool **2**; badge
reached 3, the footer read "Show 6 listings", Reset all restored 54. No horizontal overflow on
the body, the panel or the tab strip at either width; no console errors; 36 engine tests still
pass.

## Photos on a saved property, and where a property came from (17/08/2026)

Asked to let a signed-in user save properties — by link import or by hand, **with photos** — and
then compare the saved ones by selecting them.

**Most of that already existed and was left alone.** Saving from `/analyse`, the 17-field manual
form, the paste-a-link importer, and `/portfolio/compare`'s pick-up-to-three selector were all
built already; an audit confirmed it rather than assuming. **Two things were genuinely missing**,
and they are what this change is:

### 1. Photos — greenfield at every layer

No file input, no upload route, no column, no bucket, no `storage.from` anywhere in the repo.

**The bytes never touch our API.** The browser uploads straight to Supabase Storage under its own
session and only then registers the object with `POST /properties/:id/photos`. Not merely a size
argument: a Vercel function's request body is capped below a modern phone photo, and proxying
megabytes through a serverless function to re-upload them spends latency and money for nothing
the browser could not do directly.

**The bucket is private, and that was the deciding call.** These are photographs of where somebody
lives, attached to their price, their mortgage and their address — personal data under the PDPO. A
public bucket protects that only by the unguessability of a URL, which survives until one is
pasted somewhere. Reads go through hourly signed URLs instead; the cost is that a URL expires, and
that is the right trade. `{ownerId}/{propertyId}/{uuid}.{ext}` is a **contract**, not a naming
preference: the bucket's own RLS authorises by comparing the first path segment to `auth.uid()`,
and the API re-checks the first two against the caller and the property.

**The cover is `sortOrder === 0`, not an `isCover` flag** — "make this the cover" and "reorder"
are then one operation rather than two states that can disagree about which photo is the cover, a
disagreement that would only surface on a list page much later.

**This is the one place the product shows a photograph of a reader's own property**, and it is the
only kind it can: they took it. The report still carries none, for the reason already recorded —
a stock interior beside somebody's own figures makes the same false claim a made-up number would.
There is deliberately **no placeholder image** when a property has no photo.

### 2. The importer was throwing away where the figures came from

`sourceUrl`, `address`, `latitude` and `longitude` were all read by the importer and all dropped at
the form boundary, so a saved property could not say which listing produced its numbers — the first
thing you want when a price is six months old. Now four nullable columns, rendered on the portfolio
card as "Imported from spacious.hk · Tsuen Wan West". Provenance rides beside `Draft` rather than
inside it: `Draft` is what the form edits and the preview recomputes from, and provenance is not
editable, not a number, and changes nothing the engine does.

### Three real bugs the testing found

- **Deleting a property orphaned its photos in Storage.** `property_photos` cascades on the foreign
  key, so the *rows* went and the *objects* stayed — invisible to the product, unreachable through
  it, and still photographs of somebody's home after they asked for it to be deleted. A retention
  problem, not a tidiness one. Found by inspecting the bucket after a test deleted a property: two
  orphans, exactly as described. `DELETE /properties/:id` now returns the storage keys (200 with a
  body, was 204) and the browser removes the objects, the same division of labour the single-photo
  delete already used — the API cannot do it, since that needs either the user's session or a
  service-role key that must never sit in a request path keyed by a user-supplied id.
- **Two destructive buttons on one card both said "Remove"** — one deleted a photo, the other the
  whole property. Found the hard way, by a test clicking the wrong one and destroying its own
  fixture. The card's is now "Delete property"; each photo's carries `aria-label="Remove photo N"`.
- **`text-danger` is not a token in this project** (`negative` is), so the delete control was
  rendering with no colour at all.

### Worth knowing

- **A hand-inserted `auth.users` row cannot sign in** until `confirmation_token`, `recovery_token`,
  `email_change*`, `phone_change*` and `reauthentication_token` are `''` rather than `NULL` —
  GoTrue scans them as non-nullable strings and every attempt returns *"Database error querying
  schema"*. Creating the test account by SQL rather than through signup is what avoids burning the
  free tier's email quota, so this is worth remembering.
- **Supabase refuses `delete from storage.objects` over SQL** ("Direct deletion from storage tables
  is not allowed"). Cleanup has to go through the Storage API.
- An object can exist with no row (upload succeeded, registration failed) — invisible, costs only
  storage. The reverse would be a photo that silently fails to load, so registration always happens
  *after* a successful upload and the object is rolled back if it fails.

**Verified end-to-end against a real session** (throwaway account created by SQL, **deleted
afterwards along with every row and storage object** — `alphascale88@gmail.com` is again the only
account): sign in → manual entry → report → save → upload 2 photos (2 tiles rendered, 1 cover
badge) → cover thumbnail on `/portfolio` → inline manager reads 2 of 24 → "Make cover" reorders →
thumbnails in both the compare selector and its column headers → delete one photo → 1 of 24. Then
separately: a save carrying provenance stored and displayed all four fields, and deleting a
property with a photo issued a storage `DELETE` returning 200 — confirmed twice in a clean
reproduction. No console errors at any point.

**One thing not explained:** a single orphaned object survived one earlier run of that delete path,
and did not reproduce in two clean rounds afterwards. Recorded rather than dismissed.

## Six form fields had no accessible name (17/08/2026)

Noticed while writing a Playwright login for something else: `/login`'s inputs could only be
targeted by CSS, never by label. That is the symptom of a real defect — **a placeholder is not a
label.** It is the accessible name only as a last-resort fallback, it disappears the moment
anything is typed, and here it was the wrong text anyway: the email field announced itself as
*"you@example.com"*. On the one form the whole account system stands behind.

`sr-only` `<label>`s rather than visible ones on `/login`, because the compact card is deliberate
and `/signup` — which already showed proper labels — is where the extra guidance earns its space.
**A hidden real label beats `aria-label`**: it is still a label element, so it is exposed
consistently and picked up by page-translation tools that skip ARIA attributes.

**Generated ids, via `useId`.** `LoginForm` renders on `/login` *and* inline as `/analyse`'s report
gate, so a hard-coded `id` is a duplicate-id bug waiting for the day both appear on one page — at
which point a label silently points at the wrong input.

**The bigger find was `/account`.** `SettingRow` rendered its label text as a `<p>` in a different
subtree from the control — something that looks like a label and is not one. Four fields affected;
the display-name box read out as *"Optional"*, from its placeholder. `SettingRow` now takes an
optional `htmlFor` and renders a real `<label>` when given one. Optional on purpose: several rows
hold a button, a toggle or a sentence rather than a labellable control, and `htmlFor` pointing at
nothing is worse than no label at all. It also makes the text clickable, which is the visible half
of the same fix.

**One of the four was found only by measuring.** Grepping for `placeholder=` found three; the
email-change field has no placeholder at all, so it never appeared in the search — it surfaced when
a script walked the rendered DOM asking *which controls have no accessible name by any route*. The
search was for the symptom; the audit was for the defect.

Verified by resolving each field's name the way a browser does, not by reading markup: `/login`
gives "Email address" and "Password", `/analyse`'s gate the same with **no duplicate ids**,
`/signup` unchanged, and all four `/account` fields resolve via `label[for]` with no dangling
references and nothing unlabelled.

**Two things worth knowing for the next time a test account is made by SQL** (see the photos
section for why that is the route): `auth.users` alone is not enough — without a matching
**`auth.identities` row with `provider = 'email'`** the app's own `hasPasswordIdentity` check
correctly concludes the account signs in with Google and hides the password fields entirely, so the
account is not representative. And `/account`'s sections are independent disclosures whose state
must be driven off `aria-expanded`; clicking each header blindly toggles shut what the previous
click opened, which produced an audit that examined an empty page and reported no problems.

## The Search page screens real properties now (17/08/2026)

Asked how to fix the fact that `/finder`'s listings are fabricated. Four routes were laid out —
verify Centaline's open-data licence, license a commercial feed, keep paying HK$10 per Land
Registry lookup, or point the page at the reader's own saved properties — and **the last was
chosen**: the only one needing no licence, no new supply and nobody's permission. It is also the
product's own stated model ("the user brings the property") applied to the one page still
pretending otherwise.

### Both modes, because deleting the demo would have broken something deliberate

`/finder` is public and ungated *on purpose* — the login wall came off on 09/08/2026 precisely
because fabricated listings are marketing for the report rather than the product. Replacing them
outright would leave every logged-out visitor and every brand-new account staring at an empty
page, throwing away the demonstration the page exists to give. So the fabricated set **stops
pretending to be inventory and becomes a labelled sample you can switch to**, and the mode
**defaults to real data whenever there is any** — which is what makes this a fix rather than a
toggle nobody finds. A reader's own choice pins the mode, so the property count arriving a second
later cannot yank the page out from under someone who just picked the sample deliberately.

### The filter set is deliberately smaller, and that is the honest part

`PropertyFinder` offers twelve extra criteria — bedrooms, floor, renovation, furnishing, outdoor
space, view, car park, facilities, pets, tenancy — because it *generates* those fields. **A saved
property has none of them**: the report form collects price, rent, area, transaction date, buyer
situation, costs and financing, and nothing else. Offering the same panel would mean inventing the
values or filtering on empty, and the second is worse because it silently returns nothing.

So `SavedPropertyFinder` screens what a saved property really carries — price, net yield from the
stored snapshot, saleable area, plus *tracked* / *has photos* / *from a link* — and **says on
screen which criteria are missing and why**. If the form starts collecting bedrooms and floor,
they belong here the same day.

**No district filter, and no derived one.** `districtId` is null in practice. Deriving a district
from the stored coordinates by nearest centroid was considered and rejected: those centroids are
accurate to a few hundred metres and Hong Kong's districts are large with contested edges, so
nearest-centroid would confidently mislabel anything near a boundary. The top bar matches **label
and address text** instead — explainable in one sentence and never wrong.

### `FinderPin` no longer knows what a `DemoListing` is

The map used to take a listing and compute *district centroid + that listing's fixed offset*. Fine
while every pin was fabricated; wrong the moment a real property needed plotting, since it has real
coordinates and no offset to add them to — and a shared map had no business knowing the demo
fixture's shape anyway. It takes a `position` now; `PropertyFinder` does its own centroid
arithmetic, and only properties that genuinely carry coordinates get a pin. **The count of
unmapped ones is stated** ("1 mapped. 2 not shown — a property only has coordinates if it came
from a listing link that published them") rather than left to be inferred from a map emptier than
the list beside it.

### Two bugs the screenshots caught

- **`fitBounds` on a single pin zooms to the basemap maximum**, giving a featureless tile with one
  dot in it — no street, no coastline, nothing to locate the property against. Invisible while
  every caller passed 54 pins spread across the territory; immediate for a reader with *one* saved
  property. Capped at zoom 16, and **clamped on the next `idle` rather than straight after
  `fitBounds`**, because the new zoom is not guaranteed readable on the same tick and reading it
  early clamps a stale value while leaving the real one alone.
- **The yield badge was absolutely positioned in a card with no `relative`**, and would have sat
  over the price on any property without a photo. It now only overlays a photo, and moves inline
  when there isn't one.

Verified in a browser against a real session: logged out → sample mode with its banner; signed in
with nothing saved → defaults to sample, and *My properties* shows a real empty state with a CTA
(not a blank panel); with three saved → defaults to *My properties*, "3 of 3 saved", one mapped and
two correctly reported unmapped. Filters in table view where rows are countable: 3 → under 500 sq ft
1 → from a link 1 → also has photos 1 → tracked only 1 → reset 3; searching "Tsuen" → 1. Switching
back to the sample returns 54 rows and the banner. No horizontal overflow at 1400px or 390px, no
console errors, 36 engine tests still pass. Throwaway account and every storage object deleted
afterwards.

## A heart, a tick, and a Compare button (17/08/2026)

Asked for Zillow's heart on the listing cards, a checkbox on the saved ones, and a Compare button
that puts them side by side.

### The heart means two different things, and that is the honest mapping

Zillow's heart means *keep this*. Here that lands on two concepts that already exist, and forcing
one behaviour would have meant inventing a third:

- **A sample listing is not yours yet** → the heart **saves** it, through the same
  `POST /properties` and the same `listingToDraft` the report's Save button uses. A hearted card
  and the report you would have reached by clicking through therefore cannot disagree about the
  figures, because neither re-derives them.
- **A saved property is already yours** → nothing to save, so the heart toggles **`monitored`**,
  the flag that already existed and already feeds `/portfolio/alerts`. That is what "keep an eye
  on this" actually means in this product.

Both are labelled, so nobody infers it from an icon. Filled vs outlined rather than two colours,
for the same reason report severities carry a shape as well as a hue.

### Saving a fabricated listing needed a column, not a label

Hearting a sample puts invented figures in the same table as somebody's real flat — the table
alerts run against. Flagged before building rather than after. What makes it defensible is that
`listingToDraft` already labels them "2-bed sample flat — Central and Western", so a saved sample
is self-identifying wherever it appears.

But a label cannot do the two things the heart needs. It cannot answer **is this already saved**
(the heart has to render filled before anything is clicked) and it is not an **identity**
(un-hearting must delete the row *this* listing produced, and three listings share a district and
can share a bedroom count, so labels collide by construction). Hence `properties.demo_listing_id`,
nullable, with a **partial index** on `(owner_id, demo_listing_id) where not null` — the only query
is "which samples has this owner saved", which never wants the null majority. Not a foreign key:
the catalogue is a TypeScript fixture, and seeding fabricated rows into the database to point at is
the thing this project refuses.

### The tick only exists on saved cards

The comparison reads **stored snapshots**, so there is nothing for it to show about a listing
nobody has saved. Heart first, then the tick appears. `MAX_COMPARE` moved out of the compare page
into `listing-actions.tsx`, because the bar has to disable at the ceiling and the page has to
enforce it — two copies of that number is one too many.

The bar is **fixed to the bottom of the viewport**, since the thing it acts on is the list you are
scrolling; a button that scrolls away with the first card you ticked is a button you hunt for
again. With one selected it says so and shows Compare **disabled rather than absent** — a control
that only appears once the condition is met leaves a reader unsure whether a second tick does
anything.

### Three things found while building it

- **`useSearchParams` broke the production build.** Reading `?ids=` with it opts a page out of
  static prerendering unless wrapped in `Suspense`, and `next build` failed on
  `/portfolio/compare` — loudly, which is the good case. Replaced by reading `location.search`
  once inside the load effect, which is also **truer to the intent**: the ids are a *seed*, not
  state. A reader who unticks a column must not have it reinstated because the URL still names it,
  so the hook's reactivity would itself have been a bug. Ids that are not the caller's never match
  a loaded row, so a hand-edited URL smuggles nothing in.
- **The compare page had no loading and no error state.** It rendered its heading over empty space
  while two fetches were in flight, and a rejected fetch left it that way for ever — identical to
  having saved nothing. Found by a screenshot of a blank page, not by reading the code. Both states
  exist now.
- **A NUL byte got written into `property-finder.tsx`** by an over-escaped sentinel string in an
  edit script; `grep` reporting the file as binary is what caught it. The sentinel was a bad idea
  anyway and became a named helper.

Verified against a real session: signed out the heart routes to `/login` rather than failing
silently; hearting three samples produced three 201s for three distinct listings; three ticks
appeared, and only on saved cards; the bar read "1 selected — pick one more", then 2, then "3 is
the maximum"; Compare landed on `?ids=…` with four header columns and three pressed pills; and
un-hearting took the count 3 → 2, deleting the right row. In My-properties mode the heart flipped
`monitored` 0 → 1. No horizontal overflow at 1500px or 390px, no console errors, 36 engine tests
pass, production build clean. Throwaway account deleted afterwards.

## The whole card opens the listing (17/08/2026)

Asked to make the entire card clickable, photo included, rather than only its button.

**A "stretched link", not an `onClick` on the card.** An `onClick` has no `href`, so middle-click,
Cmd-click, "open in new tab" and the status-bar preview all stop working, and a keyboard user gets
nothing to focus. A `<Link>` *wrapping* the card was the other obvious option and is invalid: the
heart, the compare tick and the CTA are themselves interactive, and an anchor inside an anchor
behaves differently in every browser. So: one absolutely positioned anchor covering the card at
`z-10`, with those three raised to `z-20`. The text sits *under* the overlay, which is what makes
clicking the text navigate.

**The accessible name is the card's whole substance** — "2-bed sample flat in Central and Western,
HKD 9.11M, 2.68% net yield — open the full report" — because that is what a screen-reader user
hears when tabbing a list of links. Twelve links all named "View full analysis" would be useless.

**The visible button stays, with `tabIndex={-1}`.** A clickable card is discoverable only by trying
it, so the button still says so; but the overlay already gives the card one tab stop, and two
focusable links to the same destination is one too many.

Verified in a browser, one page per assertion (sharing a page raced each navigation against the
previous one's prefetches, which failed the harness rather than the feature): clicking the photo
and clicking the text both land on `/analyse?listing=HK-CW-3`; clicking the heart goes to `/login`
and **does not** open the listing; the anchors alternate `[null, "-1", null, "-1"]`, confirming one
focusable overlay and one non-focusable CTA per card. No overflow, no console errors, production
build clean.

**Playwright note for next time:** it refuses to click an element another element intercepts, which
is exactly what a correct overlay does — so `img.click()` retries forever and looks like a bug in
the feature. Click a coordinate instead; that is what a user does anyway.

## Photos on the report, and notes you can compare (18/08/2026)

Asked for two things: show photos on `/analyse`, and let a reader write notes on a property that
can be retrieved and compared as annotations.

### Photos and notes on the report — and the auth race that was hiding the whole path

Both belong to a *row*, so they appear when the report was opened from a saved property
(`?property=<id>`) and **detach the moment the figures are edited** — leaving a reader's own
photographs attached to numbers that no longer describe that flat would quietly imply the photos
are of whatever is now in the form.

This is the exception to the rule that **the report carries no photography**. That rule exists
because a stock interior beside somebody's figures reads as a picture of *their* flat — the same
false claim the product refuses to make with a number. These are the only images that can't be
that: the reader took them, of the property the figures describe. Notes are the same case — the
reader's observations, not an assertion Veela is making.

**Building this surfaced a real bug on the very path it targets.** `submit()` treated
`user === null` as "signed out" and **navigated away to `/login`** — correct on a click, where auth
resolved long ago, but `?property=<id>` submits from a *mount effect*, so it raced `useAuth` and
lost. Every direct visit to a saved property bounced a **signed-in** reader to the login screen and
stashed their draft. Reproduced in a browser: the page rendered nothing but "Log in". Worth noting
how it hid — the recurring `GET /login?next=/analyse` lines in the dev log had been written off as
Next prefetching a link on the page. Fixed by holding the submit while `authLoading` is true and
replaying it once auth resolves, which closes the class rather than the one caller that exposed it.

### Notes are dated rows, not one editable field

`property_notes`, newest first. A single `notes` column would have satisfied "show it on the
comparison" and destroyed the thing that makes notes worth keeping: **when you thought it.** Notes
on a flat accumulate across a viewing, a second viewing, what the agent said and what the bank
quoted, and the sequence is the substance — one column turns that into a blob somebody hand-dates,
where every edit silently overwrites what it used to say. `updatedAt` is kept distinct from
`createdAt` so a revised note says *edited* rather than appearing to have always read that way.

No author column and no replies: a property has exactly one owner in this schema and nothing is
shared, so an author field could only ever repeat `ownerId`.

**The comparison shows the latest note per property plus a count** — which is all a single column
could ever have shown — from **one** request using `distinct on (property_id)`, not one request per
column. A comparison row has space for a line or two, and shipping a property's whole history to
render its most recent line is waste that grows with use. The count is displayed so one line never
implies it is everything written.

**Plain text, never markdown**, with newlines preserved. Same rule the AI brief follows: rendering
stored text as markup means trusting it as markup. Here the text is the reader's own so the risk is
smaller — but so is the reason to add a parser.

**Zod trims before checking length**, because `"   "` passes `min(1)` and then fails the database's
`length(btrim(body)) > 0` constraint — a 500 on something the schema was supposed to catch.

### The ambiguous-destructive-label mistake, again

A test deleted a property while trying to delete a note: `getByRole("button", { name: "Delete" })`
substring-matches **"Delete property"** on the same card. That is the second time this exact shape
of bug has bitten (the photo tiles were the first), so the note controls now carry
`aria-label="Delete this note"` / `"Edit this note"` — which is what a screen-reader user needs
anyway, sitting a few pixels from a control that deletes the whole property.

Verified against a real session: Photos and Notes both render on `?property=`; Add is disabled when
empty **and on whitespace only**; a note saves, edits, and shows "18 AUG 2026 · EDITED"; editing the
price detaches both sections; a note can be written from the portfolio card; the comparison's "Your
notes" row shows both properties' latest notes with "latest of 1"; a note deletes. No horizontal
overflow at 1500px or 390px. Throwaway account, its notes and every storage object deleted
afterwards.

## Validation errors that name a field the reader can see (18/08/2026)

Reported with a screenshot: the report failed and the panel said

> `label: String must contain at least 1 character(s); priceMinor: Number must be greater than 0`

That was `parsed.error.issues` printed verbatim. Three problems, and only the last is cosmetic:

1. **`priceMinor` is not a field anyone can see.** It is the API's name, in cents, for the box the
   form labels *Price*. Naming it sends a reader looking for something that is not on screen.
2. **It says what failed and never what to do.** "Number must be greater than 0" is a predicate.
3. It is written for whoever wrote the schema.

Now each issue maps to the field's **visible label**, a sentence about what is wrong, and the fix —
"Price — The purchase price is missing or zero. Enter what you would pay for the flat. Every figure
in the report — stamp duty, yield, payback — is derived from it."

**The map lives directly beneath `draftToApiInput`**, which is the function deciding which `Draft`
field becomes which API path. This is its inverse; in another file the two would drift the first
time a field was renamed. An unmapped path still renders — naming the raw path is a poor experience
and a far better one than a silent failure.

**One line per field**, not per failing rule: three broken constraints on one number is still one
thing to fix. The heading says *"needs fixing"* rather than *"missing"*, because a vacancy rate of
400 is present and wrong, and calling it missing sends somebody hunting for an empty box.

**Two other messages in the same path were as bad and are fixed with it.** A server rejection said
only `(400)`; it now reads the two shapes a Hono rejection arrives in — plain text from
`HTTPException`, JSON from `zValidator` — and runs Zod issues through the same translator, so a
server-side rejection reads exactly like a client-side one. And the `catch` printed the raw
exception, so a dropped connection surfaced as "Failed to fetch" — which looks like a defect in the
reader's figures. It now says it is probably the connection and that nothing typed has been lost.

**`role="alert"`** on the panel: it appears in place of the report somebody just asked for, and
swapping one for the other silently is the worst case for a screen-reader user.

Verified against a real session at 1400px and 390px: an empty form gives "2 things need fixing"
naming Label and Price; one missing field gives the singular heading; a vacancy of 400 gives
"Vacancy — outside the range a percentage can take. Enter a figure between 0 and 100"; valid
figures render **no** panel; no `priceMinor`, no Zod phrasing, no horizontal overflow, no console
errors.

**Worth knowing:** this panel is only reachable **signed in**. A signed-out submit redirects to
`/login` before validation runs, which is why the first attempt to reproduce it found nothing.

## "Where are the photos when I click a listing?" (18/08/2026)

A fair question with two different answers, and neither was on screen.

**A sample listing.** The card shows a stock interior; the report showed nothing at all, which
reads as broken rather than as a rule. The report now carries the picture through — and **the
picture the reader actually clicked**, which was the awkward part: a card's image is chosen by its
**rank on the page**, not by the listing, precisely so six consecutive cards never repeat from a
set of sixteen. Anything derived from the id collides roughly four times in five across six cards,
so the grid keeps rank and the **link carries the chosen number** (`?listing=…&photo=3`). A link
without one — the table, or a shared URL — falls back to a stable number derived from the id,
which only has to be plausible because nothing shows two of them at once.

The caption is not decoration. The flat is fabricated and the photograph is stock, so it says so
**where the picture is**, not only in a banner further up: *"Stock interior — illustrative only,
not this property."* Same standard the cards already meet, and the reason this is the only
photography the report allows besides the reader's own.

**A report that is not a saved property.** Photos and notes belong to a row, and there isn't one
yet — so the report now says where they live rather than leaving it to be discovered: save it, and
you can attach pictures and write notes that appear whenever you reopen it and show up side by side
on the comparison. That was the real gap behind the question.

Both clear the moment the figures are edited, for the reason the saved-property photos already do.

Verified signed in: the card's `listing-01.jpg` and the report's are the same file, the caption and
alt text both carry the disclaimer, a direct link with no `photo` still shows one, no horizontal
overflow, no console errors.

**Worth knowing:** a *signed-out* click on a sample listing never reaches a report at all — it
redirects to `/login`, because the report is gated. The first attempt to verify this found "no
photo on the report" for that reason and not because the feature was broken.

## The two most-used features that were missing (18/08/2026)

Asked what the most-used features are, and to build them. **Veela has no users, so it has no usage
data** — that had to be said first, because the honest source is what comparable products put at
their centre and charge for, not our own telemetry.

Audited against the price bracket Veela actually sits in (§7 of the market study: Stessa, Landlord
Studio, Lendlord, PropertyData). Already built: the report, area profile, alerts, compare, notes,
photos, importer, market performance, valuation, mortgage stress test. **Genuinely missing and
high-use:** a portfolio total, a hold projection, a PDF export, rent-vs-buy, and saved searches.

Built the first two. Saved searches needs a listings feed we do not have. **PDF export and "5 Land
Registry searches a month" are both advertised on the pricing page and neither exists** — worth
knowing, and mitigated only by that page saying the subscription is not on sale.

### 1. The hold projection — the fourth promised output, finally built

The product set out to produce four things; *capital gain or loss scenarios* was the one never
built. `packages/core/src/projection.ts`, 13 new tests, **49 total**.

**The entire design problem is the growth rate**, because it is one invisible assumption that
decides the answer. Derived from our own RVD series, as at June 2026:

| Look-back | Price CAGR | Rent CAGR |
|---|---|---|
| 5 years | **−3.9%** | +2.8% |
| 10 years | +1.6% | +2.2% |
| 15 years | +3.7% | +2.8% |
| 20 years | **+6.5%** | +4.2% |
| 30 years | +3.5% | +1.9% |

A five-year window says Hong Kong prices *fall*. A twenty-year window, measured from the 2006
trough, says they compound at 6.5%. **Same market, opposite conclusions.** So:

- `projectHold` takes the growth rates as **required arguments with no defaults** — a caller cannot
  get a projection without stating what it assumed.
- `rvdGrowthWindows()` in `@veela/fixtures` **derives every window from the real series**, so no
  rate is typed in and none can go stale.
- The UI makes the window **a control, not a constant**, and the default is the **longest** (30y)
  because it is the one nobody can accuse of being chosen to flatter — deliberately not the 20-year
  figure, which is the most attractive.

Measured in the browser on one property with a fixed 10-year hold: total gain **HK$2.23M** on the
30-year window, **HK$56k** on the 5-year, **HK$3.72M** on the 20-year. A 66× spread from the
look-back alone. Watching that happen teaches more than any caveat could.

**Invariants the tests pin, not policy.** The most important: **year one must equal the report it
sits under** — growth compounds from the *end* of year one, because a projection whose first row
contradicts the report above it reads as the report being wrong. Also: cumulative cash flow is the
running total; equity is exactly value minus balance; a loan reaches zero *at* the end of its term
and not a year early; payments stop mid-projection when the loan is repaid; falling prices produce
a negative gain rather than flooring at zero; and `annualisedReturn` is `null` for a fully-financed
purchase rather than a division by zero dressed as a percentage.

**Two bugs found while writing the tests.** `loanBalanceAfter` is closed-form rather than a
360-iteration loop, because the loop accumulates rounding error and leaves a loan that never quite
reaches zero. And equity was rounding the *difference* of value and balance while the row displayed
each separately — so the arithmetic on screen was a cent out. Now both are rounded first and
subtracted, which is the property a reader checking the row actually needs. The failing test had to
move from majors to **minor units** to assert it: in majors the comparison is `a/100 - b/100`
against `(a-b)/100`, which float division makes unequal in the last bit.

**Deliberately not modelled:** no capital gains tax (Hong Kong has none — a *named rule*, not a
silent assumption), no rate path, no refinancing, no capex. Each would stack a second invisible
assumption on the first.

### 2. Portfolio totals — the thing every comparable tool opens on

`/portfolio` listed properties one card at a time and never said what the portfolio was worth or
earned. Now a summary band above the cards: combined price, monthly rent, annual net income,
blended net yield, and how many are tracked.

**The blended yield is weighted, and that is the point.** A mean of each property's yield flatters
small flats: a HK$3M studio at 4.8% gross beside a HK$30M flat at 2.4% averages to something the
portfolio does not earn. This sums income, sums value, and divides **once** — verified in the
browser at **1.95%** blended net across exactly that pair, which is correctly nearer the expensive
flat than a mean would be.

**It recomputes nothing.** Every figure is summed from the same stored snapshots the cards show, so
the totals cannot disagree with the rows beneath them. A property with no snapshot contributes its
price and rent but is excluded from the yield, **and the count of those is printed** — a blended
yield silently computed over four of seven properties is a wrong number presented as a right one.

Verified at 1500px and 390px: no horizontal overflow, no console errors, 49 engine tests pass.
Throwaway account deleted.

## Resources removed, its content merged into Market Regulations (18/08/2026)

Asked to remove Resources and dispatch its content where needed.

`/resources` carried three things. **One was already a duplicate:** the stamp duty scales, which
`/research/market-regulations` renders from the same `HK_RULE_SETS` object. Two pages, one source
of truth, two copies of the same table — so the merge deleted work rather than moving it.

The other two moved intact: the **20-term glossary** and the **12 official-source links**. Market
Regulations was the right destination rather than the footer or the report, because a reader asking
*"what does saleable area mean"* and a reader asking *"what is the duty on HK$9M"* are the same
reader one paragraph apart, and the definitions were sitting on a different page from the rules
they define. Nothing was rewritten; the only edits were terms that said "see Market Regulations"
now pointing at the page they are on, and the Cap. 349 glossary entry picking up the corrected
HK$500,000 / 3-year penalty.

**The source list is deduplicated against the rule set's own citations** rather than concatenated.
`rules.meta.sources` already prints the IRD URLs the scales come from, and the wider list contains
one of them — so it is filtered, and the page shows twelve links with no repeats rather than
thirteen with one.

Removed from: the sidebar (`TAIL_LINKS`), the dashboard tile, and the account menu's "How it works",
which now points at Market Regulations. **`/resources` 308s** to the new home, permanent because
the page is not coming back — same reasoning as the Services moves.

### A pre-existing hydration bug this surfaced

Market Regulations threw **"Hydration failed because the server rendered HTML didn't match the
client"** on every visit, and had presumably been doing so since it was built. Cause: `ScaleTable`
rendered `<caption className="sr-only">` as a child of a `<div>`, *outside* its `<table>`. A
`<caption>` must be the first child of a table, so the browser relocates a stray one — after which
the hydrated DOM can never match the server HTML.

It was also redundant: the visible label sits directly beneath it. Removed, and the table names
itself with `aria-label` instead. **Found only because merging content into the page meant opening
it in a browser with the console captured** — the page had been shipped, linked and never watched.

Verified: `/resources` redirects and resolves 200 on the destination; all 20 terms present including
*Saleable area*, *Marginal relief* and *Provisional and formal agreement*; 12 external source links
with **no duplicate URLs**; both stamp duty scale tables still render; no Resources anywhere in the
sidebar or on the dashboard; no horizontal overflow; **no console errors**.

## The mobile app: auth, a real portfolio, and the server change it needed (19/08/2026)

Asked to build the mobile app. It **did** build — 1,177 modules into a 3.76 MB Hermes bundle on the
first try, verified with `expo export` before touching anything. The Analyse screen and Map were
already real; the Portfolio was an honest stub whose own comment named the blocker. That blocker was
item 2 on this file's "deliberately not built yet" list, so that is what got built.

### The blocker was on the server, not the phone

`currentUserId()` in the route handler read the Supabase session **out of the cookie jar**. Exactly
right for a browser and useless for React Native, which has no cookies — so every `/properties` call
from the app resolved to anonymous and 401ed. No amount of client work fixes that.

The API now accepts `Authorization: Bearer <jwt>` as well as cookies. Three decisions in it:

- **The token is verified, never decoded.** `getUser(token)` asks Supabase whether the JWT is
  genuine and unexpired. Reading its claims locally would accept anything shaped like a JWT, which
  is the difference between authentication and decoration. It costs a round trip and that is the
  correct cost.
- **Bearer wins when present, and a bad Bearer is a clean 401** rather than a fall-through to
  cookies. Falling through would silently downgrade a rejected token to whatever cookie happened to
  be in the jar, which is worse than failing.
- **A plain client, not the SSR one** — there is no cookie jar and nothing to persist, so
  `persistSession: false`.

Verified against the running API with real tokens before any UI was written: no token → 401, garbage
token → 401, valid token → 200, and `POST /properties` → 201 with a computed verdict that then
appears in the authenticated list.

### Session handling is hand-rolled, and here is the trade-off

`lib/session.ts` talks to Supabase's two documented grants over plain `fetch` instead of pulling in
`@supabase/supabase-js`. The phone needs exactly two things from Supabase — password → session, and
refresh token → session — and the full client historically wants URL and stream polyfills under
React Native for behaviour that is about forty lines here.

**What we take on by doing that: we own refresh.** It happens on demand, when a request is about to
go out and the token is within two minutes of expiry, plus once reactively if the API still says 401.
No timers — a timer cannot fire while the app is asleep, and a request is the only thing that needs
a valid token anyway. The 401 retry runs **once**: a loop would hammer the auth endpoint with a
refresh token the server has already refused.

Both grants were tested against real Supabase. Worth recording: **refresh rotates the refresh
token** — a new one comes back and must be stored, which `persist()` does. A naive implementation
that kept the original would work once and then fail forever.

**Tokens are stored as three `SecureStore` keys, not one JSON blob.** `SecureStore` values are capped
at 2 KB on Android and an access token alone is often close to a kilobyte, so a combined blob is a
size limit waiting to be hit in production on the devices hardest to debug.

### The portfolio, and one deliberate duplication

Real list now: totals, then a card per property with its stored net yield, all from the same
snapshots the web reads. The blended yield **sums income and sums value and divides once** — the same
weighting argument as the web's summary, written in the same words on purpose, so the two surfaces
cannot drift into disagreeing about what a portfolio yields.

`SavedProperty` is hand-declared in `lib/api.ts` rather than imported from `@veela/db`: that package
pulls Drizzle and a Postgres driver, neither of which belongs in a phone bundle. The wire shape is
still pinned by `createPropertySchema` on the way in.

### What is deliberately absent, and why

- **No Google sign-in.** OAuth on native needs a redirect scheme in `app.json` and a deep-link
  handler — a build-configuration change that cannot be verified from here. Email and password work
  end to end; the screen says so.
- **No sign-up.** Creating an account is where consent to the dated terms and privacy statement is
  recorded, and that record is the one thing in this product that cannot be retrofitted. Reproducing
  it loosely on a second surface would mean accounts with no record of what they agreed to. The
  screen points at the web.

### Two things found on the way

- **`platforms` was undeclared in `app.json`**, so Expo offered a web target that cannot start —
  `react-native-web` is not installed. Now `["ios", "android"]`, which is what the app actually
  supports. A config claiming a capability it cannot honour is the same class of problem as a
  pricing page advertising a missing feature.
- **Typed routes are generated by `expo start`, not `expo export`.** `router.push("/sign-in")` failed
  to typecheck against a stale `.expo/types/router.d.ts` even after a successful bundle. Starting the
  dev server once regenerates it.

**I could not run the app.** No emulator or device is available here, and the web target is not
installed — so this is verified by: a clean iOS bundle (1,183 modules after the changes), a clean
typecheck of every package including mobile, and the API and Supabase contracts exercised with real
tokens against the running server. The screens themselves have not been seen rendering, and that
should be said plainly rather than implied by the rest passing.

## Short-term against long-term yield — built 20/08/2026, **removed 21/08/2026**

> **This feature no longer exists.** Asked the next day: *"if short term rental is not relevant in
> HK then remove it"* — and removed, engine and all. `packages/core/src/letting.ts`, its 15 tests
> and `components/letting-strategy.tsx` are deleted; the engine is back to 49 tests. The section
> below is kept in full because **the decision to build it and the decision to remove it were both
> deliberate, and the reasoning that survives is the product's position**: for an ordinary
> unlicensed flat, long-term letting is the only lawful strategy, so it is the only one modelled.
> What the removal settles is that the *licensed* case is not worth carrying either — a calculator
> for the small minority who hold a Cap. 349 licence is not what this product is for, and dead code
> that computes an income most readers cannot lawfully earn is worse than no code.
>
> Two knock-ons went with it: the landing page stopped claiming a short-term yield is "computed only
> for licensed premises" (true only while that existed), and `district-overview.tsx`'s standing line
> — *"there is no short-term figure to compute and none is shown anywhere in this product"* — is
> **true again**, which is the cleanest possible confirmation that the product is back to one
> coherent position.

## The original build, kept for the record (20/08/2026)

Asked directly to compute and display short-term (Airbnb) and long-term yield. **This is the
request that runs into the hardest line in the product**, and the record of the two earlier
refusals is what makes acting on it a decision rather than an erosion:

- *"Not built: the Traditional/Airbnb strategy toggle"* — Cap. 349 makes letting under 28
  consecutive days without a guesthouse licence a criminal offence, so *"the toggle stayed out
  rather than being quietly added because the reference tool has one."*
- The landing page said, in a display headline: **"There is no Airbnb calculator here, and there
  never will be."**

**The conflict was raised in two sentences before anything was built, and then the work was
delivered** — because the refusal, restated precisely, does not actually forbid the feature.
Short-term letting is not unlawful in itself; **it is unlawful without a licence**, and licensed
guesthouses are an ordinary legal business. So the figure exists — it belongs to a licensee. What
had to change was *who the calculation is for*, not whether it can be computed.

### The licence gates the arithmetic, not a disclaimer under it

`packages/core/src/letting.ts` takes `licensed: boolean` with **no default**, and returns
`shortTerm: null` when it is false. The refusal lives in the **engine**, so no later UI change can
accidentally put a short-term figure in front of somebody who has not said they hold a licence —
the same reasoning that makes `projectHold` demand its growth rates as required arguments. The null
is accompanied by `unlicensed: true`, so the panel can **explain** rather than render an empty box:
*"the income would be unlawful to earn, so the calculation is refused rather than displayed with a
warning."*

### The comparison is more dangerous than either number, and that shaped the engine

A long-term net yield in this product is **after** Hong Kong property tax. A licensed short-let
operation is a **trade**, so property tax is the wrong instrument — profits tax is. Putting a
**pre-tax** short-term figure beside a **post-tax** long-term one would flatter short-term by its
entire tax bill, which is the single easiest way to mislead somebody here. So the engine models
profits tax and `netYieldDifference` is only ever computed between two post-tax numbers.

`HK_PROFITS_TAX_DEFAULT` is **flagged `unverified`** and the panel's *"confirm the tax treatment
with an accountant"* line is **keyed off that flag** — identical to `HK_LENDING_DEFAULT`, and a
test asserts the flag is still set, so clearing it without sourcing the rates would also silently
delete the warning. Whether a given operation is assessed under profits tax at all depends on
scale and structure, facts a calculator does not have.

Both sides are **unlevered and share one denominator** (cash to acquire). The owner's fixed costs
— building management fee, government rates, other annual costs — fall on **both** sides;
`rentalIncomeTax` and `mortgageInterest` fall on neither, since profits tax replaces the first and
both yields exclude the second.

### There is no Hong Kong short-let data, so the two key fields start blank

The long-term side can estimate a rent only because the RVD publishes market yields by Class.
**Nobody publishes nightly rates or occupancy for Hong Kong.** So those two inputs have **no
default** — a prefilled occupancy rate is exactly the plausible-looking invented number this
product refuses everywhere else — and the panel says on screen, next to them, that the figures
are the reader's and not ours. The cost fields (cleaning, platform commission, a manager's cut)
*do* carry conventional defaults, because those are contract terms rather than market measurements.

**The lawful alternative is shown to everybody, outside the gate**, because most readers do not
hold a licence and the useful thing to tell them is that **a letting of 28 days or more needs
none** — serviced monthly lettings to relocating staff are lawful and usually better paid than an
ordinary two-year tenancy. That is a real strategy, not a consolation prize, and it is modelled on
the long-term side by entering the higher rent and a vacancy rate that reflects the turnover.

### The landing page had to change, and it was already contradicting itself

Shipping this while the site still promised *"there never will be"* would make the product lie
about itself — worse than either decision. The headline is now **"Short-term letting here is
licensed, or it is a crime."**, and the body states that Veela computes a short-term yield **only
for licensed premises** and will not run the calculation until you say you hold one.

**Found while editing it: the same section quoted both the current and the superseded penalty at
once.** The 18/08 correction updated the paragraph to HK$500,000 / three years and **missed the
stat tile beside it**, which still read **HK$200k**. A page stating two different maximum fines
for a criminal offence, three inches apart. Fixed, and the tile now carries a comment saying why.

### 15 new engine tests, 64 total

They pin invariants, never policy. The two that matter most: **an unlicensed short-let yields
nothing** (not zero, not an estimate with a warning), and **the difference is between two post-tax
yields**. Also: cleaning is charged per *stay* not per night (a fortnight-long booking is cleaned
once), a blank average-stay cannot divide by zero, occupancy is clamped so 150% cannot invent
nights, a loss is untaxed but not floored at zero, and every cost line reconciles to the profit
before tax.

**One real bug the tests caught.** The net yield was derived from the *unrounded* net income while
the row displayed the rounded one — so a reader dividing the two numbers on screen would not get
the percentage beside them. Rounded before subtracting now, the same lesson `projection.ts`
learned about equity.

### Verified in a browser, and the useful result

Through a temporary harness (the report is login-gated), deleted afterwards. On a HK$9M / 550 sqft
flat at HK$22,000 rent, against HK$1,200 a night at 70% occupancy: long-term **1.87%**, short-term
**1.55%** — **short-term is worse**, once a manager's cut, cleaning and profits tax are counted.
That is worth knowing: the feature does not exist to flatter short-term letting, and on realistic
Hong Kong assumptions it frequently will not.

Checked: the refusal before ticking, the seven fields after, both blank fields staying blank, the
cost table reconciling, the comparison sentence, the accountant caveat, and the figure
**disappearing again** when the licence is unticked. No horizontal overflow at 1400px or 390px, no
console errors, 64 tests pass, production build clean.

**Two things worth knowing for next time.** A route folder named `__harness-letting` **404s** —
the App Router treats a leading underscore as a private folder, excluded from routing. And a
Playwright click that lands **before hydration** toggles the DOM checkbox while React state stays
`false`, which looks exactly like a broken control: the DOM read checked, the panel stayed shut,
and a double-toggling label was suspected and wrongly blamed before the real cause was found. The
suspicion is recorded in the component rather than deleted, because a plausible wrong diagnosis is
worth as much to the next reader as the right one.

## Rent by area, comparables, and a collector that holds a line (21/08/2026)

Four requests in one sitting: show the average rent per area, show similar listings, "create and
run an agent to scrape and collect data permanently from all reliable sources", and — separately —
make the report photo a card-sized slideshow.

### The research came first, because "average rent per area" is not one lookup

**Hong Kong publishes no per-district private rent series. At all.** Established against
data.gov.hk's own package API rather than assumed, and worth writing down because it is the third
time this gap has been rediscovered:

| Source | District-level? | Rents? |
|---|---|---|
| RVD district open data (10 domestic resources) | **Yes, 18 districts** | **No** — stock, completions, vacancy only |
| RVD rent index (`rvd-real.ts`) | No, territory-wide | Yes, monthly |
| RVD *Average Rents by Class*, annual | **By region — 3 areas** | **Yes, HK$/m²/month** |
| Census 2021 district profiles | **Yes, 18 districts** | **Yes — but all tenures** |
| Land Registry | n/a | No rents whatever, at any price |

So two real geographic rent figures exist, and the build uses both:

- **`packages/fixtures/src/rvd-rents.ts`** (new, fourth genuine module) — RVD's own
  `1.1A(from_99).csv`, 1999–2025, five Classes × three regions. A true *private-market* rent, at
  the finest real geography there is for one. Class B Kowloon 2025 is HK$371/m²/month, which for a
  550 sq ft flat is **HK$18,957**.
- **`packages/fixtures/src/census-real.ts`** (new, third genuine module) — Census 2021
  `DC_21C.xlsx`, median monthly household rent by district, plus rent-to-income and the
  housing-type shares.

**Both generated by scripts, never typed** (`scripts/gen-rvd-rents.py`, `scripts/gen-census-real.py`)
— eighteen districts times six figures is exactly the size at which a transcription error is both
likely and invisible. Same reasoning as `rvdGrowthWindows()` deriving its rates from the series.

### The Census figure is a trap, and the module is built to stop it

Wong Tai Sin's median rent is **HK$2,430**. Central and Western's is **HK$15,070**. Almost none of
that sixfold gap is the market: **half of Wong Tai Sin's households are in public rental housing**
and 3% of Central and Western's are. Showing HK$2,430 to someone pricing a private flat would be
among the most misleading things this product could do.

So `publicRentalShare` sits in the same record and is not optional, `rentContext()` returns the
number and a ready-made caveat sentence **together** so it is awkward to display one without the
other, and the panel prints *"This is not a private market rent"* in bold above the explanation.
The private-market figure sits directly above it for contrast. Verified on screen with exactly
that district, because it is the worst case.

**The alternative was spreading a territory-wide rent across eighteen districts to look precise.**
That is the thing this codebase already refused when the same gap appeared for price indices.
Three real regions beat eighteen invented ones.

### The collector, and what it will not collect

`scripts/ingest-official.mjs` — runs, verified against all five live sources, `--check` for CI.

**It deliberately collects nothing from Centaline, Midland, Squarefoot, 28Hse, House730 or
Spacious**, and the file says so at length rather than leaving the absence to be read as an
oversight. "All reliable sources" cannot mean those: their terms prohibit bulk extraction, two of
them answer a real browser with a Cloudflare challenge (tested, not assumed), and **the listing
importer's Spacious bypass is not a precedent** — that exists for one page a user pasted, on a
two-host allowlist, at the moment they ask. A crawler taking the whole catalogue on a timer is a
different activity with a different name, whatever the transport looks like. Licensing stays open;
a scheduled scraper does not.

**It does two different jobs, on purpose.** Sources that move monthly get fetched and parsed.
Sources that move *once a decade* get a committed snapshot plus a **drift check** — the Census
file is compared by byte length, the RVD CSV by whether its latest year is still in the snapshot.
A cron job re-deriving the 2021 Census every night would be pure motion; a check that the snapshot
still matches what the department serves is what keeps it honest. The three known dead ends are
listed in the file under *"do not go looking again"*.

The database write is the one piece not built: `market_observations` has no `median_rent` metric
and there is no `DATABASE_URL` here, so it reports what it would write rather than claiming to
have written it.

### Similar listings — the screening is real, the stock is not

`components/similar-listings.tsx` ranks the fifty-four generated samples by district, then RVD
size Class, then nearest price per square foot, and **prints why each row is there** ("same
district · different size class"). Ranked rather than filtered: a hard filter returns nothing for
a district with three samples, and an empty panel teaches less than four imperfect rows that admit
how imperfect they are.

Every yield comes from `listingToDraft` → `draftToCoreInput` → `computeVerdict` — the *same* chain
the finder's cards use, imported rather than reimplemented, because this codebase has already had
the bug where two call sites derived a listing's figures independently and the card disagreed with
the report it opened. The disclosure sits **above** the rows, not below.

### The photo, three sizes in two days

Full-bleed 16:9 → 96px thumbnail → **card**. The first was over a thousand pixels tall on a wide
screen; the second was too apologetic to justify the space. Now a 480px card with a five-photo
slideshow, arrows, dots, arrow-key support and **no autoplay** (a carousel that advances by itself
moves the page under somebody reading a tax figure).

**A gallery makes a claim a single photo did not.** One labelled stock photo says "illustratively,
a flat". Five in a slideshow says "five views of *this* flat" — false twice over. So the caption
states the count and says they are **unrelated** interiors, different rooms in different buildings,
none in Hong Kong. That sentence is the price of the feature.

### Two things fixed in passing, both of which were the product contradicting itself

- **The pricing card claimed "everything it unlocks already works".** It does not: Land Registry
  searches and the PDF export are advertised and unbuilt. `plans.ts` now types a feature as either
  a string or `{ text, planned: true }`, the card renders planned ones dimmed with a **"not built
  yet"** tag. The note first spelled out both blockers — no payment processor, and no named
  invoicing entity, the one only the founder can clear — and was **cut back to one sentence on
  21/08/2026**: accurate, but a buyer reading a price list does not need our incorporation status.
  It now says billing is not connected and how to get in line; the blockers stay recorded here,
  and the unbuilt features keep their own tags, so nothing honest was lost with the length. On a page with a price on it, an advertised feature
  that does not exist is a Trade Descriptions Ordinance (Cap. 362) question, not a copy preference.
- **The More filters panel was pinned to the right edge** (`sm:left-auto` against `right-0`) while
  the button that opens it sits at the far left of a 1400px bar. A popover a thousand pixels from
  its own control reads as an unrelated overlay. The old comment justified it as "so it cannot run
  off the viewport", which `max-w-[calc(100vw-2rem)]` already handles.

### Verified

64 engine tests, clean typecheck across all 8 packages, clean production build, and the panels
checked in a browser at 1400px and 390px through a temporary harness (the report is login-gated) —
harness deleted. Slideshow: 5 slides, 5 dots, opens on the clicked photo, advances and wraps.
Rent panel: the three regional figures reconcile by hand (51.096 m² × HK$371 = HK$18,957), the
Wong Tai Sin caveat renders, and a report with **no** district still shows all three regions rather
than nothing. Comparables: four rows, three same-district, ranking as designed, price-per-square-foot
spread correct. No horizontal overflow, no console errors.

**Two things worth knowing.** `@veela/api`'s `dist/` bit again — the `plans.ts` type change
typechecked green everywhere until `apps/web` failed on a stale `dist`, which is the trap this file
already warns about twice. And a Server Component cannot pass a function to a Client Component, so
the harness needed `"use client"`; the real `/analyse` page is already one, which is why
`comparableNetYield` is fine there.

## The landing page sells the service now, and a fetch error says something useful (21/08/2026)

### The dark band stopped leading with a criminal penalty

Shown the Cap. 349 section and asked for *"something more attractive to present our services"* —
a fair critique of prime landing-page space. It was a full-width dark band headlined **"Short-term
letting here is licensed, or it is a crime"**, with tiles reading *minimum let / maximum fine*. A
page block whose largest words are about a crime, warning readers off something the product does
not do.

Rewritten as **"Built for Hong Kong, not adapted to it."** — the same section, now leading with
what Veela actually offers: the ad valorem scales transcribed from the IRD and versioned by
transaction date, property tax at 15% on 80%, no capital gains tax written as a *named Hong Kong
rule* rather than baked into the maths, RVD series monthly back to 1993.

**The Cap. 349 point survives as evidence rather than as the headline**, in one sentence: it is the
sharpest single proof of knowing this market, since the feature every reference product leads with
is the one that is criminal here without a licence. The full rule and the penalties live on Market
Regulations, where somebody looking them up will be.

**The tiles are facts checkable from this repository** — **49** engine tests, IRD scales, RVD from
1993, zero invented figures. (It said 64 for about an hour: the short-let removal took 15 tests
with it, and a stale count on a tile whose whole purpose is being checkable is the same class of
error as a stale price on the pricing page. Caught by re-running the suite after the removal.) The
reference products fill this slot with *"Trusted by 50,000+ investors"*; Veela has no users, so any
number of that shape would be invented. Same rule `FactBar` already follows on the service pages,
and for somebody deciding whether to trust a stamp duty figure, "tested at every band boundary" is
the stronger claim anyway.

### "Failed to fetch" was reaching the reader

Reported with a screenshot: a building lookup showed the single red line **"Failed to fetch"** under
the reader's own address. That is the browser's raw `TypeError` when a request never reaches the
server — and it names no cause, suggests nothing to do, and sitting beneath *their* property it
reads as a defect in their data rather than a dropped connection. (It fired because the dev server
was down mid-rebuild, which is incidental; the defect is that the string was ever shown.)

**This exact failure had already been fixed once**, on the report's submit path, where a dropped
connection surfaced as the identical words. It was never fixed in `neighbourhood-panel.tsx` — which
is the argument for `describeFetchFailure()` being a named function rather than a `catch` block
written afresh at each call site.

**The distinction it draws is transport versus upstream.** A `TypeError` from `fetch` means the
request did not arrive, so retrying is the sensible move and the message says so — *"usually the
connection rather than the address. Nothing you have entered has been lost."* Anything else came
back **from our own handler** (Overpass refusing, a bad coordinate) and is passed through unchanged,
because the handler knows things this function does not. Keyed on the **type**, never the message
text: browsers word it differently ("Failed to fetch", "NetworkError…", "Load failed").

A **Try again** button sits beside it, because telling somebody to try again with nothing to press
is an instruction to reload the page and lose the form.

**Verified with a forced outage**, not a mocked 500 — Playwright aborting the request at the
transport layer, which is the only way to produce the real `TypeError`. A 500 comes back from the
handler and takes the other branch. Message correct, no raw string, retry present, and pressing it
with the network restored loaded the data.

*Worth knowing for the next test:* `[role="alert"]` is not a safe selector for "our error is on
screen". Next.js mounts its own permanently-empty `__next-route-announcer__` with that role on every
page, so a `state: "detached"` wait on it never resolves and looks like a failed retry. It was not.

## A map beside the photographs, and the zoom that decides what it claims (21/08/2026)

Asked to put the slideshow on the right and a map on the left, to use the empty half of the row.
Straightforward layout — `lg:grid-cols-2`, two equal 500px columns at 1500px, stacking on a phone —
and one real question underneath it: **a map of what?**

**Map left, photographs right**, deliberately: the location is the fact, the pictures are
illustration, and on a left-to-right page the fact goes first. They stack in that order below `lg`
for the same reason.

### `ReportLocationMap` renders one of two different things, and says which

- **A real position** — coordinates a listing published, or the building the reader picked — gets a
  **dot at zoom 16**, and a caption saying so. A true statement about a real place.
- **Everything else** gets the **district centroid at zoom 13**, marked with a soft *ring* rather
  than a dot, captioned **"Wong Tai Sin — the district, not the flat."**

**The second case is the whole design.** A sample listing has no address *by construction* — no
building name, no street, no unit, a rule this file has held since the fixtures were written. A
tight pin beside one would assert a specific location for a flat that does not exist, and this
codebase already knows that "a wrong pin on a real map reads as data, never as the parsing bug it
is". An invented pin reads exactly the same way.

So the fix is not to hide the map, it is to **zoom it out to the level the data supports**. The
district is real; `DISTRICT_CENTRES` is genuine geography accurate to a few hundred metres, which is
fine for "this district is here" and useless for an address — precisely the claim the caption makes.
**Zoom carries the claim**, and the marker shape carries it a second time: a ring stands for an area,
a dot for a point.

Returns `null` with neither, and the slideshow then keeps the whole row rather than sitting beside a
hole. Behind `hasMapsKey`, like every other map here — no key, no map, and the report is unharmed.

**Verified in a browser at 1500px and 390px**, both cases on one harness (deleted): the district map
draws Wong Tai Sin at 13 with the ring, the precise map draws Mong Kok at 16 with the dot, both
captions render, columns are equal at 500px, they stack map-above-photos on a phone, no horizontal
overflow, no console errors.

*Worth knowing:* `canvas` is not a reliable "did the map draw" probe — Google served **raster
tiles**, so the map was fully rendered with no `<canvas>` on the page at all. The screenshot is what
settled it, which is the argument for looking at one rather than asserting from a selector count.

## Every page and every link, tested — and the four things it found (21/08/2026)

Asked to test the whole app and fix all broken links. `scripts/check-links.mjs` is the tool that
came out of it, committed rather than thrown away, because "are the links still good" is a question
that recurs after every Budget and every government site redesign.

    pnpm dev                                  # in another terminal
    node scripts/check-links.mjs              # pages, links, console errors
    node scripts/check-links.mjs --external   # also fetch every outbound link
    node scripts/check-links.mjs --ci         # exit 1 on any failure

**Result: 43 pages, no 404s, no console errors, no failures.** Four real defects on the way there,
and not one of them was a dead `href`.

### 1. A hydration failure on every page carrying a chart

`/map` and `/research/market-performance` threw **"Hydration failed because the server rendered
HTML didn't match the client"** on every visit. Cause: **React 19 treats `<title>` as document
metadata and hoists it into `<head>`**, and inside an `<svg>` the server pass and the client pass
disagree about whether to do it. All four charts did it — `series-chart`, `class-yield-chart`,
`territory-index-chart`, `choropleth`.

Fixed the way the stray `<caption>` on Market Regulations was fixed: **`role="img"` plus
`aria-label`**, which is the recommended pattern for a graphic anyway, needs no generated id, and
cannot be hoisted anywhere. `useId` came out of three of the four files with it.

Found only by crawling with the console captured. The pages had been shipped, linked and looked at
plenty of times.

### 2. `/services` was unreachable

The page returned 200 and **nothing anywhere linked to it**. The sidebar's Services group header is
a toggle *button*, not a link, so the four leaves were reachable by opening the group and the index
was reachable by nothing at all. An unreachable page is a broken link with the arrow pointing the
other way.

Fixed by leading the group with `{ href: "/services", label: "All services" }`, which mirrors My
Workspace exactly — `/portfolio` is that group's own first sub-link — so the shell now has one
pattern for a group with an index instead of two.

### 3. Four dead outbound links, in the worst possible place

All four sat in source lists whose entire claim is *"check us against the primary source"* — which
a 404 quietly withdraws.

| Was | Now |
|---|---|
| `eaa.org.hk/en-us/Information-Centre/Licensee-Search` | `eaa.org.hk/en-us/Licence-list` |
| `hkma.gov.hk/.../statistics/monthly-statistical-bulletin/` | `.../data-and-statistics/monthly-statistical-bulletin/` |
| `rvd.gov.hk/en/public_services/index.html` | `rvd.gov.hk/en/our_services/rates.html` |
| `iir.ia.org.hk/en/` | `iir.ia.org.hk/` |

**Every replacement was confirmed by page title, not just by status code** — "Licence list",
"Monthly Statistical Bulletin", "Register of Licensed Insurance Intermediaries". The last one is
the instructive case: `iir.ia.org.hk` is an Angular app whose language is a *client-side* route, so
`/en/` never reaches it and renders a real "The page cannot be found" — verified in a browser,
because a status code alone cannot tell an SPA shell from a working page.

`clic.org.hk` failed once with `fetch failed` and answered 200 on retry. **Not counted and not
"fixed"** — a third-party timeout says more about the network than the link, and the checker
reports those separately from failures for exactly that reason.

### What the checker cannot see, which is why it asserts as well as crawls

**Collapsed disclosures are not in the DOM.** A shut sidebar group renders no children, so a crawl
starting anywhere else cannot see its leaves — which is precisely how `/services` stayed orphaned
without anyone noticing. Two answers, both in the script:

- `ORPHAN_CANDIDATES` — routes that exist and *must* be reachable, asserted directly rather than
  inferred from a crawl.
- The crawler **opens collapsed navigation groups** before reading links, scoped to `nav`/`aside`.
  A first version clicked *every* `[aria-expanded="false"]` and became unusably slow: a report page
  carries eight amenity-count buttons and a service page five FAQ items, none containing links, and
  each failed click waited out its own timeout. Only navigation hides routes, so only navigation is
  opened. Crawl coverage went 38 pages → 43 with the groups open.

`EXPECTED_REDIRECTS` pins the five deliberate ones (`/resources` and the four old `/services/*`),
because a 200 there would mean a move silently regressed.

**One self-inflicted wound worth recording:** the fix to the Insurance Authority link was first
written as a JSX comment *inside* the `<a>` tag's attribute list, which is a syntax error. The
checker caught it immediately and unmistakably — one page crawled, a 500, and every reachability
assertion failing at once. A link checker that also compiles the app turns out to be a build check
with better error messages.

## Walked the app as four users, and what that found (21/08/2026)

Asked to simulate users and judge how easy the app is to understand and navigate. Four personas
with real goals, driven in a browser, **clicking only what was visible** — no typed URLs, no
knowledge of routes. If a persona could not get somewhere by reading the page, that was the
finding.

### Three real defects, two of them invisible from the code

**1. A logged-out reader lost their listing at the login wall.** `/finder` is ungated on purpose —
fabricated listings are marketing for the report. Click a card and `submit()` sends you to
`/login?next=/analyse`, which **drops the `?listing=`**. The figures survived (the sessionStorage
stash), so the bug was quiet: you came back to a report with the right numbers and **no
photographs, no location map and no district**, because all three are set only by the `?listing=`
branch. The rent panel then had no region to highlight and the comparables no district to rank by
— exactly the context that makes them worth reading. `next` now carries
`window.location.pathname + search`, and the stash effect stands down when the URL has a listing so
the two do not race over `reportGated`.

**2. `?next=` was an open redirect** — found while fixing the first, not reported. `/login` handed
the raw parameter to `window.location.assign`, so `/login?next=https://evil.example` would bounce
somebody through Veela's own correctly-certificated login form and off-site the moment they
authenticate. That is the classic phishing setup. `safeNext()` whitelists *shape* rather than
blacklisting strings — must start `/`, must not start `//` or `/\` (browsers normalise the
backslash) — so a new way of writing an absolute URL fails closed. Verified against four hostile
values; all fall back to `/portfolio`, and a legitimate path still survives.

**3. One page had two navigation names.** `/finder` was **Search** in the product sidebar and
**Finder** in the marketing header. Two navigations of one product disagreeing about what a
destination is called, and a reader who arrives via the header has no reason to think Search is the
same place. The label was inherited from the reference product's sidebar. Now "Finder" in both.

### Two suspicions that were wrong, and are worth recording as such

- **"The landing CTA does not navigate."** It does — `Analyse a property` → `/analyse`,
  `Explore the map` → `/map`. The persona script had clicked before hydration.
- **"The Finder's map opens on Shenzhen."** It does not. The first screenshot was cropped at the
  viewport fold and showed only the map's top edge; shooting the pane itself shows the whole
  territory correctly framed with all 54 pins. **Nearly "fixed" a map that was not broken** — the
  reason to screenshot the element rather than the page.

### Observations left alone, deliberately

- **Nine of eighteen nav labels differ from the heading of the page they open** — "Analyse a
  property" → *"Is this property worth it?"*, "Market Explorer" → *"Supply and demand, by
  district"*. That is editorial voice, and a punchy `h1` is a real design choice; it is only a
  defect when the nav gives a destination a *different name* rather than a different sentence,
  which is why only the Search/Finder case was changed. The remaining near-miss is "Saved
  Properties" → *"My properties"*; flagged, not touched.
- **`/finder` carries two search boxes** — a district filter in the top bar and a real-building
  lookup in the body — and the page opens by explaining that they are not the same thing. When a
  layout needs a paragraph to disambiguate two adjacent controls, that is worth knowing even if the
  copy is honest.
- **Clicking a Services item leaves the product shell**, sidebar and all, because those four pages
  render with the marketing header on purpose. Correct for a stranger arriving from a search
  result, a discontinuity for someone already inside the app.

### What could not be walked

**The logged-in half.** There is no test account password to hand, and creating one burns the free
tier's signup-email quota. So the report itself, the portfolio, alerts and compare were checked
structurally rather than as a user — said plainly rather than implied by the rest passing.

Verified after the changes: 48 pages crawled (up from 43, the renamed nav opening more), no broken
links, no console errors, 49/49 tests, clean typecheck across all 8 packages, clean production
build.

## The heart, at Zillow's proportion — measured, not eyeballed (26/08/2026)

Shown Zillow's card and asked for the same proportion. Measured off their screenshot rather than
matched by impression, because this file already records a pass that "missed by guessing at
'photo-forward' instead of measuring":

| | Zillow | ours before | ours now |
|---|---|---|---|
| heart / card width | 8.7% (30px on 345px) | 6.4% (18px on 280px) | **8.6%** (24px on 280px) |
| corner inset | 4.1% | 3.6% | 4.3% |

The yield badge and the compare tick moved from a 10px to a 12px inset with it. Leaving them
behind would have put two controls on the same visual row at different heights, which reads as a
misalignment rather than a choice.

### Worth knowing

**The size is a prop, not a global bump.** `HeartButton` has four call sites and only one is the
Zillow case — the card, where the heart sits on a photo. The other three sit inline beside a
`CompareCheckbox`, and a 40px button next to a 16px tick would look like a mistake. So
`size="overlay"` is passed at the card and `inline` stays the default at 18px. Verified in a
browser: card hearts 40/24, list-row hearts 32/18.

**Mobile cannot match the proportion, and the heart is not the reason.** At 390px the finder's
cards are **2-up at 173px each**, so a 24px glyph is 13.9%. Zillow shows one card per row on
mobile (~358px), which is how theirs stays at 8.7%. The heart was left at 40px anyway: shrinking a
touch target on touch devices is the wrong direction, and 40px clears WCAG 2.2's 24px minimum
where 32px was nearer the line than it needed to be. **If mobile should match, the change is the
grid going 1-up**, which is a layout decision rather than a sizing one.

**Zillow's fill semantics were deliberately not copied.** Theirs is white-filled-with-outline when
unsaved and solid red when saved — state by colour alone. Ours stays outline-versus-filled, for
the reason already recorded against this component: the state has to survive greyscale and colour
blindness. Matching Zillow exactly would trade that away for a visual.

**The pre-hydration click trap bit again, and cost a wrong diagnosis.** A Playwright click on the
List/Table toggle landed before React hydrated, so the view never changed and the probe reported
the list-row hearts as 40/24 — i.e. that the change had leaked into the inline call sites. It had
not. This file already warns about exactly this against the licence checkbox; the fix is
`waitUntil: "networkidle"` plus a settle before the first click, and the lesson is that a probe
which silently measures the wrong view looks identical to a real regression.

## The landing hero said nothing about what the product does (26/08/2026)

Reported from a phone on production: *"c'est pas clair le site fait quoi avec le message
d'accroche."* Fair. The headline read **"Every number on a Hong Kong flat, and the one that kills
the deal"** — evocative, and a visitor could read it and still not know whether this is a listings
portal, a blog or a calculator, which is the one job a hero has.

| | Before | Now |
|---|---|---|
| Headline | Every number on a Hong Kong flat, and the one that kills the deal. | **An agent quotes the gross yield. Veela shows what you keep.** |
| Lede | *Give Veela* a price… *It returns* the yield, the stamp duty you personally owe… | **Enter** a price, a rent and your buyer situation. **You get** the net yield after Hong Kong stamp duty, property tax, rates and vacancy — the duty *you personally* owe, not a generic rate — plus your payback period… |
| Under the CTA | No account, nothing saved. | The live preview is free and needs no account — it recomputes as you type. The full report needs one. |

**The new line is the market study's own recommendation 7, which had never been acted on:** lead
with the gross-versus-net gap. An agent quotes a gross yield; after the 12% effective property
tax, management fees, rates and vacancy the buyer keeps materially less, and closing that gap is
the product's reason to exist. It is a sharper sentence than "compute your yield" because it names
someone else's number and offers to correct it — and the headline can take the tension precisely
because the lede underneath is now plainly input-then-output.

### Worth knowing

**"No account, nothing saved" was false, on the first screen anyone reads.** It is the same stale
claim corrected on `/analyse`'s own header when the report went behind login on 06/08/2026 — and
missed here. Stating the split plainly is also the stronger line commercially, since it answers
"what does this cost me" before the click rather than after it.

**The first rewrite was better copy and worse on a phone.** *"An agent quotes you the gross yield.
Veela shows you what you actually keep"* is more direct, and ran to **six lines at 390px**, pushing
the call to action further down than the version being complained about. Dropping two pronouns
took it to four lines and put the CTA at **579px on an 844px viewport** — above the fold with the
whole pitch, both buttons and the free-preview line. Measured, not judged by eye: on the hero, the
fold is a constraint on the copy, not a consequence of it.

**No number in the headline, deliberately.** The study's sharpest framing quotes 3.7% gross
against ~2.5% net, but the 3.7% rests on a single press citation of an analyst and the study flags
it as indicative. The headline names the *mechanism* instead, which is defensible from our own RVD
data and needs no footnote — consistent with the FactBar rule that a claim on this page has to be
checkable from the repository.

## The hero, on the reference's pattern — and a search box that can keep its promise (27/08/2026)

Sent Mashvisor's landing page and asked for similar text and design. Their hero is a specific
shape and it is adopted: **[category] Simplified**, one muted line under it, **a search box as the
primary action** rather than two buttons, and a social-proof row.

Headline is now *"Investing in Hong Kong Property, Simplified"*; the lede carries the specificity
the register gives up, and keeps the market study's recommendation 7 in play — the number an agent
quotes is gross.

### The search box takes a listing link, not an address

The reference's box accepts an address, a neighbourhood, a city or a ZIP because an MLS-scale
database sits behind it. **Hong Kong has no such thing at any price** — the Land Registry sells
sale records one at a time at HK$10, and this project has repeatedly declined to harvest the
portals holding the rest. A box promising "enter an address" would return nothing about that
address, which is the one failure this product refuses everywhere else.

A pasted listing link *can* be honoured, because the importer reads published metadata. So the box
asks for what it can use, names the portals it works with, and offers the manual form beside it.
`?import=` hands the link to `/analyse`, which runs the **import** — never the report, per the rule
this importer was built around.

### Three defects found on the way

**The "Engine tests" tile said 49 and the truth was 69**, on the one tile whose whole purpose is
being checkable, and it had already gone stale once before. So it is no longer maintained by
memory: `scripts/check-links.mjs` counts `^test(` across the engine's test files and fails if the
page disagrees. **The guard was verified by breaking it** — set to 68, the check reported
`STALE / claims 68 … source declares 69` — rather than trusted because it typechecked.

**Horizontal overflow at 390px, caused by one word.** The hero column is a grid item, and a grid
item defaults to `min-width: auto`, so it cannot shrink below its longest unbreakable word —
"Simplified" at 76px is wider than anything the previous headline contained. `min-w-0` on the
column. Worth knowing generally: the fix belongs on the *item*, and the symptom points at the page.

**The auto-import silently did nothing**, because `submit()` read the URL from state while the prop
arrives one render after mount. Caught only because the first test asserted with a loose regex that
matched the page's own explanatory copy — a false green. The lesson is the assertion, not the bug:
a smoke test that greps for plausible words will confirm whatever it is pointed at.

### What was deliberately not copied

**No ratings badges.** Theirs shows G2 4.5/5 and Google 3.6/5. Veela has no users and no reviews,
so either would be invented — the rule already governing the dark band's tiles. That slot carries
two repository-checkable facts instead.

**No announcement bar.** Theirs promotes "AI Assistant — Try it free". `ANTHROPIC_API_KEY` is unset
in production, so that bar would advertise a feature that reports itself unconfigured — the same
failure already corrected on the pricing page.

**The headline is 3–4 lines where theirs is 2, and that could not be fixed honestly.** At 76px it
needs ~719px a line; the column is 488px, and widening the grid to 1.6fr reaches only ~586px while
shrinking the photo for nothing (measured, then reverted). Theirs is a *smaller* headline in a
wider column. Dropping the hero below display-1 would fix it and would reverse a size and weight
chosen deliberately, so it stayed.

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
unlicensed carries fines up to **HK$500,000 and three years' imprisonment** — this said
HK$200,000 and two years until 20/08/2026, which were the superseded figures; the current ones
are confirmed against the Office of the Licensing Authority's own FAQ, and **understating a
criminal penalty is the same class of error as overstating a yield**. The Home
Affairs Department runs a team dedicated to finding unlicensed listings online.

Consequence: Mashvisor's Airbnb calculator, short-vs-long-term comparison and dynamic
pricing — a large share of their product — **have no legal market here.** Veela in Hong
Kong is a **long-term rental yield** product, not an STR arbitrage product. Do not port
that half of the feature set.
*(Refined 20/08/2026, not reversed: "no legal market" is too strong stated flatly — there is a
**licensed** market, and a short-vs-long comparison now exists for exactly that case, gated on
the licence. Dynamic pricing is still out, for the separate reason that it needs nightly-rate
data Hong Kong does not publish. See "Short-term against long-term yield" below.)*

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
  **Run `vercel` from the repository root, never from `apps/web`.** Running it from inside the
  app directory created a *second* Vercel project called `web`, which then failed to build with
  "No Next.js version detected" — because Vercel applied that project's own root directory on
  top of a path that already was the app. It served nothing, held no domain, and was the source
  of a confusing deploy failure; **deleted 17/08/2026** on request (`vercel project rm web`),
  after confirming the account had no custom domains and `web-alpha-scale1.vercel.app` returned
  404. `alpha-scale1` now holds exactly one project. There is now exactly one right way to
  deploy, and one project that can be deployed to.
  *(The CLI's `rm` prompts even with `--non-interactive`, and `--yes` is not a flag it accepts.
  Piping `y` from PowerShell sends a BOM that reads as "no" and aborts; pipe it from bash.)*
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
HK$500,000 and three years). That feature is not merely unused here; it must not ship —
an unlicensed short-term-rental listing type is precisely the thing that cannot exist in a
Hong Kong product, licensed premises or not.

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
