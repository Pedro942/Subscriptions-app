import { Redirect, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppProvider } from "../src/context/AppContext";
import { theme } from "../src/constants/theme";
import { useApp } from "../src/context/AppContext";

function AppShell() {
  const { onboardingComplete, isLocked, unlockApp } = useApp();

  if (isLocked) {
    return (
      <View style={styles.lockContainer}>
        <Text style={styles.lockTitle}>App Locked</Text>
        <Text style={styles.lockSubtitle}>Biometric lock is enabled. Unlock to continue.</Text>
        <Pressable style={styles.unlockButton} onPress={() => void unlockApp()}>
          <Text style={styles.unlockButtonText}>Unlock</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {onboardingComplete ? null : <Redirect href="/onboarding" />}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.textPrimary,
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
    padding: theme.spacing.lg,
  },
  lockTitle: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  lockSubtitle: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  unlockButton: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  unlockButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
});
