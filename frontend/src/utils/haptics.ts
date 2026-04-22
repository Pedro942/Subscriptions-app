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
