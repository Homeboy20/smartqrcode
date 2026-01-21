"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import Link from "next/link";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
  }[];
}

type AnalyticsSummary = {
  totalCodes: number;
  totalScans: number;
  codesByType: Record<string, { count: number; scans: number }>;
  topCodes: Array<{ id: string; name: string | null; type: string | null; scans: number }>;
};

export default function AnalyticsPage() {
  const { user, loading: authLoading, getAccessToken } = useSupabaseAuth();
  const { canUseFeature, loading: subscriptionLoading } = useSubscription();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<Record<string, ChartData>>({});

  const fetchSummary = useCallback(async () => {
    if (!user) return;

    if (!canUseFeature('analytics')) {
      setError('Analytics feature is not available for your current subscription tier.');
      setSummary(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/summary', { cache: 'no-store' });

      if (res.status === 401) {
        const token = await getAccessToken();
        const retry = await fetch('/api/analytics/summary', {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const body = await retry.json().catch(() => ({} as any));
        if (!retry.ok) throw new Error(body?.error || `Failed to load analytics (${retry.status})`);
        setSummary(body as AnalyticsSummary);
        return;
      }

      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(body?.error || `Failed to load analytics (${res.status})`);

      setSummary(body as AnalyticsSummary);
    } catch (err) {
      console.error('Error fetching analytics summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [user, canUseFeature, getAccessToken]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const typeChart = useMemo<ChartData | null>(() => {
    if (!summary) return null;
    const entries = Object.entries(summary.codesByType || {})
      .sort(([, a], [, b]) => (b.scans || 0) - (a.scans || 0));
    const labels = entries.map(([k]) => k);
    const data = entries.map(([, v]) => Number(v.scans) || 0);
    return {
      labels,
      datasets: [
        {
          label: 'Total scans by code type',
          data,
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
        },
      ],
    };
  }, [summary]);

  useEffect(() => {
    if (!typeChart) {
      setChartData({});
      return;
    }
    setChartData({ scansByType: typeChart });
  }, [typeChart]);

  if (authLoading || subscriptionLoading || loading) {
    return <div className="text-center py-10">Loading analytics...</div>;
  }
  
  if (error) {
    return <div className="text-center py-10 text-red-600">Error: {error}</div>;
  }

  if (!user) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-semibold mb-4">Sign in required</h2>
        <p className="text-gray-600">Please sign in to view analytics.</p>
        <div className="mt-6">
          <Link href="/login?redirect=/analytics" className="px-4 py-2 bg-indigo-600 text-white rounded">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!canUseFeature('analytics')) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-semibold mb-4">Analytics Unavailable</h2>
        <p className="text-gray-600">Upgrade to Pro or Business to access analytics.</p>
        <div className="mt-6">
          <Link href="/pricing" className="px-4 py-2 bg-indigo-600 text-white rounded">
            View pricing
          </Link>
        </div>
      </div>
    );
  }

  if (!summary) {
    return <div className="text-center py-10">No analytics available yet.</div>;
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Chart Title',
      },
    },
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <SummaryCard title="Total Codes" value={summary.totalCodes} />
        <SummaryCard title="Total Scans" value={summary.totalScans} />
        <SummaryCard title="Top Code Scans" value={summary.topCodes?.[0]?.scans || 0} />
        <SummaryCard title="Top Code Type" value={(summary.topCodes?.[0]?.type || 'N/A') as any} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Scans by Type Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Scans by Type</h2>
            <button
              onClick={fetchSummary}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Refresh
            </button>
          </div>
          <div className="mt-4">
            {chartData.scansByType?.labels?.length > 0 ? (
              <Bar
                options={{
                  ...chartOptions,
                  plugins: { ...chartOptions.plugins, title: { display: true, text: 'Total scans by type' } },
                }}
                data={chartData.scansByType}
              />
            ) : (
              <p className="text-gray-600">No scan data yet.</p>
            )}
          </div>
        </div>

        {/* Top Codes */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Top Codes</h2>
          {summary.topCodes?.length ? (
            <ul className="space-y-2">
              {summary.topCodes.map((code) => (
                <li key={code.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{code.name || code.id}</div>
                    <div className="text-xs text-gray-500">{code.type || 'unknown'}</div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{code.scans} scans</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">No scanned codes yet.</p>
          )}

          <div className="mt-6">
            <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-700 font-medium">
              View recent codes →
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="hero bg-cover bg-center py-20" style={{ backgroundImage: 'url(/path/to/your/image.jpg)' }}>
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-4">Welcome to Our Service</h1>
          <p className="text-xl text-white mb-8">Discover the best features and benefits we offer.</p>
          <button className="px-6 py-3 bg-blue-500 text-white rounded">Get Started</button>
        </div>
      </div>

      {/* Features Section */}
      <div className="features py-20">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="feature text-center">
              <img src="/path/to/icon1.png" alt="Feature 1" className="mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Feature 1</h3>
              <p>Short description of feature 1.</p>
            </div>
            <div className="feature text-center">
              <img src="/path/to/icon2.png" alt="Feature 2" className="mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Feature 2</h3>
              <p>Short description of feature 2.</p>
            </div>
            <div className="feature text-center">
              <img src="/path/to/icon3.png" alt="Feature 3" className="mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Feature 3</h3>
              <p>Short description of feature 3.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="testimonials bg-gray-100 py-20">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Testimonials</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="testimonial p-6 bg-white rounded shadow">
              <p className="mb-4">"This service is amazing! It has changed the way I work."</p>
              <p className="font-semibold">- Customer Name</p>
            </div>
            <div className="testimonial p-6 bg-white rounded shadow">
              <p className="mb-4">"Highly recommend to everyone looking for great features."</p>
              <p className="font-semibold">- Another Customer</p>
            </div>
          </div>
        </div>
      </div>

      {/* About Us Section */}
      <div className="about-us py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">About Us</h2>
          <p className="mb-4">We are a company dedicated to providing the best service to our customers.</p>
          <p>Our mission is to deliver high-quality products that meet the needs of our clients.</p>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="pricing bg-gray-100 py-20">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="pricing-plan p-6 bg-white rounded shadow text-center">
              <h3 className="text-xl font-semibold mb-4">Basic Plan</h3>
              <p className="text-2xl font-bold mb-4">$9.99/month</p>
              <button className="px-4 py-2 bg-blue-500 text-white rounded">Choose Plan</button>
            </div>
            <div className="pricing-plan p-6 bg-white rounded shadow text-center">
              <h3 className="text-xl font-semibold mb-4">Pro Plan</h3>
              <p className="text-2xl font-bold mb-4">$19.99/month</p>
              <button className="px-4 py-2 bg-blue-500 text-white rounded">Choose Plan</button>
            </div>
            <div className="pricing-plan p-6 bg-white rounded shadow text-center">
              <h3 className="text-xl font-semibold mb-4">Enterprise Plan</h3>
              <p className="text-2xl font-bold mb-4">Contact Us</p>
              <button className="px-4 py-2 bg-blue-500 text-white rounded">Contact Sales</button>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div className="contact py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Contact Us</h2>
          <p className="mb-4">Have questions? We'd love to hear from you.</p>
          <form className="max-w-md mx-auto">
            <input type="text" placeholder="Your Name" className="w-full p-2 mb-4 border rounded" />
            <input type="email" placeholder="Your Email" className="w-full p-2 mb-4 border rounded" />
            <textarea placeholder="Your Message" className="w-full p-2 mb-4 border rounded"></textarea>
            <button type="submit" className="px-6 py-3 bg-blue-500 text-white rounded">Send Message</button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer bg-gray-800 text-white py-6">
        <div className="container mx-auto text-center">
          <p>&copy; 2023 Your Company. All rights reserved.</p>
          <div className="social-icons mt-4">
            <a href="#" className="mx-2">Facebook</a>
            <a href="#" className="mx-2">Twitter</a>
            <a href="#" className="mx-2">LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string | number;
}

function SummaryCard({ title, value }: SummaryCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
      <p className="text-2xl font-semibold text-gray-900">{value || 'N/A'}</p>
    </div>
  );
} 