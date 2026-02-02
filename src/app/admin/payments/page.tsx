'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

interface Payment {
  id: string;
  userId: string;
  userEmail?: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  paymentMethodDetails?: {
    type: string;
    card?: {
      brand: string;
      last4: string;
    };
    gateway?: string;
  };
  date: any;
  description: string;
  metadata?: Record<string, any>;
  subscriptionId?: string;
}

export default function AdminPaymentsPage() {
  const { getAccessToken } = useSupabaseAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState('30');
  const [searchTerm, setSearchTerm] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Function to fetch payments
  const fetchPayments = async () => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const response = await fetch(`/api/admin/transactions`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      // Map transactions to payments format
      const mappedPayments = (data.transactions || []).map((txn: any) => ({
        id: txn.id,
        userId: txn.userId || txn.user_id,
        userEmail: txn.userEmail || txn.user_email,
        amount: txn.amount,
        currency: txn.currency,
        status: txn.status,
        paymentMethod: txn.paymentMethod || txn.payment_method || 'card',
        paymentMethodDetails: {
          type: txn.paymentMethod || txn.payment_method || 'card',
          gateway: txn.paymentGateway || txn.payment_gateway
        },
        date: txn.createdAt || txn.created_at,
        description: `Payment for ${txn.plan || 'service'}`,
        metadata: txn.metadata || {},
        subscriptionId: txn.plan
      }));
      if (isMountedRef.current) {
        setPayments(mappedPayments);
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load payments');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [dateRange]);

  // Filter payments based on search term and filters
  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      searchTerm === '' || 
      payment.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || payment.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return 'Invalid date';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const handleRefundPayment = async (id: string) => {
    if (!confirm('Are you sure you want to refund this payment? This action cannot be undone.')) {
      return;
    }
    
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // Update transaction status to refunded
      const response = await fetch(`/api/admin/transactions/${id}`, {
        method: 'PUT',
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'refunded'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text()}`);
      }
      
      // Refresh payment data
      await fetchPayments();
      
      alert('Payment refunded successfully');
    } catch (err) {
      console.error('Failed to refund payment:', err);
      alert(err instanceof Error ? err.message : 'Failed to refund payment');
    }
  };

  return (
    <div className="px-1 py-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          View and manage payment transactions
        </p>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search Payments
            </label>
            <input
              type="text"
              id="search"
              placeholder="Search by user email, description or ID..."
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div>
            <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Status
            </label>
            <select
              id="statusFilter"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="succeeded">Succeeded</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 mb-1">
              Date Range
            </label>
            <select
              id="dateRange"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
        
        {/* Actions */}
        <div className="mt-4 flex justify-between items-center">
          <div>
            <span className="text-sm text-gray-600">
              {filteredPayments.length} {filteredPayments.length === 1 ? 'payment' : 'payments'} found
            </span>
          </div>
          <button
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => fetchPayments()}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading payments...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-500">No payments found matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Method
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(payment.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{payment.userEmail || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{payment.userId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{payment.description}</div>
                      {payment.subscriptionId && (
                        <div className="text-xs text-gray-500">
                          Subscription: {payment.subscriptionId}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(payment.amount, payment.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${payment.status === 'succeeded' ? 'bg-green-100 text-green-800' : 
                          payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                          payment.status === 'refunded' ? 'bg-blue-100 text-blue-800' : 
                          'bg-red-100 text-red-800'}`}>
                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.paymentMethodDetails?.type === 'card' ? (
                        <span>
                          {payment.paymentMethodDetails.card?.brand || ''} **** {payment.paymentMethodDetails.card?.last4 || ''}
                        </span>
                      ) : (
                        payment.paymentMethod
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {payment.status === 'succeeded' && (
                        <button 
                          onClick={() => handleRefundPayment(payment.id)}
                          className="text-red-600 hover:text-red-900 ml-2"
                        >
                          Refund
                        </button>
                      )}
                      <button
                        className="text-indigo-600 hover:text-indigo-900 ml-2"
                        onClick={() => window.location.href = `/admin/users/${payment.userId}`}
                      >
                        View User
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 