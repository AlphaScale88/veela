"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import type { ReactNode } from "react";

/**
 * One `<APIProvider>` for the whole app, mounted once at the root — not one per page
 * that happens to show a map. This is the fix for "Market Finder is empty, but only
 * after navigating there from the sidebar": `/finder` and `/map` each used to mount
 * their own `APIProvider`, and this app never does a full page reload between them
 * (it's a client-side SPA transition). Two independent `APIProvider` instances racing
 * to load the same Google Maps script in the same page session is exactly the
 * `@vis.gl/react-google-maps` failure mode the library's own docs warn against — its
 * own example wraps the *entire app* in one `APIProvider`, not one per map. A hard
 * reload of either page "fixed" it by accident, because that's the one case where only
 * one `APIProvider` was ever mounted at a time.
 *
 * Unconfigured is still not an error: no key means no provider, and `DistrictMap` /
 * `ListingsMap` already render nothing without one — same "zero configuration" rule as
 * everywhere else this key is read.
 */
export function MapsProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const apiKey = process.env["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"];
  if (apiKey === undefined || apiKey === "") return <>{children}</>;
  return <APIProvider apiKey={apiKey}>{children}</APIProvider>;
}
