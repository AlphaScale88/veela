import {
  DEMO_DISTRICTS,
  DEMO_METRICS,
  DEMO_NOTICE,
  DEMO_PERIODS,
  demoLatest,
  demoSeries,
  formatDemoValue,
  formatPeriod,
  type DemoMetric,
} from "@veela/fixtures";
import { sequentialBin, tokens, viz } from "@veela/ui";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

/**
 * Mobile market view. A choropleth needs `react-native-svg` or a map SDK with API
 * keys; neither is worth pulling in to preview a layout. The ranked list carries the
 * same information — sequential swatch for magnitude, ordered by value — and a tap
 * opens the district's series as a bar sparkline drawn with plain Views.
 *
 * Everything here is synthetic. See `@veela/fixtures`.
 */
export default function MapScreen(): React.JSX.Element {
  const [metric, setMetric] = useState<DemoMetric>("vacancy_rate");
  const [districtId, setDistrictId] = useState<string>("HK-WCH");

  const periodStart = DEMO_PERIODS[DEMO_PERIODS.length - 1];
  const values = useMemo(() => demoLatest(metric, periodStart), [metric, periodStart]);

  const numbers = [...values.values()];
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);

  const ranked = useMemo(
    () =>
      [...DEMO_DISTRICTS]
        .map((d) => ({ d, value: values.get(d.id) ?? 0 }))
        .sort((a, b) => b.value - a.value),
    [values],
  );

  const series = useMemo(
    () => demoSeries(districtId, metric).points.slice(-36),
    [districtId, metric],
  );
  const selected = DEMO_DISTRICTS.find((d) => d.id === districtId);
  const meta = DEMO_METRICS[metric];

  return (
    <ScrollView className="flex-1 bg-ink" contentContainerClassName="p-4 gap-4">
      <View className="border-caution/40 bg-caution/10 rounded-xl border p-3">
        <Text className="text-mist text-sm font-semibold">{DEMO_NOTICE.title}</Text>
        <Text className="text-muted mt-1 text-xs leading-5">{DEMO_NOTICE.detail}</Text>
      </View>

      {/* One filter row, above everything it scopes. */}
      <View className="flex-row gap-2">
        {(Object.keys(DEMO_METRICS) as DemoMetric[]).map((m) => {
          const on = m === metric;
          return (
            <Pressable
              key={m}
              onPress={() => setMetric(m)}
              className={`flex-1 rounded-lg border px-3 py-2 ${
                on ? "border-accent bg-accent/10" : "border-line bg-surface"
              }`}
            >
              <Text className={`text-xs font-medium ${on ? "text-accent" : "text-muted"}`}>
                {DEMO_METRICS[m].label}
              </Text>
              <Text className="text-muted text-[10px]">{DEMO_METRICS[m].side}</Text>
            </Pressable>
          );
        })}
      </View>

      {selected !== undefined && (
        <View className="border-line bg-surface gap-3 rounded-xl border p-3">
          <View className="flex-row items-baseline justify-between">
            <View>
              <Text className="text-mist text-sm font-medium">{selected.nameEn}</Text>
              <Text className="text-muted text-[10px]">
                {meta.label} · last 3 years · {formatPeriod(periodStart ?? "")}
              </Text>
            </View>
            <Text className="text-mist text-2xl font-semibold">
              {formatDemoValue(metric, values.get(selected.id) ?? 0)}
            </Text>
          </View>
          <Sparkline points={series.map((p) => p.value)} side={meta.side} />
        </View>
      )}

      <View className="gap-1.5">
        <Text className="text-muted text-xs font-semibold uppercase">
          All districts, highest first
        </Text>
        {ranked.map(({ d, value }) => {
          const on = d.id === districtId;
          return (
            <Pressable
              key={d.id}
              onPress={() => setDistrictId(d.id)}
              accessibilityRole="button"
              accessibilityLabel={`${d.nameEn}: ${formatDemoValue(metric, value)}`}
              className={`flex-row items-center gap-3 rounded-lg border px-3 py-2.5 ${
                on ? "border-accent bg-surfaceMuted" : "border-line bg-surface"
              }`}
            >
              <View
                className="h-4 w-4 rounded-[3px]"
                style={{ backgroundColor: sequentialBin(value, min, max) }}
              />
              <View className="flex-1">
                <Text className="text-mist text-sm">{d.nameEn}</Text>
                <Text className="text-muted text-[10px]">{d.region}</Text>
              </View>
              <Text className="text-mist text-sm">{formatDemoValue(metric, value)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View className="border-line bg-surface rounded-xl border p-3">
        <Text className="text-mist text-xs font-semibold">On precision</Text>
        <Text className="text-muted mt-1 text-xs leading-5">
          Real RVD series are published by Class and district, Centaline&apos;s by estate,
          Lands Department geometry per building. A district figure shown on one building
          is indicative, not specific to it.
        </Text>
      </View>
    </ScrollView>
  );
}

/**
 * Columns, not a line: with plain Views a line needs transforms that read badly at
 * small sizes. 2px gap between bars in the surface colour does the separating.
 */
function Sparkline({
  points,
  side,
}: {
  readonly points: readonly number[];
  readonly side: "supply" | "demand";
}): React.JSX.Element {
  const color = side === "supply" ? viz.supply : viz.demand;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;

  return (
    <View className="h-14 flex-row items-end gap-[2px]" accessibilityRole="image">
      {points.map((v, i) => (
        <View
          key={i}
          className="flex-1 rounded-t-[2px]"
          style={{
            height: `${Math.max(4, ((v - min) / span) * 100)}%`,
            // The latest column is the accent; the rest recede. Emphasis, not a
            // rainbow — the reader's eye should land on "now".
            backgroundColor: i === points.length - 1 ? color : tokens.color.border,
          }}
        />
      ))}
    </View>
  );
}
