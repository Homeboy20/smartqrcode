import { useEffect, useState } from 'react';
import { SUBSCRIPTION_PRICING, type PricingTier } from '@/lib/currency';

export interface AppSettings {
  freeMode: boolean;
  freeModeFeatures: {
    qrCodeGeneration: boolean;
    barcodeGeneration: boolean;
    basicTemplates: boolean;
    basicFormats: boolean;
  };
  branding: {
    siteName: string;
    logoUrl: string;
    logoSvgUrl?: string;
    faviconUrl?: string;
  };
  firebase?: {
    enabled: boolean;
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
    phoneAuthEnabled?: boolean;
    recaptchaSiteKey?: string;
  };

  pricing?: Record<'pro' | 'business', PricingTier>;
}

const DEFAULT_SETTINGS: AppSettings = {
  freeMode: false,
  freeModeFeatures: {
    qrCodeGeneration: true,
    barcodeGeneration: true,
    basicTemplates: true,
    basicFormats: true,
  },
  branding: {
    siteName: 'ScanMagic',
    logoUrl: '',
    logoSvgUrl: '',
    faviconUrl: '',
  },
  firebase: {
    enabled: false,
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: '',
    phoneAuthEnabled: false,
    recaptchaSiteKey: '',
  },
  pricing: SUBSCRIPTION_PRICING,
};

type SettingsSnapshot = {
  settings: AppSettings;
  loading: boolean;
  lastFetchedAt: number;
};

let snapshot: SettingsSnapshot = {
  settings: DEFAULT_SETTINGS,
  loading: true,
  lastFetchedAt: 0,
};

let inFlight: Promise<AppSettings | null> | null = null;
let intervalId: number | null = null;
let started = false;
let broadcastChannel: BroadcastChannel | null = null;
const subscribers = new Set<(next: SettingsSnapshot) => void>();

function emit() {
  for (const cb of subscribers) cb(snapshot);
}

function loadFromLocalStorage(): { settings: AppSettings; timestamp: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem('app_settings');
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (!parsed?.settings || !parsed?.timestamp) return null;
    return { settings: normalizeSettings(parsed.settings), timestamp: Number(parsed.timestamp) };
  } catch {
    return null;
  }
}

function saveToLocalStorage(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      'app_settings',
      JSON.stringify({
        settings,
        timestamp: Date.now(),
      })
    );
  } catch {
    // ignore
  }
}

function isFresh(ts: number) {
  return ts > 0 && Date.now() - ts < 5 * 60 * 1000;
}

async function fetchSettingsShared() {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) console.log('useAppSettings: Fetching from API...');

      // Use the non-slashed API path. Trailing-slash redirects can break POST/GET routing on some hosts.
      const response = await fetch('/api/app-settings', {
        cache: 'no-store',
      });

      if (!response.ok) {
        if (isDev) console.warn('useAppSettings: Failed to fetch app settings:', response.status);
        return null;
      }

      const data = await response.json();
      const normalized = normalizeSettings(data);

      snapshot = {
        settings: normalized,
        loading: false,
        lastFetchedAt: Date.now(),
      };
      emit();
      saveToLocalStorage(normalized);

      // Trigger Firebase reinitialization only if Firebase has valid config
      const hasValidFirebaseConfig =
        normalized.firebase?.enabled && normalized.firebase?.apiKey && normalized.firebase?.projectId;

      if (typeof window !== 'undefined') {
        if (hasValidFirebaseConfig) {
          if (isDev) console.log('useAppSettings: Valid Firebase config detected, triggering reinitialization...');
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('firebase-config-updated'));
          }, 50);
        } else if (normalized.firebase?.enabled) {
          console.warn('⚠️ Firebase is enabled but missing configuration values. Configure in Admin Panel → App Settings.');
        }
      }

      return normalized;
    } catch (error) {
      console.error('useAppSettings: Error fetching app settings:', error);
      snapshot = { ...snapshot, loading: false };
      emit();
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

function startSharedListeners() {
  if (started || typeof window === 'undefined') return;
  started = true;

  const handleSettingsUpdate = () => {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) console.log('useAppSettings: Received settings update event, refetching...');
    snapshot = { ...snapshot, loading: true };
    emit();
    void fetchSettingsShared();
  };

  window.addEventListener('app-settings-updated', handleSettingsUpdate);

  try {
    broadcastChannel = new BroadcastChannel('app-settings');
    broadcastChannel.onmessage = (event) => {
      if (event?.data?.type === 'settings-updated') {
        handleSettingsUpdate();
      }
    };
  } catch {
    // BroadcastChannel not supported
  }

  intervalId = window.setInterval(() => {
    // only refresh if cache is stale
    if (!isFresh(snapshot.lastFetchedAt)) {
      snapshot = { ...snapshot, loading: true };
      emit();
      void fetchSettingsShared();
    }
  }, 5 * 60 * 1000);
}

function normalizeSettings(candidate: unknown): AppSettings {
  const incoming = (candidate ?? {}) as Partial<AppSettings>;
  const incomingBranding = (incoming.branding ?? {}) as Partial<AppSettings['branding']>;
  const incomingFirebase = (incoming.firebase ?? {}) as Partial<NonNullable<AppSettings['firebase']>>;
  const incomingPricing = (incoming.pricing ?? {}) as Partial<Record<'pro' | 'business', PricingTier>>;

  return {
    ...DEFAULT_SETTINGS,
    ...incoming,
    freeModeFeatures: {
      ...DEFAULT_SETTINGS.freeModeFeatures,
      ...(incoming.freeModeFeatures ?? {}),
    },
    branding: {
      ...DEFAULT_SETTINGS.branding,
      ...incomingBranding,
    },
    firebase: {
      ...(DEFAULT_SETTINGS.firebase ?? {
        enabled: false,
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        measurementId: '',
      }),
      ...incomingFirebase,
    },
    pricing: {
      ...(DEFAULT_SETTINGS.pricing ?? SUBSCRIPTION_PRICING),
      ...(incomingPricing as any),
    },
  };
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const cached = loadFromLocalStorage();
    if (cached) {
      snapshot = {
        settings: cached.settings,
        loading: !isFresh(cached.timestamp),
        lastFetchedAt: cached.timestamp,
      };
      return cached.settings;
    }
    return snapshot.settings;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = loadFromLocalStorage();
    if (cached) return !isFresh(cached.timestamp);
    return snapshot.loading;
  });

  useEffect(() => {
    startSharedListeners();

    // Sync local state with the shared snapshot.
    const onUpdate = (next: SettingsSnapshot) => {
      setSettings(next.settings);
      setLoading(next.loading);
    };

    subscribers.add(onUpdate);
    // Emit current snapshot immediately
    onUpdate(snapshot);

    // Fetch once (deduped) if stale
    if (!isFresh(snapshot.lastFetchedAt)) {
      snapshot = { ...snapshot, loading: true };
      emit();
      void fetchSettingsShared();
    } else {
      // Ensure loading isn't stuck true when we have fresh cache
      if (snapshot.loading) {
        snapshot = { ...snapshot, loading: false };
        emit();
      }
    }

    return () => {
      subscribers.delete(onUpdate);
    };
  }, []);

  return { settings, loading };
}
