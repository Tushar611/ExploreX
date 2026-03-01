import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "@/types";

interface LocalSession {
  user: { id: string; email: string; name?: string };
  sessionToken?: string;
}

interface AuthContextType {
  user: User | null;
  session: LocalSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  sendPasswordResetOTP: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOTP: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_KEY = "@nomad_profile";
const SESSION_KEY = "@nomad_local_session";

type AuthUserLike = {
  id: string;
  email?: string;
  name?: string;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<LocalSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadRequestRef = useRef(0);

  const getHostFromUri = (uri?: string): string | null => {
    if (!uri) return null;
    const withoutScheme = uri.replace(/^\w+:\/\//, "");
    const host = withoutScheme.split("/")[0];
    const hostname = host.split(":")[0];
    return hostname || null;
  };

  const getApiBaseUrl = (): string => {
    if (process.env.EXPO_PUBLIC_DOMAIN) {
      return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
    }

    if (process.env.EXPO_PUBLIC_API_URL) {
      return process.env.EXPO_PUBLIC_API_URL;
    }

    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.location.origin;
    }

    const debuggerHost = (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost;
    const hostUri = Constants.expoConfig?.hostUri;
    const host = getHostFromUri(hostUri || debuggerHost || undefined);

    return host ? `http://${host}:5000` : "";
  };

  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 12000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const isAbortError = (error: unknown): boolean =>
    error instanceof Error && error.name === "AbortError";

  const getAuthHeaders = (sessionToken?: string) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (sessionToken) {
      headers.Authorization = `Bearer ${sessionToken}`;
    }
    return headers;
  };

  const upsertProfileToServer = async (profile: User, sessionToken?: string) => {
    try {
      const { getApiUrl } = await import("@/lib/query-client");
      const baseUrl = getApiUrl();
      const url = new URL("/api/user-profiles/upsert", baseUrl);

      await fetchWithTimeout(
        url.toString(),
        {
          method: "POST",
          headers: getAuthHeaders(sessionToken),
          body: JSON.stringify({
            id: profile.id,
            name: profile.name,
            age: profile.age,
            bio: profile.bio,
            interests: profile.interests,
            photos: profile.photos,
            location: profile.location,
            intentMode: profile.intentMode,
            activePlan: profile.activePlan,
          }),
        },
        15000
      );
    } catch (error) {
      if (isAbortError(error)) return;
      console.error("Profile sync error:", error);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (!raw) {
          setIsLoading(false);
          return;
        }

        const parsed = JSON.parse(raw) as LocalSession;
        if (!parsed?.user?.id) {
          setIsLoading(false);
          return;
        }

        setSession(parsed);
        await loadProfile(parsed.user.id, {
          id: parsed.user.id,
          email: parsed.user.email,
          name: parsed.user.name,
        }, parsed.sessionToken);
      } catch (error) {
        console.error("Session restore error:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const buildDefaultProfile = (authUser: AuthUserLike): User => {
    const email = authUser.email?.toLowerCase() || "";
    const fallbackName = authUser.name || (email ? email.split("@")[0] : "Nomad");
    return {
      id: authUser.id,
      email,
      name: fallbackName,
      age: 25,
      bio: "",
      location: "",
      photos: [],
      interests: [],
      intentMode: "explore_city",
      activePlan: null,
      trustScore: 20,
      meetupCount: 0,
      createdAt: new Date().toISOString(),
    };
  };

  const loadProfile = async (userId: string, fallbackUser?: AuthUserLike, sessionToken?: string): Promise<User | null> => {
    const requestId = ++loadRequestRef.current;
    try {
      const stored = await AsyncStorage.getItem(`${PROFILE_KEY}_${userId}`);
      let profile: User;
      if (stored) {
        profile = JSON.parse(stored) as User;
      } else if (fallbackUser) {
        profile = buildDefaultProfile(fallbackUser);
      } else {
        setIsLoading(false);
        return null;
      }

      if (requestId === loadRequestRef.current) {
        setUser(profile);
        setIsLoading(false);
      }
      saveProfile(profile).catch(() => {});
      upsertProfileToServer(profile, sessionToken || session?.sessionToken).catch(() => {});

      (async () => {
        try {
          const { getApiUrl } = await import("@/lib/query-client");
          const baseUrl = getApiUrl();
          const url = new URL(`/api/verification/status/${userId}`, baseUrl);
          const response = await fetchWithTimeout(url.toString(), { method: "GET" }, 5000);
          if (!response.ok) return;

          const data = await response.json();
          if (requestId !== loadRequestRef.current) return;

          const nextProfile: User = {
            ...profile,
            isTravelVerified: data.isVerified || false,
            travelBadge: data.badge || undefined,
          };
          setUser(nextProfile);
          saveProfile(nextProfile).catch(() => {});
        } catch {}
      })();

      return profile;
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      if (requestId === loadRequestRef.current) {
        setIsLoading(false);
      }
    }

    return null;
  };

  const saveProfile = async (profile: User) => {
    try {
      await AsyncStorage.setItem(`${PROFILE_KEY}_${profile.id}`, JSON.stringify(profile));
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const baseUrl = getApiBaseUrl();
      const apiUrl = baseUrl ? `${baseUrl}/api/auth/login` : "/api/auth/login";
      const response = await fetchWithTimeout(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase(), password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { success: false, error: data?.error || "Login failed" };
      }

      const authUser = data?.user as AuthUserLike | undefined;
      if (!authUser?.id) {
        return { success: false, error: "Login failed" };
      }

      const nextSession: LocalSession = {
        user: {
          id: authUser.id,
          email: authUser.email || email.toLowerCase(),
          name: authUser.name,
        },
        sessionToken: typeof data?.sessionToken === "string" ? data.sessionToken : undefined,
      };

      setSession(nextSession);
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      await loadProfile(authUser.id, authUser, nextSession.sessionToken);

      try {
        const { identifyUser } = await import("@/services/revenuecat");
        await identifyUser(authUser.id);
      } catch {}

      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "An unexpected error occurred" };
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const baseUrl = getApiBaseUrl();
      const apiUrl = baseUrl ? `${baseUrl}/api/auth/signup` : "/api/auth/signup";
      const response = await fetchWithTimeout(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase(), password, name }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { success: false, error: data?.error || "Signup failed" };
      }

      const authUser = data?.user as AuthUserLike | undefined;
      if (!authUser?.id) {
        return { success: false, error: "Signup failed" };
      }

      const nextSession: LocalSession = {
        user: {
          id: authUser.id,
          email: authUser.email || email.toLowerCase(),
          name: authUser.name || name,
        },
        sessionToken: typeof data?.sessionToken === "string" ? data.sessionToken : undefined,
      };

      setSession(nextSession);
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));

      const newUser: User = {
        id: authUser.id,
        email: authUser.email || email.toLowerCase(),
        name: authUser.name || name,
        age: 25,
        bio: "",
        location: "",
        photos: [],
        interests: [],
        intentMode: "explore_city",
        activePlan: null,
        trustScore: 20,
        meetupCount: 0,
        createdAt: new Date().toISOString(),
      };

      setUser(newUser);
      await saveProfile(newUser);
      upsertProfileToServer(newUser, nextSession.sessionToken).catch(() => {});

      try {
        const { identifyUser } = await import("@/services/revenuecat");
        await identifyUser(authUser.id);
      } catch {}

      return { success: true };
    } catch (error) {
      console.error("Signup error:", error);
      return { success: false, error: "An unexpected error occurred" };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
      try {
        const { logoutUser } = await import("@/services/revenuecat");
        await logoutUser();
      } catch {}
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const refreshProfile = async () => {
    if (!user?.id) return;
    try {
      const { getApiUrl } = await import("@/lib/query-client");
      const baseUrl = getApiUrl();

      const profileUrl = new URL(`/api/user-profiles/${user.id}`, baseUrl);
      profileUrl.searchParams.set("t", Date.now().toString());
      const profileRes = await fetchWithTimeout(profileUrl.toString(), { method: "GET" }, 8000);
      let serverProfile: Partial<User> = {};
      if (profileRes.ok) {
        const data = await profileRes.json();
        serverProfile = {
          name: data.name || user.name,
          bio: data.bio || user.bio,
          age: data.age || user.age,
          location: data.location || user.location,
          vanType: data.van_type || data.vanType || user.vanType,
          photos: data.photos || user.photos,
          interests: data.interests || user.interests,
          lookingFor: data.looking_for || data.lookingFor || user.lookingFor,
          travelStyle: data.travel_style || data.travelStyle || user.travelStyle,
          intentMode: data.intent_mode || data.intentMode || user.intentMode,
          activePlan: data.active_plan || data.activePlan || user.activePlan || null,
          trustScore: data.trust_score ?? data.trustScore ?? user.trustScore,
          meetupCount: data.meetup_count ?? data.meetupCount ?? user.meetupCount,
        };
      }

      let verificationData: Partial<User> = {};
      try {
        const verUrl = new URL(`/api/verification/status/${user.id}`, baseUrl);
        verUrl.searchParams.set("t", Date.now().toString());
        const verRes = await fetchWithTimeout(verUrl.toString(), { method: "GET" }, 8000);
        if (verRes.ok) {
          const vData = await verRes.json();
          verificationData = {
            isTravelVerified: vData.isVerified || false,
            travelBadge: vData.badge || undefined,
          };
        }
      } catch {}

      const refreshed = { ...user, ...serverProfile, ...verificationData };
      setUser(refreshed);
      await saveProfile(refreshed);
    } catch (error) {
      console.error("Refresh profile error:", error);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;

    try {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      await saveProfile(updatedUser);
      await upsertProfileToServer(updatedUser, session?.sessionToken);
    } catch (error) {
      console.error("Update profile error:", error);
    }
  };

  const sendPasswordResetOTP = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const baseUrl = getApiBaseUrl();
      const apiUrl = baseUrl
        ? `${baseUrl}/api/password-reset/send-otp`
        : "/api/password-reset/send-otp";

      const response = await fetchWithTimeout(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to send verification code" };
      }

      return { success: true };
    } catch (error) {
      console.error("Send OTP error:", error);
      return { success: false, error: "Failed to send verification code" };
    }
  };

  const verifyOTP = async (email: string, otp: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const baseUrl = getApiBaseUrl();
      const apiUrl = baseUrl
        ? `${baseUrl}/api/password-reset/verify-otp`
        : "/api/password-reset/verify-otp";

      const response = await fetchWithTimeout(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase(), code: otp }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Invalid code" };
      }

      return { success: true };
    } catch (error) {
      console.error("Verify OTP error:", error);
      return { success: false, error: "Verification failed" };
    }
  };

  const updatePassword = async (email: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const baseUrl = getApiBaseUrl();
      const apiUrl = baseUrl
        ? `${baseUrl}/api/password-reset/update-password`
        : "/api/password-reset/update-password";

      const response = await fetchWithTimeout(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase(), newPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to update password" };
      }

      return { success: true };
    } catch (error) {
      console.error("Update password error:", error);
      return { success: false, error: "Failed to update password" };
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    return sendPasswordResetOTP(email);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!session && !!user,
        login,
        signup,
        logout,
        updateProfile,
        refreshProfile,
        resetPassword,
        sendPasswordResetOTP,
        verifyOTP,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
