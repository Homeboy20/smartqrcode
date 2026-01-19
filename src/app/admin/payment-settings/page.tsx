'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { 
  StripeCredentials, 
  PayPalCredentials, 
  FlutterwaveCredentials,
  PaystackCredentials 
} from '@/lib/types';

export default function PaymentSettingsPage() {
  const { session } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState<'stripe' | 'paypal' | 'flutterwave' | 'paystack'>('paystack');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);
  const [capabilitiesData, setCapabilitiesData] = useState<any>(null);
  const [capabilitiesCountry, setCapabilitiesCountry] = useState('');
  const [capabilitiesCurrency, setCapabilitiesCurrency] = useState('');
  const [capabilitiesCopied, setCapabilitiesCopied] = useState(false);
  
  // Credentials state
  const [stripeCredentials, setStripeCredentials] = useState<StripeCredentials>({
    secretKey: '',
    publicKey: '',
    webhookSecret: '',
    pricePro: '',
    priceBusiness: ''
  });
  
  const [paypalCredentials, setPaypalCredentials] = useState<PayPalCredentials>({
    clientId: '',
    clientSecret: '',
    planIdPro: '',
    planIdBusiness: ''
  });
  
  const [flutterwaveCredentials, setFlutterwaveCredentials] = useState<FlutterwaveCredentials>({
    clientId: '',
    clientSecret: '',
    encryptionKey: '',
    webhookSecretHash: '',
    allowedCountries: ''
  });
  
  const [paystackCredentials, setPaystackCredentials] = useState<PaystackCredentials>({
    publicKey: '',
    secretKey: '',
    planCodePro: '',
    planCodeBusiness: '',
    planCodeProKes: '',
    planCodeBusinessKes: '',
    allowedCountries: ''
  });
  
  const [providersStatus, setProvidersStatus] = useState({
    stripe: false,
    paypal: false,
    flutterwave: false,
    paystack: false
  });

  const [migrating, setMigrating] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);

  // Get the base URL (client-side)
  const [baseUrl, setBaseUrl] = useState('');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  // Fetch existing payment credentials
  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        setLoading(true);

        const accessToken = session?.access_token;
        if (!accessToken) {
          throw new Error('Authentication required');
        }
        
        const response = await fetch('/api/admin/payment-settings', {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            Authorization: `Bearer ${accessToken}`,
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch payment settings');
        }
        
        const data = await response.json();
        
        // Update provider status
        setProvidersStatus({
          stripe: !!data.stripe?.isActive,
          paypal: !!data.paypal?.isActive,
          flutterwave: !!data.flutterwave?.isActive,
          paystack: !!data.paystack?.isActive
        });
        
        // Set credentials if they exist
        if (data.stripe?.credentials) {
          setStripeCredentials(data.stripe.credentials);
        }
        
        if (data.paypal?.credentials) {
          setPaypalCredentials(data.paypal.credentials);
        }
        
        if (data.flutterwave?.credentials) {
          setFlutterwaveCredentials(data.flutterwave.credentials);
        }
        
        if (data.paystack?.credentials) {
          setPaystackCredentials(data.paystack.credentials);
        }
        
      } catch (err) {
        console.error('Error fetching payment settings:', err);
        setError('Failed to load payment settings');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCredentials();
  }, [session]);

  const fetchCapabilities = async (options?: { country?: string; currency?: string }) => {
    setCapabilitiesLoading(true);
    setCapabilitiesError(null);
    try {
      const params = new URLSearchParams();
      const country = (options?.country || '').trim().toUpperCase();
      const currency = (options?.currency || '').trim().toUpperCase();
      if (country) params.set('country', country);
      if (currency) params.set('currency', currency);

      const url = params.toString()
        ? `/api/gateways/capabilities?${params.toString()}`
        : '/api/gateways/capabilities';

      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(String((data as any)?.error || `Failed to load capabilities (HTTP ${res.status})`));
      }
      setCapabilitiesData(data);
    } catch (err: any) {
      setCapabilitiesError(String(err?.message || 'Failed to load gateway capabilities'));
    } finally {
      setCapabilitiesLoading(false);
    }
  };

  const copyCapabilitiesJson = async () => {
    try {
      if (!capabilitiesData) return;
      const text = JSON.stringify(capabilitiesData, null, 2);
      await navigator.clipboard.writeText(text);
      setCapabilitiesCopied(true);
      setTimeout(() => setCapabilitiesCopied(false), 1500);
    } catch (err) {
      setCapabilitiesError('Failed to copy JSON to clipboard');
    }
  };

  useEffect(() => {
    // Best-effort fetch; this endpoint is safe (no secrets) and helps admins confirm what is allowed.
    fetchCapabilities().catch(() => {});
  }, []);

  // Save credentials
  const saveCredentials = async (provider: 'stripe' | 'paypal' | 'flutterwave' | 'paystack') => {
    try {
      setSaving(true);
      setError(null);

      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Authentication required');
      }
      
      let credentialsData;
      switch (provider) {
        case 'stripe':
          credentialsData = stripeCredentials;
          break;
        case 'paypal':
          credentialsData = paypalCredentials;
          break;
        case 'flutterwave':
          credentialsData = flutterwaveCredentials;
          break;
        case 'paystack':
          credentialsData = paystackCredentials;
          break;
      }
      
      const response = await fetch('/api/admin/payment-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          provider,
          isActive: providersStatus[provider],
          credentials: credentialsData
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save credentials');
      }
      
      setSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error(`Error saving ${provider} credentials:`, err);
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  // Toggle provider status
  const toggleProviderStatus = (provider: 'stripe' | 'paypal' | 'flutterwave' | 'paystack') => {
    setProvidersStatus(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };

  // Handle input changes
  const handleStripeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setStripeCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handlePayPalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPaypalCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleFlutterwaveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFlutterwaveCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handlePaystackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPaystackCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Testing a connection
  const testConnection = async (provider: 'stripe' | 'paypal' | 'flutterwave' | 'paystack') => {
    try {
      setLoading(true);
      setError(null);

      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Authentication required');
      }
      
      const credentialsForTest = (() => {
        if (provider === 'paystack') {
          return {
            publicKey: paystackCredentials.publicKey,
            secretKey: paystackCredentials.secretKey,
          };
        }
        if (provider === 'flutterwave') {
          return {
            clientId: flutterwaveCredentials.clientId,
            clientSecret: flutterwaveCredentials.clientSecret,
            encryptionKey: flutterwaveCredentials.encryptionKey,
            webhookSecretHash: flutterwaveCredentials.webhookSecretHash || '',
          };
        }
        if (provider === 'stripe') {
          return {
            secretKey: stripeCredentials.secretKey,
          };
        }
        if (provider === 'paypal') {
          return {
            clientId: paypalCredentials.clientId,
            clientSecret: paypalCredentials.clientSecret,
          };
        }
        return null;
      })();

      const response = await fetch('/api/admin/payment-settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          provider,
          // Allow testing with the currently-entered values to avoid relying on
          // decrypting old stored credentials (common when encryption key rotated).
          credentials: credentialsForTest,
        }),
      });
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        const raw = await response.text();
        const payload = contentType.includes('application/json') && raw ? JSON.parse(raw) : null;

        const message =
          String(payload?.error || raw || 'Connection test failed').trim() || 'Connection test failed';

        // Make the common encryption failure actionable for admins.
        if (message.toLowerCase().includes('could not be decrypted')) {
          throw new Error(
            message +
              '\n\nFix: set CREDENTIALS_ENCRYPTION_KEY (or CREDENTIALS_ENCRYPTION_KEYS) to the original key used to save credentials, or re-enter and save new credentials to re-encrypt them.'
          );
        }

        throw new Error(message);
      }
      
      alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} connection test successful!`);
      
    } catch (err) {
      console.error(`Error testing ${provider} connection:`, err);
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setLoading(false);
    }
  };

  const migrateEncryption = async () => {
    try {
      setMigrating(true);
      setMigrationMessage(null);
      setError(null);

      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/admin/payment-settings/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Migration failed');
      }

      const scanned = typeof payload?.scanned === 'number' ? payload.scanned : 0;
      const updated = typeof payload?.updated === 'number' ? payload.updated : 0;
      setMigrationMessage(`Encryption migration complete: scanned ${scanned}, updated ${updated}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  // Copy webhook URL to clipboard
  const copyWebhookUrl = async (provider: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedWebhook(provider);
      setTimeout(() => setCopiedWebhook(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Webhook URL component
  const WebhookUrlDisplay = ({ provider, url }: { provider: string; url: string }) => (
    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-medium text-blue-800">Webhook URL</h4>
          <p className="mt-1 text-xs text-blue-700">
            Configure this webhook URL in your {provider} dashboard to receive payment notifications.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-blue-300 rounded px-3 py-2 text-gray-800 font-mono break-all">
              {url || 'Loading...'}
            </code>
            <button
              type="button"
              onClick={() => copyWebhookUrl(provider, url)}
              disabled={!url}
              className="flex-shrink-0 inline-flex items-center px-3 py-2 border border-blue-300 text-xs font-medium rounded text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copiedWebhook === provider ? (
                <>
                  <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Tabs for different payment providers
  const renderTabs = () => (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        <button
          onClick={() => setActiveTab('paystack')}
          className={`${
            activeTab === 'paystack'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
        >
          <span className={`w-2 h-2 rounded-full ${providersStatus.paystack ? 'bg-green-500' : 'bg-gray-300'}`}></span>
          Paystack
        </button>
        <button
          onClick={() => setActiveTab('flutterwave')}
          className={`${
            activeTab === 'flutterwave'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
        >
          <span className={`w-2 h-2 rounded-full ${providersStatus.flutterwave ? 'bg-green-500' : 'bg-gray-300'}`}></span>
          Flutterwave
        </button>
        <button
          onClick={() => setActiveTab('stripe')}
          className={`${
            activeTab === 'stripe'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
        >
          <span className={`w-2 h-2 rounded-full ${providersStatus.stripe ? 'bg-green-500' : 'bg-gray-300'}`}></span>
          Stripe
        </button>
        <button
          onClick={() => setActiveTab('paypal')}
          className={`${
            activeTab === 'paypal'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
        >
          <span className={`w-2 h-2 rounded-full ${providersStatus.paypal ? 'bg-green-500' : 'bg-gray-300'}`}></span>
          PayPal
        </button>
      </nav>
    </div>
  );

  // Gateway overview with toggles
  const renderGatewayOverview = () => (
    <div className="bg-white shadow rounded-lg mb-6">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Payment Gateways Status</h3>
        <p className="text-sm text-gray-500 mb-6">Enable or disable payment gateways. Only enabled gateways will be available for checkout.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Paystack */}
          <div className={`p-4 rounded-lg border-2 ${providersStatus.paystack ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <svg className="h-6 w-6 text-indigo-600 mr-2" viewBox="0 0 512 512" fill="currentColor">
                  <path d="M85 128c-15 0-27 12-27 27v202c0 15 12 27 27 27h342c15 0 27-12 27-27V155c0-15-12-27-27-27H85zm0-32h342c33 0 59 26 59 59v202c0 33-26 59-59 59H85c-33 0-59-26-59-59V155c0-33 26-59 59-59z" />
                </svg>
                <span className="font-medium text-gray-900">Paystack</span>
              </div>
              <button
                type="button"
                onClick={() => toggleProviderStatus('paystack')}
                className={`${
                  providersStatus.paystack ? 'bg-green-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
              >
                <span className={`${
                  providersStatus.paystack ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
              </button>
            </div>
            <p className="text-xs text-gray-500">Cards, Bank, USSD (Africa)</p>
          </div>

          {/* Flutterwave */}
          <div className={`p-4 rounded-lg border-2 ${providersStatus.flutterwave ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <svg className="h-6 w-6 text-orange-500 mr-2" viewBox="0 0 1000 321" fill="currentColor">
                  <path d="M143.7 270.7L370.2 0H225.6L0 270.7h143.7zM370.7 270.7L483 125.2h-84.4l-91.4.3v145.2h63.5z"/>
                </svg>
                <span className="font-medium text-gray-900">Flutterwave</span>
              </div>
              <button
                type="button"
                onClick={() => toggleProviderStatus('flutterwave')}
                className={`${
                  providersStatus.flutterwave ? 'bg-green-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
              >
                <span className={`${
                  providersStatus.flutterwave ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
              </button>
            </div>
            <p className="text-xs text-gray-500">Multiple payment methods (Africa)</p>
          </div>

          {/* Stripe */}
          <div className={`p-4 rounded-lg border-2 ${providersStatus.stripe ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <svg className="h-6 w-6 text-blue-500 mr-2" viewBox="0 0 60 25" fill="currentColor">
                  <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v2.94c-1.32.81-2.96 1.18-4.86 1.18-4.13 0-7.05-2.94-7.05-7.45 0-3.9 2.4-7.41 6.79-7.41 3.98 0 6.17 3.14 6.17 7.28 0 .36 0 1.08-.24 1.86z"/>
                </svg>
                <span className="font-medium text-gray-900">Stripe</span>
              </div>
              <button
                type="button"
                onClick={() => toggleProviderStatus('stripe')}
                className={`${
                  providersStatus.stripe ? 'bg-green-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
              >
                <span className={`${
                  providersStatus.stripe ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
              </button>
            </div>
            <p className="text-xs text-gray-500">Cards (Global)</p>
          </div>

          {/* PayPal */}
          <div className={`p-4 rounded-lg border-2 ${providersStatus.paypal ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <svg className="h-6 w-6 text-blue-700 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/>
                </svg>
                <span className="font-medium text-gray-900">PayPal</span>
              </div>
              <button
                type="button"
                onClick={() => toggleProviderStatus('paypal')}
                className={`${
                  providersStatus.paypal ? 'bg-green-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
              >
                <span className={`${
                  providersStatus.paypal ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
              </button>
            </div>
            <p className="text-xs text-gray-500">PayPal account (Global)</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Payment Settings</h1>

        {migrationMessage && (
          <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{migrationMessage}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">Encryption</h3>
            <p className="text-sm text-gray-500 mb-4">Re-encrypt any legacy plaintext secrets stored in payment settings.</p>
            <button
              type="button"
              onClick={migrateEncryption}
              disabled={migrating}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {migrating ? 'Encrypting...' : 'Encrypt Existing Secrets'}
            </button>
          </div>
        </div>
        
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
                <p className="text-sm text-green-700">Credentials saved successfully!</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Gateway Overview with Toggle Buttons */}
        {renderGatewayOverview()}

        {/* Gateway Capabilities (runtime audit, no secrets) */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-1">Gateway Capabilities</h3>
                <p className="text-sm text-gray-500">
                  Confirms which providers/currencies/countries are allowed at runtime (based on your configuration + enforcement rules).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyCapabilitiesJson}
                  disabled={!capabilitiesData}
                  className="inline-flex justify-center py-2 px-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-900 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Copy the JSON response (no secrets)"
                >
                  {capabilitiesCopied ? 'Copied' : 'Copy JSON'}
                </button>
                <button
                  type="button"
                  onClick={() => fetchCapabilities({ country: capabilitiesCountry, currency: capabilitiesCurrency })}
                  disabled={capabilitiesLoading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {capabilitiesLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Country (optional)</label>
                <input
                  value={capabilitiesCountry}
                  onChange={(e) => setCapabilitiesCountry(e.target.value)}
                  placeholder="e.g. NG"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Currency (optional)</label>
                <input
                  value={capabilitiesCurrency}
                  onChange={(e) => setCapabilitiesCurrency(e.target.value)}
                  placeholder="e.g. NGN"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {capabilitiesError && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {capabilitiesError}
              </div>
            )}

            {capabilitiesData?.providers && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enabled</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Countries</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin countries</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currencies</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Methods</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider-native</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(['flutterwave', 'paystack'] as const)
                      .filter((p) => capabilitiesData.providers[p])
                      .map((p) => {
                        const row = capabilitiesData.providers[p];
                        const enabled = Boolean(row?.enabled);
                        const enabledReason = row?.enablementReason;
                        const adminCountries = Array.isArray(row?.configuredAllowedCountries)
                          ? row.configuredAllowedCountries
                          : [];
                        const countries = row?.supportedCountries;
                        const currencies = Array.isArray(row?.supportedCurrencies) ? row.supportedCurrencies : [];
                        const methods = Array.isArray(row?.supportedPaymentMethods) ? row.supportedPaymentMethods : [];
                        const native = row?.providerNative;
                        const nativeSummary =
                          p === 'flutterwave'
                            ? native?.flutterwave?.paymentOptions?.any
                            : p === 'paystack'
                              ? Array.isArray(native?.paystack?.channels?.any)
                                ? native.paystack.channels.any.join(', ')
                                : null
                              : null;
                        return (
                          <tr key={p}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{p}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                                {enabled ? 'Enabled' : 'Disabled'}
                              </span>
                              {!enabled && enabledReason && (
                                <div className="mt-1 text-xs text-gray-600">{String(enabledReason)}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {countries === 'ALL' ? 'ALL' : Array.isArray(countries) ? countries.join(', ') : '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {adminCountries.length ? adminCountries.join(', ') : '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{currencies.length ? currencies.join(', ') : '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{methods.length ? methods.join(', ') : '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {nativeSummary ? (
                                <code className="text-xs break-words">{String(nativeSummary)}</code>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {capabilitiesData?.context?.eligibility && (
              <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
                <div className="font-semibold mb-2">
                  Eligibility for {String(capabilitiesData.context.countryCode)} / {String(capabilitiesData.context.currency)}
                </div>
                <div className="space-y-1">
                  {Object.entries(capabilitiesData.context.eligibility).map(([provider, info]: any) => (
                    <div key={provider} className="flex items-start justify-between gap-3">
                      <div className="font-medium">{provider}</div>
                      <div className="flex-1 text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${info?.allowed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                          {info?.allowed ? 'Allowed' : 'Not allowed'}
                        </span>
                        {!info?.allowed && info?.reason && (
                          <div className="text-xs text-gray-600 mt-1">{info.reason}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {capabilitiesData?.context?.paymentMethods && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="font-semibold mb-2">Allowed checkout methods (context)</div>
                    <div className="space-y-1">
                      {Object.entries(capabilitiesData.context.paymentMethods).map(([provider, methods]: any) => (
                        <div key={provider} className="flex items-start justify-between gap-3">
                          <div className="font-medium">{provider}</div>
                          <div className="flex-1 text-right text-xs text-gray-700">
                            {Array.isArray(methods) && methods.length ? methods.join(', ') : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {renderTabs()}
          
          <div className="p-4 sm:p-6">
            {activeTab === 'stripe' && (
              <div>
                <div className="mb-4 flex items-center">
                  <h2 className="text-lg font-medium text-gray-900">Stripe Payment Settings</h2>
                  <div className="ml-auto flex items-center">
                    <span className="mr-2 text-sm text-gray-500">Active</span>
                    <button
                      type="button"
                      className={`${
                        providersStatus.stripe ? 'bg-indigo-600' : 'bg-gray-200'
                      } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}
                      onClick={() => toggleProviderStatus('stripe')}
                    >
                      <span className={`${
                        providersStatus.stripe ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition ease-in-out duration-200`}></span>
                    </button>
                  </div>
                </div>
                
                <div className="mt-5 border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-500 mb-4">
                    Enter your Stripe API credentials. These will be stored securely and used for payment processing.
                  </p>
                  
                  <WebhookUrlDisplay 
                    provider="Stripe" 
                    url={baseUrl ? `${baseUrl}/api/webhooks/stripe` : ''} 
                  />
                  
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor="secretKey" className="block text-sm font-medium text-gray-700">
                        Secret Key
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="secretKey"
                          id="secretKey"
                          autoComplete="off"
                          value={stripeCredentials.secretKey}
                          onChange={handleStripeChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="publicKey" className="block text-sm font-medium text-gray-700">
                        Public Key
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="publicKey"
                          id="publicKey"
                          autoComplete="off"
                          value={stripeCredentials.publicKey}
                          onChange={handleStripeChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-4">
                      <label htmlFor="webhookSecret" className="block text-sm font-medium text-gray-700">
                        Webhook Secret
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="webhookSecret"
                          id="webhookSecret"
                          autoComplete="off"
                          value={stripeCredentials.webhookSecret}
                          onChange={handleStripeChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="pricePro" className="block text-sm font-medium text-gray-700">
                        Pro Plan Price ID
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="pricePro"
                          id="pricePro"
                          value={stripeCredentials.pricePro}
                          onChange={handleStripeChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="priceBusiness" className="block text-sm font-medium text-gray-700">
                        Business Plan Price ID
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="priceBusiness"
                          id="priceBusiness"
                          value={stripeCredentials.priceBusiness}
                          onChange={handleStripeChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => testConnection('stripe')}
                      disabled={saving || !stripeCredentials.secretKey || !stripeCredentials.publicKey}
                      className="mr-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                      Test Connection
                    </button>
                    <button
                      type="button"
                      onClick={() => saveCredentials('stripe')}
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                    >
                      {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'paypal' && (
              <div>
                <div className="mb-4 flex items-center">
                  <h2 className="text-lg font-medium text-gray-900">PayPal Payment Settings</h2>
                  <div className="ml-auto flex items-center">
                    <span className="mr-2 text-sm text-gray-500">Active</span>
                    <button
                      type="button"
                      className={`${
                        providersStatus.paypal ? 'bg-indigo-600' : 'bg-gray-200'
                      } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}
                      onClick={() => toggleProviderStatus('paypal')}
                    >
                      <span className={`${
                        providersStatus.paypal ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition ease-in-out duration-200`}></span>
                    </button>
                  </div>
                </div>
                
                <div className="mt-5 border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-500 mb-4">
                    Enter your PayPal API credentials. These will be stored securely and used for payment processing.
                  </p>
                  
                  <WebhookUrlDisplay 
                    provider="PayPal" 
                    url={baseUrl ? `${baseUrl}/api/webhooks/paypal` : ''} 
                  />
                  
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor="clientId" className="block text-sm font-medium text-gray-700">
                        Client ID
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="clientId"
                          id="clientId"
                          autoComplete="off"
                          value={paypalCredentials.clientId}
                          onChange={handlePayPalChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="clientSecret" className="block text-sm font-medium text-gray-700">
                        Client Secret
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="clientSecret"
                          id="clientSecret"
                          autoComplete="off"
                          value={paypalCredentials.clientSecret}
                          onChange={handlePayPalChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="planIdPro" className="block text-sm font-medium text-gray-700">
                        Pro Plan ID
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="planIdPro"
                          id="planIdPro"
                          value={paypalCredentials.planIdPro}
                          onChange={handlePayPalChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="planIdBusiness" className="block text-sm font-medium text-gray-700">
                        Business Plan ID
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="planIdBusiness"
                          id="planIdBusiness"
                          value={paypalCredentials.planIdBusiness}
                          onChange={handlePayPalChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => testConnection('paypal')}
                      disabled={saving || !paypalCredentials.clientId || !paypalCredentials.clientSecret}
                      className="mr-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                      Test Connection
                    </button>
                    <button
                      type="button"
                      onClick={() => saveCredentials('paypal')}
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                    >
                      {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'flutterwave' && (
              <div>
                <div className="mb-4 flex items-center">
                  <h2 className="text-lg font-medium text-gray-900">Flutterwave Payment Settings (V4 API)</h2>
                  <div className="ml-auto flex items-center">
                    <span className="mr-2 text-sm text-gray-500">Active</span>
                    <button
                      type="button"
                      className={`${
                        providersStatus.flutterwave ? 'bg-indigo-600' : 'bg-gray-200'
                      } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}
                      onClick={() => toggleProviderStatus('flutterwave')}
                    >
                      <span className={`${
                        providersStatus.flutterwave ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition ease-in-out duration-200`}></span>
                    </button>
                  </div>
                </div>
                
                <div className="mt-5 border-t border-gray-200 pt-4">
                  <div className="mb-4 bg-blue-50 border-l-4 border-blue-400 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-700">
                          <strong>Flutterwave V4 API Integration</strong><br/>
                          ✅ Automatic customer management<br/>
                          ✅ Multiple payment methods (Card, Mobile Money, Bank Transfer, USSD)<br/>
                          ✅ Transaction verification and fee calculation<br/>
                          ✅ Search and update customer records
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-4">
                    Enter your Flutterwave V4 API credentials. Get your keys from <a href="https://developer.flutterwave.com/reference" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-500">Flutterwave Dashboard</a>.
                  </p>
                  
                  <WebhookUrlDisplay 
                    provider="Flutterwave" 
                    url={baseUrl ? `${baseUrl}/api/webhooks/flutterwave` : ''} 
                  />
                  
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor="clientId" className="block text-sm font-medium text-gray-700">
                        Client ID
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="clientId"
                          id="clientId"
                          autoComplete="off"
                          value={flutterwaveCredentials.clientId}
                          onChange={handleFlutterwaveChange}
                          placeholder="FLWCLIENTID-xxx"
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="clientSecret" className="block text-sm font-medium text-gray-700">
                        Client Secret
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="clientSecret"
                          id="clientSecret"
                          autoComplete="off"
                          value={flutterwaveCredentials.clientSecret}
                          onChange={handleFlutterwaveChange}
                          placeholder="FLWSECK-xxx"
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="encryptionKey" className="block text-sm font-medium text-gray-700">
                        Encryption Key
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="encryptionKey"
                          id="encryptionKey"
                          autoComplete="off"
                          value={flutterwaveCredentials.encryptionKey}
                          onChange={handleFlutterwaveChange}
                          placeholder="FLWSECK_TESTxxx"
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="webhookSecretHash" className="block text-sm font-medium text-gray-700">
                        Webhook Secret Hash
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="webhookSecretHash"
                          id="webhookSecretHash"
                          autoComplete="off"
                          value={flutterwaveCredentials.webhookSecretHash || ''}
                          onChange={handleFlutterwaveChange}
                          placeholder="Set in Flutterwave dashboard (Secret Hash)"
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Used to verify incoming webhook signatures.
                      </p>
                    </div>

                    <div className="sm:col-span-6">
                      <label htmlFor="flutterwaveAllowedCountries" className="block text-sm font-medium text-gray-700">
                        Allowed Countries (optional)
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="allowedCountries"
                          id="flutterwaveAllowedCountries"
                          placeholder="e.g. NG, GH, ZA (leave blank to allow all)"
                          value={flutterwaveCredentials.allowedCountries || ''}
                          onChange={handleFlutterwaveChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Comma-separated ISO country codes. If set, checkout will only allow Flutterwave for these countries.
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => testConnection('flutterwave')}
                      disabled={saving || !flutterwaveCredentials.clientId || !flutterwaveCredentials.clientSecret}
                      className="mr-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                      Test Connection
                    </button>
                    <button
                      type="button"
                      onClick={() => saveCredentials('flutterwave')}
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                    >
                      {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'paystack' && (
              <div>
                <div className="mb-4 flex items-center">
                  <h2 className="text-lg font-medium text-gray-900">Paystack Payment Settings</h2>
                  <div className="ml-auto flex items-center">
                    <span className="mr-2 text-sm text-gray-500">Active</span>
                    <button
                      type="button"
                      className={`${
                        providersStatus.paystack ? 'bg-indigo-600' : 'bg-gray-200'
                      } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}
                      onClick={() => toggleProviderStatus('paystack')}
                    >
                      <span className={`${
                        providersStatus.paystack ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition ease-in-out duration-200`}></span>
                    </button>
                  </div>
                </div>
                
                <div className="mt-5 border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-500 mb-4">
                    Enter your Paystack API credentials. These will be stored securely and used for payment processing.
                    Get your API keys from <a href="https://dashboard.paystack.com/#/settings/developers" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-500">Paystack Dashboard</a>.
                  </p>
                  
                  <WebhookUrlDisplay 
                    provider="Paystack" 
                    url={baseUrl ? `${baseUrl}/api/webhooks/paystack` : ''} 
                  />
                  
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor="paystackPublicKey" className="block text-sm font-medium text-gray-700">
                        Public Key
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="publicKey"
                          id="paystackPublicKey"
                          autoComplete="off"
                          placeholder="pk_live_... or pk_test_..."
                          value={paystackCredentials.publicKey}
                          onChange={handlePaystackChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="paystackSecretKey" className="block text-sm font-medium text-gray-700">
                        Secret Key
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          name="secretKey"
                          id="paystackSecretKey"
                          autoComplete="off"
                          placeholder="sk_live_... or sk_test_..."
                          value={paystackCredentials.secretKey}
                          onChange={handlePaystackChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="planCodePro" className="block text-sm font-medium text-gray-700">
                        Pro Plan Code
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="planCodePro"
                          id="planCodePro"
                          placeholder="PLN_..."
                          value={paystackCredentials.planCodePro}
                          onChange={handlePaystackChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Create subscription plans in Paystack Dashboard → Products → Plans
                      </p>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="planCodeBusiness" className="block text-sm font-medium text-gray-700">
                        Business Plan Code
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="planCodeBusiness"
                          id="planCodeBusiness"
                          placeholder="PLN_..."
                          value={paystackCredentials.planCodeBusiness}
                          onChange={handlePaystackChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-6">
                      <label htmlFor="paystackAllowedCountries" className="block text-sm font-medium text-gray-700">
                        Allowed Countries (optional)
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="allowedCountries"
                          id="paystackAllowedCountries"
                          placeholder="e.g. NG, GH, ZA (leave blank to use default supported countries)"
                          value={paystackCredentials.allowedCountries || ''}
                          onChange={handlePaystackChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Comma-separated ISO country codes. If set, checkout will only allow Paystack for these countries.
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => testConnection('paystack')}
                      disabled={saving || !paystackCredentials.publicKey || !paystackCredentials.secretKey}
                      className="mr-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                      Test Connection
                    </button>
                    <button
                      type="button"
                      onClick={() => saveCredentials('paystack')}
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                    >
                      {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-gray-50 px-4 py-5 sm:p-6">
            <div className="text-sm text-gray-500">
              <p className="font-medium text-gray-700 mb-1">Security Information</p>
              <p>
                Payment provider credentials are encrypted before being stored in the database. 
                The encryption key is stored securely on the server and not accessible from client-side code.
              </p>
              <p className="mt-2">
                We recommend regularly rotating your API credentials as a security best practice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 