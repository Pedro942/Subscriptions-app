import { useMemo, useState } from "react";
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
import { useRouter } from "expo-router";

import { theme } from "../../src/constants/theme";
import { Platform, useApp } from "../../src/context/AppContext";

const billingCycles = ["monthly", "yearly"] as const;

function groupedByCategory(platforms: Platform[]) {
  return platforms.reduce<Record<string, Platform[]>>((acc, platform) => {
    acc[platform.category] = acc[platform.category] ?? [];
    acc[platform.category].push(platform);
    return acc;
  }, {});
}

export default function AddScreen() {
  const router = useRouter();
  const { addSubscription, platforms, preferredCurrency } = useApp();
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [renewalDate, setRenewalDate] = useState("");
  const [amount, setAmount] = useState("");
  const [billingCycle, setBillingCycle] = useState<(typeof billingCycles)[number]>("monthly");
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState("");

  const groups = useMemo(() => groupedByCategory(platforms), [platforms]);

  async function submitSubscription() {
    if (!renewalDate || !amount) {
      Alert.alert("Missing fields", "Please provide renewal date and amount.");
      return;
    }

    try {
      const result = await addSubscription({
        platform_id: selectedPlatformId ?? undefined,
        custom_name: selectedPlatformId ? undefined : customName || undefined,
        custom_category: selectedPlatformId ? undefined : customCategory || "Other",
        renewal_date: renewalDate,
        amount: Number(amount),
        billing_cycle: billingCycle,
        currency: preferredCurrency,
      });
      if (result.requiresAuth) {
        Alert.alert(
          "Login required",
          "After 10 subscriptions, please create an account in Settings to keep adding subscriptions."
        );
        router.push("/auth");
        return;
      }
      setSelectedPlatformId(null);
      setRenewalDate("");
      setAmount("");
      setCustomName("");
      setCustomCategory("");
      setShowCustomModal(false);
      Alert.alert("Saved", "Subscription added successfully.");
    } catch {
      Alert.alert("Error", "Could not add subscription. Check server connectivity.");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add subscription</Text>
      <Text style={styles.subtitle}>
        Pick a popular platform by category or create a custom subscription.
      </Text>

      <Pressable
        style={styles.customButton}
        onPress={() => {
          setSelectedPlatformId(null);
          setShowCustomModal(true);
        }}
      >
        <Text style={styles.customButtonText}>+ Add custom subscription</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.groupList}>
        {Object.entries(groups).map(([category, entries]) => (
          <View key={category} style={styles.groupCard}>
            <Text style={styles.groupTitle}>{category}</Text>
            <View style={styles.platformGrid}>
              {entries.map((platform) => {
                const selected = selectedPlatformId === platform.id;
                return (
                  <Pressable
                    key={platform.id}
                    style={[styles.platformChip, selected && styles.platformChipActive]}
                    onPress={() => setSelectedPlatformId(platform.id)}
                  >
                    <Text style={[styles.platformChipText, selected && styles.platformChipTextActive]}>
                      {platform.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>Renewal date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={renewalDate}
          onChangeText={setRenewalDate}
          placeholder="2026-12-31"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <Text style={styles.inputLabel}>Amount ({preferredCurrency})</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="9.99"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <View style={styles.cycleRow}>
          {billingCycles.map((cycle) => (
            <Pressable
              key={cycle}
              onPress={() => setBillingCycle(cycle)}
              style={[styles.cycleChip, billingCycle === cycle && styles.cycleChipActive]}
            >
              <Text style={styles.cycleText}>{cycle}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.submitButton} onPress={submitSubscription}>
          <Text style={styles.submitButtonText}>Save subscription</Text>
        </Pressable>
      </View>

      <Modal visible={showCustomModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Custom subscription</Text>
            <TextInput
              style={styles.input}
              value={customName}
              onChangeText={setCustomName}
              placeholder="Name (e.g. Gym)"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <TextInput
              style={styles.input}
              value={customCategory}
              onChangeText={setCustomCategory}
              placeholder="Category (e.g. Health)"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setShowCustomModal(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.submitButton} onPress={submitSubscription}>
                <Text style={styles.submitButtonText}>Use custom</Text>
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
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginTop: 6,
    marginBottom: theme.spacing.md,
  },
  customButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  customButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  groupList: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  groupCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  groupTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
  platformGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  platformChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
  },
  platformChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#1A1328",
  },
  platformChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  platformChipTextActive: {
    color: theme.colors.textPrimary,
  },
  formCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  inputLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceElevated,
    color: theme.colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: theme.spacing.sm,
  },
  cycleRow: {
    flexDirection: "row",
    gap: 10,
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
  cycleText: {
    color: theme.colors.textPrimary,
    textTransform: "capitalize",
  },
  submitButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 11,
    alignItems: "center",
    minWidth: 120,
  },
  submitButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: theme.spacing.md,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 18,
    marginBottom: theme.spacing.sm,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
  },
});
