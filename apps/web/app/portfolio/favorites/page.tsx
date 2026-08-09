"use client";

import { DEMO_DISTRICTS } from "@veela/fixtures";
import Link from "next/link";

import { AppShell, StarIcon } from "../../../components/app-shell";
import { useAuth } from "../../../components/auth-provider";
import { useFavoriteDistricts } from "../../../components/use-favorite-districts";

/**
 * "My Favorite Markets" — districts starred from the star toggle on Market
 * Performance. A district id you can no longer resolve to a real `DemoDistrict` (the
 * fixture data changed) is dropped from display rather than shown as a broken row.
 */
export default function FavoriteMarketsPage(): React.JSX.Element {
  const { user, loading, configured } = useAuth();
  const { favorites, loading: favoritesLoading, toggle } = useFavoriteDistricts();

  if (!configured) {
    return (
      <AppShell breadcrumb="My Workspace › My Favorite Markets">
        <p className="card max-w-prose text-sm text-muted">
          Sign-in isn't configured on this deployment.
        </p>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell breadcrumb="My Workspace › My Favorite Markets">
        <p className="text-sm text-muted">Loading…</p>
      </AppShell>
    );
  }

  if (user === null) {
    return (
      <AppShell breadcrumb="My Workspace › My Favorite Markets">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          My Favorite Markets
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted">
          Log in to star districts on Market Performance and find them here.
        </p>
        <Link href="/login?next=/portfolio/favorites" className="btn-primary mt-5 inline-flex !px-6 !py-3">
          Log in
        </Link>
      </AppShell>
    );
  }

  const districts = favorites
    .map((id) => DEMO_DISTRICTS.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => d !== undefined);

  return (
    <AppShell breadcrumb="My Workspace › My Favorite Markets">
      <header className="max-w-prose">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-mist">
          My Favorite Markets
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Districts you've starred on{" "}
          <Link href="/research/market-performance" className="text-accent hover:underline">
            Market Performance
          </Link>
          .
        </p>
      </header>

      {!favoritesLoading && districts.length === 0 && (
        <p className="card mt-8 max-w-prose text-sm text-muted">
          Nothing starred yet. Open a district on Market Performance and use the
          "Favorite" button.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {districts.map((d) => (
          <div key={d.id} className="card flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold">{d.nameEn}</p>
              <p className="text-xs text-muted">{d.region}</p>
              <Link
                href={`/research/market-performance?district=${d.id}`}
                className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
              >
                View performance →
              </Link>
            </div>
            <button
              type="button"
              onClick={() => toggle(d.id)}
              aria-label={`Remove ${d.nameEn} from favorites`}
              className="text-caution"
            >
              <StarIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
