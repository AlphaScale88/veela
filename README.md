# Veela

Investor-grade analysis of a property: yield, ROI, stamp duty, tax, and the problems a
first-time buyer misses. Hong Kong first, then Vietnam, then France.

Product context, market research and open questions live in
[`.claude/CLAUDE.md`](.claude/CLAUDE.md). Read that first — it explains *why* the
product is shaped this way, including the two findings that constrain it.

## Layout

```
apps/web        Next.js 15 App Router · React 19 · Tailwind · Hono in a route handler
apps/mobile     Expo · expo-router · NativeWind · TanStack Query
packages/core   the tax & yield engine — versioned, dated rules. The core IP.
packages/db     Drizzle 0.45.x · PostGIS · RLS on every table
packages/api    Hono + Zod routes, shared by web and mobile
packages/types  the Zod contract. Types are inferred, never hand-written.
packages/ui     design tokens + presentation logic shared across both surfaces
```

Tier 3 in the [boilerplate](../../../boilerplate/CLAUDE.md) taxonomy: PostGIS geo search
plus a native app. No Tier 4 Docker service — nothing here has to run 24/7 yet.

## Running it

Requires **Node 22+**. pnpm is the package manager; if it isn't installed globally,
`npx pnpm@9 …` works for every command below without installing anything
(`corepack enable pnpm` needs administrator rights on Windows).

**No configuration is needed to see the app.** The map runs on synthetic fixtures and
the Analyse flow computes from the request body alone, so both work with no database and
no Supabase project. `.env.local` is only needed once you want to *save* a property.

**The listing importer needs a Chromium binary the first time.** `pnpm install` pulls in
`playwright` (see `.claude/CLAUDE.md` § "Spacious made to work too" for why), but not the
browser itself — one-time setup:

```bash
npx playwright install chromium
```

Everything else about the importer works without it; only pasting a spacious.hk link
needs the browser.

### Both apps at once

```bash
cd projects/startup/veela
npx pnpm@9 install          # already done if you ran it before
npx pnpm@9 dev              # turbo runs web + mobile together
```

### Web only — the fastest way to look at it

```bash
npx pnpm@9 --filter @veela/web dev
```

Then open **http://localhost:3000** — the Analyse form is the landing page, prefilled
with a plausible HK flat; submit it and you get the verdict. **/map** is the demo
choropleth.

### Mobile only

```bash
npx pnpm@9 --filter @veela/mobile dev
```

Expo prints a QR code. Scan it with **Expo Go** (iOS or Android). Press `a` for an
Android emulator; the iOS simulator needs macOS, so it isn't available here.

The **Map** tab works offline — it reads the fixtures bundled into the app. The
**Analyse** tab calls the web API, so it needs both `pnpm --filter @veela/web dev`
running and the API URL pointing at this machine's LAN address, not localhost:

```bash
# PowerShell, in the mobile app's shell
$env:EXPO_PUBLIC_API_URL = "http://172.16.19.249:3000"
npx pnpm@9 --filter @veela/mobile dev
```

Replace the IP with your current Wi-Fi address (`ipconfig`) — it changes between
networks. **A VPN will usually break this**: Expo's LAN discovery and the phone's route
to your machine both fail while the tunnel is up. Disconnect it, or run
`npx expo start --tunnel`.

### Tests

```bash
npx pnpm@9 --filter @veela/core test   # 23 tests, no database, no network
```

`packages/core` has no runtime dependencies, so this runs immediately after install.
Start there — it's where the product's value is.

## The engine

`packages/core` is the part a competitor cannot scrape, so it's built to be auditable:

- **Rules are versioned and dated.** Hong Kong suspended BSD, SSD and NRSD on
  28/02/2024 and raised the top AVD band to 6.5% on 26/02/2026. A rule set is selected
  by transaction date; nothing is a hardcoded constant.
- **Suspended duties are modelled, not deleted.** They can be reinstated, and comparing
  across years needs them.
- **Every rule cites its sources.** An unsourced rate is a bug.
- **Money is integer minor units** end to end — form, engine, database. Never a float.
- **The AVD table is transcribed verbatim from the IRD**, including its marginal-relief
  bands, and the tests assert *continuity at every band boundary*: at HK$4,323,780 the
  marginal formula must equal 1.5% of the consideration. That's what proves the
  transcription is right digit by digit, rather than merely plausible.

Adding a jurisdiction means adding a `JurisdictionRules` value and its tests. France can
reuse the `paperasse-entreprise` and `paperasse-patrimoine` plugins in this workspace
rather than re-deriving the rules.

## What is deliberately not built yet

- **Data ingestion.** District geometry from Lands Department open data, and the
  supply/demand series from RVD, the Land Registry and Centaline. The map ships with an
  honest empty state rather than invented numbers.
- **The interactive map.** API routes (`/map/districts`, `/map/buildings`,
  `/market/series`) and the schema are in place; the rendering waits on data.
- **Supabase Auth on mobile.** The Analyse flow works without an account; the portfolio
  needs one because `properties` is RLS-scoped to its owner.
- **Vietnam and France rule sets.** Only Hong Kong is modelled. The API returns a clear
  400 for the others rather than guessing.

## React versions differ between the apps, on purpose

`apps/web` is on **React 19** and `apps/mobile` on **React 18.3.1**. This is not an
oversight to tidy up: Expo SDK 52 and React Native 0.76.5 pair with React 18.3.1, and
installing React 19 there produces unmet peer warnings across `react-native`,
`expo-router` and their transitive dependencies.

The boilerplate specifies React 19 for the Next.js app — that applies to web only. pnpm
isolates each workspace's `node_modules`, so the two coexist cleanly. Bump mobile only
when Expo ships an SDK that supports React 19.

Nothing in `packages/` depends on React, which is why the split is harmless: shared code
is plain TypeScript, and `@veela/ui` exports tokens and functions rather than components.

## Conventions worth knowing

- Server Components read the database **directly, in-process**. Never `fetch()` our own
  Hono endpoint from the server — that's a pointless network hop. Hono is the door for
  outside callers: the browser and the mobile app.
- RLS is the authorisation mechanism. Handlers use `withUser()` so Postgres enforces
  ownership; they do not rely on remembering a `where owner_id = …` clause.
- The service-role key bypasses RLS and is for the ingestion job only. Never in a
  request path.
- Colour tokens live once, in `@veela/ui`, read by both Tailwind and NativeWind. A hex
  code written twice is one that will eventually differ.
- The UI labels which geographic level every figure was measured at. Showing a district
  vacancy rate on a single building implies precision we don't have.
