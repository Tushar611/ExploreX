import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import { PurchasesOffering, CustomerInfo } from "react-native-purchases";
import {
  configureRevenueCat,
  getSubscriptions,
  purchasePackage as rcPurchasePackage,
  checkUserEntitlements,
  restorePurchases as rcRestorePurchases,
  addCustomerInfoListener,
  identifyUser,
  logoutUser,
  getCustomerInfo,
  ENTITLEMENT_EXPLORER,
  ENTITLEMENT_ADVENTURER,
  ENTITLEMENT_LIFETIME,
} from "@/services/revenuecat";

export type SubscriptionTier = "starter" | "explorer" | "adventurer" | "lifetime";

interface SubscriptionContextType {
  tier: SubscriptionTier;
  isLoading: boolean;
  offerings: PurchasesOffering | null;
  customerInfo: CustomerInfo | null;
  userEntitlements: string[];
  isPro: boolean;
  isPremium: boolean;
  isConfigured: boolean;
  purchasePackage: (packageId: string) => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;
  getTierFeatures: (tier: SubscriptionTier) => string[];
  getTierPrice: (tier: SubscriptionTier) => string;
  presentPaywall: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
);

const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  starter: [
    "2 Radar scans per day",
    "2 Compatibility checks per day",
    "Limited AI Advisor access",
    "Limited Discover swipes",
    "Can message matches",
    "View Activities only",
  ],
  explorer: [
    "15 Radar scans per day",
    "15 Compatibility checks per day",
    "Unlimited AI Advisor access",
    "Basic Expert Marketplace access",
    "Priority visibility in Discover",
    "Explorer Badge",
  ],
  adventurer: [
    "Unlimited Radar",
    "Unlimited Compatibility",
    "Full AI Van Build Advisor",
    "Full Expert Marketplace access",
    "Activities posting + hosting",
    "Adventurer Badge",
    "Advanced match recommendations",
    "Highest profile visibility",
  ],
  lifetime: [
    "Everything in Adventurer, forever",
    "Unlimited Radar forever",
    "Unlimited Compatibility forever",
    "Full AI Van Build Advisor forever",
    "Lifetime Adventurer Badge",
    "Highest visibility forever",
    "All future premium features included",
    "One-time payment, no renewals",
  ],
};

export const TIER_LIMITS: Record<
  SubscriptionTier,
  { activities: number; aiChats: number; radarScans: number; compatChecks: number }
> = {
  starter: { activities: 2, aiChats: 10, radarScans: 2, compatChecks: 2 },
  explorer: { activities: 10, aiChats: 25, radarScans: 15, compatChecks: 15 },
  adventurer: { activities: -1, aiChats: -1, radarScans: -1, compatChecks: -1 },
  lifetime: { activities: -1, aiChats: -1, radarScans: -1, compatChecks: -1 },
};

const TIER_PRICES: Record<SubscriptionTier, string> = {
  starter: "$0/month",
  explorer: "$6.99/month",
  adventurer: "$15.99/month",
  lifetime: "$99.99",
};

function getTierFromEntitlements(activeEntitlements: string[]): SubscriptionTier {
  if (
    activeEntitlements.includes(ENTITLEMENT_LIFETIME) ||
    activeEntitlements.includes("lifetime")
  )
    return "lifetime";
  if (
    activeEntitlements.includes(ENTITLEMENT_ADVENTURER) ||
    activeEntitlements.includes("adventurer")
  )
    return "adventurer";
  if (
    activeEntitlements.includes(ENTITLEMENT_EXPLORER) ||
    activeEntitlements.includes("explorer") ||
    activeEntitlements.includes("Nomad Connect Pro")
  )
    return "explorer";
  return "starter";
}

function getTierFromCustomerInfo(info: CustomerInfo): SubscriptionTier {
  const activeEntitlements = Object.keys(info.entitlements.active);

  if (info.entitlements.active[ENTITLEMENT_LIFETIME]?.isActive) {
    return "lifetime";
  }

  if (info.entitlements.active[ENTITLEMENT_ADVENTURER]?.isActive) {
    return "adventurer";
  }

  if (info.entitlements.active[ENTITLEMENT_EXPLORER]?.isActive) {
    return "explorer";
  }

  return getTierFromEntitlements(activeEntitlements);
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<SubscriptionTier>("starter");
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [userEntitlements, setUserEntitlements] = useState<string[]>([]);
  const [configured, setConfigured] = useState(false);
  const listenerCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    initializePurchases();
    return () => {
      if (listenerCleanup.current) {
        listenerCleanup.current();
      }
    };
  }, []);

  const handleCustomerInfoUpdate = useCallback((info: CustomerInfo) => {
    setCustomerInfo(info);
    const entitlements = Object.keys(info.entitlements.active);
    setUserEntitlements(entitlements);
    setTier(getTierFromCustomerInfo(info));
  }, []);

  const initializePurchases = async () => {
    try {
      const success = await configureRevenueCat();
      setConfigured(success);

      if (success) {
        const result = await checkUserEntitlements();
        if (result.customerInfo) {
          handleCustomerInfoUpdate(result.customerInfo);
        }

        const currentOffering = await getSubscriptions();
        if (currentOffering) {
          setOfferings(currentOffering);
        }

        listenerCleanup.current = addCustomerInfoListener(handleCustomerInfoUpdate);
      } else {
        console.log("RevenueCat running in preview mode (no API key)");
      }
    } catch (error) {
      console.log("RevenueCat initialization (preview mode):", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSubscriptionStatus = useCallback(async () => {
    if (!configured) return;
    try {
      const result = await checkUserEntitlements();
      if (result.customerInfo) {
        handleCustomerInfoUpdate(result.customerInfo);
      }
      const currentOffering = await getSubscriptions();
      if (currentOffering) {
        setOfferings(currentOffering);
      }
    } catch (error) {
      console.log("Refresh subscription error:", error);
    }
  }, [configured, handleCustomerInfoUpdate]);

  const purchasePackage = useCallback(async (packageId: string) => {
    if (!offerings) {
      console.log("Demo mode: simulating purchase");
      if (packageId.includes("lifetime")) {
        setTier("lifetime");
        setUserEntitlements(["lifetime"]);
      } else if (packageId.includes("adventurer") || packageId.includes("annual")) {
        setTier("adventurer");
        setUserEntitlements(["adventurer"]);
      } else if (packageId.includes("explorer") || packageId.includes("monthly") || packageId.includes("yearly")) {
        setTier("explorer");
        setUserEntitlements(["explorer"]);
      }
      return;
    }

    const pkg = offerings.availablePackages.find(
      (p) => p.identifier === packageId,
    );
    if (pkg) {
      const info = await rcPurchasePackage(pkg);
      if (info) {
        handleCustomerInfoUpdate(info);
      }
    }
  }, [offerings, handleCustomerInfoUpdate]);

  const restorePurchases = useCallback(async () => {
    if (!configured) {
      console.log("Demo mode: nothing to restore");
      return;
    }
    const info = await rcRestorePurchases();
    if (info) {
      handleCustomerInfoUpdate(info);
    }
  }, [configured, handleCustomerInfoUpdate]);

  const presentPaywall = useCallback(async () => {
    try {
      const RevenueCatUI = await import("react-native-purchases-ui");
      if (RevenueCatUI?.default?.presentPaywall) {
        await RevenueCatUI.default.presentPaywall();
      } else if (RevenueCatUI?.default?.presentPaywallIfNeeded) {
        await RevenueCatUI.default.presentPaywallIfNeeded({
          requiredEntitlementIdentifier: "explorer",
        });
      }
    } catch (error) {
      console.log("RevenueCat UI paywall not available, using custom paywall");
    }
  }, []);

  const getTierFeatures = useCallback((t: SubscriptionTier) => TIER_FEATURES[t], []);
  const getTierPrice = useCallback((t: SubscriptionTier) => {
    if (offerings && offerings.availablePackages.length > 0) {
      const monthly = offerings.availablePackages.find(
        (p) => p.packageType === "MONTHLY" || p.identifier === "$rc_monthly",
      );
      const yearly = offerings.availablePackages.find(
        (p) => p.packageType === "ANNUAL" || p.identifier === "$rc_annual",
      );

      if (t === "explorer" && monthly) {
        return monthly.product.priceString + "/month";
      }
      if ((t === "adventurer" || t === "lifetime") && yearly) {
        return yearly.product.priceString + "/year";
      }
    }
    return TIER_PRICES[t];
  }, [offerings]);

  const isPro = tier === "explorer" || tier === "adventurer" || tier === "lifetime";
  const isPremium = tier === "adventurer" || tier === "lifetime";

  const value = useMemo(
    () => ({
      tier,
      isLoading,
      offerings,
      customerInfo,
      userEntitlements,
      isPro,
      isPremium,
      isConfigured: configured,
      purchasePackage,
      restorePurchases,
      refreshSubscriptionStatus,
      getTierFeatures,
      getTierPrice,
      presentPaywall,
    }),
    [
      tier,
      isLoading,
      offerings,
      customerInfo,
      userEntitlements,
      isPro,
      isPremium,
      configured,
      purchasePackage,
      restorePurchases,
      refreshSubscriptionStatus,
      getTierFeatures,
      getTierPrice,
      presentPaywall,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider",
    );
  }
  return context;
}
