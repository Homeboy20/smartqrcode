'use client';

import React, { useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

type BrandingSettings = {
  siteName: string;
  logoUrl: string;
  faviconUrl: string;
};

type AppSettingsResponse = {
  settings?: {
    branding?: Partial<BrandingSettings>;
  };
};

type AnySettings = Record<string, any>;

const DEFAULT_BRANDING: BrandingSettings = {
  siteName: 'ScanMagic',
  logoUrl: '',
  faviconUrl: '',
};

export default function BrandingSettingsForm() {
  const { session } = useSupabaseAuth();

  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [currentSettings, setCurrentSettings] = useState<AnySettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const accessToken = session?.access_token;
        if (!accessToken) {
          setLoading(false);
          return;
        }

        const response = await fetch('/api/admin/app-settings', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load branding settings');
        }

        const data = (await response.json()) as AppSettingsResponse;
        const loadedSettings = (data?.settings ?? {}) as AnySettings;
        const rawBranding = (loadedSettings?.branding ?? {}) as any;
        const next: BrandingSettings = {
          ...DEFAULT_BRANDING,
          siteName: String(rawBranding?.siteName ?? DEFAULT_BRANDING.siteName),
          // Migrate any previously-saved SVG logo field into the single logoUrl.
          logoUrl: String(rawBranding?.logoUrl ?? rawBranding?.logoSvgUrl ?? DEFAULT_BRANDING.logoUrl),
          faviconUrl: String(rawBranding?.faviconUrl ?? DEFAULT_BRANDING.faviconUrl),
        };

        if (!cancelled) {
          setCurrentSettings(loadedSettings);
          setBranding(next);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load branding settings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const uploadBrandingAsset = async (file: File, kind: 'logo' | 'favicon') => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);

      const response = await fetch('/api/admin/uploads/logo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      });

      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        const messageParts = [payload?.error || 'Logo upload failed'];
        if (payload?.details && payload.details !== payload?.error) {
          messageParts.push(String(payload.details));
        }
        if (payload?.hint) {
          messageParts.push(String(payload.hint));
        }
        throw new Error(messageParts.filter(Boolean).join(' | '));
      }

      const url = String(payload?.url || '');
      if (!url) {
        throw new Error('Logo upload failed: missing URL');
      }

      setBranding(prev => {
        if (kind === 'favicon') return { ...prev, faviconUrl: url };
        return { ...prev, logoUrl: url };
      });
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      // Merge branding into the existing app settings so we don't wipe unrelated keys.
      let base = currentSettings;
      if (!base || Object.keys(base).length === 0) {
        const preflight = await fetch('/api/admin/app-settings', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Cache-Control': 'no-cache',
          },
        });

        if (preflight.ok) {
          const preflightData = (await preflight.json()) as AppSettingsResponse;
          base = ((preflightData?.settings ?? {}) as AnySettings) || {};
          setCurrentSettings(base);
        }
      }

      const mergedSettings = {
        ...base,
        branding,
      };

      const response = await fetch('/api/admin/app-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          settings: mergedSettings,
        }),
      });

      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save branding');
      }

      if (typeof window !== 'undefined') {
        localStorage.removeItem('app_settings');
        window.dispatchEvent(new CustomEvent('app-settings-updated'));
        try {
          const channel = new BroadcastChannel('app-settings');
          channel.postMessage({ type: 'settings-updated' });
          channel.close();
        } catch {
          // ignore
        }
      }

      setSuccess('Branding saved successfully!');
      setTimeout(() => setSuccess(null), 2500);
    } catch (e: any) {
      setError(e?.message || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">Loading branding…</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-semibold mb-6 text-gray-800 border-b pb-3">Branding</h2>

      {error && <p className="text-red-600 bg-red-50 p-3 rounded-md text-sm mb-4">Error: {error}</p>}
      {success && <p className="text-green-600 bg-green-50 p-3 rounded-md text-sm mb-4">{success}</p>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="brandingSiteName" className="block text-sm font-medium text-gray-700">
            Site name
          </label>
          <input
            id="brandingSiteName"
            type="text"
            value={branding.siteName}
            onChange={(e) => setBranding(prev => ({ ...prev, siteName: e.target.value }))}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Your site name"
            disabled={saving}
          />
        </div>

        <div>
          <label htmlFor="brandingLogoUrl" className="block text-sm font-medium text-gray-700">
            Logo URL
          </label>
          <input
            id="brandingLogoUrl"
            type="url"
            value={branding.logoUrl}
            onChange={(e) => setBranding(prev => ({ ...prev, logoUrl: e.target.value }))}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="https://..."
            disabled={saving}
          />

          <div className="mt-3 flex items-center gap-3">
            <label className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 cursor-pointer">
              <input
                type="file"
                accept="image/*,.svg"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    uploadBrandingAsset(file, 'logo').catch(err => {
                      setError(err instanceof Error ? err.message : 'Logo upload failed');
                    });
                  }
                  e.currentTarget.value = '';
                }}
                disabled={saving}
              />
              Upload logo
            </label>

            <button
              type="button"
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
              onClick={() => setBranding(prev => ({ ...prev, logoUrl: '' }))}
              disabled={saving || !branding.logoUrl}
            >
              Remove
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="brandingFaviconUrl" className="block text-sm font-medium text-gray-700">
            Favicon URL
          </label>
          <input
            id="brandingFaviconUrl"
            type="url"
            value={branding.faviconUrl}
            onChange={(e) => setBranding(prev => ({ ...prev, faviconUrl: e.target.value }))}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="https://.../favicon.ico"
            disabled={saving}
          />

          <div className="mt-3 flex items-center gap-3">
            <label className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 cursor-pointer">
              <input
                type="file"
                accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/webp,.ico,.png,.svg,.webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    uploadBrandingAsset(file, 'favicon').catch(err => {
                      setError(err instanceof Error ? err.message : 'Favicon upload failed');
                    });
                  }
                  e.currentTarget.value = '';
                }}
                disabled={saving}
              />
              Upload favicon
            </label>

            <button
              type="button"
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
              onClick={() => setBranding(prev => ({ ...prev, faviconUrl: '' }))}
              disabled={saving || !branding.faviconUrl}
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      {(branding.logoUrl || branding.siteName) && (
        <div className="mt-6">
          <p className="text-sm text-gray-700 mb-2">Preview</p>
          <div className="inline-flex items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-3">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="Site logo" className="h-10 w-10 object-contain" />
            ) : (
              <div className="h-10 w-10 rounded bg-gray-100" />
            )}
            <span className="text-sm font-medium text-gray-900">{branding.siteName || 'Site name'}</span>
          </div>
        </div>
      )}

      <div className="pt-6 text-right">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Branding'}
        </button>
      </div>
    </div>
  );
}
