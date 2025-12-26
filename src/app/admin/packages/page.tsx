'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { subscriptionFeatures, subscriptionPricing, SubscriptionTier } from '@/lib/subscriptions';

interface PackageFeature {
  name: string;
  key: string;
  type: 'number' | 'boolean';
}

export default function AdminPackagesPage() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pricing, setPricing] = useState({ ...subscriptionPricing });
  const [features, setFeatures] = useState({ ...subscriptionFeatures });
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);

  const featureDefinitions: PackageFeature[] = [
    { name: 'Max QR Codes', key: 'maxQRCodes', type: 'number' },
    { name: 'Max Barcodes', key: 'maxBarcodes', type: 'number' },
    { name: 'Bulk Generation', key: 'bulkGenerationAllowed', type: 'boolean' },
    { name: 'Max Bulk Items', key: 'maxBulkItems', type: 'number' },
    { name: 'AI Customization', key: 'aiCustomizationAllowed', type: 'boolean' },
    { name: 'Max AI Customizations', key: 'maxAICustomizations', type: 'number' },
    { name: 'Analytics', key: 'analyticsEnabled', type: 'boolean' },
    { name: 'Custom Branding', key: 'customBrandingAllowed', type: 'boolean' },
    { name: 'Team Members', key: 'teamMembersAllowed', type: 'boolean' },
    { name: 'Max Team Members', key: 'maxTeamMembers', type: 'number' },
  ];

  const updatePackages = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch('/api/admin/packages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pricing,
          features
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update packages');
      }
      
      setSuccess('Packages updated successfully');
    } catch (err) {
      console.error('Failed to update packages:', err);
      setError(err instanceof Error ? err.message : 'Failed to update packages');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (tier: SubscriptionTier, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    setPricing(prev => ({
      ...prev,
      [tier]: numValue
    }));
  };

  const handleFeatureChange = (tier: SubscriptionTier, key: string, value: any) => {
    const featureDefinition = featureDefinitions.find(f => f.key === key);
    if (!featureDefinition) return;
    
    let processedValue = value;
    
    if (featureDefinition.type === 'number') {
      processedValue = parseInt(value, 10);
      if (isNaN(processedValue)) processedValue = 0;
    } else if (featureDefinition.type === 'boolean') {
      processedValue = value === 'true' || value === true;
    }
    
    setFeatures(prev => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [key]: processedValue
      }
    }));
  };

  const renderEditableFeature = (tier: SubscriptionTier, feature: PackageFeature) => {
    const value = features[tier][feature.key as keyof typeof features[typeof tier]];
    
    if (feature.type === 'boolean') {
      return (
        <select
          value={value.toString()}
          onChange={(e) => handleFeatureChange(tier, feature.key, e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded-md w-full"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }
    
    return (
      <input
        type="number"
        value={value as number}
        onChange={(e) => handleFeatureChange(tier, feature.key, e.target.value)}
        className="px-2 py-1 border border-gray-300 rounded-md w-full"
        min="0"
      />
    );
  };

  const renderPackageTier = (tier: SubscriptionTier) => {
    const isEditing = editingTier === tier;
    
    return (
      <div key={tier} className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800 capitalize">{tier}</h3>
          
          {isEditing ? (
            <div className="flex space-x-2">
              <button
                onClick={() => setEditingTier(null)}
                className="px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={updatePackages}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
              >
                Save All
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingTier(tier)}
              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
            >
              Edit
            </button>
          )}
        </div>
        
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Monthly Price
          </label>
          {isEditing ? (
            <div className="flex items-center">
              <span className="mr-1 text-gray-700">$</span>
              <input
                type="number"
                value={pricing[tier]}
                onChange={(e) => handlePriceChange(tier, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-md"
                min="0"
                step="0.01"
              />
            </div>
          ) : (
            <p className="text-gray-900 font-medium">${pricing[tier].toFixed(2)}/month</p>
          )}
        </div>
        
        <h4 className="text-md font-medium text-gray-800 mb-2">Features</h4>
        <div className="space-y-3">
          {featureDefinitions.map((feature) => (
            <div key={feature.key} className="grid grid-cols-2 gap-2 items-center">
              <label className="text-sm text-gray-600">{feature.name}</label>
              {isEditing ? (
                renderEditableFeature(tier, feature)
              ) : (
                <p className="text-gray-900">
                  {typeof features[tier][feature.key as keyof typeof features[typeof tier]] === 'boolean' 
                    ? features[tier][feature.key as keyof typeof features[typeof tier]] ? 'Yes' : 'No'
                    : features[tier][feature.key as keyof typeof features[typeof tier]]}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Check if user is authenticated and admin
  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-4">Verifying authentication...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              Please log in with an admin account to access this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-1 py-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subscription Packages</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage subscription tiers, features, and pricing
        </p>
      </div>
      
      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
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
        <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.keys(features).map(tier => renderPackageTier(tier as SubscriptionTier))}
      </div>
      
      <div className="mt-8 flex justify-end">
        <button
          onClick={updatePackages}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
} 