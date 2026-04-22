import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { theme } from "../../src/constants/theme";
import { useApp } from "../../src/context/AppContext";

function groupEvents(
  events: Array<{
    date: string;
    name: string;
    type: "renewal" | "trial_end";
    amount: number;
    currency: string;
  }>,
) {
  return events.reduce<Record<string, typeof events>>((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = [];
    }
    acc[event.date].push(event);
    return acc;
  }, {});
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function CalendarScreen() {
  const { calendarEvents, markRenewed, snoozeSubscription, skipSubscriptionCycle } =
    useApp();
  const grouped = groupEvents(calendarEvents);
  const dates = Object.keys(grouped).sort();
  const upcomingCount = calendarEvents.length;
  const [busyEventId, setBusyEventId] = useState<string | null>(null);

  async function handleMarkRenewed(subscriptionId: string) {
    try {
      setBusyEventId(subscriptionId);
      await markRenewed(subscriptionId);
    } catch {
      Alert.alert("Action failed", "Could not mark renewal.");
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleSnooze(subscriptionId: string) {
    try {
      setBusyEventId(subscriptionId);
      await snoozeSubscription(subscriptionId, 7);
    } catch {
      Alert.alert("Action failed", "Could not snooze this event.");
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleSkipCycle(subscriptionId: string) {
    try {
      setBusyEventId(subscriptionId);
      await skipSubscriptionCycle(subscriptionId);
    } catch {
      Alert.alert("Action failed", "Could not skip this cycle.");
    } finally {
      setBusyEventId(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Renewal calendar</Text>
      <Text style={styles.subtitle}>
        Timeline view for renewals and trial conversions.
      </Text>
      <View style={styles.summaryChip}>
        <Text style={styles.summaryChipText}>{upcomingCount} upcoming events</Text>
      </View>
      {dates.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No upcoming events</Text>
          <Text style={styles.emptyText}>
            Add subscriptions and trial dates to populate your calendar.
          </Text>
        </View>
      ) : (
        dates.map((dateValue) => (
          <View key={dateValue} style={styles.dayCard}>
            <Text style={styles.dayTitle}>{dateValue}</Text>
            {grouped[dateValue].map((event, index) => (
              <View key={`${event.name}-${index}`} style={styles.eventRow}>
                <View style={styles.eventDetails}>
                  <Text style={styles.eventName}>{event.name}</Text>
                  <Text style={styles.eventType}>
                    {event.type === "trial_end" ? "Trial converts" : "Renews"} ·{" "}
                    {formatCurrency(event.amount, event.currency)}
                  </Text>
                </View>
                {event.type === "renewal" ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.actionSuccess,
                        pressed && styles.actionPressed,
                        busyEventId === event.id && styles.actionDisabled,
                      ]}
                      disabled={busyEventId === event.id}
                      onPress={() => void handleMarkRenewed(event.id)}
                    >
                      <Text style={styles.actionText}>Mark renewed</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.actionInfo,
                        pressed && styles.actionPressed,
                        busyEventId === event.id && styles.actionDisabled,
                      ]}
                      disabled={busyEventId === event.id}
                      onPress={() => void handleSnooze(event.id)}
                    >
                      <Text style={styles.actionText}>Snooze 7d</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.actionWarning,
                        pressed && styles.actionPressed,
                        busyEventId === event.id && styles.actionDisabled,
                      ]}
                      disabled={busyEventId === event.id}
                      onPress={() => void handleSkipCycle(event.id)}
                    >
                      <Text style={styles.actionText}>Skip cycle</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ))
      )}
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
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  summaryChip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.infoBg,
  },
  summaryChipText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceElevated,
    padding: theme.spacing.lg,
    ...theme.effects.softShadow,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyText: {
    color: theme.colors.textSecondary,
  },
  dayCard: {
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceElevated,
    padding: theme.spacing.md,
    gap: 8,
    ...theme.effects.softShadow,
  },
  dayTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 15,
  },
  eventRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
    gap: 8,
  },
  eventDetails: {
    gap: 2,
  },
  eventName: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  eventType: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  actionButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionSuccess: {
    backgroundColor: theme.colors.successBg,
    borderColor: theme.colors.success,
  },
  actionInfo: {
    backgroundColor: theme.colors.infoBg,
    borderColor: theme.colors.accent,
  },
  actionWarning: {
    backgroundColor: theme.colors.warningBg,
    borderColor: theme.colors.warning,
  },
  actionText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  actionPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  actionDisabled: {
    opacity: 0.5,
  },
});
