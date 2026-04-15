import { Link } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { currencies, theme } from "../../src/constants/theme";
import { useApp } from "../../src/context/AppContext";

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
  } = useApp();

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

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Currency</Text>
        <Text style={styles.cardSubtitle}>Default is EUR, but you can switch anytime.</Text>
        <View style={styles.currencyGrid}>
          {currencies.map((currency) => {
            const active = preferredCurrency === currency;
            return (
              <Pressable
                key={currency}
                onPress={() => handleCurrencyChange(currency)}
                style={[styles.currencyChip, active && styles.currencyChipActive]}
              >
                <Text style={[styles.currencyText, active && styles.currencyTextActive]}>{currency}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Renewal reminders</Text>
        <Text style={styles.cardSubtitle}>
          Push notifications before renewal dates are enabled by requesting permissions.
        </Text>
        <Pressable style={styles.primaryButton} onPress={handleNotifications}>
          <Text style={styles.primaryButtonText}>
            {notificationStatus === "granted" ? "Notifications enabled" : "Enable notifications"}
          </Text>
        </Pressable>
        <View style={styles.reminderToggleRow}>
          <Pressable
            style={[styles.toggleChip, remindersEnabled && styles.toggleChipActive]}
            onPress={() => void handleToggleReminders(true)}
          >
            <Text style={styles.toggleChipText}>On</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleChip, !remindersEnabled && styles.toggleChipActive]}
            onPress={() => void handleToggleReminders(false)}
          >
            <Text style={styles.toggleChipText}>Off</Text>
          </Pressable>
        </View>
        <Text style={styles.cardSubtitle}>Notify me this many days before renewal:</Text>
        <View style={styles.currencyGrid}>
          {[1, 3, 7].map((days) => {
            const active = reminderLeadDays === days;
            return (
              <Pressable
                key={days}
                onPress={() => void handleLeadDays(days)}
                style={[styles.currencyChip, active && styles.currencyChipActive]}
              >
                <Text style={[styles.currencyText, active && styles.currencyTextActive]}>{days}d</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        {token ? (
          <>
            <Text style={styles.cardSubtitle}>Logged in as {userEmail}</Text>
            <Pressable style={styles.secondaryButton} onPress={logout}>
              <Text style={styles.secondaryButtonText}>Logout</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.cardSubtitle}>
              Create an account to unlock more than 10 subscriptions and keep your data synced.
            </Text>
            <Link href="/auth" asChild>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Login / Register</Text>
              </Pressable>
            </Link>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
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
    backgroundColor: "#1A1328",
  },
  currencyText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  currencyTextActive: {
    color: theme.colors.textPrimary,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
  reminderToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    marginBottom: 12,
  },
  toggleChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surfaceElevated,
  },
  toggleChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#1A1328",
  },
  toggleChipText: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
});
