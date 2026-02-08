"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

type ScanEvent = {
  scanned_at: string;
  country: string | null;
  referer: string | null;
  user_agent: string | null;
};

type AnalyticsResponse = {
  code: {
    id: string;
    name: string;
    type: string;
    scans: number;
    created_at?: string;
    last_scan?: string | null;
  };
  events: ScanEvent[];
  summary: {
    total_events: number;
    top_countries: Array<{ country: string; count: number }>;
    per_day: Array<{ day: string; count: number }>;
  };
};

function fmtDateTime(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString();
}

export default function CodeAnalyticsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, getAccessToken } = useSupabaseAuth();

  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user === null) {
      router.replace(`/login?redirect=/dashboard/codes/${params.id}/analytics`);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          router.replace(`/login?redirect=/dashboard/codes/${params.id}/analytics`);
          return;
        }

        const res = await fetch(`/api/codes/${params.id}/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        const json = (await res.json().catch(() => ({}))) as any;
        if (!res.ok) {
          throw new Error(json?.error || 'Failed to load analytics');
        }

        setData(json as AnalyticsResponse);
      } catch (e: any) {
        setError(e?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [user, getAccessToken, params.id, router]);

  const topCountries = useMemo(() => data?.summary?.top_countries || [], [data]);
  const dailyCounts = useMemo(() => data?.summary?.per_day || [], [data]);
  const averagePerDay = useMemo(() => {
    if (!dailyCounts.length) return 0;
    const total = dailyCounts.reduce((sum, row) => sum + row.count, 0);
    return Math.round(total / dailyCounts.length);
  }, [dailyCounts]);

  const eventsCsv = useMemo(() => {
    if (!data?.events?.length) return '';
    const rows = ['scanned_at,country,referer,user_agent'];
    data.events.forEach((e) => {
      const row = [
        e.scanned_at || '',
        e.country || '',
        e.referer || '',
        e.user_agent || '',
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',');
      rows.push(row);
    });
    return rows.join('\n');
  }, [data]);

  function downloadCsv() {
    if (!eventsCsv || !data?.code?.id) return;
    const blob = new Blob([eventsCsv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `code-analytics-${data.code.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dynamic Code Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
            {data?.code?.name ? data.code.name : 'Code'} · {data?.code?.type || 'qrcode'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Back
          </Link>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!data?.events?.length}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            Download CSV
          </button>
          {data?.code?.id ? (
            <Link
              href={`/c/${data.code.id}`}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Open
            </Link>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Loading analytics…
        </div>
      ) : error ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          {error}
        </div>
      ) : data ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs font-semibold text-gray-500">Total scans</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{data.code.scans ?? 0}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs font-semibold text-gray-500">Total events</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{data.summary.total_events ?? 0}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs font-semibold text-gray-500">Last scan</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{fmtDateTime(data.code.last_scan) || '—'}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs font-semibold text-gray-500">Avg scans/day</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{averagePerDay}</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-100 p-4 font-semibold text-gray-900">Top countries (recent)</div>
              <div className="p-4">
                {topCountries.length ? (
                  <div className="space-y-2">
                    {topCountries.map((c) => (
                      <div key={c.country} className="flex items-center justify-between text-sm">
                        <span className="text-gray-800">{c.country}</span>
                        <span className="font-semibold text-gray-900">{c.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">No scan events yet.</div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-100 p-4 font-semibold text-gray-900">Recent scans</div>
              <div className="divide-y divide-gray-100">
                {(data.events || []).slice(0, 30).map((e, idx) => (
                  <div key={`${e.scanned_at}-${idx}`} className="p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-gray-900">{fmtDateTime(e.scanned_at)}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                        {e.country || 'Unknown'}
                      </span>
                    </div>
                    {e.referer ? (
                      <div className="mt-1 truncate text-xs text-gray-600">Referrer: {e.referer}</div>
                    ) : null}
                  </div>
                ))}
                {!data.events?.length ? (
                  <div className="p-4 text-sm text-gray-600">No scans yet.</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 p-4 font-semibold text-gray-900">Daily scans</div>
            <div className="p-4">
              {dailyCounts.length ? (
                <div className="space-y-2">
                  {dailyCounts.map((row) => (
                    <div key={row.day} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-gray-600">{row.day}</div>
                      <div className="flex-1 h-2 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-indigo-600"
                          style={{ width: `${Math.min(100, row.count * 10)}%` }}
                        />
                      </div>
                      <div className="w-10 text-right text-xs font-semibold text-gray-700">{row.count}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">No daily data yet.</div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
