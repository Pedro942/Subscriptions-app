import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { theme } from "../../src/constants/theme";
import { useApp } from "../../src/context/AppContext";

type TimelineEvent = {
  id: string;
  date: string;
  name: string;
  type: "renewal" | "trial_end";
  amount: number;
  currency: string;
};

type UndoAction = {
  subscriptionId: string;
  previousDate: string;
  subscriptionName: string;
  actionLabel: string;
};

function groupEvents(
  events: TimelineEvent[],
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
  const {
    calendarEvents,
    markRenewed,
    snoozeSubscription,
    skipSubscriptionCycle,
    updateSubscription,
  } = useApp();
  const grouped = groupEvents(calendarEvents);
  const dates = Object.keys(grouped).sort();
  const upcomingCount = calendarEvents.length;
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [snoozeEvent, setSnoozeEvent] = useState<TimelineEvent | null>(null);
  const [selectedSnoozeDays, setSelectedSnoozeDays] = useState(7);
  const [customSnoozeDays, setCustomSnoozeDays] = useState("");
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);

  const snoozePresets = useMemo(() => [1, 3, 7, 14], []);

  useEffect(() => {
    if (!undoAction) return;
    const timer = setTimeout(() => {
      setUndoAction(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [undoAction]);

  async function handleMarkRenewed(event: TimelineEvent) {
    try {
      setBusyEventId(event.id);
      await markRenewed(event.id);
      setUndoAction({
        subscriptionId: event.id,
        previousDate: event.date,
        subscriptionName: event.name,
        actionLabel: "renewed",
      });
    } catch {
      Alert.alert("Action failed", "Could not mark renewal.");
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleSnooze(event: TimelineEvent, days: number) {
    try {
      setBusyEventId(event.id);
      await snoozeSubscription(event.id, days);
      setUndoAction({
        subscriptionId: event.id,
        previousDate: event.date,
        subscriptionName: event.name,
        actionLabel: `snoozed ${days}d`,
      });
    } catch {
      Alert.alert("Action failed", "Could not snooze this event.");
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleSkipCycle(event: TimelineEvent) {
    try {
      setBusyEventId(event.id);
      await skipSubscriptionCycle(event.id);
      setUndoAction({
        subscriptionId: event.id,
        previousDate: event.date,
        subscriptionName: event.name,
        actionLabel: "skipped",
      });
    } catch {
      Alert.alert("Action failed", "Could not skip this cycle.");
    } finally {
      setBusyEventId(null);
    }
  }

  function openSnoozeModal(event: TimelineEvent) {
    setSnoozeEvent(event);
    setSelectedSnoozeDays(7);
    setCustomSnoozeDays("");
  }

  async function applySnoozeSelection() {
    if (!snoozeEvent) return;
    const customValue = customSnoozeDays.trim();
    const parsedCustom = customValue ? Number(customValue) : null;
    const days = parsedCustom && Number.isInteger(parsedCustom) ? parsedCustom : selectedSnoozeDays;
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      Alert.alert("Invalid snooze days", "Enter a whole number between 1 and 30.");
      return;
    }
    const target = snoozeEvent;
    setSnoozeEvent(null);
    await handleSnooze(target, days);
  }

  async function handleUndoLastAction() {
    if (!undoAction) return;
    try {
      setBusyEventId(undoAction.subscriptionId);
      await updateSubscription(undoAction.subscriptionId, {
        renewal_date: undoAction.previousDate,
      });
      setUndoAction(null);
    } catch {
      Alert.alert("Undo failed", "Could not restore the previous renewal date.");
    } finally {
      setBusyEventId(null);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
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
                        onPress={() => void handleMarkRenewed(event)}
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
                        onPress={() => openSnoozeModal(event)}
                      >
                        <Text style={styles.actionText}>Snooze...</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.actionButton,
                          styles.actionWarning,
                          pressed && styles.actionPressed,
                          busyEventId === event.id && styles.actionDisabled,
                        ]}
                        disabled={busyEventId === event.id}
                        onPress={() => void handleSkipCycle(event)}
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

      {undoAction ? (
        <View style={styles.undoBanner}>
          <View style={styles.undoBody}>
            <Text style={styles.undoTitle}>Action applied</Text>
            <Text style={styles.undoText}>
              {undoAction.subscriptionName} {undoAction.actionLabel}. Undo?
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.undoButton,
              pressed && styles.actionPressed,
              busyEventId === undoAction.subscriptionId && styles.actionDisabled,
            ]}
            disabled={busyEventId === undoAction.subscriptionId}
            onPress={() => void handleUndoLastAction()}
          >
            <Text style={styles.undoButtonText}>Undo</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={Boolean(snoozeEvent)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Snooze renewal</Text>
            <Text style={styles.modalSubtitle}>
              {snoozeEvent?.name ?? "Subscription"}
            </Text>
            <Text style={styles.modalLabel}>Choose delay</Text>
            <View style={styles.presetRow}>
              {snoozePresets.map((days) => (
                <Pressable
                  key={days}
                  style={({ pressed }) => [
                    styles.presetChip,
                    selectedSnoozeDays === days && styles.presetChipActive,
                    pressed && styles.actionPressed,
                  ]}
                  onPress={() => {
                    setSelectedSnoozeDays(days);
                    setCustomSnoozeDays("");
                  }}
                >
                  <Text style={styles.presetChipText}>{days}d</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={customSnoozeDays}
              onChangeText={setCustomSnoozeDays}
              keyboardType="number-pad"
              style={styles.customInput}
              placeholder="Custom days (1-30)"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.cancelButton, pressed && styles.actionPressed]}
                onPress={() => setSnoozeEvent(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.confirmButton, pressed && styles.actionPressed]}
                onPress={() => void applySnoozeSelection()}
              >
                <Text style={styles.confirmButtonText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    paddingBottom: 120,
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
  undoBanner: {
    position: "absolute",
    left: theme.spacing.md,
    right: theme.spacing.md,
    bottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceAccent,
    padding: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    ...theme.effects.softShadow,
  },
  undoBody: {
    flex: 1,
    gap: 2,
  },
  undoTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  undoText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  undoButton: {
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.accentSoft,
  },
  undoButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: theme.spacing.md,
  },
  modalCard: {
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.effects.cardShadow,
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubtitle: {
    color: theme.colors.textSecondary,
    marginTop: -2,
  },
  modalLabel: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.chipDefaultBg,
  },
  presetChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.chipActiveBg,
  },
  presetChipText: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
    fontSize: 12,
  },
  customInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSoft,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: theme.colors.surfaceSoft,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  confirmButton: {
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: theme.colors.accent,
  },
  confirmButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
});
