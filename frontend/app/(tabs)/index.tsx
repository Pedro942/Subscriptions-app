import { FontAwesome5 } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { theme } from "../../src/constants/theme";
import { SharedMember, Subscription, useApp } from "../../src/context/AppContext";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function parseSharedWith(input: string): SharedMember[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [nameRaw, ratioRaw] = part.split(":").map((value) => value.trim());
      const ratio = Number(ratioRaw);
      return { name: nameRaw, share_ratio: Number.isFinite(ratio) ? ratio : 0 };
    })
    .filter((member) => member.name && member.share_ratio > 0 && member.share_ratio <= 1);
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
    markRenewed,
    needsAuthForMoreSubscriptions,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
  } = useApp();
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editRenewalDate, setEditRenewalDate] = useState("");
  const [editBillingCycle, setEditBillingCycle] = useState<(typeof billingCycles)[number]>("monthly");
  const [editTrialEnabled, setEditTrialEnabled] = useState(false);
  const [editTrialEndDate, setEditTrialEndDate] = useState("");
  const [editSharedWithInput, setEditSharedWithInput] = useState("");

  const categories = useMemo(
    () =>
      Array.from(new Set(subscriptions.map((item) => item.category)))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 12),
    [subscriptions]
  );

  const monthlyAverage = useMemo(
    () => analytics?.average_monthly_per_subscription ?? 0,
    [analytics?.average_monthly_per_subscription]
  );

  function openEditModal(subscription: Subscription) {
    setEditingSubscription(subscription);
    setEditAmount(String(subscription.amount));
    setEditRenewalDate(subscription.renewal_date);
    setEditBillingCycle(subscription.billing_cycle);
    setEditTrialEnabled(Boolean(subscription.is_trial));
    setEditTrialEndDate(subscription.trial_end_date ?? "");
    setEditSharedWithInput(
      (subscription.shared_with ?? []).map((member) => `${member.name}:${member.share_ratio}`).join(", ")
    );
  }

  async function submitEdit() {
    if (!editingSubscription) return;
    if (!editAmount || !editRenewalDate) {
      Alert.alert("Missing fields", "Please fill in amount and renewal date.");
      return;
    }
    if (editTrialEnabled && !editTrialEndDate) {
      Alert.alert("Missing trial end", "Provide a trial end date for trial subscriptions.");
      return;
    }
    try {
      await updateSubscription(editingSubscription.id, {
        amount: Number(editAmount),
        renewal_date: editRenewalDate,
        billing_cycle: editBillingCycle,
        currency: editingSubscription.currency,
        is_trial: editTrialEnabled,
        trial_end_date: editTrialEnabled ? editTrialEndDate : null,
        shared_with: parseSharedWith(editSharedWithInput),
      });
      setEditingSubscription(null);
    } catch {
      Alert.alert("Update failed", "Could not update subscription.");
    }
  }

  async function handleMarkRenewed(id: string) {
    try {
      await markRenewed(id);
    } catch {
      Alert.alert("Failed", "Could not mark subscription as renewed.");
    }
  }

  const searchSortBar = (
    <View style={styles.searchSortContainer}>
      <TextInput
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search subscriptions"
        placeholderTextColor={theme.colors.textSecondary}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, !categoryFilter && styles.filterChipActive]}
          onPress={() => setCategoryFilter(null)}
        >
          <Text style={styles.filterText}>All categories</Text>
        </Pressable>
        {categories.map((category) => (
          <Pressable
            key={category}
            style={[styles.filterChip, categoryFilter === category && styles.filterChipActive]}
            onPress={() => setCategoryFilter(category)}
          >
            <Text style={styles.filterText}>{category}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.sortRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChips}>
          {(["renewal_date", "amount", "name"] as const).map((value) => (
            <Pressable
              key={value}
              style={[styles.sortChip, sortBy === value && styles.sortChipActive]}
              onPress={() => setSortBy(value)}
            >
              <Text style={styles.sortChipText}>
                {value === "renewal_date" ? "Renewal" : value === "amount" ? "Amount" : "Name"}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.sortChip, styles.sortChipOrder]}
            onPress={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          >
            <Text style={styles.sortChipText}>{sortOrder === "asc" ? "Asc" : "Desc"}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );

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
        <Text style={styles.heroValue}>{formatCurrency(analytics?.monthly_total ?? 0, preferredCurrency)}</Text>
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

      {analytics?.trial_conversions?.length ? (
        <View style={styles.trialCard}>
          <Text style={styles.trialCardTitle}>Trial conversions soon</Text>
          {analytics.trial_conversions.slice(0, 3).map((item) => (
            <Text key={item.id} style={styles.trialCardText}>
              {item.name} ends on {item.trial_end_date}
            </Text>
          ))}
        </View>
      ) : null}

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
        ListHeaderComponent={searchSortBar}
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
              <View style={styles.itemTextBlock}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.category} · Renews {item.renewal_date}
                </Text>
                {item.is_trial && item.trial_end_date ? (
                  <Text style={styles.itemTrialMeta}>Trial until {item.trial_end_date}</Text>
                ) : null}
                {(item.duplicate_count ?? 0) > 1 ? (
                  <Text style={styles.duplicateTag}>Potential duplicate ({item.duplicate_count})</Text>
                ) : null}
                {(item.shared_with ?? []).length ? (
                  <Text style={styles.itemShareMeta}>
                    Shared: {(item.shared_with ?? []).map((member) => member.name).join(", ")}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.itemActions}>
              <Text style={styles.itemPrice}>
                {formatCurrency(item.amount, item.currency)} · {item.billing_cycle}
              </Text>
              <View style={styles.itemActionRow}>
                <Pressable onPress={() => void handleMarkRenewed(item.id)}>
                  <FontAwesome5 name="check-circle" size={16} color={theme.colors.success} />
                </Pressable>
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
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleChip, editTrialEnabled && styles.toggleChipActive]}
                onPress={() => setEditTrialEnabled(true)}
              >
                <Text style={styles.toggleText}>Trial</Text>
              </Pressable>
              <Pressable
                style={[styles.toggleChip, !editTrialEnabled && styles.toggleChipActive]}
                onPress={() => setEditTrialEnabled(false)}
              >
                <Text style={styles.toggleText}>Paid</Text>
              </Pressable>
            </View>
            {editTrialEnabled ? (
              <TextInput
                style={styles.input}
                value={editTrialEndDate}
                onChangeText={setEditTrialEndDate}
                placeholder="Trial end date (YYYY-MM-DD)"
                placeholderTextColor={theme.colors.textSecondary}
              />
            ) : null}
            <TextInput
              style={styles.input}
              value={editSharedWithInput}
              onChangeText={setEditSharedWithInput}
              placeholder="Shared with (name:ratio, comma-separated)"
              placeholderTextColor={theme.colors.textSecondary}
            />
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
  trialCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: "#2A2214",
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  trialCardTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    marginBottom: 4,
  },
  trialCardText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
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
  searchSortContainer: {
    gap: 10,
    marginBottom: theme.spacing.sm,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.surface,
  },
  filterChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#1A1328",
  },
  filterText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
  sortRow: {
    flexDirection: "row",
  },
  sortChips: {
    gap: 8,
  },
  sortChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.surface,
  },
  sortChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#1A1328",
  },
  sortChipOrder: {
    borderColor: theme.colors.warning,
  },
  sortChipText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
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
    gap: theme.spacing.sm,
  },
  itemLeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flex: 1,
  },
  itemTextBlock: {
    flex: 1,
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
  itemTrialMeta: {
    color: theme.colors.warning,
    marginTop: 2,
    fontSize: 12,
  },
  duplicateTag: {
    color: theme.colors.danger,
    marginTop: 2,
    fontSize: 12,
  },
  itemShareMeta: {
    color: theme.colors.textSecondary,
    marginTop: 2,
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
    marginBottom: theme.spacing.sm,
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
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  toggleChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  toggleChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#1A1328",
  },
  toggleText: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
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
