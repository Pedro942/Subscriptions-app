import { ReactNode } from "react";
import { Pressable, PressableProps, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from "react-native";

import { theme } from "../../constants/theme";

type ChipVariant = "default" | "active" | "success" | "warning" | "danger" | "info";

type AppChipProps = {
  label?: string;
  children?: ReactNode;
  active?: boolean;
  variant?: ChipVariant;
  selected?: boolean;
  pressedStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
} & Omit<PressableProps, "style">;

function variantStyles(variant: ChipVariant) {
  switch (variant) {
    case "active":
      return styles.active;
    case "success":
      return styles.success;
    case "warning":
      return styles.warning;
    case "danger":
      return styles.danger;
    case "info":
      return styles.info;
    default:
      return styles.default;
  }
}

export function AppChip({
  label,
  children,
  active = false,
  variant = "default",
  selected = false,
  pressedStyle,
  style,
  textStyle,
  disabled,
  ...rest
}: AppChipProps) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles(selected || active ? "active" : variant),
        pressed && styles.pressed,
        pressed && pressedStyle,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <Text style={[styles.text, textStyle]}>{label ?? children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.chipDefaultBg,
  },
  text: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
    fontSize: 12,
  },
  default: {
    backgroundColor: theme.colors.chipDefaultBg,
    borderColor: theme.colors.border,
  },
  active: {
    backgroundColor: theme.colors.chipActiveBg,
    borderColor: theme.colors.accent,
  },
  success: {
    backgroundColor: theme.colors.successBg,
    borderColor: theme.colors.success,
  },
  warning: {
    backgroundColor: theme.colors.warningBg,
    borderColor: theme.colors.warning,
  },
  danger: {
    backgroundColor: theme.colors.dangerBg,
    borderColor: theme.colors.danger,
  },
  info: {
    backgroundColor: theme.colors.infoBg,
    borderColor: theme.colors.accent,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
