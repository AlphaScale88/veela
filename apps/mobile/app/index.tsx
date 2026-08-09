import { useMutation } from "@tanstack/react-query";
import type { Verdict } from "@veela/core";
import { createPropertySchema, type CreatePropertyInput } from "@veela/types";
import {
  acquisitionLines,
  annualLines,
  criticalCount,
  formatCompactMoney,
  headlineStats,
  severityColor,
  severityLabel,
  tokens,
} from "@veela/ui";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { previewVerdict } from "../lib/api";

const HKD_CENTS = 100;

interface FormState {
  label: string;
  price: string;
  monthlyRent: string;
  areaSqft: string;
  transactionDate: string;
  isPermanentResident: boolean;
  ownsOtherResidentialProperty: boolean;
  purchasingViaCompany: boolean;
  ownerPaysRates: boolean;
  managementFee: string;
  otherAnnual: string;
  agencyFee: string;
  legalFees: string;
  vacancyPct: string;
  loanAmount: string;
  interestPct: string;
  termYears: string;
}

const INITIAL: FormState = {
  label: "Flat in Tai Koo",
  price: "8000000",
  monthlyRent: "18000",
  areaSqft: "500",
  transactionDate: "2026-07-30",
  isPermanentResident: true,
  ownsOtherResidentialProperty: false,
  purchasingViaCompany: false,
  ownerPaysRates: true,
  managementFee: "1200",
  otherAnnual: "10000",
  agencyFee: "80000",
  legalFees: "15000",
  vacancyPct: "4",
  loanAmount: "4000000",
  interestPct: "3",
  termYears: "25",
};

function toInput(f: FormState): CreatePropertyInput {
  const cents = (s: string): number => Math.round((Number(s) || 0) * HKD_CENTS);
  const loan = cents(f.loanAmount);
  const area = Number(f.areaSqft) || 0;

  return {
    label: f.label,
    jurisdiction: "HK",
    currency: "HKD",
    priceMinor: cents(f.price),
    monthlyRentMinor: cents(f.monthlyRent),
    transactionDate: f.transactionDate,
    monitored: false,
    ...(area > 0 && { saleableAreaSqft: area }),
    buyer: {
      isPermanentResident: f.isPermanentResident,
      ownsOtherResidentialProperty: f.ownsOtherResidentialProperty,
      purchasingViaCompany: f.purchasingViaCompany,
    },
    costs: {
      ownerPaysRates: f.ownerPaysRates,
      monthlyManagementFeeMinor: cents(f.managementFee),
      annualOtherCostsMinor: cents(f.otherAnnual),
      agencyFeeMinor: cents(f.agencyFee),
      legalFeesMinor: cents(f.legalFees),
      vacancyRate: (Number(f.vacancyPct) || 0) / 100,
    },
    ...(loan > 0 && {
      financing: {
        loanAmountMinor: loan,
        annualInterestRate: (Number(f.interestPct) || 0) / 100,
        termYears: Number(f.termYears) || 1,
      },
    }),
  };
}

export default function AnalyseScreen(): React.JSX.Element {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (f: FormState) => {
      const parsed = createPropertySchema.safeParse(toInput(f));
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
      }
      return previewVerdict(parsed.data);
    },
    onSuccess: (data) => {
      setVerdict(data.verdict);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  if (verdict !== null) {
    return <VerdictScreen verdict={verdict} onBack={() => setVerdict(null)} />;
  }

  return (
    <ScrollView
      className="flex-1 bg-ink"
      contentContainerClassName="p-4 gap-4"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-mist text-xl font-semibold">Is this property worth it?</Text>
      <Text className="text-muted text-sm leading-5">
        Enter the figures. Nothing is saved and no account is needed.
      </Text>

      <Group title="The property">
        <Row label="Label" value={form.label} onChange={(v) => set("label", v)} />
        <Row label="Price (HK$)" value={form.price} onChange={(v) => set("price", v)} numeric />
        <Row
          label="Monthly rent (HK$)"
          value={form.monthlyRent}
          onChange={(v) => set("monthlyRent", v)}
          numeric
        />
        <Row label="Area (sq ft)" value={form.areaSqft} onChange={(v) => set("areaSqft", v)} numeric />
        <Row
          label="Date (YYYY-MM-DD)"
          value={form.transactionDate}
          onChange={(v) => set("transactionDate", v)}
        />
      </Group>

      <Group title="You, the buyer — drives stamp duty">
        <Toggle
          label="HK permanent resident"
          value={form.isPermanentResident}
          onChange={(v) => set("isPermanentResident", v)}
        />
        <Toggle
          label="I already own residential property"
          hint="Moves you to the flat 15% scale."
          value={form.ownsOtherResidentialProperty}
          onChange={(v) => set("ownsOtherResidentialProperty", v)}
        />
        <Toggle
          label="Buying through a company"
          value={form.purchasingViaCompany}
          onChange={(v) => set("purchasingViaCompany", v)}
        />
      </Group>

      <Group title="Running costs">
        <Row
          label="Management (HK$/mo)"
          value={form.managementFee}
          onChange={(v) => set("managementFee", v)}
          numeric
        />
        <Row label="Other annual" value={form.otherAnnual} onChange={(v) => set("otherAnnual", v)} numeric />
        <Row label="Agency fee" value={form.agencyFee} onChange={(v) => set("agencyFee", v)} numeric />
        <Row label="Legal fees" value={form.legalFees} onChange={(v) => set("legalFees", v)} numeric />
        <Row
          label="Vacancy (% of year)"
          value={form.vacancyPct}
          onChange={(v) => set("vacancyPct", v)}
          numeric
        />
        <Toggle
          label="I pay the rates, not the tenant"
          value={form.ownerPaysRates}
          onChange={(v) => set("ownerPaysRates", v)}
        />
      </Group>

      <Group title="Financing — 0 for a cash purchase">
        <Row label="Loan (HK$)" value={form.loanAmount} onChange={(v) => set("loanAmount", v)} numeric />
        <Row label="Rate (%)" value={form.interestPct} onChange={(v) => set("interestPct", v)} numeric />
        <Row label="Term (years)" value={form.termYears} onChange={(v) => set("termYears", v)} numeric />
      </Group>

      {error !== null && (
        <View className="rounded-xl border border-negative/40 bg-negative/10 p-3">
          <Text className="text-mist text-sm">{error}</Text>
        </View>
      )}

      <Pressable
        onPress={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="bg-accent items-center rounded-xl py-4 active:opacity-80"
      >
        {mutation.isPending ? (
          <ActivityIndicator color={tokens.color.bg} />
        ) : (
          <Text className="text-ink text-base font-semibold">Is it worth it?</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function VerdictScreen({
  verdict,
  onBack,
}: {
  readonly verdict: Verdict;
  readonly onBack: () => void;
}): React.JSX.Element {
  const criticals = criticalCount(verdict);

  return (
    <ScrollView className="flex-1 bg-ink" contentContainerClassName="p-4 gap-5">
      <Pressable onPress={onBack}>
        <Text className="text-accent text-sm">← Change the figures</Text>
      </Pressable>

      <View className="flex-row flex-wrap gap-2">
        {headlineStats(verdict).map((s) => (
          <View
            key={s.label}
            className="border-line bg-surface min-w-[47%] flex-1 rounded-xl border p-3"
          >
            <Text className="text-muted text-[10px] uppercase">{s.label}</Text>
            <Text
              className="mt-1 text-2xl font-semibold"
              style={{ color: s.color ?? tokens.color.text }}
            >
              {s.value}
            </Text>
            {s.hint !== undefined && (
              <Text className="text-muted mt-1 text-[10px] leading-3">{s.hint}</Text>
            )}
          </View>
        ))}
      </View>

      {criticals > 0 && (
        <View className="border-negative/40 bg-negative/10 rounded-xl border p-3">
          <Text className="text-mist text-sm">
            {criticals} {criticals === 1 ? "issue" : "issues"} could sink this deal.
          </Text>
        </View>
      )}

      <View className="gap-2">
        <Text className="text-muted text-xs font-semibold uppercase">What to watch</Text>
        {verdict.findings.map((f, i) => (
          <View key={`${f.id}-${i}`} className="border-line bg-surface rounded-xl border p-3">
            <Text
              className="text-[10px] font-semibold uppercase"
              style={{ color: severityColor[f.severity] }}
            >
              {severityLabel[f.severity]}
            </Text>
            <Text className="text-mist mt-1 text-sm font-medium">{f.title}</Text>
            <Text className="text-muted mt-1 text-xs leading-5">{f.detail}</Text>
          </View>
        ))}
      </View>

      <Table title="Cash to acquire" lines={acquisitionLines(verdict)} />
      <Table title="Every year" lines={annualLines(verdict)} />

      <Text className="text-muted text-[10px] leading-4">
        Computed with {verdict.rulesUsed}.
      </Text>
    </ScrollView>
  );
}

function Table({
  title,
  lines,
}: {
  readonly title: string;
  readonly lines: ReturnType<typeof acquisitionLines>;
}): React.JSX.Element {
  return (
    <View className="gap-2">
      <Text className="text-muted text-xs font-semibold uppercase">{title}</Text>
      <View className="border-line bg-surface overflow-hidden rounded-xl border">
        {lines.map((l) => (
          <View
            key={l.label}
            className={`flex-row items-baseline justify-between px-3 py-2.5 ${
              l.emphasis === true ? "border-line bg-surfaceMuted border-t" : ""
            }`}
          >
            <Text className="text-muted flex-1 pr-3 text-xs">{l.label}</Text>
            <Text className={`text-mist text-xs ${l.emphasis === true ? "font-semibold" : ""}`}>
              {formatCompactMoney(l.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Group({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View className="border-line bg-surface gap-3 rounded-xl border p-3">
      <Text className="text-muted text-xs font-semibold uppercase">{title}</Text>
      {children}
    </View>
  );
}

function Row({
  label,
  value,
  onChange,
  numeric,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly numeric?: boolean;
}): React.JSX.Element {
  return (
    <View>
      <Text className="text-muted mb-1 text-xs">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={numeric === true ? "numeric" : "default"}
        placeholderTextColor={tokens.color.textMuted}
        className="border-line bg-ink text-mist rounded-lg border px-3 py-2.5 text-sm"
      />
    </View>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly value: boolean;
  readonly onChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1">
        <Text className="text-mist text-sm">{label}</Text>
        {hint !== undefined && <Text className="text-muted text-[10px]">{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: tokens.color.border, true: tokens.color.accent }}
        thumbColor={tokens.color.text}
      />
    </View>
  );
}
