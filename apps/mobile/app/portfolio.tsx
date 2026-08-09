import { ScrollView, Text, View } from "react-native";

/**
 * The portfolio is the answer to the daily-use problem: evaluating a property is
 * episodic, but a tracked set of properties monitored against RVD indices and tax
 * changes gives a reason to open the app.
 *
 * It needs authentication (`properties` is RLS-scoped to the owner), so it ships as
 * a stub until Supabase Auth is wired into the mobile app.
 */
export default function PortfolioScreen(): React.JSX.Element {
  return (
    <ScrollView className="flex-1 bg-ink" contentContainerClassName="p-4 gap-4">
      <Text className="text-mist text-xl font-semibold">Your portfolio</Text>
      <Text className="text-muted text-sm leading-5">
        Save a property and Veela tracks it against the market — rent and price indices,
        vacancy in its district, and any change to the tax rules that alters the verdict.
      </Text>

      <View className="border-line bg-surface rounded-xl border border-dashed p-6">
        <Text className="text-mist text-sm font-medium">Sign-in required</Text>
        <Text className="text-muted mt-2 text-xs leading-5">
          Saved properties are private to your account and enforced by row-level security
          in the database, so this screen needs Supabase Auth. Not wired up yet — the
          Analyse tab works without an account.
        </Text>
      </View>
    </ScrollView>
  );
}
