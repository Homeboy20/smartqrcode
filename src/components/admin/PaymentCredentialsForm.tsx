'use client';

import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { PaymentGatewayConfig, defaultGatewayConfig, getGatewayConfig, saveGatewayConfig } from '@/lib/firestore';

interface PaymentCredentials {
  // Stripe
  STRIPE_SECRET_KEY: string;
  NEXT_PUBLIC_STRIPE_PUBLIC_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID_PRO: string;
  STRIPE_PRICE_ID_BUSINESS: string;
  
  // PayPal
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_PLAN_ID_PRO: string;
  PAYPAL_PLAN_ID_BUSINESS: string;
  
  // Flutterwave
  FLUTTERWAVE_PUBLIC_KEY: string;
  FLUTTERWAVE_SECRET_KEY: string;
  FLUTTERWAVE_ENCRYPTION_KEY: string;
  
  // Paystack
  PAYSTACK_PUBLIC_KEY: string;
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_PLAN_CODE_PRO: string;
  PAYSTACK_PLAN_CODE_BUSINESS: string;
  
  // Allow for dynamic indexing
  [key: string]: string;
}

export default function PaymentCredentialsForm() {
  const { user, getAccessToken } = useSupabaseAuth();
  const [credentials, setCredentials] = useState<PaymentCredentials>({
    // Stripe
    STRIPE_SECRET_KEY: '',
    NEXT_PUBLIC_STRIPE_PUBLIC_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
    STRIPE_PRICE_ID_PRO: '',
    STRIPE_PRICE_ID_BUSINESS: '',
    
    // PayPal
    PAYPAL_CLIENT_ID: '',
    PAYPAL_CLIENT_SECRET: '',
    PAYPAL_PLAN_ID_PRO: '',
    PAYPAL_PLAN_ID_BUSINESS: '',
    
    // Flutterwave
    FLUTTERWAVE_PUBLIC_KEY: '',
    FLUTTERWAVE_SECRET_KEY: '',
    FLUTTERWAVE_ENCRYPTION_KEY: '',
    
    // Paystack
    PAYSTACK_PUBLIC_KEY: '',
    PAYSTACK_SECRET_KEY: '',
    PAYSTACK_PLAN_CODE_PRO: '',
    PAYSTACK_PLAN_CODE_BUSINESS: ''
  });
  
  // Payment gateway configuration state
  const [gatewayConfig, setGatewayConfig] = useState<PaymentGatewayConfig>(defaultGatewayConfig);
  
  const [activeTab, setActiveTab] = useState<'stripe' | 'paypal' | 'flutterwave' | 'paystack'>('paystack');
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingCredentials, setLoadingCredentials] = useState(true);

  // Fetch stored credentials on mount
  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        console.log('PaymentCredentialsForm: Fetching credentials...');
        setLoadingCredentials(true);
        setError(null);

        const accessToken = await getAccessToken();
        if (!accessToken) {
          console.error('PaymentCredentialsForm: Failed to get authentication token');
          setError('Authentication error. Please try signing in again.');
          return;
        }

        const response = await fetch('/api/admin/credentials', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('PaymentCredentialsForm: Failed to fetch credentials', {
            status: response.status,
            statusText: response.statusText,
            errorText,
          });
          throw new Error(`Failed to fetch credentials: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        handleCredentialsData(data);
      } catch (error: unknown) {
        console.error('PaymentCredentialsForm: Error fetching credentials:', error);
        setError('Failed to load saved credentials. ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        setLoadingCredentials(false);
      }
    };
    
    // Helper function to process credentials data
    const handleCredentialsData = (data: { 
      credentials?: Record<string, string>;
      updatedAt?: string | null;
    }) => {
      console.log('PaymentCredentialsForm: Received credentials data', { 
        hasCredentials: !!data.credentials,
        credentialCount: data.credentials ? Object.keys(data.credentials).length : 0,
        updatedAt: data.updatedAt
      });
      
      const receivedCredentials = data.credentials ?? {};

      if (Object.keys(receivedCredentials).length > 0) {
        // Log the keys of credentials received (not values for security)
        console.log('PaymentCredentialsForm: Credential keys received:', Object.keys(receivedCredentials));
        
        setCredentials(prevCredentials => {
          const newCredentials = {
            ...prevCredentials,
            ...receivedCredentials
          };
          // Log which fields were updated
          Object.keys(receivedCredentials).forEach(key => {
            if (receivedCredentials[key] && receivedCredentials[key] !== prevCredentials[key]) {
              console.log(`PaymentCredentialsForm: Updated credential ${key}`);
            }
          });
          return newCredentials;
        });
      }
    };
    
    // Fetch gateway config
    const fetchGatewayConfig = async () => {
      setConfigLoading(true);
      try {
        const config = await getGatewayConfig();
        setGatewayConfig(config);
      } catch (error) {
        console.error('Error fetching gateway config:', error);
        setError('Failed to load gateway configuration');
      } finally {
        setConfigLoading(false);
      }
    };
    
    if (user) {
      console.log('PaymentCredentialsForm: User authenticated, fetching credentials');
      fetchCredentials();
      fetchGatewayConfig();
    } else {
      console.log('PaymentCredentialsForm: No user logged in, skipping credential fetch');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGatewayToggle = (gateway: 'stripe' | 'paypal' | 'flutterwave' | 'paystack', field: 'enabled' | 'testMode') => {
    setGatewayConfig(prev => ({
      ...prev,
      [gateway]: {
        ...prev[gateway],
        [field]: !prev[gateway][field]
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('PaymentCredentialsForm: Submitting credentials...');
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('Failed to get authentication token');
      
      // Log keys being submitted (not values)
      console.log('PaymentCredentialsForm: Submitting credential keys:', 
        Object.keys(credentials).filter(key => credentials[key]));
      
      // Save credentials
      const credResponse = await fetch('/api/admin/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(credentials)
      });
      
      if (!credResponse.ok) {
        const errorData = await credResponse.json();
        console.error('PaymentCredentialsForm: Failed to save credentials', {
          status: credResponse.status,
          statusText: credResponse.statusText,
          error: errorData
        });
        throw new Error(errorData.error || 'Failed to save credentials');
      }
      
      // Save gateway configuration
      const configSaved = await saveGatewayConfig(gatewayConfig);
      if (!configSaved) {
        throw new Error('Failed to save gateway configuration');
      }
      
      const result = await credResponse.json();
      console.log('PaymentCredentialsForm: Credentials saved successfully', result);
      
      setSuccess('Payment credentials and gateway configuration saved successfully');
    } catch (error) {
      console.error('PaymentCredentialsForm: Error saving settings:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getTabClass = (tab: string) => {
    return `px-4 py-2 border-b-2 font-medium text-sm ${
      activeTab === tab 
        ? 'border-indigo-500 text-indigo-600' 
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`;
  };

  // Style constants
  const inputStyle = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
  const labelStyle = "block text-sm font-medium text-gray-700";

  if (loadingCredentials || configLoading) {
    return (
      <div className="animate-pulse p-6 bg-white rounded-lg shadow">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Toggle switch component
  const ToggleSwitch = ({ 
    enabled, 
    onChange, 
    label 
  }: { 
    enabled: boolean; 
    onChange: () => void; 
    label: string 
  }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
          enabled ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      >
        <span className="sr-only">{label}</span>
        <span
          className={`pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        >
          <span
            className={`absolute inset-0 h-full w-full flex items-center justify-center transition-opacity ${
              enabled ? 'opacity-0 ease-out duration-100' : 'opacity-100 ease-in duration-200'
            }`}
            aria-hidden="true"
          >
            <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 12 12">
              <path
                d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span
            className={`absolute inset-0 h-full w-full flex items-center justify-center transition-opacity ${
              enabled ? 'opacity-100 ease-in duration-200' : 'opacity-0 ease-out duration-100'
            }`}
            aria-hidden="true"
          >
            <svg className="h-3 w-3 text-indigo-600" fill="currentColor" viewBox="0 0 12 12">
              <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
            </svg>
          </span>
        </span>
      </button>
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-semibold mb-6 text-gray-800 border-b pb-3">
        Payment Provider Settings
      </h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md">
          {success}
        </div>
      )}
      
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            type="button"
            className={getTabClass('stripe')}
            onClick={() => setActiveTab('stripe')}
          >
            Stripe
          </button>
          <button
            type="button"
            className={getTabClass('paypal')}
            onClick={() => setActiveTab('paypal')}
          >
            PayPal
          </button>
          <button
            type="button"
            className={getTabClass('flutterwave')}
            onClick={() => setActiveTab('flutterwave')}
          >
            Flutterwave
          </button>
          <button
            type="button"
            className={getTabClass('paystack')}
            onClick={() => setActiveTab('paystack')}
          >
            Paystack
          </button>
          
          {/* Debug button - only visible in development */}
          {process.env.NODE_ENV === 'development' && (
            <button
              type="button"
              className="ml-auto px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
              onClick={async () => {
                console.log('Current credentials state:', credentials);
                console.log('Keys with values:', Object.keys(credentials).filter(k => credentials[k]));
                console.log('Gateway config:', gatewayConfig);
                // Also attempt to check Firestore directly
                const accessToken = await getAccessToken();
                fetch('/api/admin/credentials', {
                  headers: {
                    'Cache-Control': 'no-cache',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                  }
                })
                  .then(response => {
                    console.log('Debug fetch response status:', response.status);
                    return response.json();
                  })
                  .then(data => console.log('Debug fetch response:', data))
                  .catch(err => console.error('Debug fetch error:', err));
              }}
            >
              Debug
            </button>
          )}
        </nav>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Gateway controls for current tab */}
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200 mb-6">
          <h3 className="text-md font-medium text-gray-700 mb-4">Gateway Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleSwitch 
              enabled={gatewayConfig[activeTab].enabled} 
              onChange={() => handleGatewayToggle(activeTab, 'enabled')} 
              label={`Enable ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`} 
            />
            <ToggleSwitch 
              enabled={gatewayConfig[activeTab].testMode} 
              onChange={() => handleGatewayToggle(activeTab, 'testMode')} 
              label="Test Mode" 
            />
          </div>
          {!gatewayConfig[activeTab].enabled && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-md">
              <span className="font-medium">Note:</span> This payment gateway is currently disabled. Enable it to allow customers to pay using this method.
            </div>
          )}
          {gatewayConfig[activeTab].testMode && gatewayConfig[activeTab].enabled && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-md">
              <span className="font-medium">Test Mode Active:</span> No real payments will be processed. Use test cards for testing.
            </div>
          )}
        </div>
        
        {activeTab === 'stripe' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="STRIPE_SECRET_KEY" className={labelStyle}>
                Secret Key
              </label>
              <input
                type="password"
                id="STRIPE_SECRET_KEY"
                name="STRIPE_SECRET_KEY"
                value={credentials.STRIPE_SECRET_KEY}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="sk_test_..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Find this in your Stripe Dashboard under Developers → API Keys
              </p>
            </div>
            
            <div>
              <label htmlFor="NEXT_PUBLIC_STRIPE_PUBLIC_KEY" className={labelStyle}>
                Public Key
              </label>
              <input
                type="text"
                id="NEXT_PUBLIC_STRIPE_PUBLIC_KEY"
                name="NEXT_PUBLIC_STRIPE_PUBLIC_KEY"
                value={credentials.NEXT_PUBLIC_STRIPE_PUBLIC_KEY}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="pk_test_..."
              />
            </div>
            
            <div>
              <label htmlFor="STRIPE_WEBHOOK_SECRET" className={labelStyle}>
                Webhook Secret
              </label>
              <input
                type="password"
                id="STRIPE_WEBHOOK_SECRET"
                name="STRIPE_WEBHOOK_SECRET"
                value={credentials.STRIPE_WEBHOOK_SECRET}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="whsec_..."
              />
            </div>
            
            <div>
              <label htmlFor="STRIPE_PRICE_ID_PRO" className={labelStyle}>
                Pro Price ID
              </label>
              <input
                type="text"
                id="STRIPE_PRICE_ID_PRO"
                name="STRIPE_PRICE_ID_PRO"
                value={credentials.STRIPE_PRICE_ID_PRO}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="price_..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Create subscription products in Stripe Dashboard → Products
              </p>
            </div>
            
            <div>
              <label htmlFor="STRIPE_PRICE_ID_BUSINESS" className={labelStyle}>
                Business Price ID
              </label>
              <input
                type="text"
                id="STRIPE_PRICE_ID_BUSINESS"
                name="STRIPE_PRICE_ID_BUSINESS"
                value={credentials.STRIPE_PRICE_ID_BUSINESS}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="price_..."
              />
            </div>
          </div>
        )}
        
        {activeTab === 'paypal' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="PAYPAL_CLIENT_ID" className={labelStyle}>
                Client ID
              </label>
              <input
                type="text"
                id="PAYPAL_CLIENT_ID"
                name="PAYPAL_CLIENT_ID"
                value={credentials.PAYPAL_CLIENT_ID}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="Client ID from PayPal Developer Dashboard"
              />
            </div>
            
            <div>
              <label htmlFor="PAYPAL_CLIENT_SECRET" className={labelStyle}>
                Client Secret
              </label>
              <input
                type="password"
                id="PAYPAL_CLIENT_SECRET"
                name="PAYPAL_CLIENT_SECRET"
                value={credentials.PAYPAL_CLIENT_SECRET}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="Client Secret from PayPal Developer Dashboard"
              />
            </div>
            
            <div>
              <label htmlFor="PAYPAL_PLAN_ID_PRO" className={labelStyle}>
                Pro Plan ID
              </label>
              <input
                type="text"
                id="PAYPAL_PLAN_ID_PRO"
                name="PAYPAL_PLAN_ID_PRO"
                value={credentials.PAYPAL_PLAN_ID_PRO}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="PayPal Pro Plan ID"
              />
              <p className="mt-1 text-xs text-gray-500">
                Create subscription plans in PayPal Developer Dashboard
              </p>
            </div>
            
            <div>
              <label htmlFor="PAYPAL_PLAN_ID_BUSINESS" className={labelStyle}>
                Business Plan ID
              </label>
              <input
                type="text"
                id="PAYPAL_PLAN_ID_BUSINESS"
                name="PAYPAL_PLAN_ID_BUSINESS"
                value={credentials.PAYPAL_PLAN_ID_BUSINESS}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="PayPal Business Plan ID"
              />
            </div>
          </div>
        )}
        
        {activeTab === 'flutterwave' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="FLUTTERWAVE_PUBLIC_KEY" className={labelStyle}>
                Public Key
              </label>
              <input
                type="text"
                id="FLUTTERWAVE_PUBLIC_KEY"
                name="FLUTTERWAVE_PUBLIC_KEY"
                value={credentials.FLUTTERWAVE_PUBLIC_KEY}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="FLWPUBK..."
              />
            </div>
            
            <div>
              <label htmlFor="FLUTTERWAVE_SECRET_KEY" className={labelStyle}>
                Secret Key
              </label>
              <input
                type="password"
                id="FLUTTERWAVE_SECRET_KEY"
                name="FLUTTERWAVE_SECRET_KEY"
                value={credentials.FLUTTERWAVE_SECRET_KEY}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="FLWSECK..."
              />
            </div>
            
            <div>
              <label htmlFor="FLUTTERWAVE_ENCRYPTION_KEY" className={labelStyle}>
                Encryption Key
              </label>
              <input
                type="password"
                id="FLUTTERWAVE_ENCRYPTION_KEY"
                name="FLUTTERWAVE_ENCRYPTION_KEY"
                value={credentials.FLUTTERWAVE_ENCRYPTION_KEY}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="Flutterwave Encryption Key"
              />
            </div>
          </div>
        )}
        
        {activeTab === 'paystack' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="PAYSTACK_PUBLIC_KEY" className={labelStyle}>
                Public Key
              </label>
              <input
                type="text"
                id="PAYSTACK_PUBLIC_KEY"
                name="PAYSTACK_PUBLIC_KEY"
                value={credentials.PAYSTACK_PUBLIC_KEY}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="pk_live_... or pk_test_..."
              />
            </div>
            
            <div>
              <label htmlFor="PAYSTACK_SECRET_KEY" className={labelStyle}>
                Secret Key
              </label>
              <input
                type="password"
                id="PAYSTACK_SECRET_KEY"
                name="PAYSTACK_SECRET_KEY"
                value={credentials.PAYSTACK_SECRET_KEY}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="sk_live_... or sk_test_..."
              />
            </div>
            
            <div>
              <label htmlFor="PAYSTACK_PLAN_CODE_PRO" className={labelStyle}>
                Pro Plan Code
              </label>
              <input
                type="text"
                id="PAYSTACK_PLAN_CODE_PRO"
                name="PAYSTACK_PLAN_CODE_PRO"
                value={credentials.PAYSTACK_PLAN_CODE_PRO}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="PLN_..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Create subscription plans in Paystack Dashboard → Products → Plans
              </p>
            </div>
            
            <div>
              <label htmlFor="PAYSTACK_PLAN_CODE_BUSINESS" className={labelStyle}>
                Business Plan Code
              </label>
              <input
                type="text"
                id="PAYSTACK_PLAN_CODE_BUSINESS"
                name="PAYSTACK_PLAN_CODE_BUSINESS"
                value={credentials.PAYSTACK_PLAN_CODE_BUSINESS}
                onChange={handleInputChange}
                className={inputStyle}
                placeholder="PLN_..."
              />
            </div>
          </div>
        )}
        
        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">
                Credentials are encrypted before storage
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
} 