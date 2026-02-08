import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  Dimensions,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { AppColors, Spacing, BorderRadius, Shadows } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type AlertType = "success" | "error" | "warning" | "info" | "confirm";

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface AlertConfig {
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface AlertContextValue {
  showAlert: (config: AlertConfig) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

const ALERT_ICONS: Record<AlertType, { name: keyof typeof Feather.glyphMap; gradient: [string, string] }> = {
  success: { name: "check-circle", gradient: ["#4CAF50", "#66BB6A"] },
  error: { name: "alert-circle", gradient: [AppColors.danger, "#E57373"] },
  warning: { name: "alert-triangle", gradient: [AppColors.sunsetAmber, AppColors.sunsetGold] },
  info: { name: "info", gradient: [AppColors.primary, AppColors.accent] },
  confirm: { name: "help-circle", gradient: [AppColors.primary, AppColors.accent] },
};

function AlertModal({ config, visible, onDismiss }: { config: AlertConfig | null; visible: boolean; onDismiss: () => void }) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(0.85);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 14, mass: 0.6, stiffness: 120 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withSpring(0.85, { damping: 14, mass: 0.6, stiffness: 120 });
      backdropOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!config || !visible) return null;

  const alertType = config.type || "info";
  const iconConfig = ALERT_ICONS[alertType];
  const buttons = config.buttons || [{ text: "OK", style: "default" as const }];

  const handleButtonPress = (button: AlertButton) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onDismiss();
    button.onPress?.();
  };

  const hasCancel = buttons.some(b => b.style === "cancel");
  const primaryButtons = buttons.filter(b => b.style !== "cancel");
  const cancelButton = buttons.find(b => b.style === "cancel");

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.backdropPress} onPress={() => {
          if (cancelButton) {
            handleButtonPress(cancelButton);
          } else if (buttons.length === 1) {
            handleButtonPress(buttons[0]);
          }
        }}>
          <Animated.View style={[styles.card, { backgroundColor: isDark ? "#2A2420" : "#FFFFFF" }, cardStyle]}>
            <View style={[styles.iconContainer]}>
              <LinearGradient
                colors={iconConfig.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Feather name={iconConfig.name} size={28} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <ThemedText
              type="h4"
              style={[styles.title, { color: theme.text }]}
            >
              {config.title}
            </ThemedText>

            {config.message ? (
              <ThemedText
                type="body"
                style={[styles.message, { color: theme.textSecondary }]}
              >
                {config.message}
              </ThemedText>
            ) : null}

            <View style={styles.buttonRow}>
              {cancelButton && (
                <Pressable
                  onPress={() => handleButtonPress(cancelButton)}
                  style={({ pressed }) => [
                    styles.button,
                    styles.cancelButton,
                    {
                      backgroundColor: isDark ? "#3D352F" : "#F2F2F7",
                      opacity: pressed ? 0.7 : 1,
                    },
                    primaryButtons.length > 0 && { flex: 1, marginRight: Spacing.sm },
                  ]}
                >
                  <ThemedText
                    type="body"
                    style={[styles.buttonText, { color: theme.textSecondary, fontWeight: "600" as const }]}
                  >
                    {cancelButton.text}
                  </ThemedText>
                </Pressable>
              )}
              {primaryButtons.map((button, index) => {
                const isDestructive = button.style === "destructive";
                const gradColors: [string, string] = isDestructive
                  ? [AppColors.danger, "#E57373"]
                  : [AppColors.primary, AppColors.accent];

                return (
                  <Pressable
                    key={index}
                    onPress={() => handleButtonPress(button)}
                    style={({ pressed }) => [
                      styles.button,
                      { opacity: pressed ? 0.8 : 1 },
                      hasCancel && { flex: 1 },
                      !hasCancel && { minWidth: 120 },
                    ]}
                  >
                    <LinearGradient
                      colors={gradColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.gradientButton}
                    >
                      <ThemedText
                        type="body"
                        style={[styles.buttonText, { color: "#FFFFFF", fontWeight: "600" as const }]}
                      >
                        {button.text}
                      </ThemedText>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const queueRef = useRef<AlertConfig[]>([]);

  const processQueue = useCallback(() => {
    if (queueRef.current.length > 0 && !visible) {
      const next = queueRef.current.shift()!;
      setAlertConfig(next);
      setVisible(true);
    }
  }, [visible]);

  const showAlert = useCallback((config: AlertConfig) => {
    if (visible) {
      queueRef.current.push(config);
    } else {
      setAlertConfig(config);
      setVisible(true);
    }

    if (Platform.OS !== "web") {
      const type = config.type || "info";
      if (type === "success") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (type === "error") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } else if (type === "warning") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    }
  }, [visible]);

  const onDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setAlertConfig(null);
      processQueue();
    }, 200);
  }, [processQueue]);

  const value = useMemo(() => ({ showAlert }), [showAlert]);

  return (
    <AlertContext.Provider value={value}>
      {children}
      <AlertModal config={alertConfig} visible={visible} onDismiss={onDismiss} />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  backdropPress: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: Spacing["3xl"],
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    paddingTop: Spacing["3xl"],
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    ...Shadows.large,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  iconGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: Spacing.sm,
  },
  button: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  gradientButton: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
  },
  buttonText: {
    fontSize: 16,
  },
});
