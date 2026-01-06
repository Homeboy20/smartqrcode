import { useState, useEffect } from 'react';

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
  };
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
  },
};

function normalizeSettings(candidate: unknown): AppSettings {
  const incoming = (candidate ?? {}) as Partial<AppSettings>;
  const incomingBranding = (incoming.branding ?? {}) as Partial<AppSettings['branding']>;
  const incomingFirebase = (incoming.firebase ?? {}) as Partial<NonNullable<AppSettings['firebase']>>;

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
  };
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Try to load from localStorage first for instant load
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('app_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          // Check if cache is less than 5 minutes old
          if (parsed.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
            console.log('useAppSettings: Loaded from cache:', parsed.settings);
            return normalizeSettings(parsed.settings);
          }
        }
      } catch (error) {
        console.error('Error loading cached settings:', error);
      }
    }
    console.log('useAppSettings: Using default settings');
    return DEFAULT_SETTINGS;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        console.log('useAppSettings: Fetching from API...');
        // Add cache busting parameter
        const response = await fetch(`/api/app-settings?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('useAppSettings: Received from API:', data);
          const normalized = normalizeSettings(data);
          setSettings(normalized);
          
          // Cache the settings in localStorage
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('app_settings', JSON.stringify({
                settings: normalized,
                timestamp: Date.now()
              }));
              console.log('useAppSettings: Cached to localStorage');
            } catch (error) {
              console.error('Error caching settings:', error);
            }
          }
        } else {
          console.error('Failed to fetch app settings:', response.status);
        }
      } catch (error) {
        console.error('Error fetching app settings:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
    
    // Listen for settings updates from admin page
    const handleSettingsUpdate = () => {
      console.log('useAppSettings: Received settings update event, refetching...');
      fetchSettings();
    };
    
    // Listen on window events (same tab)
    window.addEventListener('app-settings-updated', handleSettingsUpdate);
    
    // Listen on BroadcastChannel (cross-tab)
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('app-settings');
      channel.onmessage = (event) => {
        if (event.data.type === 'settings-updated') {
          console.log('useAppSettings: Received broadcast, refetching...');
          fetchSettings();
        }
      };
    } catch (e) {
      // BroadcastChannel not supported
    }
    
    // Refresh settings every 5 minutes
    const interval = setInterval(fetchSettings, 5 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('app-settings-updated', handleSettingsUpdate);
      if (channel) {
        channel.close();
      }
    };
  }, []);

  return { settings, loading };
}
