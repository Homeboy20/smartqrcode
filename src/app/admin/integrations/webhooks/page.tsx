'use client';

import React, { useState } from 'react';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  provider: string;
  lastTriggered?: string;
  successRate?: number;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([
    {
      id: '1',
      name: 'Payment Success Webhook',
      url: 'https://your-domain.com/api/webhooks/payment-success',
      events: ['payment.success', 'subscription.created'],
      status: 'active',
      provider: 'Flutterwave',
      lastTriggered: '2026-01-02T10:30:00Z',
      successRate: 98.5
    },
    {
      id: '2',
      name: 'Payment Failed Webhook',
      url: 'https://your-domain.com/api/webhooks/payment-failed',
      events: ['payment.failed'],
      status: 'active',
      provider: 'Paystack',
      lastTriggered: '2026-01-01T15:20:00Z',
      successRate: 100
    }
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
    provider: 'flutterwave'
  });

  const availableEvents = [
    'payment.success',
    'payment.failed',
    'subscription.created',
    'subscription.cancelled',
    'subscription.updated',
    'refund.processed',
    'customer.created',
    'customer.updated'
  ];

  const providers = [
    { id: 'flutterwave', name: 'Flutterwave' },
    { id: 'paystack', name: 'Paystack' },
    { id: 'stripe', name: 'Stripe' },
    { id: 'paypal', name: 'PayPal' }
  ];

  const toggleWebhookStatus = (id: string) => {
    setWebhooks(prev => prev.map(webhook => 
      webhook.id === id 
        ? { ...webhook, status: webhook.status === 'active' ? 'inactive' : 'active' }
        : webhook
    ));
  };

  const deleteWebhook = (id: string) => {
    if (confirm('Are you sure you want to delete this webhook?')) {
      setWebhooks(prev => prev.filter(w => w.id !== id));
    }
  };

  const handleAddWebhook = () => {
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    const webhook: Webhook = {
      id: Date.now().toString(),
      name: newWebhook.name,
      url: newWebhook.url,
      events: newWebhook.events,
      status: 'active',
      provider: providers.find(p => p.id === newWebhook.provider)?.name || 'Custom',
      successRate: 100
    };

    setWebhooks(prev => [...prev, webhook]);
    setShowAddModal(false);
    setNewWebhook({ name: '', url: '', events: [], provider: 'flutterwave' });
  };

  const toggleEvent = (event: string) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event]
    }));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Webhook Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure webhooks to receive real-time notifications from payment providers
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Webhook
          </button>
        </div>

        {/* Info Banner */}
        <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Webhook Security:</strong> All webhooks should verify signatures from payment providers. 
                Make sure your endpoints are HTTPS and can handle POST requests.
              </p>
            </div>
          </div>
        </div>

        {/* Webhooks List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <ul className="divide-y divide-gray-200">
            {webhooks.map((webhook) => (
              <li key={webhook.id} className="px-6 py-5 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900">{webhook.name}</h3>
                        <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          webhook.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {webhook.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => toggleWebhookStatus(webhook.id)}
                          className="text-sm text-indigo-600 hover:text-indigo-900"
                        >
                          {webhook.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => deleteWebhook(webhook.id)}
                          className="text-sm text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded">{webhook.url}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {webhook.events.map(event => (
                        <span key={event} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {event}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Provider:</span>
                        <span className="ml-2 font-medium text-gray-900">{webhook.provider}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Last Triggered:</span>
                        <span className="ml-2 font-medium text-gray-900">{formatDate(webhook.lastTriggered)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Success Rate:</span>
                        <span className="ml-2 font-medium text-green-600">{webhook.successRate?.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {webhooks.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No webhooks configured</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new webhook.</p>
          </div>
        )}

        {/* Add Webhook Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowAddModal(false)}></div>

              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Add New Webhook
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="newWebhookName" className="block text-sm font-medium text-gray-700 mb-1">
                        Webhook Name
                      </label>
                      <input
                        id="newWebhookName"
                        name="webhookName"
                        type="text"
                        value={newWebhook.name}
                        onChange={(e) => setNewWebhook({...newWebhook, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="e.g., Payment Success Handler"
                      />
                    </div>

                    <div>
                      <label htmlFor="newWebhookUrl" className="block text-sm font-medium text-gray-700 mb-1">
                        Webhook URL
                      </label>
                      <input
                        id="newWebhookUrl"
                        name="webhookUrl"
                        type="url"
                        value={newWebhook.url}
                        onChange={(e) => setNewWebhook({...newWebhook, url: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="https://your-domain.com/api/webhook"
                      />
                    </div>

                    <div>
                      <label htmlFor="newWebhookProvider" className="block text-sm font-medium text-gray-700 mb-1">
                        Provider
                      </label>
                      <select
                        id="newWebhookProvider"
                        name="webhookProvider"
                        value={newWebhook.provider}
                        onChange={(e) => setNewWebhook({...newWebhook, provider: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {providers.map(provider => (
                          <option key={provider.id} value={provider.id}>{provider.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Events to Listen
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {availableEvents.map(event => (
                          <label key={event} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={newWebhook.events.includes(event)}
                              onChange={() => toggleEvent(event)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">{event}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleAddWebhook}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Add Webhook
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
