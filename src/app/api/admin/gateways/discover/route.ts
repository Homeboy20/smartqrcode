import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
import { AFRICAN_COUNTRIES } from '@/lib/countries/africa';
import { listFlutterwaveBanks } from '@/lib/flutterwave';
import { listPaystackBanks } from '@/lib/paystack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Provider = 'paystack' | 'flutterwave';

type DiscoverRequest = {
  provider: Provider;
  scope?: 'africa';
  offset?: number;
  limit?: number;
  persist?: boolean;
};

type CountryResult = {
  code: string;
  name: string;
  ok: boolean;
  bankCount?: number;
  error?: string;
  ms: number;
};

function toInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

async function mapWithConcurrency<T, R>(items: readonly T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function runProbe(provider: Provider, countryCode: string): Promise<{ bankCount?: number }> {
  if (provider === 'flutterwave') {
    const banks = await listFlutterwaveBanks(countryCode);
    return { bankCount: banks.length };
  }

  const banks = await listPaystackBanks(countryCode);
  return { bankCount: banks.length };
}

async function persistDiscovery(params: {
  provider: Provider;
  scope: 'africa';
  total: number;
  offset: number;
  limit: number;
  results: CountryResult[];
}) {
  const supabase = createServerClient();
  if (!supabase) return;

  const key = 'gateway_discovery';

  const { data: existing } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  const currentValue = (existing as any)?.value && typeof (existing as any).value === 'object' ? (existing as any).value : {};

  const nextValue = {
    ...currentValue,
    updatedAt: new Date().toISOString(),
    [params.provider]: {
      scope: params.scope,
      total: params.total,
      lastBatch: {
        offset: params.offset,
        limit: params.limit,
        results: params.results,
      },
    },
  };

  await supabase
    .from('app_settings')
    .upsert(
      {
        key,
        value: nextValue,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: 'key' }
    );
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    await verifyAdminAccess(request);

    const body = (await request.json().catch(() => null)) as DiscoverRequest | null;
    const provider = body?.provider;

    if (provider !== 'paystack' && provider !== 'flutterwave') {
      return NextResponse.json(
        { error: 'Invalid provider. Use "paystack" or "flutterwave".' },
        { status: 400 }
      );
    }

    const scope: 'africa' = 'africa';
    const total = AFRICAN_COUNTRIES.length;

    const offset = clamp(toInt(body?.offset, 0), 0, total);
    const limit = clamp(toInt(body?.limit, 25), 1, 40);
    const persist = Boolean(body?.persist);

    const slice = AFRICAN_COUNTRIES.slice(offset, offset + limit);

    const startedAt = Date.now();
    const results = await mapWithConcurrency(slice, 6, async (c) => {
      const started = Date.now();
      try {
        const probe = await runProbe(provider, c.code);
        return {
          code: c.code,
          name: c.name,
          ok: true,
          bankCount: probe.bankCount,
          ms: Date.now() - started,
        } satisfies CountryResult;
      } catch (err: any) {
        const message = String(err?.message || 'Probe failed');
        return {
          code: c.code,
          name: c.name,
          ok: false,
          error: message,
          ms: Date.now() - started,
        } satisfies CountryResult;
      }
    });

    const ok = results.filter((r) => r.ok).length;
    const failed = results.length - ok;
    const supportedCountryCodes = results.filter((r) => r.ok).map((r) => r.code);

    const nextOffset = offset + limit < total ? offset + limit : null;

    const payload = {
      provider,
      scope,
      offset,
      limit,
      total,
      nextOffset,
      summary: {
        ok,
        failed,
        ms: Date.now() - startedAt,
      },
      supportedCountryCodes,
      results,
    };

    if (persist) {
      await persistDiscovery({ provider, scope, total, offset, limit, results });
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    const message = String(error?.message || 'Failed to discover gateway countries');

    // Keep responses JSON-only.
    const status = message.toLowerCase().includes('admin access') || message.toLowerCase().includes('authentication')
      ? 403
      : 500;

    return NextResponse.json(
      {
        error: 'Gateway discovery failed',
        details: message,
      },
      { status }
    );
  }
}
