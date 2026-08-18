import { useQuery } from "@tanstack/react-query";
import type { Verdict } from "@veela/core";
import { formatCompactMoney, formatPercent, gradeNetYield, standingColor } from "@veela/ui";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { useAuth } from "../lib/auth";
import { fetchProperties, fetchProperty, type SavedProperty } from "../lib/api";

/**
 * The portfolio — real now, rather than the stub that shipped in its place.
 *
 * This is the answer to the daily-use problem the product is built around: evaluating a property is
 * episodic, but a *tracked* set of properties gives a reason to open the app on a Tuesday. It
 * needed authentication, because `properties` is RLS-scoped to its owner, and it needed the API to
 * accept a Bearer token, because a phone has no cookies. Both exist now.
 *
 * ## Totals, and the same weighting argument as the web
 *
 * The blended yield sums income and sums value and divides **once**. A mean of each property's
 * percentage flatters the cheap high-yield flats — the same trap the web's portfolio summary
 * avoids, avoided here for the same reason and stated in the same words so the two surfaces cannot
 * drift into disagreeing about what a portfolio yields.
 *
 * ## One request per property, deliberately
 *
 * `GET /properties` is cheap and carries no snapshot, so each stored verdict is fetched
 * separately — exactly what the web does, and fine at personal-portfolio scale. React Query holds
 * them, so pulling to refresh re-fetches rather than re-mounting.
 */
export default function PortfolioScreen(): React.JSX.Element {
  const { signedIn, loading: authLoading, configured, signOut } = useAuth();

  const query = useQuery({
    queryKey: ["portfolio"],
    enabled: signedIn,
    queryFn: async () => {
      const { properties } = await fetchProperties();
      /* Sequential rather than `Promise.all`: a phone on mobile data does not benefit from twenty
         parallel requests, and the list is small by construction. */
      const rows: { property: SavedProperty; verdict: Verdict | null }[] = [];
      for (const property of properties) {
        try {
          const detail = await fetchProperty(property.id);
          rows.push({ property, verdict: detail.verdict?.payload ?? null });
        } catch {
          // One unreadable snapshot must not empty the whole list.
          rows.push({ property, verdict: null });
        }
      }
      return rows;
    },
  });

  if (authLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <ActivityIndicator />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <ScrollView className="flex-1 bg-ink" contentContainerClassName="p-4 gap-4">
        <Text className="text-mist text-xl font-semibold">Your portfolio</Text>
        <Text className="text-muted text-sm leading-5">
          Save a property and Veela tracks it against the market — rent and price indices, vacancy
          in its district, and any change to the tax rules that alters the verdict.
        </Text>

        <View className="border-line bg-surface rounded-xl border p-4">
          <Text className="text-mist text-sm font-medium">Sign in to see it</Text>
          <Text className="text-muted mt-2 text-xs leading-5">
            Saved properties are private to your account and that is enforced by the database, not
            by this app. The Analyse tab works without an account.
          </Text>
          {configured ? (
            <Pressable
              onPress={() => router.push("/sign-in")}
              className="bg-accent mt-3 items-center rounded-full px-5 py-3"
            >
              <Text className="text-sm font-semibold text-white">Sign in</Text>
            </Pressable>
          ) : (
            <Text className="text-muted mt-3 text-xs leading-5">
              Sign-in is not configured on this build.
            </Text>
          )}
        </View>
      </ScrollView>
    );
  }

  const rows = query.data ?? [];

  return (
    <ScrollView
      className="flex-1 bg-ink"
      contentContainerClassName="p-4 gap-4"
      refreshControl={
        <RefreshControl refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
      }
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text className="text-mist text-xl font-semibold">Your portfolio</Text>
        <Pressable onPress={() => void signOut()} hitSlop={8}>
          <Text className="text-muted text-xs">Sign out</Text>
        </Pressable>
      </View>

      {query.isLoading && <ActivityIndicator />}

      {query.isError && (
        <View className="border-negative/40 bg-negative/10 rounded-xl border p-3">
          <Text className="text-negative text-sm leading-5">
            {query.error instanceof Error ? query.error.message : "Could not load your properties."}
          </Text>
        </View>
      )}

      {!query.isLoading && !query.isError && rows.length === 0 && (
        <View className="border-line bg-surface rounded-xl border p-4">
          <Text className="text-mist text-sm font-medium">Nothing saved yet</Text>
          <Text className="text-muted mt-2 text-xs leading-5">
            Run a report on the Analyse tab, then save it. Saved properties appear here with the
            figures as they were on the day you saved them.
          </Text>
        </View>
      )}

      {rows.length > 0 && <Totals rows={rows} />}

      {rows.map(({ property, verdict }) => (
        <PropertyCard key={property.id} property={property} verdict={verdict} />
      ))}

      {rows.length > 0 && (
        <Text className="text-muted text-xs leading-5">
          Each figure is the snapshot stored when you saved that property, not a fresh computation —
          tax rules change, and a report should keep saying what it said when you acted on it.
        </Text>
      )}
    </ScrollView>
  );
}

function Totals({
  rows,
}: {
  readonly rows: readonly { readonly property: SavedProperty; readonly verdict: Verdict | null }[];
}): React.JSX.Element {
  const currency = rows[0]?.property.currency ?? "HKD";
  let value = 0;
  let rent = 0;
  let netIncome = 0;
  let valueWithSnapshot = 0;
  let missing = 0;

  for (const { property, verdict } of rows) {
    value += property.priceMinor;
    rent += property.monthlyRentMinor;
    if (verdict === null) {
      missing += 1;
      continue;
    }
    netIncome += verdict.annual.netIncome.amount;
    valueWithSnapshot += property.priceMinor;
  }

  /* Summed, then divided once — never a mean of percentages. See the file comment. */
  const blended = valueWithSnapshot > 0 ? netIncome / valueWithSnapshot : null;

  return (
    <View className="border-line bg-surface gap-3 rounded-xl border p-4">
      <Text className="text-mist text-sm font-semibold">
        {rows.length} propert{rows.length === 1 ? "y" : "ies"}
      </Text>
      <View className="flex-row flex-wrap gap-y-3">
        <Cell label="Combined price" value={formatCompactMoney({ amount: value, currency })} />
        <Cell label="Rent / month" value={formatCompactMoney({ amount: rent, currency })} />
        <Cell
          label="Net income / yr"
          value={valueWithSnapshot > 0 ? formatCompactMoney({ amount: netIncome, currency }) : "—"}
        />
        <Cell
          label="Blended net yield"
          value={formatPercent(blended)}
          color={blended === null ? undefined : standingColor[gradeNetYield(blended)]}
        />
      </View>
      {missing > 0 && (
        <Text className="text-muted text-xs leading-5">
          Yield and net income cover the {rows.length - missing} with a saved report. Price and rent
          cover all {rows.length}.
        </Text>
      )}
    </View>
  );
}

function Cell({
  label,
  value,
  color,
}: {
  readonly label: string;
  readonly value: string;
  readonly color?: string | undefined;
}): React.JSX.Element {
  return (
    <View className="w-1/2 gap-0.5 pr-2">
      <Text className="text-muted text-[11px]">{label}</Text>
      <Text className="text-mist text-base font-semibold" style={color === undefined ? undefined : { color }}>
        {value}
      </Text>
    </View>
  );
}

function PropertyCard({
  property,
  verdict,
}: {
  readonly property: SavedProperty;
  readonly verdict: Verdict | null;
}): React.JSX.Element {
  const netYield = verdict?.returns.netYield ?? null;
  const colour = standingColor[gradeNetYield(netYield)];

  return (
    <View className="border-line bg-surface gap-2 rounded-xl border p-4">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="text-mist flex-1 text-sm font-semibold leading-5">{property.label}</Text>
        <Text className="text-xs font-semibold" style={{ color: colour }}>
          {formatPercent(netYield)}
        </Text>
      </View>

      <Text className="text-mist text-lg font-semibold">
        {formatCompactMoney({ amount: property.priceMinor, currency: property.currency })}
      </Text>

      <Text className="text-muted text-xs leading-5">
        Rent {formatCompactMoney({ amount: property.monthlyRentMinor, currency: property.currency })}
        /mo
        {property.saleableAreaSqft !== null && ` · ${property.saleableAreaSqft} sq ft`}
        {property.monitored && " · tracked"}
      </Text>

      {verdict === null && (
        <Text className="text-muted text-xs leading-5">
          No saved report for this one, so there is no yield to show. Re-run it on the web to store
          one.
        </Text>
      )}
    </View>
  );
}
