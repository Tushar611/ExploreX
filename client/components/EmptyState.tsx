import React from "react";
import { StyleSheet, View, Image, ViewStyle, StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { Icon } from "@/components/Icon";
import { AppColors, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface EmptyStateProps {
  image?: any;
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  image,
  icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      {icon ? (
        <LinearGradient
          colors={[AppColors.primary + "18", AppColors.accent + "10"]}
          style={styles.iconCircle}
        >
          <LinearGradient
            colors={[AppColors.primary, AppColors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconInner}
          >
            <Icon name={icon} size={32} color="#FFF" />
          </LinearGradient>
        </LinearGradient>
      ) : image ? (
        <Image source={image} style={styles.image} resizeMode="contain" />
      ) : null}
      <ThemedText type="h4" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText
        type="body"
        style={[styles.description, { color: theme.textSecondary }]}
      >
        {description}
      </ThemedText>
      {actionLabel && onAction ? (
        <GradientButton onPress={onAction} style={styles.button}>
          {actionLabel}
        </GradientButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: Spacing["2xl"],
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  iconInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  button: {
    minWidth: 200,
  },
});
