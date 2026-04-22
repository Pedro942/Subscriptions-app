import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { theme } from "../../constants/theme";

type AppSkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
};

export function AppSkeleton({
  width = "100%",
  height = 12,
  rounded = 8,
  style,
}: AppSkeletonProps) {
  return (
    <View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius: rounded,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
