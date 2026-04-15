import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { currencies, theme } from "../src/constants/theme";
import { useApp } from "../src/context/AppContext";

const leadOptions = [1, 3, 7];

export default function OnboardingScreen() {
  const router = useRouter();
  const {
    preferredCurrency,
    setPreferredCurrency,
    remindersEnabled,
    setRemindersEnabled,
    reminderLeadDays,
    setReminderLeadDays,
    setOnboardingComplete,
  } = useApp();
  const [step, setStep] = useState(0);

  const steps = useMemo(
    () => [
      {
        title: "Welcome to Subscription Hub",
        subtitle: "Track trials, renewals, spending insights, and shared subscriptions in one place.",
      },
      {
        title: "Choose your default currency",
        subtitle: "All analytics will be converted to this currency. You can change it later in Settings.",
      },
      {
        title: "Enable reminder defaults",
        subtitle: "Set reminders now, and we will notify you before renewals and trial conversions.",
      },
    ],
    []
  );

  async function finish() {
    await setOnboardingComplete(true);
    router.replace("/(tabs)");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.stepIndicator}>
        Step {step + 1} / {steps.length}
      </Text>
      <Text style={styles.title}>{steps[step].title}</Text>
      <Text style={styles.subtitle}>{steps[step].subtitle}</Text>

      {step === 1 ? (
        <View style={styles.rowWrap}>
          {currencies.map((currency) => {
            const active = preferredCurrency === currency;
            return (
              <Pressable
                key={currency}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => void setPreferredCurrency(currency)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{currency}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {step === 2 ? (
        <>
          <View style={styles.rowWrap}>
            <Pressable
              style={[styles.chip, remindersEnabled && styles.chipActive]}
              onPress={() => void setRemindersEnabled(true)}
            >
              <Text style={[styles.chipText, remindersEnabled && styles.chipTextActive]}>Reminders ON</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, !remindersEnabled && styles.chipActive]}
              onPress={() => void setRemindersEnabled(false)}
            >
              <Text style={[styles.chipText, !remindersEnabled && styles.chipTextActive]}>Reminders OFF</Text>
            </Pressable>
          </View>
          <Text style={styles.subheading}>Notify me before renewal:</Text>
          <View style={styles.rowWrap}>
            {leadOptions.map((days) => {
              const active = reminderLeadDays === days;
              return (
                <Pressable
                  key={days}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => void setReminderLeadDays(days)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{days} days</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <View style={styles.actions}>
        {step > 0 ? (
          <Pressable style={styles.secondaryButton} onPress={() => setStep((prev) => Math.max(0, prev - 1))}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {step < steps.length - 1 ? (
          <Pressable style={styles.primaryButton} onPress={() => setStep((prev) => prev + 1)}>
            <Text style={styles.primaryButtonText}>Next</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primaryButton} onPress={() => void finish()}>
            <Text style={styles.primaryButtonText}>Get started</Text>
          </Pressable>
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
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  stepIndicator: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  subheading: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
    marginTop: theme.spacing.sm,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#1A1328",
  },
  chipText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  chipTextActive: {
    color: theme.colors.textPrimary,
  },
  actions: {
    marginTop: theme.spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
});
