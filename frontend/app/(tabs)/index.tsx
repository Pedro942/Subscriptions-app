import { FontAwesome5 } from "@expo/vector-icons";
import { Link } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../../src/constants/theme";
import { useApp } from "../../src/context/AppContext";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function HomeScreen() {
  const { loading, analytics, subscriptions, preferredCurrency, deleteSubscription, needsAuthForMoreSubscriptions } =
    useApp();

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
              <Text style={styles.itemPrice}>{formatCurrency(item.amount, item.currency)}</Text>
              <Pressable onPress={() => void deleteSubscription(item.id)}>
                <FontAwesome5 name="trash" size={16} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        )}
      />
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
  itemPrice: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
});
