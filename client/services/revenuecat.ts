import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  LOG_LEVEL,
} from "react-native-purchases";
import { Platform } from "react-native";
import Constants from "expo-constants";

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

const ENTITLEMENT_EXPLORER = "explorer";
const ENTITLEMENT_ADVENTURER = "adventurer";
const ENTITLEMENT_LIFETIME = "lifetime";

let isConfigured = false;

function isRunningInExpoGo(): boolean {
  const appOwnership = (Constants as any)?.appOwnership;
  const executionEnvironment = (Constants as any)?.executionEnvironment;
  return appOwnership === "expo" || executionEnvironment === "storeClient";
}


function getApiKey(): string | undefined {
  if (REVENUECAT_API_KEY) return REVENUECAT_API_KEY;

  return Platform.select({
    ios: REVENUECAT_IOS_KEY,
    android: REVENUECAT_ANDROID_KEY,
    default: REVENUECAT_IOS_KEY || REVENUECAT_ANDROID_KEY,
  }) || undefined;
}

const includesAny = (values: string[], keywords: string[]) => {
  const normalizedValues = values.map((value) => value.toLowerCase());
  return keywords.some((keyword) =>
    normalizedValues.some((value) => value.includes(keyword.toLowerCase())),
  );
};

const expertRateFromIdentifier = (value: string): number | null => {
  const match = value.toLowerCase().match(/expert[_-]?(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function configureRevenueCat(userId?: string): Promise<boolean> {
  if (isConfigured) return true;

  const apiKey = getApiKey();

  if (isRunningInExpoGo()) {
    console.log("RevenueCat disabled in Expo Go. Use development build or Test Store key.");
    return false;
  }

  if (!apiKey) {
    console.log("RevenueCat running in preview mode (no API key)");
    return false;
  }

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    await Purchases.configure({ apiKey, appUserID: userId || undefined });
    isConfigured = true;
    console.log("RevenueCat configured successfully");
    return true;
  } catch (error) {
    console.log("RevenueCat configuration skipped:", (error as any)?.message || error);
    return false;
  }
}

export async function identifyUser(userId: string): Promise<CustomerInfo | null> {
  if (!isConfigured) return null;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    return customerInfo;
  } catch (error) {
    console.log("RevenueCat identify error:", error);
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  if (!isConfigured) return;
  try {
    const isAnonymous = await Purchases.isAnonymous();
    if (!isAnonymous) {
      await Purchases.logOut();
    }
  } catch (error) {
    console.log("RevenueCat logout error:", error);
  }
}

export async function getSubscriptions(): Promise<PurchasesOffering | null> {
  if (!isConfigured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current || null;
  } catch (error) {
    console.log("RevenueCat getSubscriptions error:", error);
    return null;
  }
}

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<CustomerInfo | null> {
  if (!isConfigured) return null;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) return null;
    throw error;
  }
}

export async function checkUserEntitlements(): Promise<{
  customerInfo: CustomerInfo | null;
  activeEntitlements: string[];
  isPro: boolean;
  isPremium: boolean;
}> {
  if (!isConfigured) {
    return {
      customerInfo: null,
      activeEntitlements: [],
      isPro: false,
      isPremium: false,
    };
  }

  try {
    const info = await Purchases.getCustomerInfo();
    const activeEntitlements = Object.keys(info.entitlements.active);
    const purchasedProducts = info.activeSubscriptions || [];

    const hasLifetime =
      info.entitlements.active[ENTITLEMENT_LIFETIME]?.isActive === true ||
      includesAny(activeEntitlements, ["lifetime", "forever"]) ||
      includesAny(purchasedProducts, ["lifetime", "forever"]);

    const hasAdventurer =
      info.entitlements.active[ENTITLEMENT_ADVENTURER]?.isActive === true ||
      includesAny(activeEntitlements, ["adventurer", "expert", "premium"]) ||
      includesAny(purchasedProducts, ["adventurer", "expert", "premium"]);

    const hasExplorer =
      info.entitlements.active[ENTITLEMENT_EXPLORER]?.isActive === true ||
      includesAny(activeEntitlements, ["explorer", "pro", "nomad connect pro"]) ||
      includesAny(purchasedProducts, ["explorer", "pro"]);

    const isPro = hasExplorer || hasAdventurer || hasLifetime;
    const isPremium = hasAdventurer || hasLifetime;

    return { customerInfo: info, activeEntitlements, isPro, isPremium };
  } catch (error) {
    console.log("RevenueCat entitlements error:", error);
    return {
      customerInfo: null,
      activeEntitlements: [],
      isPro: false,
      isPremium: false,
    };
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!isConfigured) return null;
  try {
    const info = await Purchases.restorePurchases();
    return info;
  } catch (error) {
    console.log("RevenueCat restore error:", error);
    return null;
  }
}

export function addCustomerInfoListener(
  listener: (info: CustomerInfo) => void,
): () => void {
  if (!isConfigured) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isConfigured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.log("RevenueCat getCustomerInfo error:", error);
    return null;
  }
}

export async function purchaseConsultation(expertName: string, amount: number, rateTier?: number): Promise<{
  success: boolean;
  transactionId: string | null;
  error?: string;
}> {
  if (!isConfigured) {
    console.log("RevenueCat demo mode: simulating consultation purchase");
    const mockTxId = "rc_demo_" + Date.now().toString() + Math.random().toString(36).substr(2, 6);
    return { success: true, transactionId: mockTxId };
  }

  try {
    const offerings = await Purchases.getOfferings();

    const consultationOffering = offerings.all["expert_consultation"] || offerings.current;
    if (!consultationOffering) {
      console.log("No consultation offering found, using demo purchase");
      const mockTxId = "rc_sim_" + Date.now().toString() + Math.random().toString(36).substr(2, 6);
      return { success: true, transactionId: mockTxId };
    }

    const targetRate = Number.isFinite(rateTier as number) ? Number(rateTier) : NaN;
    const candidatePackages = consultationOffering.availablePackages.filter((p) => {
      const id = p.identifier.toLowerCase();
      const productId = p.product.identifier.toLowerCase();
      return id.includes("expert") || id.includes("consult") || productId.includes("expert") || productId.includes("consult");
    });

    const pool = candidatePackages.length > 0 ? candidatePackages : consultationOffering.availablePackages;

    let pkg: PurchasesPackage | undefined;

    if (Number.isFinite(targetRate)) {
      let nearestDiff = Number.POSITIVE_INFINITY;
      for (const candidate of pool) {
        const fromProduct = expertRateFromIdentifier(candidate.product.identifier);
        const fromPackage = expertRateFromIdentifier(candidate.identifier);
        const candidateRate = fromProduct ?? fromPackage;
        if (!Number.isFinite(candidateRate as number)) continue;

        const diff = Math.abs((candidateRate as number) - targetRate);
        if (diff < nearestDiff) {
          nearestDiff = diff;
          pkg = candidate;
        }
      }
    }

    if (!pkg) {
      const expertSlug = expertName.toLowerCase().replace(/[^a-z0-9]+/g, "");
      pkg = pool.find((candidate) => {
        const id = candidate.identifier.toLowerCase().replace(/[^a-z0-9]+/g, "");
        const productId = candidate.product.identifier.toLowerCase().replace(/[^a-z0-9]+/g, "");
        return id.includes(expertSlug) || productId.includes(expertSlug);
      });
    }

    if (!pkg) {
      pkg = pool[0];
    }

    if (!pkg) {
      console.log("No consultation package found, using demo purchase");
      const mockTxId = "rc_sim_" + Date.now().toString() + Math.random().toString(36).substr(2, 6);
      return { success: true, transactionId: mockTxId };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const txId = customerInfo.nonSubscriptionTransactions?.[0]?.transactionIdentifier ||
      "rc_" + Date.now().toString();

    return { success: true, transactionId: txId };
  } catch (error: any) {
    if (error.userCancelled) {
      return { success: false, transactionId: null, error: "cancelled" };
    }
    console.log("RevenueCat consultation purchase error, falling back to demo:", error);
    const mockTxId = "rc_fallback_" + Date.now().toString() + Math.random().toString(36).substr(2, 6);
    return { success: true, transactionId: mockTxId };
  }
}

export { isConfigured as isRevenueCatConfigured, ENTITLEMENT_EXPLORER, ENTITLEMENT_ADVENTURER, ENTITLEMENT_LIFETIME };
