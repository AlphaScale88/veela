import type { Verdict } from "@veela/core";
import type { CreatePropertyInput } from "@veela/types";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(`Request to ${path} failed`, res.status);
  }
  return (await res.json()) as T;
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
