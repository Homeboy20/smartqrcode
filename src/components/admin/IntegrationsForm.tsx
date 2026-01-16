'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';

// Define types for integration settings
interface FlutterwaveSettings {
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
  webhookSecretHash: string;
}

interface PayPalSettings {
  clientId: string;
  clientSecret: string;
}

interface StripeSettings {
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
}

interface PaystackSettings {
  publicKey: string;
  secretKey: string;
  planCodePro: string;
  planCodeBusiness: string;
}

interface GooglePaySettings {
  merchantId: string;
  merchantName: string;
}

interface IntegrationSettings {
  flutterwave: FlutterwaveSettings;
  paypal: PayPalSettings;
  stripe: StripeSettings;
  paystack: PaystackSettings;
  googlePay: GooglePaySettings;
}

type ActiveTab = 'flutterwave' | 'paypal' | 'stripe' | 'paystack' | 'googlePay';

type ProviderStatus = Record<Exclude<ActiveTab, 'googlePay'>, boolean>;

const emptySettings: IntegrationSettings = {
  flutterwave: { clientId: '', clientSecret: '', encryptionKey: '', webhookSecretHash: '' },
  paypal: { clientId: '', clientSecret: '' },
  stripe: { publicKey: '', secretKey: '', webhookSecret: '' },
  paystack: { publicKey: '', secretKey: '', planCodePro: '', planCodeBusiness: '' },
  googlePay: { merchantId: '', merchantName: '' },
};

const emptyStatus: ProviderStatus = {
  flutterwave: false,
  paypal: false,
  stripe: false,
  paystack: false,
};

const isSaveableProvider = (tab: ActiveTab): tab is Exclude<ActiveTab, 'googlePay'> => tab !== 'googlePay';

export default function IntegrationsForm() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('flutterwave');
  const [settings, setSettings] = useState<IntegrationSettings>(emptySettings);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>(emptyStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch current integration settings on mount (from payment_settings)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const idToken = user && 'getIdToken' in user ? await user.getIdToken() : null;
        if (!idToken) {
          throw new Error('Authentication required');
        }

        const response = await fetch('/api/admin/payment-settings', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load payment settings');
        }

        const data = await response.json();
        if (cancelled) return;

        setProviderStatus({
          stripe: Boolean(data?.stripe?.isActive),
          paypal: Boolean(data?.paypal?.isActive),
          flutterwave: Boolean(data?.flutterwave?.isActive),
          paystack: Boolean(data?.paystack?.isActive),
        });

        setSettings(prev => ({
          ...prev,
          stripe: { ...emptySettings.stripe, ...(data?.stripe?.credentials ?? {}) },
          paypal: { ...emptySettings.paypal, ...(data?.paypal?.credentials ?? {}) },
          flutterwave: { ...emptySettings.flutterwave, ...(data?.flutterwave?.credentials ?? {}) },
          paystack: { ...emptySettings.paystack, ...(data?.paystack?.credentials ?? {}) },
        }));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (user) load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleInputChange = (gateway: keyof IntegrationSettings, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [gateway]: {
        ...prev[gateway],
        [name]: value,
      }
    }));
  };

  const handleSaveIntegrations = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!isSaveableProvider(activeTab)) {
      setLoading(false);
      setError('Google Pay settings are not supported here yet.');
      return;
    }

    try {
      const idToken = user && 'getIdToken' in user ? await user.getIdToken() : null;
      if (!idToken) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/admin/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          provider: activeTab,
          isActive: providerStatus[activeTab],
          credentials: settings[activeTab],
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save integration settings');
      }

      setSuccess('Integration settings saved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  // Consistent input field style
  const inputStyle = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
  const labelStyle = "block text-sm font-medium text-gray-700";

  const renderTabContent = () => {
    switch (activeTab) {
      case 'flutterwave':
        return (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-800">Flutterwave Settings</h3>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={providerStatus.flutterwave}
                onChange={(e) => setProviderStatus(prev => ({ ...prev, flutterwave: e.target.checked }))}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              Enabled
            </label>
            <div>
              <label htmlFor="fwClientId" className={labelStyle}>Public Key</label>
              <input type="text" id="fwClientId" name="clientId" value={settings.flutterwave.clientId} onChange={(e) => handleInputChange('flutterwave', e)} className={inputStyle} placeholder="FLWPUBK..." />
            </div>
            <div>
              <label htmlFor="fwClientSecret" className={labelStyle}>Secret Key</label>
              <input type="password" id="fwClientSecret" name="clientSecret" value={settings.flutterwave.clientSecret} onChange={(e) => handleInputChange('flutterwave', e)} className={inputStyle} placeholder="FLWSECK..." />
            </div>
            <div>
              <label htmlFor="fwEncryptionKey" className={labelStyle}>Encryption Key</label>
              <input type="password" id="fwEncryptionKey" name="encryptionKey" value={settings.flutterwave.encryptionKey} onChange={(e) => handleInputChange('flutterwave', e)} className={inputStyle} placeholder="Encryption Key" />
            </div>
            <div>
              <label htmlFor="fwWebhookSecretHash" className={labelStyle}>Webhook Secret Hash</label>
              <input type="password" id="fwWebhookSecretHash" name="webhookSecretHash" value={settings.flutterwave.webhookSecretHash} onChange={(e) => handleInputChange('flutterwave', e)} className={inputStyle} placeholder="Your webhook secret hash" />
              <p className="mt-2 text-sm text-gray-500">
                Required for webhook signature verification. Find this in your Flutterwave dashboard under Settings → Webhooks.
              </p>
            </div>
          </div>
        );
      case 'paypal':
        return (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-800">PayPal Settings</h3>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={providerStatus.paypal}
                onChange={(e) => setProviderStatus(prev => ({ ...prev, paypal: e.target.checked }))}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              Enabled
            </label>
            <div>
              <label htmlFor="ppClientId" className={labelStyle}>Client ID</label>
              <input type="text" id="ppClientId" name="clientId" value={settings.paypal.clientId} onChange={(e) => handleInputChange('paypal', e)} className={inputStyle} placeholder="PayPal Client ID" />
            </div>
            <div>
              <label htmlFor="ppClientSecret" className={labelStyle}>Client Secret</label>
              <input type="password" id="ppClientSecret" name="clientSecret" value={settings.paypal.clientSecret} onChange={(e) => handleInputChange('paypal', e)} className={inputStyle} placeholder="PayPal Client Secret" />
            </div>
          </div>
        );
      case 'stripe':
        return (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-800">Stripe Settings</h3>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={providerStatus.stripe}
                onChange={(e) => setProviderStatus(prev => ({ ...prev, stripe: e.target.checked }))}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              Enabled
            </label>
            <div>
              <label htmlFor="stripePublicKey" className={labelStyle}>Publishable Key</label>
              <input type="text" id="stripePublicKey" name="publicKey" value={settings.stripe.publicKey} onChange={(e) => handleInputChange('stripe', e)} className={inputStyle} placeholder="pk_live_..." />
            </div>
            <div>
              <label htmlFor="stripeSecretKey" className={labelStyle}>Secret Key</label>
              <input type="password" id="stripeSecretKey" name="secretKey" value={settings.stripe.secretKey} onChange={(e) => handleInputChange('stripe', e)} className={inputStyle} placeholder="sk_live_..." />
            </div>
             <div>
              <label htmlFor="stripeWebhookSecret" className={labelStyle}>Webhook Signing Secret</label>
              <input type="password" id="stripeWebhookSecret" name="webhookSecret" value={settings.stripe.webhookSecret} onChange={(e) => handleInputChange('stripe', e)} className={inputStyle} placeholder="whsec_..." />
            </div>
          </div>
        );
      case 'paystack':
        return (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-800">Paystack Settings</h3>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={providerStatus.paystack}
                onChange={(e) => setProviderStatus(prev => ({ ...prev, paystack: e.target.checked }))}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              Enabled
            </label>
            <div>
              <label htmlFor="paystackPublicKey" className={labelStyle}>Public Key</label>
              <input type="text" id="paystackPublicKey" name="publicKey" value={settings.paystack.publicKey} onChange={(e) => handleInputChange('paystack', e)} className={inputStyle} placeholder="pk_live_..." />
            </div>
            <div>
              <label htmlFor="paystackSecretKey" className={labelStyle}>Secret Key</label>
              <input type="password" id="paystackSecretKey" name="secretKey" value={settings.paystack.secretKey} onChange={(e) => handleInputChange('paystack', e)} className={inputStyle} placeholder="sk_live_..." />
            </div>
            <div>
              <label htmlFor="paystackPlanCodePro" className={labelStyle}>Plan Code (Pro)</label>
              <input type="text" id="paystackPlanCodePro" name="planCodePro" value={settings.paystack.planCodePro} onChange={(e) => handleInputChange('paystack', e)} className={inputStyle} placeholder="PLN_..." />
            </div>
            <div>
              <label htmlFor="paystackPlanCodeBusiness" className={labelStyle}>Plan Code (Business)</label>
              <input type="text" id="paystackPlanCodeBusiness" name="planCodeBusiness" value={settings.paystack.planCodeBusiness} onChange={(e) => handleInputChange('paystack', e)} className={inputStyle} placeholder="PLN_..." />
            </div>
          </div>
        );
      case 'googlePay':
        return (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-800">Google Pay Settings</h3>
             <div>
              <label htmlFor="gpMerchantId" className={labelStyle}>Merchant ID</label>
              <input type="text" id="gpMerchantId" name="merchantId" value={settings.googlePay.merchantId} onChange={(e) => handleInputChange('googlePay', e)} className={inputStyle} placeholder="Google Pay Merchant ID" />
            </div>
             <div>
              <label htmlFor="gpMerchantName" className={labelStyle}>Merchant Name</label>
              <input type="text" id="gpMerchantName" name="merchantName" value={settings.googlePay.merchantName} onChange={(e) => handleInputChange('googlePay', e)} className={inputStyle} placeholder="Your Merchant Name Displayed to Users" />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const getTabClass = (tabName: ActiveTab) => {
    return `px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors border-b-2 ${activeTab === tabName ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-6 border border-gray-200">
      <h2 className="text-xl font-semibold mb-6 text-gray-800 border-b pb-3">Payment Integrations</h2>
      <form onSubmit={handleSaveIntegrations} className="space-y-6">
        {error && <p className="text-red-600 bg-red-50 p-3 rounded-md text-sm">Error: {error}</p>}
        {success && <p className="text-green-600 bg-green-50 p-3 rounded-md text-sm">{success}</p>}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-1" aria-label="Tabs">
            <button type="button" onClick={() => setActiveTab('flutterwave')} className={getTabClass('flutterwave')}>Flutterwave</button>
            <button type="button" onClick={() => setActiveTab('paypal')} className={getTabClass('paypal')}>PayPal</button>
            <button type="button" onClick={() => setActiveTab('stripe')} className={getTabClass('stripe')}>Stripe</button>
            <button type="button" onClick={() => setActiveTab('paystack')} className={getTabClass('paystack')}>Paystack</button>
            <button type="button" onClick={() => setActiveTab('googlePay')} className={getTabClass('googlePay')}>Google Pay</button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-5 p-4 border border-gray-200 rounded-md bg-gray-50/50 min-h-[200px]">
          {renderTabContent()}
        </div>
        
        {/* Security Note */}
        <p className="text-xs text-red-600 pt-1">Warning: API keys and secrets are sensitive. Ensure your backend handles these securely.</p>

        {/* Save Button */}
        <div className="pt-2 text-right">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Integration Settings'}
          </button>
        </div>
      </form>
    </div>
  );
} 