# Brand mark — provenance

**`veela-logo.svg`**, **`veela-icon.svg`**, **`veela-logo-white.svg`**

From the 2024 codebase at `C:\Veela` — the previous attempt at this product, assessed
elsewhere in `CLAUDE.md` as "read it, do not merge it" for its *code*. The logo is a
different case: it is the founders' own mark from their own earlier venture, not
third-party content, so none of the reasoning that ruled out that codebase's Vietnamese
city photography applies to it.

- `veela-logo.svg` — the full wordmark, brand blue `#006AFF`. Copied verbatim from
  `frontend-web/real-estate-fe/public/img/logo.svg`.
- `veela-icon.svg` — the house mark alone, same blue. **Not a separate design** — the
  identical path data sits inside `veela-logo.svg` as its final subpath; this file
  isolates it for square placements (favicon, compact header) where the wordmark
  doesn't fit.
- `veela-logo-white.svg` — the same wordmark in white, for the dark surface
  (`ShortLetLaw`'s contained card). From `frontend-web/real-estate-bo/public/img/VeelaLogo.svg`.

## The blue is used as-is, and deliberately not matched to the UI accent token

The brand blue (`#006AFF`) and this app's interactive accent (`tokens.color.accent`,
`#0B5BD3`) are **two different blues, on purpose**. `#006AFF` against white contrasts at
roughly **4.4:1** — under the 4.5:1 WCAG AA threshold for normal-size text, which matters
for button labels but not for a logotype: **WCAG's own contrast requirement explicitly
exempts logos** ("the text that is part of a logo or brand name has no minimum contrast
requirement"). `#0B5BD3` was chosen for the UI precisely because it clears **6.1:1**
comfortably. Reproduce the logo faithfully; don't let its colour leak into buttons and
links where the accessibility maths is different.
