import { FontAwesome5 } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { AppSkeleton } from "../../src/components/ui/AppSkeleton";
import { theme } from "../../src/constants/theme";
import {
  SharedMember,
  Subscription,
  useApp,
} from "../../src/context/AppContext";
import { triggerImpactHaptic, triggerNotificationHaptic } from "../../src/utils/haptics";

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
    .filter(
      (member) =>
        member.name && member.share_ratio > 0 && member.share_ratio <= 1,
    );
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
  const [editingSubscription, setEditingSubscription] =
    useState<Subscription | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editRenewalDate, setEditRenewalDate] = useState("");
  const [editBillingCycle, setEditBillingCycle] =
    useState<(typeof billingCycles)[number]>("monthly");
  const [editTrialEnabled, setEditTrialEnabled] = useState(false);
  const [editTrialEndDate, setEditTrialEndDate] = useState("");
  const [editSharedWithInput, setEditSharedWithInput] = useState("");

  const categories = useMemo(
    () =>
      Array.from(new Set(subscriptions.map((item) => item.category)))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 12),
    [subscriptions],
  );

  const monthlyAverage = useMemo(
    () => analytics?.average_monthly_per_subscription ?? 0,
    [analytics?.average_monthly_per_subscription],
  );

  function openEditModal(subscription: Subscription) {
    setEditingSubscription(subscription);
    setEditAmount(String(subscription.amount));
    setEditRenewalDate(subscription.renewal_date);
    setEditBillingCycle(subscription.billing_cycle);
    setEditTrialEnabled(Boolean(subscription.is_trial));
    setEditTrialEndDate(subscription.trial_end_date ?? "");
    setEditSharedWithInput(
      (subscription.shared_with ?? [])
        .map((member) => `${member.name}:${member.share_ratio}`)
        .join(", "),
    );
  }

  async function submitEdit() {
    if (!editingSubscription) return;
    if (!editAmount || !editRenewalDate) {
      Alert.alert("Missing fields", "Please fill in amount and renewal date.");
      return;
    }
    if (editTrialEnabled && !editTrialEndDate) {
      Alert.alert(
        "Missing trial end",
        "Provide a trial end date for trial subscriptions.",
      );
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
      await triggerNotificationHaptic("success");
      setEditingSubscription(null);
    } catch {
      await triggerNotificationHaptic("error");
      Alert.alert("Update failed", "Could not update subscription.");
    }
  }

  async function handleMarkRenewed(id: string) {
    try {
      await markRenewed(id);
      await triggerNotificationHaptic("success");
    } catch {
      await triggerNotificationHaptic("error");
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <AppChip
          label="All categories"
          active={!categoryFilter}
          onPress={() => setCategoryFilter(null)}
        />
        {categories.map((category) => (
          <AppChip
            key={category}
            label={category}
            active={categoryFilter === category}
            onPress={() => setCategoryFilter(category)}
          />
        ))}
      </ScrollView>
      <View style={styles.sortRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortChips}
        >
          {(["renewal_date", "amount", "name"] as const).map((value) => (
            <AppChip
              key={value}
              label={
                value === "renewal_date"
                  ? "Renewal"
                  : value === "amount"
                    ? "Amount"
                    : "Name"
              }
              active={sortBy === value}
              onPress={() => setSortBy(value)}
            />
          ))}
          <AppChip
            label={sortOrder === "asc" ? "Asc" : "Desc"}
            variant="warning"
            onPress={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          />
        </ScrollView>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <AppSkeleton style={styles.skeletonHero} />
        <View style={styles.skeletonInsightRow}>
          <AppSkeleton style={styles.skeletonInsight} />
          <AppSkeleton style={styles.skeletonInsight} />
        </View>
        <AppSkeleton style={styles.skeletonSearch} />
        <AppSkeleton style={styles.skeletonChipRow} />
        <AppSkeleton style={styles.skeletonItem} />
        <AppSkeleton style={styles.skeletonItem} />
        <AppSkeleton style={styles.skeletonItem} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppCard variant="accent" padding="lg" style={styles.heroCard}>
        <Text style={styles.heroLabel}>Monthly spend</Text>
        <Text style={styles.heroValue}>
          {formatCurrency(analytics?.monthly_total ?? 0, preferredCurrency)}
        </Text>
        <Text style={styles.heroSubLabel}>
          Yearly total:{" "}
          {formatCurrency(analytics?.yearly_total ?? 0, preferredCurrency)}
        </Text>
        <View style={styles.heroMetaRow}>
          <AppChip
            label={`${subscriptions.length} tracked`}
            variant="default"
            style={styles.heroMetaChip}
            textStyle={styles.heroMetaText}
          />
          <AppChip
            label={`${analytics?.upcoming_renewals_count ?? 0} upcoming`}
            variant="default"
            style={styles.heroMetaChip}
            textStyle={styles.heroMetaText}
          />
        </View>
      </AppCard>

      <View style={styles.insightRow}>
        <AppCard style={styles.insightCard}>
          <Text style={styles.insightLabel}>Avg / subscription</Text>
          <Text style={styles.insightValue}>
            {formatCurrency(monthlyAverage, preferredCurrency)}
          </Text>
        </AppCard>
        <AppCard style={styles.insightCard}>
          <Text style={styles.insightLabel}>Top category</Text>
          <Text style={styles.insightValue}>
            {analytics?.top_category?.name ?? "—"}
          </Text>
        </AppCard>
      </View>

      {analytics?.trial_conversions?.length ? (
        <AppCard variant="warning" style={styles.trialCard}>
          <Text style={styles.trialCardTitle}>Trial conversions soon</Text>
          {analytics.trial_conversions.slice(0, 3).map((item) => (
            <Text key={item.id} style={styles.trialCardText}>
              {item.name} ends on {item.trial_end_date}
            </Text>
          ))}
        </AppCard>
      ) : null}

      {needsAuthForMoreSubscriptions ? (
        <Link href="/auth" asChild>
          <Pressable
            style={({ pressed }) => [
              styles.authPrompt,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.authPromptTitle}>
              Unlock unlimited subscriptions
            </Text>
            <Text style={styles.authPromptText}>
              You reached 10 subscriptions. Sign in to keep adding and enable
              full analytics history.
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
          <AppCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No subscriptions yet</Text>
            <Text style={styles.emptyText}>
              Use the Add tab to track Netflix, Spotify, and more.
            </Text>
            <Link href="/(tabs)/add" asChild>
              <AppButton label="Add your first subscription" style={styles.emptyCta} />
            </Link>
          </AppCard>
        }
        renderItem={({ item }) => (
          <AppCard style={styles.itemCard}>
            <View style={styles.itemLeading}>
              {item.platform_logo_url ? (
                <Image
                  source={{ uri: item.platform_logo_url }}
                  style={styles.logoImage}
                />
              ) : (
                <View style={styles.iconCircle}>
                  <Text style={styles.iconLabel}>
                    {item.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.itemTextBlock}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.category} · Renews {item.renewal_date}
                </Text>
                {item.platform_offer_name ? (
                  <Text style={styles.itemOfferMeta}>
                    Offer: {item.platform_offer_name}
                  </Text>
                ) : null}
                {item.is_trial && item.trial_end_date ? (
                  <Text style={styles.itemTrialMeta}>
                    Trial until {item.trial_end_date}
                  </Text>
                ) : null}
                {(item.duplicate_count ?? 0) > 1 ? (
                  <Text style={styles.duplicateTag}>
                    Potential duplicate ({item.duplicate_count})
                  </Text>
                ) : null}
                {(item.shared_with ?? []).length ? (
                  <Text style={styles.itemShareMeta}>
                    Shared:{" "}
                    {(item.shared_with ?? [])
                      .map((member) => member.name)
                      .join(", ")}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.itemActions}>
              <Text style={styles.itemPrice}>
                {formatCurrency(item.amount, item.currency)} ·{" "}
                {item.billing_cycle}
              </Text>
              <View style={styles.itemActionRow}>
                <AppButton
                  icon={
                    <FontAwesome5
                      name="check-circle"
                      size={16}
                      color={theme.colors.success}
                    />
                  }
                  variant="ghost"
                  style={styles.iconActionButton}
                  onPress={() => void handleMarkRenewed(item.id)}
                />
                <AppButton
                  icon={
                    <FontAwesome5
                      name="edit"
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                  }
                  variant="ghost"
                  style={styles.iconActionButton}
                  onPress={() => openEditModal(item)}
                />
                <AppButton
                  icon={
                    <FontAwesome5
                      name="trash"
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                  }
                  variant="ghost"
                  style={styles.iconActionButton}
                  onPress={async () => {
                    await triggerImpactHaptic("light");
                    await deleteSubscription(item.id);
                  }}
                />
              </View>
            </View>
          </AppCard>
        )}
      />

      <Modal
        visible={Boolean(editingSubscription)}
        animationType="slide"
        transparent
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit subscription</Text>
            <Text style={styles.modalSubtitle}>
              {editingSubscription?.name}
            </Text>
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
                  style={[
                    styles.cycleChip,
                    editBillingCycle === cycle && styles.cycleChipActive,
                  ]}
                  onPress={() => setEditBillingCycle(cycle)}
                >
                  <Text style={styles.cycleChipText}>{cycle}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.toggleRow}>
              <Pressable
                style={[
                  styles.toggleChip,
                  editTrialEnabled && styles.toggleChipActive,
                ]}
                onPress={() => setEditTrialEnabled(true)}
              >
                <Text style={styles.toggleText}>Trial</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.toggleChip,
                  !editTrialEnabled && styles.toggleChipActive,
                ]}
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
              <AppButton
                label="Cancel"
                variant="secondary"
                style={styles.secondaryButton}
                onPress={async () => {
                  await triggerImpactHaptic("light");
                  setEditingSubscription(null);
                }}
              />
              <AppButton
                label="Save"
                style={styles.primaryButton}
                onPress={() => void submitEdit()}
              />
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
  heroMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: theme.spacing.md,
  },
  heroMetaChip: {
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroMetaText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  insightRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  insightCard: {
    flex: 1,
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
    backgroundColor: theme.colors.infoBg,
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
  filterChip: {},
  filterChipActive: {},
  filterText: {},
  sortRow: {
    flexDirection: "row",
  },
  sortChips: {
    gap: 8,
  },
  sortChip: {},
  sortChipActive: {},
  sortChipOrder: {},
  sortChipText: {},
  emptyCard: {
    marginTop: theme.spacing.lg,
    alignItems: "flex-start",
    gap: 8,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: 6,
  },
  emptyCtaText: {},
  itemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLabel: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
  logoImage: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#fff",
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
  itemOfferMeta: {
    color: theme.colors.textMuted,
    marginTop: 2,
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
  iconActionButton: {
    width: 30,
    height: 30,
    paddingHorizontal: 0,
    paddingVertical: 0,
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
    backgroundColor: theme.colors.accentSoft,
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
    backgroundColor: theme.colors.accentSoft,
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
  secondaryButton: {},
  secondaryButtonText: {},
  primaryButton: {},
  primaryButtonText: {},
  buttonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  chipPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  skeletonHero: {
    height: 148,
    borderRadius: theme.radius.xl,
    marginBottom: theme.spacing.md,
  },
  skeletonInsightRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  skeletonInsight: {
    flex: 1,
    height: 86,
    borderRadius: theme.radius.lg,
  },
  skeletonSearch: {
    height: 44,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  skeletonChipRow: {
    height: 32,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  skeletonItem: {
    height: 94,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.sm,
  },
});
