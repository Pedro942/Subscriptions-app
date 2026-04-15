import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AppProvider } from "../src/context/AppContext";
import { theme } from "../src/constants/theme";

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth"
          options={{
            presentation: "modal",
            title: "Account",
          }}
        />
      </Stack>
    </AppProvider>
  );
}
