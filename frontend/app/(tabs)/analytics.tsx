import { ScrollView, StyleSheet, Text, View } from "react-native";

import { theme } from "../../src/constants/theme";
import { useApp } from "../../src/context/AppContext";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function AnalyticsScreen() {
  const { analytics, preferredCurrency } = useApp();

  const categoryEntries = Object.entries(analytics?.category_breakdown ?? {}).sort(
    (a, b) => b[1].monthly - a[1].monthly
  );
  const maxMonthly = categoryEntries[0]?.[1].monthly ?? 1;
  const monthlyTotal = analytics?.monthly_total ?? 0;
  const yearlyTotal = analytics?.yearly_total ?? 0;
  const averageSpend = analytics?.average_monthly_per_subscription ?? 0;
  const topCategory = analytics?.top_category?.name ?? "—";
  const renewalsCount = analytics?.upcoming_renewals_count ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>Monthly</Text>
          <Text style={styles.value}>
            {formatCurrency(analytics?.monthly_total ?? 0, preferredCurrency)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>Yearly</Text>
          <Text style={styles.value}>
            {formatCurrency(analytics?.yearly_total ?? 0, preferredCurrency)}
          </Text>
        </View>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Average / subscription</Text>
          <Text style={styles.kpiValue}>{formatCurrency(averageSpend, preferredCurrency)}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Top category</Text>
          <Text style={styles.kpiValue}>{topCategory}</Text>
        </View>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Upcoming renewals</Text>
          <Text style={styles.kpiValue}>{renewalsCount}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Savings target (10%)</Text>
          <Text style={styles.kpiValue}>{formatCurrency(monthlyTotal * 0.1, preferredCurrency)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category breakdown</Text>
        {categoryEntries.length === 0 ? (
          <Text style={styles.emptyText}>Add subscriptions to see your spend distribution.</Text>
        ) : (
          categoryEntries.map(([category, totals]) => {
            const widthRatio = Math.max(0.08, totals.monthly / maxMonthly);
            return (
              <View key={category} style={styles.barRow}>
                <View style={styles.barTextRow}>
                  <Text style={styles.barLabel}>{category}</Text>
                  <Text style={styles.barValue}>
                    {formatCurrency(totals.monthly, preferredCurrency)}/mo
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.round(widthRatio * 100)}%` }]} />
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Upcoming renewals (30 days)</Text>
        {analytics?.upcoming_renewals.length ? (
          analytics.upcoming_renewals.map((renewal) => (
            <View key={renewal.id} style={styles.renewalRow}>
              <View>
                <Text style={styles.renewalName}>{renewal.name}</Text>
                <Text style={styles.renewalDate}>{renewal.renewal_date}</Text>
              </View>
              <Text style={styles.renewalAmount}>
                {formatCurrency(renewal.amount, renewal.currency)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No renewals in the next 30 days.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Projection</Text>
        <Text style={styles.projectionText}>
          At this pace you are spending {formatCurrency(monthlyTotal, preferredCurrency)} per month and{" "}
          {formatCurrency(yearlyTotal, preferredCurrency)} per year.
        </Text>
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
    paddingBottom: 40,
  },
  summaryRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  kpiGrid: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  kpiLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  kpiValue: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 16,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.textSecondary,
  },
  barRow: {
    marginBottom: theme.spacing.sm,
  },
  barTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  barLabel: {
    color: theme.colors.textPrimary,
    fontSize: 13,
  },
  barValue: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceElevated,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
  },
  renewalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  renewalName: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  renewalDate: {
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontSize: 12,
  },
  renewalAmount: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  projectionText: {
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});
