"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";

import { useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { useSubscription } from "@/hooks/useSubscription";

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

function StatCard({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
      {helper ? <div className="mt-2 text-xs text-gray-500">{helper}</div> : null}
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
      <div className="text-sm font-semibold text-gray-900">{title}</div>
      <p className="mt-1 text-sm text-gray-600">{body}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user, loading: authLoading, getAccessToken } = useSupabaseAuth();
  const { canUseFeature, loading: subscriptionLoading } = useSubscription();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<Record<string, ChartData>>({});

  const analyticsEnabled = !!user && canUseFeature("analytics");
  const getAccessTokenRef = useRef(getAccessToken);

  useEffect(() => {
    getAccessTokenRef.current = getAccessToken;
  }, [getAccessToken]);

  const fetchSummary = useCallback(async () => {
    if (!user || !analyticsEnabled) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/summary", { cache: "no-store" });

      if (res.status === 401) {
        const token = await getAccessTokenRef.current();
        const retry = await fetch("/api/analytics/summary", {
          cache: "no-store",
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
      console.error("Error fetching analytics summary:", err);
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [user, analyticsEnabled]);

  useEffect(() => {
    if (authLoading || subscriptionLoading) return;

    if (!user || !analyticsEnabled) {
      setLoading(false);
      setSummary(null);
      setError(null);
      return;
    }

    fetchSummary();
  }, [authLoading, subscriptionLoading, user, analyticsEnabled, fetchSummary]);

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
          label: "Total scans by code type",
          data,
          backgroundColor: "rgba(79, 70, 229, 0.7)",
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
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-10">
          <div className="h-36 rounded-2xl bg-white/70 shadow-sm border border-gray-200 animate-pulse" />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/70 border border-gray-200 animate-pulse" />
            ))}
          </div>
          <div className="mt-6 h-64 rounded-2xl bg-white/70 border border-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-3xl px-4 py-12">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <div className="text-sm font-semibold">Analytics failed to load</div>
            <div className="mt-1 text-sm">{error}</div>
            <button
              onClick={fetchSummary}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-xl px-4 py-12">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
            <div className="text-sm font-semibold text-gray-900">Sign in required</div>
            <p className="mt-1 text-sm text-gray-600">Please sign in to view analytics.</p>
            <Link
              href="/login?redirect=/analytics"
              className="mt-4 inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!analyticsEnabled) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-xl px-4 py-12">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
            <div className="text-sm font-semibold text-gray-900">Analytics unavailable</div>
            <p className="mt-1 text-sm text-gray-600">Upgrade to Pro or Business to access analytics.</p>
            <Link
              href="/pricing"
              className="mt-4 inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              View pricing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-3xl px-4 py-12">
          <EmptyPanel title="No analytics yet" body="Generate and share a code to start tracking scans." />
        </div>
      </div>
    );
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: false, text: "" },
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: "#eef2f7" } },
    },
  };

  const topCode = summary.topCodes?.[0];
  const avgScansPerCode = summary.totalCodes ? Math.round(summary.totalScans / summary.totalCodes) : 0;
  const topType = Object.entries(summary.codesByType || {})
    .sort(([, a], [, b]) => (b.scans || 0) - (a.scans || 0))
    .map(([k]) => k)[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white via-white to-indigo-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">ScanMagic Analytics</div>
              <h1 className="mt-2 text-2xl font-bold text-gray-900">Overview</h1>
              <p className="mt-1 text-sm text-gray-600">Monitor scan performance and the codes driving the most engagement.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={fetchSummary}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Refresh
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Back to dashboard
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total codes" value={summary.totalCodes} helper="Across QR + barcodes" />
            <StatCard label="Total scans" value={summary.totalScans} helper="All-time tracked" />
            <StatCard label="Average scans/code" value={avgScansPerCode} helper="Benchmark performance" />
            <StatCard label="Top code type" value={topType || "—"} helper="Highest total scans" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Scans by type</h2>
              <span className="text-xs text-gray-500">Last 30 days</span>
            </div>
            <div className="mt-4">
              {chartData.scansByType?.labels?.length ? (
                <Bar options={chartOptions} data={chartData.scansByType} />
              ) : (
                <EmptyPanel title="No scan data" body="Share a code to start tracking scans." />
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Top code</h2>
            {topCode ? (
              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900 truncate">{topCode.name || topCode.id}</div>
                  <div className="text-xs text-gray-500">{topCode.type || "unknown"}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">Total scans</div>
                  <div className="mt-1 text-xl font-bold text-gray-900">{topCode.scans}</div>
                </div>
                <Link
                  href={`/dashboard/codes/${topCode.id}/analytics`}
                  className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  View detailed analytics
                </Link>
              </div>
            ) : (
              <EmptyPanel title="No top code yet" body="Generate and share a code to start tracking." />
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Top codes</h2>
            <Link href="/dashboard" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              View recent codes →
            </Link>
          </div>
          {summary.topCodes?.length ? (
            <div className="mt-4 divide-y divide-gray-100">
              {summary.topCodes.map((code) => (
                <div key={code.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{code.name || code.id}</div>
                    <div className="text-xs text-gray-500">{code.type || "unknown"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-gray-900">{code.scans} scans</div>
                    <Link
                      href={`/dashboard/codes/${code.id}/analytics`}
                      className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel title="No scans yet" body="Start sharing your codes to see performance." />
          )}
        </div>
      </div>
    </div>
  );
}
