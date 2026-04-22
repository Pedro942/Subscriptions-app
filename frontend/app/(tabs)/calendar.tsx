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

import { AppButton } from "../../src/components/ui/AppButton";
import { AppCard } from "../../src/components/ui/AppCard";
import { AppChip } from "../../src/components/ui/AppChip";
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
        <AppChip
          label={`${upcomingCount} upcoming events`}
          variant="info"
          textStyle={styles.summaryChipText}
        />
        {dates.length === 0 ? (
          <AppCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptyText}>
              Add subscriptions and trial dates to populate your calendar.
            </Text>
          </AppCard>
        ) : (
          dates.map((dateValue) => (
            <AppCard key={dateValue} style={styles.dayCard}>
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
                      <AppChip
                        label="Mark renewed"
                        variant="success"
                        onPress={() => void handleMarkRenewed(event)}
                        pressedStyle={styles.actionPressed}
                        disabled={busyEventId === event.id}
                        style={styles.actionButton}
                        textStyle={styles.actionText}
                      />
                      <AppChip
                        label="Snooze..."
                        variant="info"
                        onPress={() => openSnoozeModal(event)}
                        pressedStyle={styles.actionPressed}
                        disabled={busyEventId === event.id}
                        style={styles.actionButton}
                        textStyle={styles.actionText}
                      />
                      <AppChip
                        label="Skip cycle"
                        variant="warning"
                        onPress={() => void handleSkipCycle(event)}
                        pressedStyle={styles.actionPressed}
                        disabled={busyEventId === event.id}
                        style={styles.actionButton}
                        textStyle={styles.actionText}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
            </AppCard>
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
          <AppButton
            label="Undo"
            variant="secondary"
            size="sm"
            onPress={() => void handleUndoLastAction()}
            pressedStyle={styles.actionPressed}
            disabled={busyEventId === undoAction.subscriptionId}
            style={styles.undoButton}
            textStyle={styles.undoButtonText}
          />
        </View>
      ) : null}

      <Modal visible={Boolean(snoozeEvent)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <AppCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>Snooze renewal</Text>
            <Text style={styles.modalSubtitle}>
              {snoozeEvent?.name ?? "Subscription"}
            </Text>
            <Text style={styles.modalLabel}>Choose delay</Text>
            <View style={styles.presetRow}>
              {snoozePresets.map((days) => (
                <AppChip
                  key={days}
                  label={`${days}d`}
                  selected={selectedSnoozeDays === days}
                  onPress={() => {
                    setSelectedSnoozeDays(days);
                    setCustomSnoozeDays("");
                  }}
                  pressedStyle={styles.actionPressed}
                  textStyle={styles.presetChipText}
                  style={styles.presetChip}
                />
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
              <AppButton
                label="Cancel"
                variant="ghost"
                onPress={() => setSnoozeEvent(null)}
                pressedStyle={styles.actionPressed}
                style={styles.cancelButton}
                textStyle={styles.cancelButtonText}
              />
              <AppButton
                label="Apply"
                variant="primary"
                onPress={() => void applySnoozeSelection()}
                pressedStyle={styles.actionPressed}
                style={styles.confirmButton}
                textStyle={styles.confirmButtonText}
              />
            </View>
          </AppCard>
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
  summaryChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  emptyCard: {
    padding: theme.spacing.lg,
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
    padding: theme.spacing.md,
    gap: 8,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: {
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  undoButtonText: {
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
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
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
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  presetChipText: {
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
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  cancelButtonText: {
    fontWeight: "600",
  },
  confirmButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  confirmButtonText: {
    fontWeight: "700",
  },
});
