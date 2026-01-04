'use client';

import React, { useState } from 'react';

interface ApiLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  provider: string;
  duration: number;
  requestId?: string;
  error?: string;
}

export default function ApiLogsPage() {
  const [logs] = useState<ApiLog[]>([
    {
      id: '1',
      timestamp: '2026-01-02T10:35:22Z',
      method: 'POST',
      endpoint: '/v4/customers',
      statusCode: 201,
      provider: 'Flutterwave',
      duration: 245,
      requestId: 'req_abc123'
    },
    {
      id: '2',
      timestamp: '2026-01-02T10:34:15Z',
      method: 'POST',
      endpoint: '/v4/transactions/verify',
      statusCode: 200,
      provider: 'Flutterwave',
      duration: 189,
      requestId: 'req_def456'
    },
    {
      id: '3',
      timestamp: '2026-01-02T10:33:08Z',
      method: 'POST',
      endpoint: '/transaction/initialize',
      statusCode: 200,
      provider: 'Paystack',
      duration: 312,
      requestId: 'req_ghi789'
    },
    {
      id: '4',
      timestamp: '2026-01-02T10:32:45Z',
      method: 'GET',
      endpoint: '/v4/transactions',
      statusCode: 401,
      provider: 'Flutterwave',
      duration: 95,
      requestId: 'req_jkl012',
      error: 'Invalid API key'
    }
  ]);

  const [filter, setFilter] = useState({
    provider: 'all',
    status: 'all',
    method: 'all'
  });

  const getStatusBadge = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{statusCode}</span>;
    } else if (statusCode >= 400 && statusCode < 500) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{statusCode}</span>;
    } else if (statusCode >= 500) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{statusCode}</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{statusCode}</span>;
  };

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-blue-100 text-blue-800',
      POST: 'bg-green-100 text-green-800',
      PUT: 'bg-yellow-100 text-yellow-800',
      DELETE: 'bg-red-100 text-red-800',
      PATCH: 'bg-purple-100 text-purple-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[method] || 'bg-gray-100 text-gray-800'}`}>
        {method}
      </span>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredLogs = logs.filter(log => {
    if (filter.provider !== 'all' && log.provider !== filter.provider) return false;
    if (filter.method !== 'all' && log.method !== filter.method) return false;
    if (filter.status !== 'all') {
      if (filter.status === 'success' && (log.statusCode < 200 || log.statusCode >= 300)) return false;
      if (filter.status === 'error' && log.statusCode < 400) return false;
    }
    return true;
  });

  const stats = {
    total: logs.length,
    success: logs.filter(l => l.statusCode >= 200 && l.statusCode < 300).length,
    errors: logs.filter(l => l.statusCode >= 400).length,
    avgDuration: Math.round(logs.reduce((sum, l) => sum + l.duration, 0) / logs.length)
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">API Activity Logs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor all API requests to payment providers and third-party services
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <dt className="text-sm font-medium text-gray-500 truncate">Total Requests</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.total}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <dt className="text-sm font-medium text-gray-500 truncate">Successful</dt>
              <dd className="mt-1 text-3xl font-semibold text-green-600">{stats.success}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <dt className="text-sm font-medium text-gray-500 truncate">Errors</dt>
              <dd className="mt-1 text-3xl font-semibold text-red-600">{stats.errors}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <dt className="text-sm font-medium text-gray-500 truncate">Avg Response</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.avgDuration}ms</dd>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg mb-6 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select
                value={filter.provider}
                onChange={(e) => setFilter({...filter, provider: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Providers</option>
                <option value="Flutterwave">Flutterwave</option>
                <option value="Paystack">Paystack</option>
                <option value="Stripe">Stripe</option>
                <option value="PayPal">PayPal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filter.status}
                onChange={(e) => setFilter({...filter, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="success">Success (2xx)</option>
                <option value="error">Errors (4xx, 5xx)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
              <select
                value={filter.method}
                onChange={(e) => setFilter({...filter, method: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Methods</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Request ID
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className={log.error ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getMethodBadge(log.method)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">
                      {log.endpoint}
                      {log.error && (
                        <div className="text-xs text-red-600 mt-1">
                          Error: {log.error}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.provider}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(log.statusCode)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.duration}ms
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {log.requestId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow mt-6">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No logs found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
