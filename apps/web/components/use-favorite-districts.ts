"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "./auth-provider";

/**
 * "My Favorite Markets" — shared between the star toggle on Market Performance/Map
 * and the `/portfolio/favorites` list, so both read and write the same
 * `profiles.favorite_districts` array through one place rather than two independent
 * fetches that could disagree about what's starred.
 */
export function useFavoriteDistricts(): {
  readonly favorites: readonly string[];
  readonly loading: boolean;
  readonly toggle: (districtId: string) => void;
} {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) {
      setFavorites([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { profile: { favoriteDistricts: readonly string[] } } | null) => {
        if (!cancelled && json !== null) setFavorites(json.profile.favoriteDistricts);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggle = useCallback(
    (districtId: string) => {
      if (user === null) return;
      const next = favorites.includes(districtId)
        ? favorites.filter((id) => id !== districtId)
        : [...favorites, districtId];
      setFavorites(next); // optimistic — this is a star toggle, not a form submit
      void fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ favoriteDistricts: next }),
      }).catch(() => undefined);
    },
    [user, favorites],
  );

  return { favorites, loading, toggle };
}
