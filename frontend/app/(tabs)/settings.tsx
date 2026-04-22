import * as Clipboard from "expo-clipboard";
import * as LocalAuthentication from "expo-local-authentication";
import { Link } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMemo, useState } from "react";

import { currencies, theme } from "../../src/constants/theme";
import { useApp } from "../../src/context/AppContext";

function parseCategoryLimits(input: string): Record<string, number> {
  const entries = input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((entry) => {
      const [categoryRaw, limitRaw] = entry
        .split(":")
        .map((value) => value.trim());
      const limit = Number(limitRaw);
      return { category: categoryRaw, limit };
    })
    .filter(
      (entry) =>
        entry.category && Number.isFinite(entry.limit) && entry.limit > 0,
    );
  const result: Record<string, number> = {};
  for (const entry of entries) {
    result[entry.category] = entry.limit;
  }
  return result;
}

export default function SettingsScreen() {
  const {
    preferredCurrency,
    setPreferredCurrency,
    token,
    userEmail,
    logout,
    notificationStatus,
    requestNotificationsPermission,
    remindersEnabled,
    setRemindersEnabled,
    reminderLeadDays,
    setReminderLeadDays,
    quietHoursEnabled,
    setQuietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    setQuietHours,
    budgetConfig,
    setBudgetConfig,
    exportJson,
    exportCsv,
    importJson,
    isBiometricLockEnabled,
    setBiometricLockEnabled,
    lockApp,
    fxRates,
  } = useApp();

  const [budgetLimitInput, setBudgetLimitInput] = useState(
    budgetConfig?.monthly_limit ? String(budgetConfig.monthly_limit) : "",
  );
  const [categoryLimitsInput, setCategoryLimitsInput] = useState(
    budgetConfig
      ? Object.entries(budgetConfig.category_limits)
          .map(([category, limit]) => `${category}:${limit}`)
          .join(", ")
      : "",
  );
  const [importJsonInput, setImportJsonInput] = useState("");

  const biometricLabel = useMemo(
    () => (isBiometricLockEnabled ? "Biometric lock ON" : "Biometric lock OFF"),
    [isBiometricLockEnabled],
  );

  async function handleCurrencyChange(currency: string) {
    try {
      await setPreferredCurrency(currency);
    } catch {
      Alert.alert("Error", "Could not update preferred currency.");
    }
  }

  async function handleNotifications() {
    try {
      await requestNotificationsPermission();
    } catch {
      Alert.alert("Error", "Notification permissions could not be updated.");
    }
  }

  async function handleToggleReminders(enabled: boolean) {
    try {
      await setRemindersEnabled(enabled);
      if (enabled && notificationStatus !== "granted") {
        await requestNotificationsPermission();
      }
    } catch {
      Alert.alert("Error", "Reminder settings could not be updated.");
    }
  }

  async function handleLeadDays(days: number) {
    try {
      await setReminderLeadDays(days);
    } catch {
      Alert.alert("Error", "Reminder lead time could not be updated.");
    }
  }

  async function handleQuietHours(enabled: boolean) {
    try {
      await setQuietHoursEnabled(enabled);
    } catch {
      Alert.alert("Error", "Quiet hour settings could not be updated.");
    }
  }

  async function handleQuietWindow(startHour: number, endHour: number) {
    try {
      await setQuietHours(startHour, endHour);
    } catch {
      Alert.alert("Error", "Quiet hour window could not be updated.");
    }
  }

  async function handleSaveBudget() {
    const monthlyLimit = Number(budgetLimitInput);
    if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) {
      Alert.alert("Invalid budget", "Enter a valid monthly budget amount.");
      return;
    }
    try {
      await setBudgetConfig({
        monthly_limit: monthlyLimit,
        category_limits: parseCategoryLimits(categoryLimitsInput),
      });
      Alert.alert("Saved", "Budget updated.");
    } catch {
      Alert.alert("Error", "Could not save budget.");
    }
  }

  async function handleExportJson() {
    try {
      const data = await exportJson();
      await Clipboard.setStringAsync(data);
      Alert.alert("Export complete", "JSON export copied to clipboard.");
    } catch {
      Alert.alert("Error", "Could not export JSON.");
    }
  }

  async function handleExportCsv() {
    try {
      const data = await exportCsv();
      await Clipboard.setStringAsync(data);
      Alert.alert("Export complete", "CSV export copied to clipboard.");
    } catch {
      Alert.alert("Error", "Could not export CSV.");
    }
  }

  async function handleImportJson() {
    try {
      const parsed = JSON.parse(importJsonInput) as {
        subscriptions?: Record<string, unknown>[];
      };
      const subscriptions = parsed.subscriptions ?? [];
      if (!Array.isArray(subscriptions)) {
        Alert.alert("Invalid payload", "Expected a `subscriptions` array.");
        return;
      }
      const imported = await importJson({ subscriptions });
      Alert.alert("Import complete", `${imported} subscriptions imported.`);
      setImportJsonInput("");
    } catch {
      Alert.alert("Error", "Could not import JSON payload.");
    }
  }

  async function handleBiometricToggle() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      Alert.alert(
        "Unavailable",
        "Biometric hardware is not available or no biometric is enrolled.",
      );
      return;
    }
    const target = !isBiometricLockEnabled;
    await setBiometricLockEnabled(target);
    if (target) {
      lockApp();
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Currency</Text>
        <Text style={styles.cardSubtitle}>
          Default is EUR, but you can switch anytime.
        </Text>
        <View style={styles.currencyGrid}>
          {currencies.map((currency) => {
            const active = preferredCurrency === currency;
            return (
              <Pressable
                key={currency}
                onPress={() => void handleCurrencyChange(currency)}
                style={[
                  styles.currencyChip,
                  active && styles.currencyChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.currencyText,
                    active && styles.currencyTextActive,
                  ]}
                >
                  {currency}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {fxRates ? (
          <Text style={styles.metaText}>
            FX source: {fxRates.source}{" "}
            {fxRates.fetched_at ? `· Updated ${fxRates.fetched_at}` : ""}
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Renewal reminders</Text>
        <Text style={styles.cardSubtitle}>
          Push notifications before renewal dates are enabled by requesting
          permissions.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => void handleNotifications()}
        >
          <Text style={styles.primaryButtonText}>
            {notificationStatus === "granted"
              ? "Notifications enabled"
              : "Enable notifications"}
          </Text>
        </Pressable>
        <View style={styles.row}>
          <Pressable
            style={[
              styles.toggleChip,
              remindersEnabled && styles.toggleChipActive,
            ]}
            onPress={() => void handleToggleReminders(true)}
          >
            <Text style={styles.toggleChipText}>On</Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleChip,
              !remindersEnabled && styles.toggleChipActive,
            ]}
            onPress={() => void handleToggleReminders(false)}
          >
            <Text style={styles.toggleChipText}>Off</Text>
          </Pressable>
        </View>
        <Text style={styles.cardSubtitle}>
          Notify me this many days before renewal:
        </Text>
        <View style={styles.currencyGrid}>
          {[1, 3, 7].map((days) => {
            const active = reminderLeadDays === days;
            return (
              <Pressable
                key={days}
                onPress={() => void handleLeadDays(days)}
                style={[
                  styles.currencyChip,
                  active && styles.currencyChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.currencyText,
                    active && styles.currencyTextActive,
                  ]}
                >
                  {days}d
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quiet hours</Text>
        <Text style={styles.cardSubtitle}>
          Suppress reminders during selected hours.
        </Text>
        <View style={styles.row}>
          <Pressable
            style={[
              styles.toggleChip,
              quietHoursEnabled && styles.toggleChipActive,
            ]}
            onPress={() => void handleQuietHours(true)}
          >
            <Text style={styles.toggleChipText}>Enabled</Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleChip,
              !quietHoursEnabled && styles.toggleChipActive,
            ]}
            onPress={() => void handleQuietHours(false)}
          >
            <Text style={styles.toggleChipText}>Disabled</Text>
          </Pressable>
        </View>
        <View style={styles.currencyGrid}>
          {[
            { label: "22 → 8", start: 22, end: 8 },
            { label: "23 → 7", start: 23, end: 7 },
            { label: "0 → 6", start: 0, end: 6 },
          ].map((slot) => {
            const active =
              quietHoursStart === slot.start && quietHoursEnd === slot.end;
            return (
              <Pressable
                key={slot.label}
                style={[
                  styles.currencyChip,
                  active && styles.currencyChipActive,
                ]}
                onPress={() => void handleQuietWindow(slot.start, slot.end)}
              >
                <Text
                  style={[
                    styles.currencyText,
                    active && styles.currencyTextActive,
                  ]}
                >
                  {slot.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Budgets</Text>
        <Text style={styles.cardSubtitle}>
          Set monthly and category limits using format: Video Streaming:60,
          Music:20
        </Text>
        <TextInput
          style={styles.input}
          value={budgetLimitInput}
          onChangeText={setBudgetLimitInput}
          keyboardType="decimal-pad"
          placeholder={`Monthly budget (${preferredCurrency})`}
          placeholderTextColor={theme.colors.textSecondary}
        />
        <TextInput
          style={styles.input}
          value={categoryLimitsInput}
          onChangeText={setCategoryLimitsInput}
          placeholder="Category limits"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <Pressable
          style={styles.primaryButton}
          onPress={() => void handleSaveBudget()}
        >
          <Text style={styles.primaryButtonText}>Save budget</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data export/import</Text>
        <Text style={styles.cardSubtitle}>
          Export to clipboard and import from JSON payload. Keeps your data
          portable.
        </Text>
        <View style={styles.row}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void handleExportJson()}
          >
            <Text style={styles.secondaryButtonText}>Export JSON</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void handleExportCsv()}
          >
            <Text style={styles.secondaryButtonText}>Export CSV</Text>
          </Pressable>
        </View>
        <TextInput
          style={[styles.input, styles.importInput]}
          value={importJsonInput}
          onChangeText={setImportJsonInput}
          multiline
          placeholder='Paste JSON export payload here {"subscriptions":[...]}'
          placeholderTextColor={theme.colors.textSecondary}
        />
        <Pressable
          style={styles.primaryButton}
          onPress={() => void handleImportJson()}
        >
          <Text style={styles.primaryButtonText}>Import JSON</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Security</Text>
        <Text style={styles.cardSubtitle}>
          Enable app lock and unlock using local biometrics.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => void handleBiometricToggle()}
        >
          <Text style={styles.primaryButtonText}>{biometricLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        {token ? (
          <>
            <Text style={styles.cardSubtitle}>Logged in as {userEmail}</Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => void logout()}
            >
              <Text style={styles.secondaryButtonText}>Logout</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.cardSubtitle}>
              Create an account to unlock more than 10 subscriptions and keep
              your data synced.
            </Text>
            <Link href="/auth" asChild>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Login / Register</Text>
              </Pressable>
            </Link>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    paddingBottom: 36,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    ...theme.effects.softShadow,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardSubtitle: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  metaText: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: theme.spacing.sm,
    flexWrap: "wrap",
  },
  currencyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  currencyChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    backgroundColor: theme.colors.surfaceElevated,
  },
  currencyChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  currencyText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  currencyTextActive: {
    color: theme.colors.textPrimary,
  },
  toggleChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surfaceElevated,
  },
  toggleChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  toggleChipText: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceElevated,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: theme.spacing.sm,
  },
  importInput: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    paddingVertical: 10,
    alignItems: "center",
    ...theme.effects.softShadow,
  },
  primaryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    backgroundColor: theme.colors.surfaceElevated,
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
});
