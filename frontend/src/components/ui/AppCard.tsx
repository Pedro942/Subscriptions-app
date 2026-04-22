import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { theme } from "../../constants/theme";

type AppCardVariant = "default" | "elevated" | "accent" | "warning";
type AppCardPadding = "md" | "lg";

type AppCardProps = {
  children: ReactNode;
  variant?: AppCardVariant;
  padding?: AppCardPadding;
  style?: StyleProp<ViewStyle>;
};

export function AppCard({
  children,
  variant = "default",
  padding = "md",
  style,
}: AppCardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === "default" && styles.defaultCard,
        variant === "elevated" && styles.elevatedCard,
        variant === "accent" && styles.accentCard,
        variant === "warning" && styles.warningCard,
        padding === "md" ? styles.paddingMd : styles.paddingLg,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    ...theme.effects.softShadow,
  },
  defaultCard: {
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
  },
  elevatedCard: {
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceElevated,
  },
  accentCard: {
    borderColor: theme.colors.accentAlt,
    backgroundColor: theme.colors.surfaceAccent,
    ...theme.effects.cardShadow,
  },
  warningCard: {
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.warningBg,
  },
  paddingMd: {
    padding: theme.spacing.md,
  },
  paddingLg: {
    padding: theme.spacing.lg,
  },
});
