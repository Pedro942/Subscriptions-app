import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type BillingCycle = "monthly" | "yearly";

export type Platform = {
  id: string;
  slug: string;
  name: string;
  category: string;
};

export type Subscription = {
  id: string;
  name: string;
  category: string;
  renewal_date: string;
  amount: number;
  billing_cycle: BillingCycle;
  currency: string;
  platform_slug?: string | null;
};

type Analytics = {
  monthly_total: number;
  yearly_total: number;
  category_breakdown: Record<string, { monthly: number; yearly: number }>;
  upcoming_renewals: Array<{
    id: string;
    name: string;
    renewal_date: string;
    amount: number;
    currency: string;
  }>;
  currency: string;
  subscriptions_count: number;
};

type AddSubscriptionInput = {
  platform_id?: string;
  custom_name?: string;
  custom_category?: string;
  renewal_date: string;
  amount: number;
  billing_cycle: BillingCycle;
  currency: string;
};

type AuthPayload = {
  email: string;
  password: string;
};

type AuthResponse = {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
};

type AppContextShape = {
  loading: boolean;
  deviceId: string;
  preferredCurrency: string;
  token: string | null;
  userEmail: string | null;
  platforms: Platform[];
  subscriptions: Subscription[];
  analytics: Analytics | null;
  notificationStatus: Notifications.PermissionStatus | null;
  needsAuthForMoreSubscriptions: boolean;
  setPreferredCurrency: (currency: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  addSubscription: (payload: AddSubscriptionInput) => Promise<{ requiresAuth: boolean }>;
  deleteSubscription: (id: string) => Promise<void>;
  login: (payload: AuthPayload) => Promise<void>;
  register: (payload: AuthPayload) => Promise<void>;
  logout: () => Promise<void>;
  requestNotificationsPermission: () => Promise<void>;
};

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  "http://localhost:8000";

const STORAGE_KEYS = {
  token: "subscription-hub:token",
  userEmail: "subscription-hub:user-email",
  currency: "subscription-hub:currency",
  deviceId: "subscription-hub:device-id",
};

const defaultAnalytics: Analytics = {
  monthly_total: 0,
  yearly_total: 0,
  category_breakdown: {},
  upcoming_renewals: [],
  currency: "EUR",
  subscriptions_count: 0,
};

const AppContext = createContext<AppContextShape | null>(null);

function randomSegment() {
  return Math.random().toString(36).slice(2, 10);
}

function buildDeviceId() {
  const modelName = Device.modelName?.replace(/\s+/g, "-").toLowerCase() ?? "device";
  return `${modelName}-${Date.now().toString(36)}-${randomSegment()}`;
}

async function apiRequest<T>({
  path,
  method = "GET",
  token,
  deviceId,
  body,
}: {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string | null;
  deviceId?: string;
  body?: object;
}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (deviceId) {
    headers["x-device-id"] = deviceId;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrencyState] = useState("EUR");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<Notifications.PermissionStatus | null>(
    null
  );

  const initialize = useCallback(async () => {
    const [storedToken, storedEmail, storedCurrency, storedDeviceId] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.token),
      AsyncStorage.getItem(STORAGE_KEYS.userEmail),
      AsyncStorage.getItem(STORAGE_KEYS.currency),
      AsyncStorage.getItem(STORAGE_KEYS.deviceId),
    ]);

    const resolvedDeviceId = storedDeviceId ?? buildDeviceId();
    if (!storedDeviceId) {
      await AsyncStorage.setItem(STORAGE_KEYS.deviceId, resolvedDeviceId);
    }

    if (storedToken) setToken(storedToken);
    if (storedEmail) setUserEmail(storedEmail);
    if (storedCurrency) setPreferredCurrencyState(storedCurrency);
    setDeviceId(resolvedDeviceId);
  }, []);

  const refreshAll = useCallback(async () => {
    if (!deviceId) return;
    const authToken = token;
    const [platformList, subscriptionList] = await Promise.all([
      apiRequest<Platform[]>({ path: "/platforms", token: authToken, deviceId }),
      apiRequest<Subscription[]>({ path: "/subscriptions", token: authToken, deviceId }),
    ]);
    const analyticsData = await apiRequest<Analytics>({
      path: `/analytics?currency=${preferredCurrency}`,
      token: authToken,
      deviceId,
    });
    setPlatforms(platformList);
    setSubscriptions(subscriptionList);
    setAnalytics(analyticsData);
  }, [deviceId, preferredCurrency, token]);

  useEffect(() => {
    initialize()
      .catch(() => {
        // Keep app usable even when local bootstrapping fails.
      })
      .finally(() => setLoading(false));
  }, [initialize]);

  useEffect(() => {
    if (!deviceId) return;
    refreshAll().catch(() => {
      setAnalytics(defaultAnalytics);
      setPlatforms([]);
      setSubscriptions([]);
    });
  }, [deviceId, token, preferredCurrency, refreshAll]);

  const setPreferredCurrency = useCallback(async (currency: string) => {
    setPreferredCurrencyState(currency);
    await AsyncStorage.setItem(STORAGE_KEYS.currency, currency);
  }, []);

  const loginWithEndpoint = useCallback(
    async (path: "/auth/login" | "/auth/register", payload: AuthPayload) => {
      if (!deviceId) return;
      const data = await apiRequest<AuthResponse>({
        path,
        method: "POST",
        deviceId,
        body: {
          ...payload,
          device_id: deviceId,
        },
      });
      setToken(data.access_token);
      setUserEmail(data.email);
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.token, data.access_token),
        AsyncStorage.setItem(STORAGE_KEYS.userEmail, data.email),
      ]);
      await refreshAll();
    },
    [deviceId, refreshAll]
  );

  const login = useCallback(
    async (payload: AuthPayload) => {
      await loginWithEndpoint("/auth/login", payload);
    },
    [loginWithEndpoint]
  );

  const register = useCallback(
    async (payload: AuthPayload) => {
      await loginWithEndpoint("/auth/register", payload);
    },
    [loginWithEndpoint]
  );

  const logout = useCallback(async () => {
    setToken(null);
    setUserEmail(null);
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.token),
      AsyncStorage.removeItem(STORAGE_KEYS.userEmail),
    ]);
    await refreshAll();
  }, [refreshAll]);

  const addSubscription = useCallback(
    async (payload: AddSubscriptionInput) => {
      if (!deviceId) return { requiresAuth: false };
      try {
        await apiRequest<Subscription>({
          path: "/subscriptions",
          method: "POST",
          token,
          deviceId,
          body: payload,
        });
        await refreshAll();
        return { requiresAuth: false };
      } catch (error) {
        const message = String(error);
        const requiresAuth = message.includes("Authentication required after 10 subscriptions");
        if (requiresAuth) {
          return { requiresAuth: true };
        }
        throw error;
      }
    },
    [deviceId, refreshAll, token]
  );

  const deleteSubscription = useCallback(
    async (id: string) => {
      if (!deviceId) return;
      await apiRequest<void>({
        path: `/subscriptions/${id}`,
        method: "DELETE",
        token,
        deviceId,
      });
      await refreshAll();
    },
    [deviceId, refreshAll, token]
  );

  const requestNotificationsPermission = useCallback(async () => {
    const result = await Notifications.requestPermissionsAsync();
    setNotificationStatus(result.status);
  }, []);

  const needsAuthForMoreSubscriptions = !token && subscriptions.length >= 10;

  const value = useMemo<AppContextShape>(
    () => ({
      loading,
      deviceId,
      preferredCurrency,
      token,
      userEmail,
      platforms,
      subscriptions,
      analytics,
      notificationStatus,
      needsAuthForMoreSubscriptions,
      setPreferredCurrency,
      refreshAll,
      addSubscription,
      deleteSubscription,
      login,
      register,
      logout,
      requestNotificationsPermission,
    }),
    [
      loading,
      deviceId,
      preferredCurrency,
      token,
      userEmail,
      platforms,
      subscriptions,
      analytics,
      notificationStatus,
      needsAuthForMoreSubscriptions,
      setPreferredCurrency,
      refreshAll,
      addSubscription,
      deleteSubscription,
      login,
      register,
      logout,
      requestNotificationsPermission,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
