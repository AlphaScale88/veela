import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { tokens } from "@veela/ui";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";

import { AuthProvider } from "../lib/auth";

import "../global.css";

export default function RootLayout(): React.JSX.Element {
  // One client per mount, created in state so Fast Refresh doesn't discard the cache.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 2,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: tokens.color.bg },
          headerTintColor: tokens.color.text,
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: tokens.color.surface,
            borderTopColor: tokens.color.border,
          },
          tabBarActiveTintColor: tokens.color.accent,
          tabBarInactiveTintColor: tokens.color.textMuted,
          sceneStyle: { backgroundColor: tokens.color.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Analyse" }} />
        <Tabs.Screen name="map" options={{ title: "Map" }} />
        <Tabs.Screen name="portfolio" options={{ title: "Portfolio" }} />
        {/* Reachable from the Portfolio tab, not a tab of its own — `href: null` keeps it out of
            the bar. A permanent "Sign in" tab would sit there advertising itself long after
            somebody had signed in. */}
        <Tabs.Screen name="sign-in" options={{ title: "Sign in", href: null }} />
      </Tabs>
      </AuthProvider>
    </QueryClientProvider>
  );
}
