/**
 * NativeWind reads the SAME tokens as the web app's Tailwind config, so a colour can
 * never drift between the two surfaces. Required by the workspace rule: share design
 * tokens, don't copy hex codes between apps.
 *
 * CommonJS because NativeWind's metro transformer loads this synchronously.
 */
const { tokens } = require("@veela/ui");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
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
      },
    },
  },
  plugins: [],
};
