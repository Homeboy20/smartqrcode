'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
    fill?: boolean;
  }>;
}

interface AnalyticsData {
  summary: {
    totalUsers: number;
    totalQrCodes: number;
    totalScans: number;
    activeSubscriptions: number;
    totalRevenue: string;
  };
  userGrowth: ChartData;
  qrCodeScans: ChartData;
  platformDistribution: ChartData;
  subscriptionRevenue: ChartData;
}

// Mock data for charts
const getMockData = (): AnalyticsData => {
  // Last 7 days for labels
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  // Random data for user growth
  const userGrowthData = Array.from({ length: 7 }, () => Math.floor(Math.random() * 15) + 5);
  
  // Random data for QR code scans
  const qrCodeScansData = Array.from({ length: 7 }, () => Math.floor(Math.random() * 200) + 50);
  
  // Random data for platform distribution
  const platformLabels = ['iOS', 'Android', 'Windows', 'Mac', 'Other'];
  const platformData = Array.from({ length: 5 }, () => Math.floor(Math.random() * 30) + 10);
  
  // Random data for subscription revenue
  const revenueData = Array.from({ length: 7 }, () => Math.floor(Math.random() * 500) + 100);

  return {
    summary: {
      totalUsers: 156,
      totalQrCodes: 2543,
      totalScans: 18942,
      activeSubscriptions: 78,
      totalRevenue: '$12,435',
    },
    userGrowth: {
      labels: days,
      datasets: [
        {
          label: 'New Users',
          data: userGrowthData,
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          fill: true,
        },
      ],
    },
    qrCodeScans: {
      labels: days,
      datasets: [
        {
          label: 'QR Code Scans',
          data: qrCodeScansData,
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 2,
          fill: true,
        },
      ],
    },
    platformDistribution: {
      labels: platformLabels,
      datasets: [
        {
          label: 'Platform Distribution',
          data: platformData,
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
          ],
          borderWidth: 1,
        },
      ],
    },
    subscriptionRevenue: {
      labels: days,
      datasets: [
        {
          label: 'Revenue',
          data: revenueData,
          backgroundColor: 'rgba(139, 92, 246, 0.2)',
          borderColor: 'rgba(139, 92, 246, 1)',
          borderWidth: 2,
          fill: true,
        },
      ],
    },
  };
};

export default function AnalyticsPage() {
  const { user } = useSupabaseAuth();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState<'week' | 'month' | 'year'>('week');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        if (isMountedRef.current) {
          setLoading(true);
        }
        // In a real app, fetch data from API with cache control headers
        // const response = await fetch(`/api/admin/analytics?timeFrame=${timeFrame}`, {
        //   cache: 'no-store',
        //   headers: {
        //     'Cache-Control': 'no-cache',
        //     'Pragma': 'no-cache'
        //   }
        // });
        // const data = await response.json();
        
        // For now, use mock data
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay
        if (isMountedRef.current) {
          setAnalyticsData(getMockData());
        }
      } catch (error) {
        console.error("Error fetching analytics data:", error);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchAnalyticsData();
  }, [timeFrame]);

  const renderChartPlaceholder = () => (
    <div className="animate-pulse flex flex-col">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
      <div className="h-48 bg-gray-100 rounded-lg border border-gray-200"></div>
    </div>
  );

  if (loading || !analyticsData) {
    return (
      <div className="px-1 py-4 sm:px-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="mt-1 text-sm text-gray-600">
            View detailed statistics and analytics
          </p>
        </div>
        
        {/* Loading state for summary cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-8">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white overflow-hidden shadow rounded-lg p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
              <div className="h-8 bg-gray-300 rounded w-1/2"></div>
            </div>
          ))}
        </div>
        
        {/* Loading state for charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-md">
              {renderChartPlaceholder()}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-1 py-4 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="mt-1 text-sm text-gray-600">
            View detailed statistics and analytics
          </p>
        </div>
        
        {/* Time frame selector */}
        <div className="flex rounded-lg shadow-sm">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium ${
              timeFrame === 'week'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            } rounded-l-lg border border-gray-200`}
            onClick={() => setTimeFrame('week')}
          >
            Weekly
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium ${
              timeFrame === 'month'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            } border-t border-b border-r border-gray-200`}
            onClick={() => setTimeFrame('month')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium ${
              timeFrame === 'year'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            } rounded-r-lg border-t border-b border-r border-gray-200`}
            onClick={() => setTimeFrame('year')}
          >
            Yearly
          </button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Users
                </dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {analyticsData.summary.totalUsers.toLocaleString()}
                </dd>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total QR Codes
                </dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {analyticsData.summary.totalQrCodes.toLocaleString()}
                </dd>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Scans
                </dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {analyticsData.summary.totalScans.toLocaleString()}
                </dd>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Active Subscriptions
                </dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {analyticsData.summary.activeSubscriptions.toLocaleString()}
                </dd>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Revenue
                </dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {analyticsData.summary.totalRevenue}
                </dd>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 mb-4">User Growth</h3>
          <div className="h-64 flex items-center justify-center">
            <p className="text-gray-500 text-center">
              [Chart visualization would be rendered here using Chart.js or a similar library]
              <br />
              <span className="text-sm">Data shows {timeFrame === 'week' ? 'weekly' : timeFrame === 'month' ? 'monthly' : 'yearly'} user growth</span>
            </p>
          </div>
        </div>
        
        {/* QR Code Scans Chart */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 mb-4">QR Code Scans</h3>
          <div className="h-64 flex items-center justify-center">
            <p className="text-gray-500 text-center">
              [Chart visualization would be rendered here using Chart.js or a similar library]
              <br />
              <span className="text-sm">Data shows {timeFrame === 'week' ? 'weekly' : timeFrame === 'month' ? 'monthly' : 'yearly'} scan activity</span>
            </p>
          </div>
        </div>
        
        {/* Platform Distribution Chart */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            <p className="text-gray-500 text-center">
              [Chart visualization would be rendered here using Chart.js or a similar library]
              <br />
              <span className="text-sm">Data shows distribution across different platforms</span>
            </p>
          </div>
        </div>
        
        {/* Subscription Revenue Chart */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Subscription Revenue</h3>
          <div className="h-64 flex items-center justify-center">
            <p className="text-gray-500 text-center">
              [Chart visualization would be rendered here using Chart.js or a similar library]
              <br />
              <span className="text-sm">Data shows {timeFrame === 'week' ? 'weekly' : timeFrame === 'month' ? 'monthly' : 'yearly'} revenue</span>
            </p>
          </div>
        </div>
      </div>
      
      {/* Download Reports Section */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Export Reports</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
            <svg className="h-5 w-5 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            User Report (CSV)
          </button>
          <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
            <svg className="h-5 w-5 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            QR Code Report (CSV)
          </button>
          <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
            <svg className="h-5 w-5 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Revenue Report (PDF)
          </button>
          <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
            <svg className="h-5 w-5 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Full Analytics (XLSX)
          </button>
        </div>
      </div>
    </div>
  );
} 