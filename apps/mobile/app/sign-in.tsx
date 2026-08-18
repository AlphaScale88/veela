import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { useAuth } from "../lib/auth";

/**
 * Sign in on the phone.
 *
 * Email and password only. **No Google**, and that is a real limitation rather than an omission:
 * OAuth on a native app needs a redirect scheme registered in `app.json` and a deep-link handler,
 * which is a build-configuration change and cannot be verified from here. The web has both
 * methods; this has the one that works end to end today, and says so.
 *
 * No sign-up either. Creating an account is where consent to the terms and privacy statement is
 * recorded (`consent_records`, versioned by date), and that record is the one thing in this
 * product that cannot be retrofitted. Doing it properly on a second surface means presenting the
 * same documents and writing the same row; doing it carelessly means an account with no record of
 * what it agreed to. Until that is built, this screen points at the web.
 */
export default function SignInScreen(): React.JSX.Element {
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) {
    return (
      <ScrollView className="flex-1 bg-ink" contentContainerClassName="p-4 gap-3">
        <Text className="text-mist text-xl font-semibold">Sign in</Text>
        <Text className="text-muted text-sm leading-5">
          Sign-in is not configured on this build — EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. The Analyse tab works without an account.
        </Text>
      </ScrollView>
    );
  }

  async function submit(): Promise<void> {
    setPending(true);
    setError(null);
    const message = await signIn(email, password);
    setPending(false);
    if (message === null) {
      // Back to where they came from; the Portfolio tab re-renders signed in.
      router.back();
      return;
    }
    setError(message);
  }

  const canSubmit = email.trim() !== "" && password !== "" && !pending;

  return (
    <ScrollView className="flex-1 bg-ink" contentContainerClassName="p-4 gap-4">
      <View className="gap-1.5">
        <Text className="text-mist text-xl font-semibold">Sign in</Text>
        <Text className="text-muted text-sm leading-5">
          Your saved properties are private to your account — the database enforces it, not the
          app. Signing in is what makes the Portfolio tab work.
        </Text>
      </View>

      <View className="gap-3">
        <View className="gap-1.5">
          <Text className="text-muted text-xs">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
            placeholderTextColor="#8A94A6"
            className="border-line bg-surface text-mist rounded-xl border px-3.5 py-3 text-base"
          />
        </View>

        <View className="gap-1.5">
          <Text className="text-muted text-xs">Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            placeholder="Password"
            placeholderTextColor="#8A94A6"
            className="border-line bg-surface text-mist rounded-xl border px-3.5 py-3 text-base"
          />
        </View>
      </View>

      {error !== null && (
        <View className="border-negative/40 bg-negative/10 rounded-xl border p-3">
          <Text className="text-negative text-sm leading-5">{error}</Text>
        </View>
      )}

      <Pressable
        onPress={() => void submit()}
        disabled={!canSubmit}
        className={`items-center rounded-full px-5 py-3.5 ${canSubmit ? "bg-accent" : "bg-accent/40"}`}
      >
        {pending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">Sign in</Text>
        )}
      </Pressable>

      <Text className="text-muted text-xs leading-5">
        No account yet? Sign up on the web — creating one records which version of the terms and
        privacy statement you accepted, and that record is not something to reproduce loosely on a
        second surface.
      </Text>
    </ScrollView>
  );
}
