import { tokens } from "@veela/ui";
import type { Config } from "tailwindcss";

/**
 * Colours come from `@veela/ui` tokens, the same source NativeWind reads on mobile.
 * A hex code written twice is a hex code that will eventually differ.
 *
 * The three faces are assigned by job, not by taste: `display` carries the voice and is
 * rationed to headlines, `sans` is the reading face, and `mono` is reserved for figures
 * and the small caps-tracked labels that name a source. A number set in the same face as
 * the prose around it stops looking like a measurement.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: tokens.color.bg,
        surface: tokens.color.surface,
        surfaceMuted: tokens.color.surfaceMuted,
        line: tokens.color.border,
        mist: tokens.color.text,
        muted: tokens.color.textMuted,
        accent: tokens.color.accent,
        positive: tokens.color.positive,
        caution: tokens.color.caution,
        negative: tokens.color.negative,
        inverse: tokens.color.inverse,
        inverseText: tokens.color.inverseText,
        inverseMuted: tokens.color.inverseMuted,
        inverseLine: tokens.color.inverseBorder,
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: `${tokens.radius.md}px`,
        panel: `${tokens.radius.lg}px`,
        // Big photo cards and the hero frame — the size that reads as "listing card"
        // rather than "form field".
        hero: `${tokens.radius.xl}px`,
      },
      boxShadow: {
        // **Elevation is back, on purpose.** A card has to visibly float off the tinted
        // page for the marketplace vocabulary — "listing card", "hover lift" — to mean
        // anything. Two steps: resting and hovered/elevated.
        card: "0 1px 2px rgba(12, 26, 43, 0.04), 0 8px 24px -12px rgba(12, 26, 43, 0.14)",
        lift: "0 4px 10px rgba(12, 26, 43, 0.08), 0 22px 48px -18px rgba(12, 26, 43, 0.26)",
        overlay: "0 4px 8px rgba(12, 26, 43, 0.06), 0 24px 56px -20px rgba(12, 26, 43, 0.24)",
      },
      maxWidth: {
        // Reading measure. Anything longer and the eye loses the line return.
        prose: "58ch",
        // Display measure. Headlines want a *shorter* line than prose, not a longer one —
        // this is the single biggest lever on whether a page reads as editorial.
        display: "20ch",
        // The page. Narrower than the 6xl a dashboard wants, because a document is
        // read, not scanned.
        page: "1080px",
      },
      letterSpacing: {
        tightest: "-0.045em",
      },
      fontSize: {
        // One editorial scale, big at the top and with a real jump between steps.
        // Timid contrast between h1 and h2 is what makes a page look like a form.
        "display-1": ["clamp(2.75rem, 6.5vw, 4.75rem)", { lineHeight: "1.02", letterSpacing: "-0.05em" }],
        "display-2": ["clamp(1.9rem, 3.4vw, 2.6rem)", { lineHeight: "1.08", letterSpacing: "-0.03em" }],
        "display-3": ["1.35rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        lede: ["clamp(1.05rem, 1.5vw, 1.3rem)", { lineHeight: "1.55" }],
        // Figures. Set large and in mono, a number becomes the thing you look at.
        figure: ["clamp(1.75rem, 3vw, 2.4rem)", { lineHeight: "1", letterSpacing: "-0.02em" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
