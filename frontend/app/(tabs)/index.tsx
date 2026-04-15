import { FontAwesome5 } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { theme } from "../../src/constants/theme";
import { Subscription, useApp } from "../../src/context/AppContext";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

const billingCycles = ["monthly", "yearly"] as const;

export default function HomeScreen() {
  const {
    loading,
    analytics,
    subscriptions,
    preferredCurrency,
    deleteSubscription,
    updateSubscription,
    needsAuthForMoreSubscriptions,
  } = useApp();
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editRenewalDate, setEditRenewalDate] = useState("");
  const [editBillingCycle, setEditBillingCycle] = useState<(typeof billingCycles)[number]>("monthly");

  const monthlyAverage = useMemo(
    () => analytics?.average_monthly_per_subscription ?? 0,
    [analytics?.average_monthly_per_subscription]
  );

  function openEditModal(subscription: Subscription) {
    setEditingSubscription(subscription);
    setEditAmount(String(subscription.amount));
    setEditRenewalDate(subscription.renewal_date);
    setEditBillingCycle(subscription.billing_cycle);
  }

  async function submitEdit() {
    if (!editingSubscription) return;
    if (!editAmount || !editRenewalDate) {
      Alert.alert("Missing fields", "Please fill in amount and renewal date.");
      return;
    }
    try {
      await updateSubscription(editingSubscription.id, {
        amount: Number(editAmount),
        renewal_date: editRenewalDate,
        billing_cycle: editBillingCycle,
        currency: editingSubscription.currency,
      });
      setEditingSubscription(null);
    } catch {
      Alert.alert("Update failed", "Could not update subscription.");
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Monthly spend</Text>
        <Text style={styles.heroValue}>
          {formatCurrency(analytics?.monthly_total ?? 0, preferredCurrency)}
        </Text>
        <Text style={styles.heroSubLabel}>
          Yearly total: {formatCurrency(analytics?.yearly_total ?? 0, preferredCurrency)}
        </Text>
      </View>

      <View style={styles.insightRow}>
        <View style={styles.insightCard}>
          <Text style={styles.insightLabel}>Avg / subscription</Text>
          <Text style={styles.insightValue}>{formatCurrency(monthlyAverage, preferredCurrency)}</Text>
        </View>
        <View style={styles.insightCard}>
          <Text style={styles.insightLabel}>Top category</Text>
          <Text style={styles.insightValue}>{analytics?.top_category?.name ?? "—"}</Text>
        </View>
      </View>

      {needsAuthForMoreSubscriptions ? (
        <Link href="/auth" asChild>
          <Pressable style={styles.authPrompt}>
            <Text style={styles.authPromptTitle}>Unlock unlimited subscriptions</Text>
            <Text style={styles.authPromptText}>
              You reached 10 subscriptions. Sign in to keep adding and enable full analytics history.
            </Text>
          </Pressable>
        </Link>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your subscriptions</Text>
        <Text style={styles.sectionCount}>{subscriptions.length}</Text>
      </View>

      <FlatList
        data={subscriptions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No subscriptions yet</Text>
            <Text style={styles.emptyText}>Use the Add tab to track Netflix, Spotify, and more.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemLeading}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconLabel}>{item.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.category} · Renews {item.renewal_date}
                </Text>
              </View>
            </View>
            <View style={styles.itemActions}>
              <Text style={styles.itemPrice}>
                {formatCurrency(item.amount, item.currency)} · {item.billing_cycle}
              </Text>
              <View style={styles.itemActionRow}>
                <Pressable onPress={() => openEditModal(item)}>
                  <FontAwesome5 name="edit" size={16} color={theme.colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => void deleteSubscription(item.id)}>
                  <FontAwesome5 name="trash" size={16} color={theme.colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      <Modal visible={Boolean(editingSubscription)} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit subscription</Text>
            <Text style={styles.modalSubtitle}>{editingSubscription?.name}</Text>
            <TextInput
              style={styles.input}
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              placeholder="Amount"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <TextInput
              style={styles.input}
              value={editRenewalDate}
              onChangeText={setEditRenewalDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <View style={styles.cycleRow}>
              {billingCycles.map((cycle) => (
                <Pressable
                  key={cycle}
                  style={[styles.cycleChip, editBillingCycle === cycle && styles.cycleChipActive]}
                  onPress={() => setEditBillingCycle(cycle)}
                >
                  <Text style={styles.cycleChipText}>{cycle}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setEditingSubscription(null)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => void submitEdit()}>
                <Text style={styles.primaryButtonText}>Save</Text>
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
    padding: theme.spacing.md,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  heroCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  heroLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: theme.spacing.xs,
  },
  heroValue: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    fontWeight: "700",
  },
  heroSubLabel: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  insightRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  insightCard: {
    flex: 1,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  insightLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  insightValue: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  authPrompt: {
    backgroundColor: "#1A1328",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  authPromptTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    marginBottom: 4,
  },
  authPromptText: {
    color: theme.colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  sectionCount: {
    color: theme.colors.textSecondary,
    fontSize: 15,
  },
  listContent: {
    gap: theme.spacing.sm,
    paddingBottom: 32,
  },
  emptyCard: {
    marginTop: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyText: {
    color: theme.colors.textSecondary,
  },
  itemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  itemLeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flexShrink: 1,
    marginRight: theme.spacing.sm,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  iconLabel: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
  itemName: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  itemMeta: {
    color: theme.colors.textSecondary,
    marginTop: 3,
    fontSize: 12,
  },
  itemActions: {
    alignItems: "flex-end",
    gap: theme.spacing.sm,
  },
  itemActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemPrice: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: theme.spacing.md,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubtitle: {
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginBottom: theme.spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceElevated,
    color: theme.colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: theme.spacing.sm,
  },
  cycleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  cycleChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cycleChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#1A1328",
  },
  cycleChipText: {
    color: theme.colors.textPrimary,
    textTransform: "capitalize",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
});
