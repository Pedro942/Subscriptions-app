import { ScrollView, StyleSheet, Text, View } from "react-native";

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
  const { calendarEvents } = useApp();
  const grouped = groupEvents(calendarEvents);
  const dates = Object.keys(grouped).sort();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Renewal calendar</Text>
      <Text style={styles.subtitle}>
        Timeline view for renewals and trial conversions.
      </Text>
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
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingBottom: 104,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    ...theme.effects.softShadow,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    marginBottom: 6,
    fontSize: 17,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  dayCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: 10,
    ...theme.effects.softShadow,
  },
  dayTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 16,
  },
  eventRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
    paddingBottom: 2,
  },
  eventDetails: {
    gap: 2,
  },
  eventName: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
    fontSize: 14,
  },
  eventType: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
