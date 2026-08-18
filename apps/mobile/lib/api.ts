import type { Verdict } from "@veela/core";
import type { CreatePropertyInput } from "@veela/types";

import { currentAccessToken, forceRefresh } from "./session";

/**
 * The mobile client talks to the same Hono API as the browser — the typed contract in
 * `@veela/types` is the only definition of the request shape, so a change breaks
 * compilation on both surfaces rather than at runtime on one.
 */

const BASE_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Every request carries the session token when there is one, and retries **once** after a 401.
 *
 * The web sends a cookie the browser manages; the phone sends `Authorization: Bearer`, which the
 * API learned to accept for exactly this reason. Attaching it unconditionally is safe — the
 * anonymous routes ignore it — and means no caller has to remember which endpoints need auth.
 *
 * **The retry is the part worth explaining.** `currentAccessToken` already refreshes a token that
 * is expired or nearly so, so a 401 means something the clock could not predict: the session was
 * revoked, the password changed, or the device slept through the expiry. Forcing one refresh and
 * repeating the request turns that into a recoverable blip instead of an error the reader has to
 * understand. It retries **once** — a loop here would hammer the auth endpoint with a refresh
 * token the server has already refused.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const send = async (token: string | null): Promise<Response> =>
    fetch(`${BASE_URL}/api${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token === null ? {} : { authorization: `Bearer ${token}` }),
        ...init?.headers,
      },
    });

  let res = await send(await currentAccessToken());

  if (res.status === 401) {
    const fresh = await forceRefresh();
    if (fresh !== null) res = await send(fresh);
  }

  if (!res.ok) {
    throw new ApiError(await readMessage(res, path), res.status);
  }
  return (await res.json()) as T;
}

/**
 * The server's own reason, when it gave one.
 *
 * Rejections arrive in two shapes and always have: Hono's `HTTPException` sends plain text and
 * `zValidator` sends JSON. Reading `res.json()` unconditionally throws on the first and discards
 * the message — the same bug the web's listing importer had, so it is worth not repeating on a
 * second surface.
 */
async function readMessage(res: Response, path: string): Promise<string> {
  const text = await res.text().catch(() => "");
  if (text === "") return `Request to ${path} failed (${res.status}).`;
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? text;
  } catch {
    return text;
  }
}

export function previewVerdict(input: CreatePropertyInput): Promise<{ verdict: Verdict }> {
  return request("/verdict/preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface SeriesPoint {
  readonly periodStart: string;
  readonly periodMonths: number;
  readonly value: number;
  readonly source: string;
}

export function fetchSeries(params: {
  districtId: string;
  metric: string;
}): Promise<{ districtId: string; metric: string; points: SeriesPoint[]; sources: string[] }> {
  const qs = new URLSearchParams(params).toString();
  return request(`/market/series?${qs}`);
}

export function fetchDistricts(): Promise<{
  districts: { id: string; nameEn: string; nameZh: string | null }[];
}> {
  return request("/districts");
}

/**
 * A saved property as the API returns it.
 *
 * Hand-declared rather than imported from `@veela/db`: that package pulls Drizzle and a Postgres
 * driver, neither of which belongs in a phone bundle. The fields used here are the ones the
 * Portfolio screen reads, and the wire shape is pinned by `createPropertySchema` on the way in.
 */
export interface SavedProperty {
  readonly id: string;
  readonly label: string;
  readonly currency: "HKD" | "VND" | "EUR";
  readonly priceMinor: number;
  readonly monthlyRentMinor: number;
  readonly saleableAreaSqft: number | null;
  readonly monitored: boolean;
  readonly sourceUrl: string | null;
  readonly updatedAt: string;
}

export function fetchProperties(): Promise<{ properties: SavedProperty[] }> {
  return request("/properties");
}

/** The latest stored snapshot for one property, or `null` if it has never been computed. */
export function fetchProperty(
  id: string,
): Promise<{ property: SavedProperty; verdict: { payload: Verdict } | null }> {
  return request(`/properties/${id}`);
}
