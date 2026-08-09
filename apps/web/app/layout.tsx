import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

import { AiChat } from "../components/ai-chat";
import { AiChatProvider } from "../components/ai-chat-provider";
import { AuthProvider } from "../components/auth-provider";
import { MapsProvider } from "../components/maps-provider";
import { SiteChrome } from "../components/site-chrome";

/**
 * Three faces, three jobs. Instrument Sans reads long. IBM Plex Mono is the instrument
 * face: every figure, every source label, every band name is set in it, so a
 * measurement always looks like a measurement.
 *
 * The display face was Bricolage Grotesque; it's DM Sans now, asked for directly as
 * "the same font as Airbnb." Airbnb's actual face, Cereal, is proprietary — not
 * licensed for anyone outside Airbnb to use — so this is the free substitute most
 * commonly cited for Cereal's specific warmth: rounded terminals, a humanist-geometric
 * hybrid, without Bricolage Grotesque's more idiosyncratic, quirkier letterforms.
 * `font-extrabold` (800) is what carries that warmth at headline size — DM Sans
 * supports the full 100–1000 weight range as a variable font, so nothing here is
 * pushing past what the face actually ships.
 */
const display = DM_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Veela — what a Hong Kong flat actually returns",
  description:
    "Investor-grade analysis of a Hong Kong property: yield, ROI, stamp duty, tax and the problems a first-time buyer misses. Every rate cites its source.",
};

export const viewport: Viewport = {
  themeColor: "#F4F6FA",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-ink font-sans text-mist antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-card focus:bg-mist focus:px-4 focus:py-2 focus:text-sm focus:text-inverseText"
        >
          Skip to content
        </a>

        <AuthProvider>
          <AiChatProvider>
            <MapsProvider>
              {/* SiteChrome decides, per route, whether the marketing header/footer
                  render at all — `/finder` opts out and supplies its own shell. See
                  that file. One MapsProvider here, not one per map-bearing page — see
                  that component for why the second pattern silently broke navigation. */}
              <SiteChrome>{children}</SiteChrome>
              <AiChat />
            </MapsProvider>
          </AiChatProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
