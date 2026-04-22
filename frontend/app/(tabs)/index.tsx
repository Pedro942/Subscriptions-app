import { FontAwesome5 } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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

import { theme } from "../../src/constants/theme";
import {
  SharedMember,
  Subscription,
  useApp,
} from "../../src/context/AppContext";

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
    subColors,
    setSubColor,
  } = useApp();

  const COLOR_OPTIONS: Array<{ label: string; value: string | null }> = [
    { label: "None", value: null },
    { label: "Purple", value: "#8B5CF6" },
    { label: "Blue", value: "#3B82F6" },
    { label: "Green", value: "#22C55E" },
    { label: "Amber", value: "#F59E0B" },
    { label: "Red", value: "#EF4444" },
    { label: "Teal", value: "#14B8A6" },
  ];
  const [editingSubscription, setEditingSubscription] =
    useState<Subscription | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editRenewalDate, setEditRenewalDate] = useState("");
  const [editBillingCycle, setEditBillingCycle] =
    useState<(typeof billingCycles)[number]>("monthly");
  const [editTrialEnabled, setEditTrialEnabled] = useState(false);
  const [editTrialEndDate, setEditTrialEndDate] = useState("");
  const [editSharedWithInput, setEditSharedWithInput] = useState("");
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localSearch, setSearchQuery]);

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
        value={localSearch}
        onChangeText={setLocalSearch}
        placeholder="Search subscriptions"
        placeholderTextColor={theme.colors.textSecondary}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <Pressable
          style={[
            styles.filterChip,
            !categoryFilter && styles.filterChipActive,
          ]}
          onPress={() => setCategoryFilter(null)}
        >
          <Text style={styles.filterText}>All categories</Text>
        </Pressable>
        {categories.map((category) => (
          <Pressable
            key={category}
            style={[
              styles.filterChip,
              categoryFilter === category && styles.filterChipActive,
            ]}
            onPress={() => setCategoryFilter(category)}
          >
            <Text style={styles.filterText}>{category}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.sortRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortChips}
        >
          {(["renewal_date", "amount", "name"] as const).map((value) => (
            <Pressable
              key={value}
              style={[
                styles.sortChip,
                sortBy === value && styles.sortChipActive,
              ]}
              onPress={() => setSortBy(value)}
            >
              <Text style={styles.sortChipText}>
                {value === "renewal_date"
                  ? "Renewal"
                  : value === "amount"
                    ? "Amount"
                    : "Name"}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.sortChip, styles.sortChipOrder]}
            onPress={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          >
            <Text style={styles.sortChipText}>
              {sortOrder === "asc" ? "Asc" : "Desc"}
            </Text>
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
        <Text style={styles.heroValue}>
          {formatCurrency(analytics?.monthly_total ?? 0, preferredCurrency)}
        </Text>
        <Text style={styles.heroSubLabel}>
          Yearly total:{" "}
          {formatCurrency(analytics?.yearly_total ?? 0, preferredCurrency)}
        </Text>
      </View>

      <View style={styles.insightRow}>
        <View style={styles.insightCard}>
          <Text style={styles.insightLabel}>Avg / subscription</Text>
          <Text style={styles.insightValue}>
            {formatCurrency(monthlyAverage, preferredCurrency)}
          </Text>
        </View>
        <View style={styles.insightCard}>
          <Text style={styles.insightLabel}>Top category</Text>
          <Text style={styles.insightValue}>
            {analytics?.top_category?.name ?? "—"}
          </Text>
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No subscriptions yet</Text>
            <Text style={styles.emptyText}>
              Use the Add tab to track Netflix, Spotify, and more.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.itemCard,
              subColors[item.id]
                ? { borderLeftColor: subColors[item.id], borderLeftWidth: 3 }
                : null,
            ]}
          >
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
                <Pressable onPress={() => void handleMarkRenewed(item.id)}>
                  <FontAwesome5
                    name="check-circle"
                    size={16}
                    color={theme.colors.success}
                  />
                </Pressable>
                <Pressable onPress={() => openEditModal(item)}>
                  <FontAwesome5
                    name="edit"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
                <Pressable onPress={() => void deleteSubscription(item.id)}>
                  <FontAwesome5
                    name="trash"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
              </View>
            </View>
          </View>
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
            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {(editingSubscription?.price_history ?? []).length > 0 ? (
                <View style={styles.priceHistorySection}>
                  <Text style={styles.priceHistoryTitle}>Price history</Text>
                  {[...(editingSubscription?.price_history ?? [])]
                    .reverse()
                    .map((entry, i) => {
                      const increased = entry.new_amount > entry.old_amount;
                      return (
                        <View key={i} style={styles.priceHistoryRow}>
                          <Text style={styles.priceHistoryDate}>
                            {entry.changed_at.slice(0, 10)}
                          </Text>
                          <View style={styles.priceHistoryArrow}>
                            <Text style={styles.priceHistoryOld}>
                              {formatCurrency(entry.old_amount, entry.old_currency)}
                            </Text>
                            <FontAwesome5
                              name="arrow-right"
                              size={10}
                              color={theme.colors.textMuted}
                            />
                            <Text
                              style={
                                increased
                                  ? styles.priceUp
                                  : styles.priceDown
                              }
                            >
                              {formatCurrency(entry.new_amount, entry.new_currency)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                </View>
              ) : null}
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
              <Text style={styles.colorPickerLabel}>Tag colour</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.colorPickerRow}
              >
                {COLOR_OPTIONS.map((opt) => {
                  const active =
                    (subColors[editingSubscription?.id ?? ""] ?? null) === opt.value;
                  return (
                    <Pressable
                      key={opt.label}
                      onPress={() =>
                        editingSubscription &&
                        void setSubColor(editingSubscription.id, opt.value)
                      }
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: opt.value ?? theme.colors.surfaceSoft },
                        active && styles.colorSwatchActive,
                      ]}
                    />
                  );
                })}
              </ScrollView>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setEditingSubscription(null)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={() => void submitEdit()}
              >
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
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  heroCard: {
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    marginBottom: theme.spacing.md,
    ...theme.effects.cardShadow,
  },
  heroLabel: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginBottom: theme.spacing.xs,
  },
  heroValue: {
    color: theme.colors.textPrimary,
    fontSize: 36,
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
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    ...theme.effects.softShadow,
  },
  insightLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  insightValue: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  trialCard: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: "#2B2214",
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.effects.softShadow,
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
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.effects.softShadow,
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
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  sectionCount: {
    color: theme.colors.textSecondary,
    fontSize: 15,
  },
  listContent: {
    gap: theme.spacing.sm,
    paddingBottom: 120,
  },
  searchSortContainer: {
    gap: 10,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    ...theme.effects.softShadow,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSoft,
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
    backgroundColor: theme.colors.surfaceSoft,
  },
  filterChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  filterText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
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
    backgroundColor: theme.colors.surfaceSoft,
  },
  sortChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
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
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    ...theme.effects.softShadow,
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
    alignItems: "flex-start",
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.effects.softShadow,
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
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
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
    color: theme.colors.textMuted,
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
    fontSize: 13,
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
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    maxHeight: "85%",
    ...theme.effects.cardShadow,
  },
  modalScroll: {
    flexGrow: 0,
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
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSoft,
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
    backgroundColor: theme.colors.surfaceSoft,
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
  colorPickerLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: theme.spacing.xs,
  },
  colorPickerRow: {
    gap: 10,
    paddingBottom: 4,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  colorSwatchActive: {
    borderColor: theme.colors.textPrimary,
    borderWidth: 3,
  },
  priceHistorySection: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSoft,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    gap: 6,
  },
  priceHistoryTitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  priceHistoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceHistoryDate: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  priceHistoryArrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  priceHistoryOld: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textDecorationLine: "line-through",
  },
  priceUp: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: "600",
  },
  priceDown: {
    color: theme.colors.success,
    fontSize: 12,
    fontWeight: "600",
  },
});
