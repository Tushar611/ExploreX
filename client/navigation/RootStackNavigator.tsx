import React, { useState, useCallback, useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthScreen from "@/screens/AuthScreen";
import ChatScreen from "@/screens/ChatScreen";
import ActivityChatScreen from "@/screens/ActivityChatScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import CustomerCenterScreen from "@/screens/CustomerCenterScreen";
import SocialRadarScreen from "@/screens/SocialRadarScreen";
import SplashScreen from "@/screens/SplashScreen";
import TravelVerificationScreen from "@/screens/TravelVerificationScreen";
import { SOSButton } from "@/components/SOSButton";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/context/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { AppColors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const CHAT_SCREENS = ["Chat", "ActivityChat"];

function getActiveRouteName(state: any): string | null {
  if (!state || !state.routes) return null;
  const route = state.routes[state.index];
  if (!route) return null;
  if (route.state) {
    return getActiveRouteName(route.state);
  }
  return route.name;
}

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
  Chat: { matchId: string; matchName: string; matchPhoto?: string };
  ActivityChat: { activityId: string; activityTitle: string };
  ExpertMarketplace: undefined;
  ApplyAsExpert: undefined;
  ExpertStatus: undefined;
  Subscription: undefined;
  CustomerCenter: undefined;
  SocialRadar: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading, user, updateProfile } = useAuth();
  const { theme } = useTheme();
  const [currentRoute, setCurrentRoute] = useState<string>("Main");
  const [showSplash, setShowSplash] = useState(true);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  const checkVerificationStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const baseUrl = getApiUrl();
      const url = new URL(`/api/verification/status/${user.id}`, baseUrl);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) return;
      const data = await response.json();
      setIsVerified(Boolean(data.isVerified));
    } catch {
      setIsVerified((prev) => prev);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      if (typeof user.isTravelVerified === "boolean") {
        setIsVerified(user.isTravelVerified);
      }
      if (user.isTravelVerified !== true) {
        checkVerificationStatus();
      }
    } else {
      setIsVerified(null);
    }
  }, [isAuthenticated, user?.id, user?.isTravelVerified, checkVerificationStatus]);

  const handleVerified = async (badge?: string) => {
    setIsVerified(true);
    const validBadge = (badge || "nomad") as "nomad" | "adventurer" | "explorer";
    await updateProfile({
      isTravelVerified: true,
      travelBadge: validBadge,
    });
  };

  const handleStateChange = useCallback((e: any) => {
    const state = e?.data?.state;
    if (state) {
      const activeRoute = getActiveRouteName(state);
      if (activeRoute) {
        setCurrentRoute(activeRoute);
      }
    }
  }, []);

  if (showSplash) {
    return <SplashScreen onAnimationComplete={() => setShowSplash(false)} />;
  }

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  if (isAuthenticated && isVerified === false) {
    return <TravelVerificationScreen onVerified={handleVerified} />;
  }

  const isChatScreen = CHAT_SCREENS.includes(currentRoute);
  const showSOS = isAuthenticated && !isChatScreen;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        screenOptions={screenOptions}
        screenListeners={{
          state: handleStateChange,
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="ActivityChat"
              component={ActivityChatScreen}
              options={({ route }) => ({
                headerTitle: route.params.activityTitle,
                headerBackTitle: "Back",
                headerTransparent: true,
                headerStyle: { backgroundColor: "transparent" },
                headerTintColor: "#000000",
                headerTitleStyle: { color: "#000000" },
                headerShadowVisible: false,
              })}
            />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="CustomerCenter"
              component={CustomerCenterScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="SocialRadar"
              component={SocialRadarScreen}
              options={{
                headerShown: false,
              }}
            />
          </>
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
      <SOSButton visible={showSOS} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
