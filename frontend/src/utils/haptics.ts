import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

function isWeb() {
  return Platform.OS === "web";
}

export async function triggerSelectionHaptic() {
  if (isWeb()) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Best effort only.
  }
}

export async function triggerSuccessHaptic() {
  if (isWeb()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Best effort only.
  }
}

export async function triggerWarningHaptic() {
  if (isWeb()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Best effort only.
  }
}

export async function triggerImpactHaptic(
  weight: "light" | "medium" | "heavy" = "light",
) {
  if (isWeb()) return;
  try {
    await Haptics.impactAsync(
      weight === "heavy"
        ? Haptics.ImpactFeedbackStyle.Heavy
        : weight === "medium"
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
    );
  } catch {
    // Best effort only.
  }
}

export async function triggerNotificationHaptic(
  kind: "success" | "warning" | "error",
) {
  if (isWeb()) return;
  try {
    await Haptics.notificationAsync(
      kind === "success"
        ? Haptics.NotificationFeedbackType.Success
        : kind === "warning"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error,
    );
  } catch {
    // Best effort only.
  }
}

export async function triggerHaptic(
  type: "selection" | "success" | "warning" | "error",
) {
  if (type === "selection") {
    await triggerSelectionHaptic();
    return;
  }
  await triggerNotificationHaptic(type);
}
