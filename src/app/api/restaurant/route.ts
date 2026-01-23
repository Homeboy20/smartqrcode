import { NextRequest, NextResponse } from 'next/server';

import { verifyUserAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
import { ensureUniqueRestaurantSlug, slugifyRestaurantName } from '@/lib/restaurant/slug';
import { requireFeatureAccess } from '@/lib/subscription/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RestaurantRow = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  accepted_payments: string[];
  enable_table_qr: boolean;
  logo_url: string | null;
  brand_primary_color: string;
  whatsapp_order_note: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v) ? v : null;
}

function normalizePayments(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  return [];
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifyUserAccess(request);

    const supabase = createServerClient();
    if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

    const { data, error } = await supabase
      .from('restaurants')
      .select(
        'id,user_id,name,slug,whatsapp_number,accepted_payments,enable_table_qr,logo_url,brand_primary_color,whatsapp_order_note,created_at,updated_at'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ restaurant: data || null });
  } catch (error: any) {
    const message = error?.message || 'Unauthorized';
    const status = /token|auth|unauthorized|expired|bearer/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyUserAccess(request);

    const body = await request.json().catch(() => null);

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const whatsappNumber = typeof body?.whatsappNumber === 'string' ? body.whatsappNumber.trim() : '';
    const acceptedPayments = normalizePayments(body?.acceptedPayments);
    const enableTableQr = typeof body?.enableTableQr === 'boolean' ? body.enableTableQr : false;
    const logoUrl = typeof body?.logoUrl === 'string' ? body.logoUrl.trim() : '';
    const brandPrimaryColor = normalizeHexColor(body?.brandPrimaryColor) ?? '#111827';
    const whatsappOrderNote = typeof body?.whatsappOrderNote === 'string' ? body.whatsappOrderNote.trim() : '';

    if (body?.brandPrimaryColor !== undefined && !normalizeHexColor(body?.brandPrimaryColor)) {
      return badRequest('Brand color must be a hex value like #111827');
    }

    if (!name) return badRequest('Restaurant name is required');
    if (!whatsappNumber) return badRequest('WhatsApp phone number is required');

    const supabase = createServerClient();
    if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

    const gate = await requireFeatureAccess(supabase, userId, 'restaurant',
      'Restaurant features require a Pro or Business plan (or paid trial).'
    );
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const { data: existing } = await supabase
      .from('restaurants')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ error: 'Restaurant already exists for this account' }, { status: 409 });
    }

    const baseSlug = slugifyRestaurantName(name);

    const slug = await ensureUniqueRestaurantSlug(baseSlug, async (candidate) => {
      const { data } = await supabase
        .from('restaurants')
        .select('id')
        .eq('slug', candidate)
        .maybeSingle();
      return Boolean(data?.id);
    });

    const { data: created, error } = await supabase
      .from('restaurants')
      .insert({
        user_id: userId,
        name,
        slug,
        whatsapp_number: whatsappNumber,
        accepted_payments: acceptedPayments,
        enable_table_qr: enableTableQr,
        logo_url: logoUrl || null,
        brand_primary_color: brandPrimaryColor,
        whatsapp_order_note: whatsappOrderNote || null,
      })
      .select(
        'id,user_id,name,slug,whatsapp_number,accepted_payments,enable_table_qr,logo_url,brand_primary_color,whatsapp_order_note,created_at,updated_at'
      )
      .single();

    if (error || !created) {
      return NextResponse.json({ error: error?.message || 'Failed to create restaurant' }, { status: 500 });
    }

    return NextResponse.json({ restaurant: created as RestaurantRow }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/restaurant error:', error);
    const message = error?.message || 'Failed to create restaurant';
    const status = /token|auth|unauthorized|expired|bearer/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await verifyUserAccess(request);

    const body = await request.json().catch(() => null);

    const name = typeof body?.name === 'string' ? body.name.trim() : undefined;
    const whatsappNumber = typeof body?.whatsappNumber === 'string' ? body.whatsappNumber.trim() : undefined;
    const acceptedPayments = body?.acceptedPayments !== undefined ? normalizePayments(body.acceptedPayments) : undefined;
    const enableTableQr = typeof body?.enableTableQr === 'boolean' ? body.enableTableQr : undefined;
    const logoUrl = body?.logoUrl !== undefined ? (typeof body.logoUrl === 'string' ? body.logoUrl.trim() : '') : undefined;
    const brandPrimaryColor = body?.brandPrimaryColor !== undefined ? normalizeHexColor(body.brandPrimaryColor) : undefined;
    const whatsappOrderNote =
      body?.whatsappOrderNote !== undefined ? (typeof body.whatsappOrderNote === 'string' ? body.whatsappOrderNote.trim() : '') : undefined;

    if (body?.brandPrimaryColor !== undefined && !brandPrimaryColor) {
      return badRequest('Brand color must be a hex value like #111827');
    }

    if (name !== undefined && !name) return badRequest('Restaurant name is required');
    if (whatsappNumber !== undefined && !whatsappNumber) return badRequest('WhatsApp phone number is required');

    const supabase = createServerClient();
    if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

    const gate = await requireFeatureAccess(supabase, userId, 'restaurant',
      'Restaurant features require a Pro or Business plan (or paid trial).'
    );
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const patch: Record<string, any> = {};
    if (name !== undefined) patch.name = name;
    if (whatsappNumber !== undefined) patch.whatsapp_number = whatsappNumber;
    if (acceptedPayments !== undefined) patch.accepted_payments = acceptedPayments;
    if (enableTableQr !== undefined) patch.enable_table_qr = enableTableQr;
    if (logoUrl !== undefined) patch.logo_url = logoUrl || null;
    if (brandPrimaryColor !== undefined) patch.brand_primary_color = brandPrimaryColor;
    if (whatsappOrderNote !== undefined) patch.whatsapp_order_note = whatsappOrderNote || null;

    const { data: updated, error } = await supabase
      .from('restaurants')
      .update(patch)
      .eq('user_id', userId)
      .select(
        'id,user_id,name,slug,whatsapp_number,accepted_payments,enable_table_qr,logo_url,brand_primary_color,whatsapp_order_note,created_at,updated_at'
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    return NextResponse.json({ restaurant: updated as RestaurantRow }, { status: 200 });
  } catch (error: any) {
    console.error('PATCH /api/restaurant error:', error);
    const message = error?.message || 'Failed to update restaurant';
    const status = /token|auth|unauthorized|expired|bearer/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
