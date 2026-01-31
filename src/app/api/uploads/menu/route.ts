import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { createServerClient } from '@/lib/supabase/server';
import { hasFeatureAccess } from '@/lib/subscription';
import type { SubscriptionTier } from '@/lib/subscription';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function safeRandomId() {
  try {
    return typeof randomUUID === 'function' ? randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
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

    // Restaurant uploads (menu images / PDFs) also require restaurant access.
    if (!hasFeatureAccess(tier, 'restaurant')) {
      return json(402, { error: 'Restaurant uploads require a Pro or Business plan (or paid trial).' });
    }

    const form = await req.formData();
    const file = form.get('file');

    if (!file || typeof (file as any).arrayBuffer !== 'function') {
      return json(400, { error: 'Missing file' });
    }

    const fileAny: any = file;
    const originalName = typeof fileAny?.name === 'string' ? fileAny.name : '';
    const size = typeof fileAny?.size === 'number' ? fileAny.size : 0;
    const contentType = typeof fileAny?.type === 'string' ? fileAny.type : '';
    const isPdf = contentType === 'application/pdf';
    const isImage = contentType.startsWith('image/');

    if (!isPdf && !isImage) {
      return json(400, { error: 'Only PDF and image files are supported.' });
    }

    const maxBytes = 15 * 1024 * 1024; // 15MB
    if (size > maxBytes) {
      return json(400, { error: 'File is too large (max 15MB).' });
    }

    const safeName = sanitizeFilename(originalName || (isPdf ? 'menu.pdf' : 'image'));
    const relativePath = `menus/${user.id}/${safeRandomId()}-${safeName}`;
    
    // Save to public/uploads directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const userDir = path.join(uploadsDir, 'menus', user.id);
    const filePath = path.join(uploadsDir, relativePath);

    // Ensure directory exists
    if (!existsSync(userDir)) {
      await mkdir(userDir, { recursive: true });
    }

    const bytes = Buffer.from(await fileAny.arrayBuffer());

    try {
      await writeFile(filePath, bytes);
    } catch (writeError: any) {
      return json(500, {
        error: 'Upload failed',
        details: writeError.message,
        hint: 'Ensure the server has write permissions to the public/uploads directory.',
      });
    }

    // Return public URL relative to your domain
    const publicUrl = `/uploads/${relativePath}`;

    return json(200, {
      ok: true,
      url: publicUrl,
      path: relativePath,
      contentType,
    });
  } catch (e: any) {
    console.error('Upload /api/uploads/menu failed', {
      message: e?.message,
      name: e?.name,
      stack: e?.stack,
    });
    return json(500, {
      error: 'Upload failed',
      details: String(e?.message || 'Internal Server Error'),
    });
  }
}
