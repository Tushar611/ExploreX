import React from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Stop, Ellipse } from "react-native-svg";
import { useTheme } from "@/hooks/useTheme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export function ChatBackground() {
  const { isDark } = useTheme();

  return (
    <View style={styles.container} pointerEvents="none">
      <LinearGradient
        colors={
          isDark
            ? ["#081126", "#0D1A3A", "#0F224A", "#0B1632"]
            : ["#F3F8FF", "#EAF2FF", "#E0EBFF", "#EEF4FF"]
        }
        locations={[0, 0.32, 0.7, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="glowTop" cx="0.78" cy="0.08" rx="0.55" ry="0.36">
            <Stop offset="0" stopColor={isDark ? "#2CC3FF" : "#90C2FF"} stopOpacity={isDark ? "0.2" : "0.25"} />
            <Stop offset="0.55" stopColor={isDark ? "#246BFD" : "#6EA3FF"} stopOpacity={isDark ? "0.1" : "0.14"} />
            <Stop offset="1" stopColor={isDark ? "#246BFD" : "#6EA3FF"} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glowMid" cx="0.22" cy="0.56" rx="0.62" ry="0.44">
            <Stop offset="0" stopColor={isDark ? "#89D6FF" : "#B9D8FF"} stopOpacity={isDark ? "0.08" : "0.14"} />
            <Stop offset="1" stopColor={isDark ? "#89D6FF" : "#B9D8FF"} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Ellipse
          cx={SCREEN_WIDTH * 0.78}
          cy={SCREEN_HEIGHT * 0.08}
          rx={SCREEN_WIDTH * 0.64}
          ry={SCREEN_HEIGHT * 0.34}
          fill="url(#glowTop)"
        />
        <Ellipse
          cx={SCREEN_WIDTH * 0.22}
          cy={SCREEN_HEIGHT * 0.56}
          rx={SCREEN_WIDTH * 0.62}
          ry={SCREEN_HEIGHT * 0.42}
          fill="url(#glowMid)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
});
