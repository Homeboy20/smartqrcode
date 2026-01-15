import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, isFirebaseAdminInitialized } from '@/lib/firebase-admin';
import { createServerClient } from '@/lib/supabase/server';
import { verifyFirebaseIdToken } from '@/lib/firebaseIdToken';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Firebase Bearer token' }, { status: 401 });
    }

    const firebaseToken = authHeader.slice('Bearer '.length).trim();
    if (!firebaseToken) {
      return NextResponse.json({ error: 'Missing Firebase token' }, { status: 401 });
    }

    const decoded = await (async () => {
      // Prefer Admin SDK when configured (supports revoked-token checks, etc.)
      if (isFirebaseAdminInitialized()) {
        return await adminAuth.verifyIdToken(firebaseToken);
      }

      // Fallback: verify using Firebase public keys (no service-account needed).
      // This keeps phone auth working even when Admin credentials are not present.
      return await verifyFirebaseIdToken(firebaseToken);
    })().catch((err: any) => {
      const message = String(err?.message || err || 'Invalid token');
      console.error('Firebase token verification failed:', message);
      throw new Error(`Invalid Firebase token: ${message}`);
    });

    const body = await request.json().catch(() => ({} as any));
    const redirect = typeof body?.redirect === 'string' ? body.redirect : '/';
    const displayName = typeof body?.displayName === 'string' ? body.displayName : undefined;

    const supabaseAdmin = createServerClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase server configuration missing (SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL)' },
        { status: 500 }
      );
    }

    // We use a deterministic email based on Firebase UID to bootstrap a Supabase session.
    // This keeps Firebase SMS login and Supabase session-based app features working together.
    const smsEmail = `firebase_${decoded.uid}@sms.smartqrcode.local`;

    const origin = request.nextUrl.origin;
    const redirectTo = `${origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`;

    const metadata: Record<string, any> = {
      provider: 'firebase_sms',
      firebase_uid: decoded.uid,
      phone_number: (decoded as any).phone_number || null,
    };
    if (displayName) metadata.display_name = displayName;

    // Ensure the Supabase auth user exists (ignore if already created).
    try {
      await supabaseAdmin.auth.admin.createUser({
        email: smsEmail,
        email_confirm: true,
        user_metadata: metadata,
      });
    } catch {
      // ignore: may already exist
    }

    // Generate a magic link and return it to the client.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: smsEmail,
      options: {
        redirectTo,
        data: metadata,
      },
    } as any);

    if (error || !data?.properties?.action_link) {
      return NextResponse.json(
        { error: error?.message || 'Failed to generate Supabase sign-in link' },
        { status: 500 }
      );
    }

    return NextResponse.json({ actionLink: data.properties.action_link });
  } catch (err: any) {
    console.error('Firebase SMS exchange error:', err);
    const message = String(err?.message || 'Internal error');
    const status = message.toLowerCase().includes('invalid firebase token') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
