import { Redirect, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { FontAwesome5 } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppProvider } from "../src/context/AppContext";
import { theme } from "../src/constants/theme";
import { useApp } from "../src/context/AppContext";

function LockScreen() {
  const { unlockApp } = useApp();

  useEffect(() => {
    void unlockApp();
  }, [unlockApp]);

  return (
    <View style={styles.lockContainer}>
      <FontAwesome5
        name="fingerprint"
        size={56}
        color={theme.colors.accent}
        style={styles.lockIcon}
      />
      <Text style={styles.lockTitle}>App Locked</Text>
      <Text style={styles.lockSubtitle}>
        Authenticate with biometrics or your device passcode to continue.
      </Text>
      <Pressable style={styles.unlockButton} onPress={() => void unlockApp()}>
        <Text style={styles.unlockButtonText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

function formatSyncTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function AppShell() {
  const { onboardingComplete, isLocked, isOffline, lastSyncedAt } = useApp();

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <View style={styles.appShell}>
      <StatusBar style="light" />
      {onboardingComplete ? null : <Redirect href="/onboarding" />}
      {isOffline ? (
        <View style={styles.offlineBanner}>
          <FontAwesome5 name="wifi" size={11} color={theme.colors.textPrimary} />
          <Text style={styles.offlineText}>
            Offline{lastSyncedAt ? ` · Last synced ${formatSyncTime(lastSyncedAt)}` : ""}
          </Text>
        </View>
      ) : null}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.textPrimary,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth"
          options={{
            presentation: "modal",
            title: "Account",
          }}
        />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.colors.warning,
    paddingVertical: 5,
  },
  offlineText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  lockContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  lockIcon: {
    marginBottom: theme.spacing.lg,
  },
  lockTitle: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  lockSubtitle: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    textAlign: "center",
  },
  unlockButton: {
    alignSelf: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 20,
    ...theme.effects.softShadow,
  },
  unlockButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
});
