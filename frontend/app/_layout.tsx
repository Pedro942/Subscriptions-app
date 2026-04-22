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

function AppShell() {
  const { onboardingComplete, isLocked } = useApp();

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <>
      <StatusBar style="light" />
      {onboardingComplete ? null : <Redirect href="/onboarding" />}
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
    </>
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
