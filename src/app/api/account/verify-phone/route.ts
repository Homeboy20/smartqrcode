import { NextRequest, NextResponse } from 'next/server';
import { verifyUserAccess } from '@/lib/supabase/auth';
import { adminAuth, isFirebaseAdminInitialized } from '@/lib/firebase-admin';
import { verifyFirebaseIdToken } from '@/lib/firebaseIdToken';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyUserAccess(request);

    const body = await request.json().catch(() => ({} as any));
    const firebaseIdToken = String(body?.firebaseIdToken || '').trim();
    if (!firebaseIdToken) {
      return NextResponse.json({ error: 'Missing firebaseIdToken' }, { status: 400 });
    }

    const decoded = await (async () => {
      if (isFirebaseAdminInitialized()) {
        return await adminAuth.verifyIdToken(firebaseIdToken);
      }
      return await verifyFirebaseIdToken(firebaseIdToken);
    })().catch((err: any) => {
      const message = String(err?.message || err || 'Invalid token');
      throw new Error(`Invalid Firebase token: ${message}`);
    });

    const phoneNumber = String((decoded as any)?.phone_number || '').trim();
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Firebase token is missing phone_number' }, { status: 400 });
    }

    const supabaseAdmin = createServerClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase server configuration missing (SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL)' },
        { status: 500 }
      );
    }

    const { data: existing, error: getError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getError || !existing?.user) {
      return NextResponse.json(
        { error: getError?.message || 'Failed to load user' },
        { status: 500 }
      );
    }

    const nowIso = new Date().toISOString();
    const nextMetadata = {
      ...(existing.user.user_metadata ?? {}),
      phone_number: phoneNumber,
      phone_verified_at: nowIso,
      phone_provider: 'firebase',
    };

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: nextMetadata,
    });

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to update user metadata' },
        { status: 500 }
      );
    }

    // Best-effort: keep public.users email/display_name intact; no schema changes required.
    return NextResponse.json({ success: true, phoneNumber }, { status: 200 });
  } catch (err: any) {
    const message = String(err?.message || 'Internal error');
    const status = message.toLowerCase().includes('no authentication token') || message.toLowerCase().includes('invalid or expired token') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
