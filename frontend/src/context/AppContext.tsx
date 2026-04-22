import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type BillingCycle = "monthly" | "yearly";
type SortBy = "renewal_date" | "amount" | "name";
type SortOrder = "asc" | "desc";

export type Platform = {
  id: string;
  slug: string;
  name: string;
  category: string;
  logo_url?: string | null;
  offers?: PlatformOffer[];
};

export type PlatformOffer = {
  id: string;
  name: string;
  price: number;
  billing_cycle: BillingCycle;
  currency: string;
  logo_url?: string | null;
};

export type SharedMember = {
  name: string;
  share_ratio: number;
};

export type PriceHistoryEntry = {
  changed_at: string;
  old_amount: number;
  new_amount: number;
  old_currency: string;
  new_currency: string;
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
  platform_logo_url?: string | null;
  platform_offer_id?: string | null;
  platform_offer_name?: string | null;
  trial_end_date?: string | null;
  is_trial?: boolean;
  shared_with?: SharedMember[];
  effective_personal_share?: number;
  duplicate_count?: number;
  price_history?: PriceHistoryEntry[];
};

type UpcomingRenewal = {
  id: string;
  name: string;
  renewal_date: string;
  amount: number;
  currency: string;
};

type BudgetStatus = {
  monthly_limit: number;
  category_limits: Record<string, number>;
  monthly_total: number;
  monthly_usage_percent: number;
  over_budget: boolean;
  over_budget_amount: number;
  category_usage: Record<string, { spent: number; limit: number; usage_percent: number; over_budget: boolean }>;
};

type Insight = {
  title: string;
  value: string;
  severity: "info" | "warning" | "danger";
};

type Analytics = {
  monthly_total: number;
  yearly_total: number;
  category_breakdown: Record<string, { monthly: number; yearly: number }>;
  upcoming_renewals: UpcomingRenewal[];
  currency: string;
  subscriptions_count: number;
  average_monthly_per_subscription: number;
  top_category: { name: string; monthly: number } | null;
  upcoming_renewals_count: number;
  next_renewal_date: string | null;
  trial_conversions: Array<{ id: string; name: string; trial_end_date: string }>;
  duplicate_groups: Array<{ name: string; category: string; count: number }>;
  insights: Insight[];
  budget_status: BudgetStatus | null;
  savings_target_10_percent: number;
};

type FxRates = {
  base: string;
  rates: Record<string, number>;
  fetched_at: string | null;
  source: string;
};

type CalendarEvent = {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  currency: string;
  type: "renewal" | "trial_end";
};

type BudgetConfig = {
  monthly_limit: number;
  category_limits: Record<string, number>;
};

type AddSubscriptionInput = {
  platform_id?: string;
  platform_offer_id?: string;
  use_manual_price?: boolean;
  custom_name?: string;
  custom_category?: string;
  renewal_date: string;
  amount: number;
  billing_cycle: BillingCycle;
  currency: string;
  trial_end_date?: string | null;
  is_trial?: boolean;
  shared_with?: SharedMember[];
};

type UpdateSubscriptionInput = {
  renewal_date?: string;
  amount?: number;
  billing_cycle?: BillingCycle;
  currency?: string;
  platform_offer_id?: string;
  use_manual_price?: boolean;
  trial_end_date?: string | null;
  is_trial?: boolean;
  shared_with?: SharedMember[];
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
  onboardingComplete: boolean;
  deviceId: string;
  preferredCurrency: string;
  token: string | null;
  userEmail: string | null;
  platforms: Platform[];
  subscriptions: Subscription[];
  analytics: Analytics | null;
  calendarEvents: CalendarEvent[];
  fxRates: FxRates | null;
  budgetConfig: BudgetConfig | null;
  notificationStatus: Notifications.PermissionStatus | null;
  needsAuthForMoreSubscriptions: boolean;
  remindersEnabled: boolean;
  reminderLeadDays: number;
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  searchQuery: string;
  categoryFilter: string | null;
  sortBy: SortBy;
  sortOrder: SortOrder;
  isBiometricLockEnabled: boolean;
  isLocked: boolean;
  setPreferredCurrency: (currency: string) => Promise<void>;
  setReminderLeadDays: (days: number) => Promise<void>;
  setRemindersEnabled: (enabled: boolean) => Promise<void>;
  setQuietHoursEnabled: (enabled: boolean) => Promise<void>;
  setQuietHours: (startHour: number, endHour: number) => Promise<void>;
  setOnboardingComplete: (value: boolean) => Promise<void>;
  setSearchQuery: (value: string) => void;
  setCategoryFilter: (value: string | null) => void;
  setSortBy: (value: SortBy) => void;
  setSortOrder: (value: SortOrder) => void;
  setBiometricLockEnabled: (value: boolean) => Promise<void>;
  unlockApp: () => Promise<void>;
  lockApp: () => void;
  setBudgetConfig: (config: BudgetConfig) => Promise<void>;
  refreshAll: () => Promise<void>;
  addSubscription: (payload: AddSubscriptionInput) => Promise<{ requiresAuth: boolean; duplicateWarning?: string }>;
  updateSubscription: (id: string, payload: UpdateSubscriptionInput) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  markRenewed: (id: string) => Promise<void>;
  duplicateCheck: (payload: AddSubscriptionInput) => Promise<{ is_duplicate: boolean; duplicate_count: number; message: string }>;
  exportJson: () => Promise<string>;
  exportCsv: () => Promise<string>;
  importJson: (payload: { subscriptions: Record<string, unknown>[] }) => Promise<number>;
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
  remindersEnabled: "subscription-hub:reminders-enabled",
  reminderLeadDays: "subscription-hub:reminder-lead-days",
  quietHoursEnabled: "subscription-hub:quiet-hours-enabled",
  quietHoursStart: "subscription-hub:quiet-hours-start",
  quietHoursEnd: "subscription-hub:quiet-hours-end",
  onboardingComplete: "subscription-hub:onboarding-complete",
  biometricLockEnabled: "subscription-hub:biometric-lock-enabled",
};

const defaultAnalytics: Analytics = {
  monthly_total: 0,
  yearly_total: 0,
  category_breakdown: {},
  upcoming_renewals: [],
  currency: "EUR",
  subscriptions_count: 0,
  average_monthly_per_subscription: 0,
  top_category: null,
  upcoming_renewals_count: 0,
  next_renewal_date: null,
  trial_conversions: [],
  duplicate_groups: [],
  insights: [],
  budget_status: null,
  savings_target_10_percent: 0,
};

const defaultReminderLeadDays = 3;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const AppContext = createContext<AppContextShape | null>(null);

function randomSegment() {
  return Math.random().toString(36).slice(2, 10);
}

function buildDeviceId() {
  const modelName = Device.modelName?.replace(/\s+/g, "-").toLowerCase() ?? "device";
  return `${modelName}-${Date.now().toString(36)}-${randomSegment()}`;
}

function parseApiError(error: unknown): string {
  const raw = String(error);
  try {
    const parsed = JSON.parse(raw.replace(/^Error:\s*/, ""));
    if (typeof parsed?.detail === "string") {
      return parsed.detail;
    }
  } catch {
    // Fall back to raw text.
  }
  return raw;
}

async function apiRequest<T>({
  path,
  method = "GET",
  token,
  deviceId,
  body,
  contentType = "application/json",
}: {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string | null;
  deviceId?: string;
  body?: object | string;
  contentType?: string;
}): Promise<T> {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (deviceId) {
    headers["x-device-id"] = deviceId;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : contentType === "application/json"
            ? JSON.stringify(body)
            : String(body),
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
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrencyState] = useState("EUR");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [fxRates, setFxRates] = useState<FxRates | null>(null);
  const [budgetConfig, setBudgetConfigState] = useState<BudgetConfig | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<Notifications.PermissionStatus | null>(
    null
  );
  const [remindersEnabled, setRemindersEnabledState] = useState(false);
  const [reminderLeadDays, setReminderLeadDaysState] = useState(defaultReminderLeadDays);
  const [quietHoursEnabled, setQuietHoursEnabledState] = useState(false);
  const [quietHoursStart, setQuietHoursStartState] = useState(22);
  const [quietHoursEnd, setQuietHoursEndState] = useState(8);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("renewal_date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [isBiometricLockEnabled, setBiometricLockEnabledState] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const scheduleRenewalReminders = useCallback(
    async (subscriptionList: Subscription[], leadDays: number) => {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!remindersEnabled || notificationStatus !== "granted") {
        return;
      }

      const now = new Date();
      const blockedStart = quietHoursStart;
      const blockedEnd = quietHoursEnd;
      for (const subscription of subscriptionList) {
        const reminderDate = new Date(`${subscription.renewal_date}T09:00:00`);
        reminderDate.setDate(reminderDate.getDate() - leadDays);
        if (Number.isNaN(reminderDate.getTime()) || reminderDate <= now) {
          continue;
        }

        if (quietHoursEnabled) {
          const hour = reminderDate.getHours();
          const insideQuietRange =
            blockedStart < blockedEnd
              ? hour >= blockedStart && hour < blockedEnd
              : hour >= blockedStart || hour < blockedEnd;
          if (insideQuietRange) {
            reminderDate.setHours(blockedEnd, 0, 0, 0);
          }
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Renewal soon: ${subscription.name}`,
            body: `${subscription.name} renews in ${leadDays} day${leadDays > 1 ? "s" : ""}.`,
            data: {
              subscriptionId: subscription.id,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderDate,
          },
        });
      }

      // Trial-expiry notifications: fire 1 day before and on the day itself.
      for (const subscription of subscriptionList) {
        if (!subscription.is_trial || !subscription.trial_end_date) continue;

        const offsets: Array<{ daysOffset: number; title: string; body: string }> = [
          {
            daysOffset: 1,
            title: `Trial ending tomorrow: ${subscription.name}`,
            body: `Your ${subscription.name} trial ends tomorrow. Cancel now to avoid being charged.`,
          },
          {
            daysOffset: 0,
            title: `Trial ending today: ${subscription.name}`,
            body: `Your ${subscription.name} trial ends today. Make sure to cancel if you don't want to be charged.`,
          },
        ];

        for (const { daysOffset, title, body } of offsets) {
          const notifDate = new Date(`${subscription.trial_end_date}T09:00:00`);
          notifDate.setDate(notifDate.getDate() - daysOffset);
          if (Number.isNaN(notifDate.getTime()) || notifDate <= now) continue;

          if (quietHoursEnabled) {
            const hour = notifDate.getHours();
            const insideQuietRange =
              blockedStart < blockedEnd
                ? hour >= blockedStart && hour < blockedEnd
                : hour >= blockedStart || hour < blockedEnd;
            if (insideQuietRange) {
              notifDate.setHours(blockedEnd, 0, 0, 0);
            }
          }

          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              data: { subscriptionId: subscription.id },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: notifDate,
            },
          });
        }
      }
    },
    [notificationStatus, remindersEnabled, quietHoursEnabled, quietHoursStart, quietHoursEnd]
  );

  const fetchSubscriptions = useCallback(
    async (
      authToken: string | null,
      localDeviceId: string,
      params?: { q?: string; category?: string | null; sortBy?: SortBy; sortOrder?: SortOrder }
    ) => {
      const q = params?.q ?? searchQuery;
      const category = params?.category ?? categoryFilter;
      const sortField = params?.sortBy ?? sortBy;
      const direction = params?.sortOrder ?? sortOrder;
      const qs = new URLSearchParams();
      if (q.trim()) qs.set("q", q.trim());
      if (category) qs.set("category", category);
      qs.set("sort_by", sortField);
      qs.set("sort_order", direction);
      const path = qs.toString() ? `/subscriptions?${qs.toString()}` : "/subscriptions";
      return await apiRequest<Subscription[]>({
        path,
        token: authToken,
        deviceId: localDeviceId,
      });
    },
    [categoryFilter, searchQuery, sortBy, sortOrder]
  );

  const fetchBudgets = useCallback(
    async (authToken: string | null, localDeviceId: string, currency: string) => {
      return await apiRequest<BudgetStatus | null>({
        path: `/budgets?currency=${currency}`,
        token: authToken,
        deviceId: localDeviceId,
      });
    },
    []
  );

  const refreshAll = useCallback(async () => {
    if (!deviceId || isLocked) return;
    const authToken = token;
    const [platformList, subscriptionList, analyticsData, calendarData, fxData, budgets] = await Promise.all([
      apiRequest<Platform[]>({ path: "/platforms", token: authToken, deviceId }),
      fetchSubscriptions(authToken, deviceId),
      apiRequest<Analytics>({
        path: `/analytics?currency=${preferredCurrency}`,
        token: authToken,
        deviceId,
      }),
      apiRequest<{ events: CalendarEvent[] }>({ path: "/calendar?horizon_days=120", token: authToken, deviceId }),
      apiRequest<FxRates>({ path: "/fx-rates", token: authToken, deviceId }),
      fetchBudgets(authToken, deviceId, preferredCurrency),
    ]);
    setPlatforms(platformList);
    setSubscriptions(subscriptionList);
    setAnalytics(analyticsData);
    setCalendarEvents(calendarData.events);
    setFxRates(fxData);
    setBudgetConfigState(
      budgets
        ? {
            monthly_limit: budgets.monthly_limit,
            category_limits: budgets.category_limits,
          }
        : null
    );
  }, [deviceId, fetchBudgets, fetchSubscriptions, isLocked, preferredCurrency, token]);

  const initialize = useCallback(async () => {
    const [
      storedToken,
      storedEmail,
      storedCurrency,
      storedDeviceId,
      storedRemindersEnabled,
      storedLeadDays,
      storedQuietEnabled,
      storedQuietStart,
      storedQuietEnd,
      storedOnboardingComplete,
      storedBiometricLock,
    ] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.token),
      AsyncStorage.getItem(STORAGE_KEYS.userEmail),
      AsyncStorage.getItem(STORAGE_KEYS.currency),
      AsyncStorage.getItem(STORAGE_KEYS.deviceId),
      AsyncStorage.getItem(STORAGE_KEYS.remindersEnabled),
      AsyncStorage.getItem(STORAGE_KEYS.reminderLeadDays),
      AsyncStorage.getItem(STORAGE_KEYS.quietHoursEnabled),
      AsyncStorage.getItem(STORAGE_KEYS.quietHoursStart),
      AsyncStorage.getItem(STORAGE_KEYS.quietHoursEnd),
      AsyncStorage.getItem(STORAGE_KEYS.onboardingComplete),
      AsyncStorage.getItem(STORAGE_KEYS.biometricLockEnabled),
    ]);
    const permission = await Notifications.getPermissionsAsync();
    setNotificationStatus(permission.status);

    const resolvedDeviceId = storedDeviceId ?? buildDeviceId();
    if (!storedDeviceId) {
      await AsyncStorage.setItem(STORAGE_KEYS.deviceId, resolvedDeviceId);
    }

    if (storedToken) setToken(storedToken);
    if (storedEmail) setUserEmail(storedEmail);
    if (storedCurrency) setPreferredCurrencyState(storedCurrency);
    if (storedRemindersEnabled) setRemindersEnabledState(storedRemindersEnabled === "true");
    if (storedLeadDays) {
      const parsed = Number(storedLeadDays);
      if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 30) {
        setReminderLeadDaysState(parsed);
      }
    }
    if (storedQuietEnabled) setQuietHoursEnabledState(storedQuietEnabled === "true");
    if (storedQuietStart) {
      const parsedStart = Number(storedQuietStart);
      if (!Number.isNaN(parsedStart) && parsedStart >= 0 && parsedStart <= 23) {
        setQuietHoursStartState(parsedStart);
      }
    }
    if (storedQuietEnd) {
      const parsedEnd = Number(storedQuietEnd);
      if (!Number.isNaN(parsedEnd) && parsedEnd >= 0 && parsedEnd <= 23) {
        setQuietHoursEndState(parsedEnd);
      }
    }
    if (storedOnboardingComplete === "true") {
      setOnboardingCompleteState(true);
    }
    if (storedBiometricLock === "true") {
      setBiometricLockEnabledState(true);
      setIsLocked(true);
    }
    setDeviceId(resolvedDeviceId);
  }, []);

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
      setCalendarEvents([]);
      setFxRates(null);
      setBudgetConfigState(null);
    });
  }, [deviceId, token, preferredCurrency, refreshAll, searchQuery, categoryFilter, sortBy, sortOrder, isLocked]);

  useEffect(() => {
    void scheduleRenewalReminders(subscriptions, reminderLeadDays);
  }, [subscriptions, reminderLeadDays, scheduleRenewalReminders]);

  const setPreferredCurrency = useCallback(async (currency: string) => {
    setPreferredCurrencyState(currency);
    await AsyncStorage.setItem(STORAGE_KEYS.currency, currency);
  }, []);

  const setReminderLeadDays = useCallback(async (days: number) => {
    setReminderLeadDaysState(days);
    await AsyncStorage.setItem(STORAGE_KEYS.reminderLeadDays, String(days));
  }, []);

  const setRemindersEnabled = useCallback(async (enabled: boolean) => {
    setRemindersEnabledState(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.remindersEnabled, String(enabled));
  }, []);

  const setQuietHoursEnabled = useCallback(async (enabled: boolean) => {
    setQuietHoursEnabledState(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.quietHoursEnabled, String(enabled));
  }, []);

  const setQuietHours = useCallback(async (startHour: number, endHour: number) => {
    setQuietHoursStartState(startHour);
    setQuietHoursEndState(endHour);
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.quietHoursStart, String(startHour)),
      AsyncStorage.setItem(STORAGE_KEYS.quietHoursEnd, String(endHour)),
    ]);
  }, []);

  const setOnboardingComplete = useCallback(async (value: boolean) => {
    setOnboardingCompleteState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.onboardingComplete, String(value));
  }, []);

  const setBiometricLockEnabled = useCallback(async (value: boolean) => {
    setBiometricLockEnabledState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.biometricLockEnabled, String(value));
    if (!value) {
      setIsLocked(false);
    }
  }, []);

  const unlockApp = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      // Device has no biometric capability — unlock without challenge.
      setIsLocked(false);
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Subscription Hub",
      fallbackLabel: "Use Passcode",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });

    if (result.success) {
      setIsLocked(false);
    }
  }, []);

  const lockApp = useCallback(() => {
    if (isBiometricLockEnabled) {
      setIsLocked(true);
    }
  }, [isBiometricLockEnabled]);

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

  const duplicateCheck = useCallback(
    async (payload: AddSubscriptionInput) => {
      if (!deviceId) return { is_duplicate: false, duplicate_count: 0, message: "Device unavailable." };
      return await apiRequest<{ is_duplicate: boolean; duplicate_count: number; message: string }>({
        path: "/subscriptions/duplicate-check",
        method: "POST",
        token,
        deviceId,
        body: payload,
      });
    },
    [deviceId, token]
  );

  const addSubscription = useCallback(
    async (payload: AddSubscriptionInput) => {
      if (!deviceId) return { requiresAuth: false };
      const duplicateResult = await duplicateCheck(payload);
      try {
        await apiRequest<Subscription>({
          path: "/subscriptions",
          method: "POST",
          token,
          deviceId,
          body: payload,
        });
        await refreshAll();
        return {
          requiresAuth: false,
          duplicateWarning: duplicateResult.is_duplicate ? duplicateResult.message : undefined,
        };
      } catch (error) {
        const message = parseApiError(error);
        const requiresAuth = message.includes("Authentication required after 10 subscriptions");
        if (requiresAuth) {
          return { requiresAuth: true };
        }
        throw error;
      }
    },
    [deviceId, duplicateCheck, refreshAll, token]
  );

  const updateSubscription = useCallback(
    async (id: string, payload: UpdateSubscriptionInput) => {
      if (!deviceId) return;
      await apiRequest<Subscription>({
        path: `/subscriptions/${id}`,
        method: "PUT",
        token,
        deviceId,
        body: payload,
      });
      await refreshAll();
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

  const markRenewed = useCallback(
    async (id: string) => {
      if (!deviceId) return;
      await apiRequest<void>({
        path: `/subscriptions/${id}/mark-renewed`,
        method: "POST",
        token,
        deviceId,
      });
      await refreshAll();
    },
    [deviceId, refreshAll, token]
  );

  const setBudgetConfig = useCallback(
    async (config: BudgetConfig) => {
      if (!deviceId) return;
      await apiRequest<BudgetConfig>({
        path: "/budgets",
        method: "PUT",
        token,
        deviceId,
        body: config,
      });
      setBudgetConfigState(config);
      await refreshAll();
    },
    [deviceId, refreshAll, token]
  );

  const exportJson = useCallback(async () => {
    if (!deviceId) return "";
    const data = await apiRequest<{ exported_at: string; subscriptions: Record<string, unknown>[] }>({
      path: "/export/json",
      token,
      deviceId,
    });
    return JSON.stringify(data, null, 2);
  }, [deviceId, token]);

  const exportCsv = useCallback(async () => {
    if (!deviceId) return "";
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : { "x-device-id": deviceId };
    const response = await fetch(`${API_BASE}/export/csv`, { headers });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "CSV export failed");
    }
    return await response.text();
  }, [deviceId, token]);

  const importJson = useCallback(
    async (payload: { subscriptions: Record<string, unknown>[] }) => {
      if (!deviceId) return 0;
      const result = await apiRequest<{ imported: number }>({
        path: "/import/json",
        method: "POST",
        token,
        deviceId,
        body: payload,
      });
      await refreshAll();
      return result.imported;
    },
    [deviceId, refreshAll, token]
  );

  const requestNotificationsPermission = useCallback(async () => {
    const result = await Notifications.requestPermissionsAsync();
    setNotificationStatus(result.status);
    if (result.status === "granted") {
      await scheduleRenewalReminders(subscriptions, reminderLeadDays);
    }
  }, [reminderLeadDays, scheduleRenewalReminders, subscriptions]);

  const needsAuthForMoreSubscriptions = !token && subscriptions.length >= 10;

  const value = useMemo<AppContextShape>(
    () => ({
      loading,
      onboardingComplete,
      deviceId,
      preferredCurrency,
      token,
      userEmail,
      platforms,
      subscriptions,
      analytics,
      calendarEvents,
      fxRates,
      budgetConfig,
      notificationStatus,
      needsAuthForMoreSubscriptions,
      remindersEnabled,
      reminderLeadDays,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      searchQuery,
      categoryFilter,
      sortBy,
      sortOrder,
      isBiometricLockEnabled,
      isLocked,
      setPreferredCurrency,
      setReminderLeadDays,
      setRemindersEnabled,
      setQuietHoursEnabled,
      setQuietHours,
      setOnboardingComplete,
      setSearchQuery,
      setCategoryFilter,
      setSortBy,
      setSortOrder,
      setBiometricLockEnabled,
      unlockApp,
      lockApp,
      setBudgetConfig,
      refreshAll,
      addSubscription,
      updateSubscription,
      deleteSubscription,
      markRenewed,
      duplicateCheck,
      exportJson,
      exportCsv,
      importJson,
      login,
      register,
      logout,
      requestNotificationsPermission,
    }),
    [
      loading,
      onboardingComplete,
      deviceId,
      preferredCurrency,
      token,
      userEmail,
      platforms,
      subscriptions,
      analytics,
      calendarEvents,
      fxRates,
      budgetConfig,
      notificationStatus,
      needsAuthForMoreSubscriptions,
      remindersEnabled,
      reminderLeadDays,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      searchQuery,
      categoryFilter,
      sortBy,
      sortOrder,
      isBiometricLockEnabled,
      isLocked,
      setPreferredCurrency,
      setReminderLeadDays,
      setRemindersEnabled,
      setQuietHoursEnabled,
      setQuietHours,
      setOnboardingComplete,
      setSearchQuery,
      setCategoryFilter,
      setSortBy,
      setSortOrder,
      setBiometricLockEnabled,
      unlockApp,
      lockApp,
      setBudgetConfig,
      refreshAll,
      addSubscription,
      updateSubscription,
      deleteSubscription,
      markRenewed,
      duplicateCheck,
      exportJson,
      exportCsv,
      importJson,
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
