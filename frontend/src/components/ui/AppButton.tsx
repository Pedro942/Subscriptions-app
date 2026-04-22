import { ReactNode } from "react";
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { theme } from "../../constants/theme";

type AppButtonProps = {
  label?: string;
  children?: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
} & Omit<PressableProps, "style">;

export function AppButton({
  label,
  children,
  icon,
  variant = "primary",
  size = "md",
  style,
  textStyle,
  pressedStyle,
  disabled,
  ...rest
}: AppButtonProps) {
  const content = children ?? label ?? "";
  const hasTextContent = typeof content === "string" || typeof content === "number";
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        size === "sm" ? styles.small : styles.medium,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        variant === "ghost" && styles.ghost,
        pressed && !disabled && styles.pressed,
        pressed && !disabled && pressedStyle,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {icon}
        {hasTextContent ? (
          <Text
            style={[
              styles.label,
              isPrimary && styles.primaryLabel,
              (isSecondary || variant === "ghost") && styles.secondaryLabel,
              textStyle,
            ]}
          >
            {content}
          </Text>
        ) : content ? (
          content
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: theme.radius.md,
  },
  medium: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  small: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  primary: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
    ...theme.effects.softShadow,
  },
  secondary: {
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceSoft,
  },
  ghost: {
    borderColor: theme.colors.border,
    backgroundColor: "transparent",
  },
  label: {
    fontWeight: "700",
    fontSize: 13,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryLabel: {
    color: theme.colors.textPrimary,
  },
  secondaryLabel: {
    color: theme.colors.textSecondary,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
