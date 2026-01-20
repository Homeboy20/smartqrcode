'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { useRouter } from 'next/navigation';
import { subscriptionFeatures, subscriptionPricing, SubscriptionTier } from '@/lib/subscriptions';
import Link from 'next/link';

interface Subscription {
  id: string;
  plan: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  amount: number;
  currency: string;
  paymentMethod: string;
  lastPaymentDate?: string;
  nextBillingDate?: string;
}

export default function UserSubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [userTier, setUserTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  useEffect(() => {
    // Redirect if not logged in
    if (!authLoading && !user) {
      router.push('/login?redirect=/account/subscription');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    const fetchSubscriptionData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get user data to determine tier
        const userResponse = await fetch(`/api/users/${user.uid}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          }
        });
        
        if (!userResponse.ok) {
          throw new Error(`Error fetching user data: ${userResponse.status}`);
        }
        
        const userData = await userResponse.json();
        setUserTier(userData.user.subscriptionTier || 'free');
        
        // Get subscription details if any
        const subscriptionResponse = await fetch('/api/subscriptions/current', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          }
        });
        
        if (subscriptionResponse.ok) {
          const data = await subscriptionResponse.json();
          if (data.subscription) {
            setSubscription(data.subscription);
          }
        }
      } catch (err) {
        console.error('Error fetching subscription data:', err);
        setError('Failed to load your subscription details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionData();
  }, [user]);

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    
    try {
      setLoading(true);
      
      const response = await fetch(`/api/subscriptions/${subscription.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }
      
      // Get updated subscription
      const updatedData = await response.json();
      setSubscription({
        ...subscription,
        status: 'canceled',
        autoRenew: false
      });
      
      setCancelModalOpen(false);
    } catch (err) {
      console.error('Error canceling subscription:', err);
      setError('Failed to cancel subscription. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderFeaturesList = (tier: SubscriptionTier) => {
    const features = subscriptionFeatures[tier];
    
    return (
      <ul className="mt-2 space-y-2">
        <li className="flex items-center">
          <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>{features.maxQRCodes} QR Codes</span>
        </li>
        <li className="flex items-center">
          <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>{features.maxBarcodes} Barcodes</span>
        </li>
        {features.bulkGenerationAllowed && (
          <li className="flex items-center">
            <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Bulk Generation (up to {features.maxBulkItems} items)</span>
          </li>
        )}
        {features.aiCustomizationAllowed && (
          <li className="flex items-center">
            <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>AI Customization (up to {features.maxAICustomizations} per month)</span>
          </li>
        )}
        {features.analyticsEnabled && (
          <li className="flex items-center">
            <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Advanced Analytics</span>
          </li>
        )}
        {features.customBrandingAllowed && (
          <li className="flex items-center">
            <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Custom Branding</span>
          </li>
        )}
        {features.teamMembersAllowed && (
          <li className="flex items-center">
            <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Team Access (up to {features.maxTeamMembers} members)</span>
          </li>
        )}
      </ul>
    );
  };

  // Show loading state
  if (authLoading || (loading && !subscription && !error)) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3">Loading subscription details...</span>
      </div>
    );
  }

  // Modal component for cancellation confirmation
  const CancelModal = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center ${cancelModalOpen ? 'block' : 'hidden'}`}>
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h3 className="text-xl font-semibold mb-4">Cancel Your Subscription</h3>
        <p className="mb-6 text-gray-700">
          Are you sure you want to cancel your subscription? You'll continue to have access until the end of your billing period on {formatDate(subscription?.nextBillingDate)}.
        </p>
        <div className="flex justify-end space-x-4">
          <button 
            onClick={() => setCancelModalOpen(false)}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Keep Subscription
          </button>
          <button 
            onClick={handleCancelSubscription}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Cancel Subscription
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Your Subscription</h1>
      
      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4">
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
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Current Plan: {userTier.charAt(0).toUpperCase() + userTier.slice(1)}</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              {subscription?.status === 'active' ? 'Your subscription is active.' : 
               subscription?.status === 'canceled' ? 'Your subscription will end at the end of the billing period.' :
               'No active subscription.'}
            </p>
          </div>
          <div className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 font-medium">
            {userTier.charAt(0).toUpperCase() + userTier.slice(1)}
          </div>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            {subscription && (
              <>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Price</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: subscription.currency || 'USD'
                    }).format(subscription.amount)}/month
                  </dd>
                </div>
                
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${subscription.status === 'active' ? 'bg-green-100 text-green-800' : 
                        subscription.status === 'canceled' ? 'bg-red-100 text-red-800' : 
                        subscription.status === 'past_due' ? 'bg-yellow-100 text-yellow-800' : 
                        subscription.status === 'trialing' ? 'bg-blue-100 text-blue-800' : 
                        'bg-gray-100 text-gray-800'}`}>
                      {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                    </span>
                  </dd>
                </div>
                
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(subscription.startDate)}</dd>
                </div>
                
                {subscription.status === 'active' && subscription.nextBillingDate && (
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Next Billing Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(subscription.nextBillingDate)}</dd>
                  </div>
                )}
                
                {subscription.status === 'canceled' && subscription.endDate && (
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Access Until</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(subscription.endDate)}</dd>
                  </div>
                )}
                
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
                  <dd className="mt-1 text-sm text-gray-900 capitalize">{subscription.paymentMethod}</dd>
                </div>
                
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Auto Renew</dt>
                  <dd className="mt-1 text-sm text-gray-900">{subscription.autoRenew ? 'Yes' : 'No'}</dd>
                </div>
              </>
            )}
            
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Features Included</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {renderFeaturesList(userTier)}
              </dd>
            </div>
          </dl>
        </div>
        
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          {subscription?.status === 'active' ? (
            <div className="flex flex-col sm:flex-row sm:justify-between space-y-4 sm:space-y-0">
              <Link
                href="/pricing"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
              >
                Change Plan
              </Link>
              <button
                onClick={() => setCancelModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                Cancel Subscription
              </button>
            </div>
          ) : userTier === 'free' ? (
            <Link
              href="/pricing"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
            >
              Upgrade Your Plan
            </Link>
          ) : subscription?.status === 'canceled' ? (
            <Link
              href="/pricing"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
            >
              Renew Subscription
            </Link>
          ) : (
            <Link
              href="/pricing"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
            >
              View Plans
            </Link>
          )}
        </div>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg font-medium text-gray-900">Billing History</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            View your recent payments and invoices
          </p>
        </div>
        <div className="border-t border-gray-200">
          {/* This could be populated with actual billing history */}
          <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
            <p>Your billing history will appear here</p>
            <Link href="/account/billing" className="mt-2 inline-block text-indigo-600 hover:text-indigo-500">
              View all billing history
            </Link>
          </div>
        </div>
      </div>
      
      {/* Cancel Subscription Modal */}
      {cancelModalOpen && <CancelModal />}
    </div>
  );
} 