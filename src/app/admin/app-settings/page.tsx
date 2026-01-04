'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

interface AppSettings {
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
  };
}

export default function AppSettingsPage() {
  const { session } = useSupabaseAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<AppSettings>({
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
    },
  });

  // Fetch existing app settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const accessToken = session?.access_token;
        if (!accessToken) {
          console.log('No session, skipping fetch');
          setLoading(false);
          return;
        }
        
        const response = await fetch('/api/admin/app-settings', {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            Authorization: `Bearer ${accessToken}`,
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.settings) {
            setSettings(data.settings);
          }
        }
      } catch (err) {
        console.error('Error fetching app settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [session]);

  const handleToggleFreeMode = () => {
    setSettings(prev => ({
      ...prev,
      freeMode: !prev.freeMode
    }));
  };

  const handleToggleFeature = (feature: keyof AppSettings['freeModeFeatures']) => {
    setSettings(prev => ({
      ...prev,
      freeModeFeatures: {
        ...prev.freeModeFeatures,
        [feature]: !prev.freeModeFeatures[feature]
      }
    }));
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      console.log('Saving settings:', settings);
      const response = await fetch('/api/admin/app-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ settings }),
      });

      const responseData = await response.json();
      console.log('Save response:', responseData);

      if (!response.ok) {
        // Show detailed error message including instructions
        throw new Error(responseData.error + (responseData.details ? '\n\n' + responseData.details : ''));
      }

      // Clear localStorage cache so frontend picks up new settings immediately
      if (typeof window !== 'undefined') {
        localStorage.removeItem('app_settings');
        // Broadcast settings change to all open tabs
        window.dispatchEvent(new CustomEvent('app-settings-updated'));
        // Also use BroadcastChannel for cross-tab communication
        try {
          const channel = new BroadcastChannel('app-settings');
          channel.postMessage({ type: 'settings-updated' });
          channel.close();
        } catch (e) {
          // BroadcastChannel not supported in some browsers
        }
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">App Settings</h1>

        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {success && (
          <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">Settings saved successfully!</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {/* Free Mode Toggle */}
          <div className="px-4 py-5 sm:p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Free Mode</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Enable free access to basic features for all visitors. Premium features will still require registration and login.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleFreeMode}
                className={`${
                  settings.freeMode ? 'bg-indigo-600' : 'bg-gray-200'
                } relative inline-flex flex-shrink-0 h-8 w-14 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              >
                <span className="sr-only">Enable free mode</span>
                <span
                  className={`${
                    settings.freeMode ? 'translate-x-6' : 'translate-x-0'
                  } pointer-events-none inline-block h-7 w-7 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                />
              </button>
            </div>

            {settings.freeMode && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-blue-800">Free Mode Enabled</h4>
                    <p className="mt-1 text-sm text-blue-700">
                      Visitors can access basic features without creating an account. Premium features remain locked behind authentication.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Free Mode Features Configuration */}
          {settings.freeMode && (
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Available Features in Free Mode
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Select which basic features are available to visitors without authentication.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">QR Code Generation</h4>
                    <p className="text-xs text-gray-500">Allow visitors to generate basic QR codes</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleFeature('qrCodeGeneration')}
                    className={`${
                      settings.freeModeFeatures.qrCodeGeneration ? 'bg-green-600' : 'bg-gray-200'
                    } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}
                  >
                    <span
                      className={`${
                        settings.freeModeFeatures.qrCodeGeneration ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">Barcode Generation</h4>
                    <p className="text-xs text-gray-500">Allow visitors to generate basic barcodes</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleFeature('barcodeGeneration')}
                    className={`${
                      settings.freeModeFeatures.barcodeGeneration ? 'bg-green-600' : 'bg-gray-200'
                    } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}
                  >
                    <span
                      className={`${
                        settings.freeModeFeatures.barcodeGeneration ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">Basic Templates</h4>
                    <p className="text-xs text-gray-500">Allow access to standard templates (premium templates require login)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleFeature('basicTemplates')}
                    className={`${
                      settings.freeModeFeatures.basicTemplates ? 'bg-green-600' : 'bg-gray-200'
                    } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}
                  >
                    <span
                      className={`${
                        settings.freeModeFeatures.basicTemplates ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">Basic Export Formats</h4>
                    <p className="text-xs text-gray-500">Allow PNG exports (SVG, PDF require login)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleFeature('basicFormats')}
                    className={`${
                      settings.freeModeFeatures.basicFormats ? 'bg-green-600' : 'bg-gray-200'
                    } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}
                  >
                    <span
                      className={`${
                        settings.freeModeFeatures.basicFormats ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-yellow-800">Premium Features Always Require Login</h4>
                    <p className="mt-1 text-sm text-yellow-700">
                      Features like bulk generation, AI customization, analytics, custom branding, and advanced templates always require users to be registered and logged in, regardless of free mode settings.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="px-4 py-4 sm:px-6 bg-gray-50">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>

        {/* Information Section */}
        <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-3">How Free Mode Works</h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span><strong>Visitors</strong> can use basic features without creating an account</span>
              </p>
              <p className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span><strong>Registered users</strong> get access to premium features based on their subscription tier</span>
              </p>
              <p className="flex items-start">
                <span className="text-blue-500 mr-2">ⓘ</span>
                <span><strong>Premium features</strong> (bulk generation, AI, analytics, etc.) always require authentication</span>
              </p>
              <p className="flex items-start">
                <span className="text-blue-500 mr-2">ⓘ</span>
                <span><strong>Free mode</strong> is perfect for demos, trials, or freemium business models</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
