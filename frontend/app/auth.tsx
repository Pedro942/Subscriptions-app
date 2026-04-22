import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { theme } from "../src/constants/theme";
import { useApp } from "../src/context/AppContext";

type Mode = "login" | "register";

export default function AuthScreen() {
  const router = useRouter();
  const { login, register } = useApp();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter both email and password.");
      return;
    }

    setPending(true);
    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ email, password });
      }
      router.back();
    } catch {
      Alert.alert(
        "Authentication failed",
        "Please verify credentials and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>
          {mode === "login" ? "Welcome back" : "Create account"}
        </Text>
        <Text style={styles.subtitle}>
          Accounts are required after 10 subscriptions to unlock unlimited
          tracking.
        </Text>

        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeChip, mode === "login" && styles.modeChipActive]}
            onPress={() => setMode("login")}
          >
            <Text style={styles.modeText}>Login</Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeChip,
              mode === "register" && styles.modeChipActive,
            ]}
            onPress={() => setMode("register")}
          >
            <Text style={styles.modeText}>Register</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password (min 8 chars)"
          placeholderTextColor={theme.colors.textSecondary}
        />

        <Pressable
          style={[styles.submitButton, pending && styles.submitButtonDisabled]}
          onPress={submit}
        >
          <Text style={styles.submitText}>
            {pending
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Register"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
    justifyContent: "center",
  },
  panel: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xxl,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    ...theme.effects.cardShadow,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: theme.spacing.md,
  },
  modeChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surface,
  },
  modeChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  modeText: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSoft,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: theme.spacing.sm,
  },
  submitButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    alignItems: "center",
    paddingVertical: 12,
    marginTop: theme.spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
});
