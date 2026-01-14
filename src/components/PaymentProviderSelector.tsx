import React from 'react';
import Image from 'next/image';

// Define the payment providers types
export type PaymentProvider = 'paystack' | 'stripe' | 'paypal' | 'flutterwave';

// Define the component props
interface PaymentProviderSelectorProps {
  selectedProvider: PaymentProvider;
  onSelectProvider: (provider: PaymentProvider) => void;
  availableProviders?: PaymentProvider[];
}

export default function PaymentProviderSelector({
  selectedProvider,
  onSelectProvider,
  availableProviders = ['paystack', 'flutterwave'],
}: PaymentProviderSelectorProps) {
  // Provider display info
  const providerInfo = {
    paystack: {
      name: 'Paystack',
      logo: '/images/paystack-logo.svg',
      description: 'Pay with cards, bank, or USSD',
    },
    stripe: {
      name: 'Stripe',
      logo: '/images/stripe-logo.svg',
      description: 'Pay with credit/debit card',
    },
    paypal: {
      name: 'PayPal',
      logo: '/images/paypal-logo.svg',
      description: 'Pay with PayPal account',
    },
    flutterwave: {
      name: 'Flutterwave',
      logo: '/images/flutterwave-logo.svg',
      description: 'Pay with multiple methods',
    },
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">Select payment method</h3>
        <p className="mt-1 text-sm text-gray-500">
          Choose how you'd like to pay for your subscription
        </p>
      </div>
      
      <div className="space-y-4">
        {availableProviders.map((provider) => (
          <div
            key={provider}
            onClick={() => onSelectProvider(provider)}
            className={`
              relative rounded-lg border p-4 flex items-start cursor-pointer hover:bg-gray-50
              ${selectedProvider === provider 
                ? 'border-2 border-indigo-500 bg-indigo-50' 
                : 'border-gray-300'
              }
            `}
          >
            <div className="flex items-center h-5">
              <input
                id={`payment-${provider}`}
                name="paymentProvider"
                value={provider}
                type="radio"
                checked={selectedProvider === provider}
                onChange={() => onSelectProvider(provider)}
                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
            </div>
            
            <div className="ml-3 flex-1 flex justify-between">
              <div>
                <label 
                  htmlFor={`payment-${provider}`}
                  className="font-medium text-gray-900 block"
                >
                  {providerInfo[provider].name}
                </label>
                <p className="text-gray-500 text-sm">
                  {providerInfo[provider].description}
                </p>
              </div>
              
              <div className="ml-4 flex-shrink-0 w-16 h-10 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Placeholder for logo - in production, replace with actual logos */}
                  {provider === 'paystack' && (
                    <svg className="h-6 text-indigo-600" viewBox="0 0 512 512" fill="currentColor">
                      <path d="M85 128c-15 0-27 12-27 27v202c0 15 12 27 27 27h342c15 0 27-12 27-27V155c0-15-12-27-27-27H85zm0-32h342c33 0 59 26 59 59v202c0 33-26 59-59 59H85c-33 0-59-26-59-59V155c0-33 26-59 59-59z" />
                    </svg>
                  )}
                  {provider === 'stripe' && (
                    <svg className="h-6 text-blue-500" viewBox="0 0 60 25" fill="currentColor">
                      <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v2.94c-1.32.81-2.96 1.18-4.86 1.18-4.13 0-7.05-2.94-7.05-7.45 0-3.9 2.4-7.41 6.79-7.41 3.98 0 6.17 3.14 6.17 7.28 0 .36 0 1.08-.24 1.86zm-8.1-2.94h4.5c0-1.37-.91-2.21-2.18-2.21-1.32 0-2.14.91-2.32 2.21zM40.95 20c-1.5 0-2.43-.8-2.43-2.13 0-1.86 1.7-2.72 4.81-2.72v-.7c0-1.34-.62-1.89-1.87-1.89-.94 0-1.92.33-2.75.84V11c.9-.37 2.25-.8 3.88-.8 2.98 0 4.11 1.75 4.11 4.7V20h-3.2l-.28-1.01h-.1c-.83.8-1.92 1.23-3.17 1.23zm.77-2.78c.7 0 1.32-.37 1.6-.73v-1.49c-1.31 0-1.9.36-1.9 1.18 0 .58.31.95.85 1.04h.45zM30.6 20.03c-3.2 0-4.9-2.5-4.9-7.37 0-4.8 1.7-7.5 4.9-7.5 1.32 0 2.15.33 2.98.95V.01h3.88V20h-3.2l-.28-1.01h-.1c-.87.76-1.92 1.23-3.28 1.23V20v.03zm.8-3.13c.76 0 1.32-.18 1.7-.73V8.98c-.38-.4-.94-.55-1.7-.55-1.23 0-1.95 1.3-1.95 4.13 0 2.9.72 4.2 1.95 4.2v.07zM22.32 20h-3.89V5.89h3.89V20zM22.54.8c0 1.16-.94 2.1-2.1 2.1a2.1 2.1 0 0 1 0-4.2c1.16 0 2.1.94 2.1 2.1zM15.07 5.67c1.5 0 2.97.4 3.87.98v3.25a6.89 6.89 0 0 0-3.57-1.16c-1.36 0-1.92.55-1.92 1.16 0 .66.32 1.01 1.74 1.56 2.97 1.12 3.97 2.43 3.97 4.7 0 2.72-2.14 4.07-5.02 4.07-1.6 0-3.53-.5-4.57-1.2v-3.38c1.16.8 2.94 1.42 4.5 1.42 1.2 0 1.95-.4 1.95-1.27s-.59-1.23-2.06-1.78c-2.65-1.02-3.61-2.28-3.61-4.4.04-2.6 1.95-3.95 4.72-3.95zM1.95 12.26C1.95 8.34 4.69 5.6 8.62 5.6c1.23 0 2.32.22 3.06.62v3.24a5.47 5.47 0 0 0-2.83-.8c-1.97 0-3.02 1.16-3.02 3.42v.04c0 2.16 1.13 3.49 3.2 3.49.37 0 .73-.08 1.1-.16v-2.21H7.8V10.5h6.66V19c-1.6.87-3.57 1.23-5.84 1.23-4.61 0-6.67-2.83-6.67-7.97z"/>
                    </svg>
                  )}
                  {provider === 'paypal' && (
                    <svg className="h-6 text-blue-700" viewBox="0 0 101 32" fill="currentColor">
                      <path d="M12.09 5.22c-.8 0-1.42.62-1.42 1.38v2.34c-1.84-1.79-4.34-2.88-7.09-2.88C1.61 6.06 0 7.68 0 9.65c0 1.97 1.61 3.58 3.58 3.58 2.56 0 4.92-1.01 6.67-2.79v1.4c0 .8.62 1.41 1.42 1.41.8 0 1.41-.62 1.41-1.42V6.59c0-.76-.62-1.37-1.42-1.37h.43zm-1.42 5.83c0 2.1-2.55 3.8-5.67 3.8C3.04 14.85 1.42 13.23 1.42 11.3c0-1.93 1.62-3.55 3.58-3.55 3.12 0 5.67 1.7 5.67 3.8v-.5zM24.8 6.65c-.8 0-1.42.62-1.42 1.38v4.92c0 2.1-2.55 3.8-5.67 3.8-1.96 0-3.58-1.62-3.58-3.55 0-1.93 1.62-3.55 3.58-3.55 3.12 0 5.67 1.7 5.67 3.8v-5.42c0-.76-.62-1.38-1.42-1.38h.84zm0 9.02v-2.72c-1.84-1.78-4.34-2.87-7.09-2.87-1.97 0-3.58 1.6-3.58 3.57s1.61 3.58 3.58 3.58c2.75 0 5.25-1.09 7.09-2.88v1.32H24.8zM36.1 6.65c-.8 0-1.42.62-1.42 1.38v6.15c-1.84-1.78-4.34-2.87-7.09-2.87-1.97 0-3.58 1.6-3.58 3.57s1.61 3.58 3.58 3.58c2.75 0 5.25-1.09 7.09-2.88v1.4c0 .76.62 1.37 1.42 1.37.79 0 1.41-.61 1.41-1.37V8.03c0-.76-.62-1.38-1.41-1.38h0zm-1.42 9.02c0 2.1-2.55 3.8-5.67 3.8-1.96 0-3.58-1.62-3.58-3.55 0-1.93 1.62-3.55 3.58-3.55 3.12 0 5.67 1.7 5.67 3.8v-.5zM48.82 11.3c0-2.63-2.14-4.76-4.76-4.76s-4.76 2.13-4.76 4.76 2.14 4.76 4.76 4.76 4.76-2.13 4.76-4.76zm-1.42 0c0 1.85-1.5 3.34-3.34 3.34-1.85 0-3.34-1.5-3.34-3.34 0-1.85 1.5-3.34 3.34-3.34 1.84 0 3.34 1.5 3.34 3.34zM60.13 11.3c0-2.63-2.13-4.76-4.76-4.76-2.62 0-4.75 2.13-4.75 4.76s2.13 4.76 4.75 4.76c2.63 0 4.76-2.13 4.76-4.76zm-1.41 0c0 1.85-1.5 3.34-3.35 3.34-1.84 0-3.33-1.5-3.33-3.34 0-1.85 1.49-3.34 3.33-3.34 1.85 0 3.35 1.5 3.35 3.34zM71.45 11.3c0-2.63-2.14-4.76-4.76-4.76s-4.76 2.13-4.76 4.76 2.14 4.76 4.76 4.76 4.76-2.13 4.76-4.76zm-1.42 0c0 1.85-1.5 3.34-3.34 3.34-1.85 0-3.34-1.5-3.34-3.34 0-1.85 1.5-3.34 3.34-3.34 1.84 0 3.34 1.5 3.34 3.34zM78.64 6.65c-.62 0-1.16.41-1.33 1-.91.35-1.58 1.04-1.58 2.04 0 1.73 1.67 2.3 2.98 2.75 1.14.4 1.58.62 1.58 1.2 0 .54-.7.84-1.42.84s-1.43-.26-1.43-.84c0-.4-.32-.72-.71-.72-.4 0-.7.32-.7.72 0 1.27 1.37 1.99 2.84 1.99 1.74 0 2.83-.77 2.83-1.99 0-1.58-1.27-2.23-2.83-2.75-1.16-.4-1.73-.6-1.73-1.2 0-.61.76-.84 1.41-.84.72 0 1.42.24 1.42.84 0 .4.32.71.71.71.4 0 .71-.31.71-.71 0-1.17-1.34-1.99-2.84-1.99l.09-.05zM88.89 6.65c-.8 0-1.42.62-1.42 1.38v6.15c-1.84-1.78-4.33-2.87-7.09-2.87-1.96 0-3.58 1.6-3.58 3.57s1.62 3.58 3.58 3.58c2.76 0 5.25-1.09 7.1-2.88v1.4c0 .76.61 1.37 1.41 1.37.8 0 1.42-.61 1.42-1.37V8.03c0-.76-.62-1.38-1.42-1.38h0zm-1.42 9.02c0 2.1-2.55 3.8-5.67 3.8-1.96 0-3.58-1.62-3.58-3.55 0-1.93 1.62-3.55 3.58-3.55 3.12 0 5.67 1.7 5.67 3.8v-.5zM100.04 15.57c0-.4-.32-.72-.71-.72h-7.8c-.4 0-.7.32-.7.72 0 .4.3.7.7.7h7.8c.39 0 .7-.3.7-.7z"/>
                      <path d="M96.04 19.15c-.4 0-.71.3-.71.7v7.8c0 .41.31.71.7.71.4 0 .71-.3.71-.7v-7.8c0-.4-.31-.71-.7-.71zM96.04 3.56c-.4 0-.71.31-.71.71v7.8c0 .4.31.7.7.7.4 0 .71-.3.71-.7v-7.8c0-.4-.31-.7-.7-.7z"/>
                    </svg>
                  )}
                  {provider === 'flutterwave' && (
                    <svg className="h-6 text-orange-500" viewBox="0 0 1000 321" fill="currentColor">
                      <path d="M143.7 270.7L370.2 0H225.6L0 270.7h143.7zM370.7 270.7L483 125.2h-84.4l-91.4.3v145.2h63.5zM709.3 270.7L804.2 145l-92.6-145h-69.5l-109 172.5V0h-63.8v270.7h70l105.1-164.1v164.1h64.9z"/>
                      <path d="M945.8 174.1c0 11.8-2.3 22.1-7 30.7-4.7 8.6-10.8 15.7-18.5 21.2-7.7 5.5-16.4 9.6-26.3 12.3-9.9 2.7-20.1 4-30.5 4h-84.2V80.5H858c10.9 0 21.6 0.9 32 2.6 10.4 1.7 19.7 4.8 27.9 9.3 8.2 4.5 14.8 10.7 19.9 18.8 5.1 8.1 7.6 18.6 7.6 31.6 0 13.8-4.1 25.3-12.3 34.6-8.2 9.3-19.1 15.4-32.7 18.1v.7c8.3 1 15.8 3.1 22.7 6.3 6.9 3.2 12.7 7.4 17.6 12.5 4.9 5.2 8.7 11.2 11.4 18.1 2.7 6.9 4 14.3 4 22.1h-.3v-1.1zm-69.5-73.4c0-13.1-4.5-22.4-13.5-27.8-9-5.4-20.9-8.2-35.8-8.2h-34.5v74.3h32.7c7.2 0 14-1 20.4-2.9 6.4-1.9 12-4.7 16.8-8.4 4.8-3.7 8.6-8.3 11.4-13.8 2.8-5.4 4.1-11.8 4.1-19.1l-1.6 5.9zm12.5 72c0-15-5.3-26-16-32.9-10.7-6.9-24.3-10.4-40.9-10.4h-38.9v85.8H850c15.4 0 28.2-3.5 38.4-10.6 10.2-7.1 15.3-17.9 15.3-32.5l-14.9.6z"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 