import { useMemo } from "react";
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

function formatShort(amount: number, currency: string) {
  if (amount >= 1000) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 1,
      notation: "compact",
    }).format(amount);
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const TREND_MONTHS = 6;
const CHART_HEIGHT = 100;

export default function AnalyticsScreen() {
  const { analytics, preferredCurrency, fxRates, budgetConfig, subscriptions } = useApp();

  const trendData = useMemo(() => {
    if (!subscriptions.length) return [];
    const now = new Date();
    const fxBase = fxRates?.base ?? preferredCurrency;

    return Array.from({ length: TREND_MONTHS }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      let total = 0;

      for (const sub of subscriptions) {
        let amount = sub.amount;
        if (sub.currency !== preferredCurrency && fxRates) {
          const fromRate = sub.currency === fxBase ? 1 : (fxRates.rates[sub.currency] ?? 1);
          const toRate = preferredCurrency === fxBase ? 1 : (fxRates.rates[preferredCurrency] ?? 1);
          amount = (sub.amount / fromRate) * toRate;
        }
        if (sub.billing_cycle === "monthly") {
          total += amount;
        } else {
          const renewal = new Date(sub.renewal_date);
          if (renewal.getMonth() === d.getMonth()) {
            total += amount;
          }
        }
      }

      return {
        label: d.toLocaleString("default", { month: "short" }),
        total: Math.round(total * 100) / 100,
        isCurrent: i === 0,
      };
    });
  }, [subscriptions, preferredCurrency, fxRates]);

  const trendMax = useMemo(
    () => Math.max(...trendData.map((m) => m.total), 1),
    [trendData],
  );

  const categoryEntries = Object.entries(
    analytics?.category_breakdown ?? {},
  ).sort((a, b) => b[1].monthly - a[1].monthly);
  const maxMonthly = categoryEntries[0]?.[1].monthly ?? 1;
  const monthlyTotal = analytics?.monthly_total ?? 0;
  const yearlyTotal = analytics?.yearly_total ?? 0;
  const averageSpend = analytics?.average_monthly_per_subscription ?? 0;
  const topCategory = analytics?.top_category?.name ?? "—";
  const renewalsCount = analytics?.upcoming_renewals_count ?? 0;
  const trialConversions = analytics?.trial_conversions ?? [];
  const insights = analytics?.insights ?? [];
  const budgetStatus = analytics?.budget_status;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>Monthly</Text>
          <Text style={styles.value}>
            {formatCurrency(monthlyTotal, preferredCurrency)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>Yearly</Text>
          <Text style={styles.value}>
            {formatCurrency(yearlyTotal, preferredCurrency)}
          </Text>
        </View>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Average / subscription</Text>
          <Text style={styles.kpiValue}>
            {formatCurrency(averageSpend, preferredCurrency)}
          </Text>
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
          <Text style={styles.kpiValue}>
            {formatCurrency(
              analytics?.savings_target_10_percent ?? monthlyTotal * 0.1,
              preferredCurrency,
            )}
          </Text>
        </View>
      </View>

      {trendData.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending trend (next 6 months)</Text>
          <View style={styles.trendChart}>
            {trendData.map((month) => {
              const barH = Math.max(4, Math.round((month.total / trendMax) * CHART_HEIGHT));
              return (
                <View key={month.label} style={styles.trendColumn}>
                  <Text style={styles.trendAmount}>
                    {formatShort(month.total, preferredCurrency)}
                  </Text>
                  <View
                    style={[
                      styles.trendBar,
                      {
                        height: barH,
                        backgroundColor: month.isCurrent
                          ? theme.colors.accent
                          : theme.colors.accentSoft,
                        borderColor: month.isCurrent
                          ? theme.colors.accent
                          : theme.colors.border,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.trendLabel,
                      month.isCurrent && styles.trendLabelCurrent,
                    ]}
                  >
                    {month.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.trendHint}>
            Monthly subs contribute every month; yearly subs appear in their renewal month.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category breakdown</Text>
        {categoryEntries.length === 0 ? (
          <Text style={styles.emptyText}>
            Add subscriptions to see your spend distribution.
          </Text>
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
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.round(widthRatio * 100)}%` },
                    ]}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Budget progress</Text>
        {budgetStatus ? (
          <>
            <Text style={styles.budgetText}>
              {formatCurrency(budgetStatus.monthly_total, preferredCurrency)} /{" "}
              {formatCurrency(budgetStatus.monthly_limit, preferredCurrency)}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(100, Math.round(budgetStatus.monthly_usage_percent))}%`,
                    backgroundColor: budgetStatus.over_budget
                      ? theme.colors.danger
                      : theme.colors.success,
                  },
                ]}
              />
            </View>
            <Text style={styles.budgetHint}>
              {budgetStatus.over_budget
                ? `Over budget by ${formatCurrency(budgetStatus.over_budget_amount, preferredCurrency)}`
                : "Within budget"}
            </Text>
          </>
        ) : (
          <Text style={styles.emptyText}>
            No budget configured yet. Set one in Settings to receive
            overspending alerts.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trial conversions (14 days)</Text>
        {trialConversions.length ? (
          trialConversions.map((trial) => (
            <View key={trial.id} style={styles.renewalRow}>
              <View>
                <Text style={styles.renewalName}>{trial.name}</Text>
                <Text style={styles.renewalDate}>
                  Converts on {trial.trial_end_date}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>
            No trial conversions in the next 14 days.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Insights</Text>
        {insights.length ? (
          insights.map((insight, idx) => (
            <View key={`${insight.title}-${idx}`} style={styles.insightRow}>
              <Text
                style={[
                  styles.insightSeverity,
                  insight.severity === "danger"
                    ? styles.insightDanger
                    : insight.severity === "warning"
                      ? styles.insightWarning
                      : styles.insightInfo,
                ]}
              >
                {insight.severity.toUpperCase()}
              </Text>
              <View style={styles.insightBody}>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                <Text style={styles.insightValue}>{insight.value}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No insights yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          FX rates ({fxRates?.base ?? "EUR"})
        </Text>
        {fxRates ? (
          <>
            <View style={styles.rateGrid}>
              {Object.entries(fxRates.rates).map(([code, value]) => (
                <View key={code} style={styles.rateChip}>
                  <Text style={styles.rateCode}>{code}</Text>
                  <Text style={styles.rateValue}>{value.toFixed(4)}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.fxMeta}>
              Source: {fxRates.source}{" "}
              {fxRates.fetched_at ? `· Updated ${fxRates.fetched_at}` : ""}
            </Text>
          </>
        ) : (
          <Text style={styles.emptyText}>FX rates unavailable.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Projection</Text>
        <Text style={styles.projectionText}>
          At this pace you are spending{" "}
          {formatCurrency(monthlyTotal, preferredCurrency)} per month and{" "}
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
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    ...theme.effects.softShadow,
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
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    ...theme.effects.softShadow,
  },
  kpiGrid: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    ...theme.effects.softShadow,
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
    backgroundColor: theme.colors.surfaceSoft,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
  },
  budgetText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
  budgetHint: {
    color: theme.colors.textSecondary,
    marginTop: 8,
    fontSize: 12,
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
  insightRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  insightSeverity: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  insightInfo: {
    color: theme.colors.accent,
  },
  insightWarning: {
    color: theme.colors.warning,
  },
  insightDanger: {
    color: theme.colors.danger,
  },
  insightBody: {
    flex: 1,
    gap: 2,
  },
  insightTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  insightValue: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  rateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rateChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 78,
  },
  rateCode: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 12,
  },
  rateValue: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  fxMeta: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    fontSize: 12,
  },
  projectionText: {
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  trendChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: CHART_HEIGHT + 52,
    marginTop: 4,
  },
  trendColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  trendBar: {
    width: "100%",
    borderRadius: 4,
    borderWidth: 1,
  },
  trendAmount: {
    color: theme.colors.textMuted,
    fontSize: 9,
    textAlign: "center",
  },
  trendLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    textAlign: "center",
  },
  trendLabelCurrent: {
    color: theme.colors.accent,
    fontWeight: "700",
  },
  trendHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: theme.spacing.sm,
    fontStyle: "italic",
  },
  legacyInsightRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
});
