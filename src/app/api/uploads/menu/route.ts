import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { hasFeatureAccess } from '@/lib/subscription';
import type { SubscriptionTier } from '@/lib/subscription';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function sanitizeFilename(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json(401, { error: 'Unauthorized' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) return json(401, { error: 'Unauthorized' });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return json(500, { error: 'Supabase configuration missing' });
    }

    const verifier = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } = await verifier.auth.getUser(token);
    if (userError || !userData.user) {
      return json(401, { error: 'Unauthorized' });
    }

    const user = userData.user;

    const adminClient = createServerClient();
    if (!adminClient) {
      return json(500, {
        error: 'Supabase server client is not configured',
        details: 'Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in your environment.',
      });
    }

    const { data: tierRow } = await adminClient
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier = ((tierRow as any)?.subscription_tier || 'free') as SubscriptionTier;
    if (!hasFeatureAccess(tier, 'fileUploads')) {
      return json(403, { error: 'File uploads require a Pro or Business plan.' });
    }

    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return json(400, { error: 'Missing file' });
    }

    const contentType = file.type || '';
    const isPdf = contentType === 'application/pdf';
    const isImage = contentType.startsWith('image/');

    if (!isPdf && !isImage) {
      return json(400, { error: 'Only PDF and image files are supported.' });
    }

    const maxBytes = 15 * 1024 * 1024; // 15MB
    if (file.size > maxBytes) {
      return json(400, { error: 'File is too large (max 15MB).' });
    }

    const bucket = process.env.NEXT_PUBLIC_MENU_UPLOADS_BUCKET || 'menu-uploads';

    const safeName = sanitizeFilename(file.name || (isPdf ? 'menu.pdf' : 'image'));
    const objectPath = `menus/${user.id}/${crypto.randomUUID()}-${safeName}`;

    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await adminClient.storage
      .from(bucket)
      .upload(objectPath, bytes, {
        contentType: contentType || (isPdf ? 'application/pdf' : 'application/octet-stream'),
        upsert: false,
      });

    if (uploadError) {
      return json(500, {
        error: 'Upload failed',
        details: uploadError.message,
        hint: 'Ensure the Storage bucket exists and is public if you want anyone to view the menu/brochure.',
      });
    }

    const { data: publicData } = adminClient.storage.from(bucket).getPublicUrl(objectPath);

    return json(200, {
      ok: true,
      url: publicData.publicUrl,
      path: objectPath,
      contentType,
    });
  } catch (e: any) {
    return json(500, { error: e?.message || 'Upload failed' });
  }
}
