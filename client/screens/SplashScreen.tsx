import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { VideoView, useVideoPlayer } from "expo-video";

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

export default function SplashScreen({ onAnimationComplete }: SplashScreenProps) {
  const hasCompleted = useRef(false);

  const player = useVideoPlayer(
    require("../../Explorex_logo_animation_json_5b0e38ec54.mp4"),
    (instance) => {
      instance.muted = true;
      instance.loop = true;
      instance.play();
    },
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasCompleted.current) {
        hasCompleted.current = true;
        onAnimationComplete();
      }
    }, 3500);

    return () => {
      clearTimeout(timeout);
    };
  }, [onAnimationComplete, player]);

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        allowsPictureInPicture={false}
        fullscreenOptions={{
          enable: false,
        }}
      />
      <LinearGradient
        colors={["rgba(3,9,18,0.08)", "rgba(3,9,18,0.3)", "rgba(3,9,18,0.55)"]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
