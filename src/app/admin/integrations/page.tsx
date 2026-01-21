'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import Link from 'next/link';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: 'payment' | 'analytics' | 'storage' | 'auth' | 'other';
  status: 'active' | 'inactive' | 'error';
  icon: string;
  setupUrl: string;
  docsUrl?: string;
  testConnection?: boolean;
}

export default function IntegrationsPage() {
  const { getAccessToken } = useSupabaseAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'paystack',
      name: 'Paystack',
      description: 'Accept payments via cards, bank transfers, and mobile money across Africa',
      category: 'payment',
      status: 'inactive',
      icon: '💳',
      setupUrl: '/admin/payment-settings',
      docsUrl: 'https://paystack.com/docs',
      testConnection: true
    },
    {
      id: 'flutterwave',
      name: 'Flutterwave V4',
      description: 'Accept payments from anywhere in Africa and beyond with V4 API',
      category: 'payment',
      status: 'inactive',
      icon: '🦋',
      setupUrl: '/admin/payment-settings',
      docsUrl: 'https://developer.flutterwave.com/reference',
      testConnection: true
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Global payment processing for cards and digital wallets',
      category: 'payment',
      status: 'inactive',
      icon: '💎',
      setupUrl: '/admin/payment-settings',
      docsUrl: 'https://stripe.com/docs',
      testConnection: true
    },
    {
      id: 'paypal',
      name: 'PayPal',
      description: 'Accept PayPal payments and subscriptions globally',
      category: 'payment',
      status: 'inactive',
      icon: '🅿️',
      setupUrl: '/admin/payment-settings',
      docsUrl: 'https://developer.paypal.com/docs',
      testConnection: true
    },
    {
      id: 'supabase',
      name: 'Supabase',
      description: 'PostgreSQL database, authentication, and real-time subscriptions',
      category: 'storage',
      status: 'active',
      icon: '⚡',
      setupUrl: '/admin/app-settings',
      docsUrl: 'https://supabase.com/docs'
    },
    {
      id: 'firebase',
      name: 'Firebase',
      description: 'Authentication and admin SDK integration',
      category: 'auth',
      status: 'inactive',
      icon: '🔥',
      setupUrl: '/admin/app-settings',
      docsUrl: 'https://firebase.google.com/docs'
    }
  ]);

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchIntegrationStatus();
  }, []);

  const fetchIntegrationStatus = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) return;

      // Fetch payment settings status
      const response = await fetch('/api/admin/payment-settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        setIntegrations(prev => prev.map(integration => {
          if (integration.category === 'payment') {
            const isActive = data[integration.id]?.isActive || false;
            return {
              ...integration,
              status: isActive ? 'active' : 'inactive'
            };
          }
          return integration;
        }));
      }
    } catch (error) {
      console.error('Error fetching integration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <span className="w-2 h-2 mr-1 bg-green-400 rounded-full"></span>
            Active
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <span className="w-2 h-2 mr-1 bg-red-400 rounded-full"></span>
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <span className="w-2 h-2 mr-1 bg-gray-400 rounded-full"></span>
            Inactive
          </span>
        );
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors = {
      payment: 'bg-blue-100 text-blue-800',
      analytics: 'bg-purple-100 text-purple-800',
      storage: 'bg-yellow-100 text-yellow-800',
      auth: 'bg-indigo-100 text-indigo-800',
      other: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[category as keyof typeof colors]}`}>
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </span>
    );
  };

  const filteredIntegrations = filter === 'all' 
    ? integrations 
    : integrations.filter(i => i.category === filter);

  const stats = {
    total: integrations.length,
    active: integrations.filter(i => i.status === 'active').length,
    inactive: integrations.filter(i => i.status === 'inactive').length,
    error: integrations.filter(i => i.status === 'error').length
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage all third-party integrations and services for your QR code platform
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total</dt>
                    <dd className="text-2xl font-semibold text-gray-900">{stats.total}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active</dt>
                    <dd className="text-2xl font-semibold text-green-600">{stats.active}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Inactive</dt>
                    <dd className="text-2xl font-semibold text-gray-900">{stats.inactive}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Errors</dt>
                    <dd className="text-2xl font-semibold text-red-600">{stats.error}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {['all', 'payment', 'auth', 'storage', 'analytics'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`${
                    filter === tab
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
                >
                  {tab === 'all' ? 'All Integrations' : tab}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Integrations Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredIntegrations.map((integration) => (
              <div key={integration.id} className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl">{integration.icon}</span>
                    {getStatusBadge(integration.status)}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{integration.name}</h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{integration.description}</p>
                  <div className="mb-4">
                    {getCategoryBadge(integration.category)}
                  </div>
                  <div className="flex items-center justify-between">
                    <Link
                      href={integration.setupUrl}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Configure →
                    </Link>
                    {integration.docsUrl && (
                      <a
                        href={integration.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Docs
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredIntegrations.length === 0 && !loading && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No integrations found</h3>
            <p className="mt-1 text-sm text-gray-500">Try selecting a different category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
