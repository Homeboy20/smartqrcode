import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

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
    const authResult = await verifyAdminAccess(req);
    if (!authResult.isAdmin) {
      return json(403, { error: 'Admin access required' });
    }

    const adminClient = createServerClient();
    if (!adminClient) {
      return json(500, {
        error: 'Supabase server client is not configured',
        details: 'Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in your environment.',
      });
    }

    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return json(400, { error: 'Missing file' });
    }

    const contentType = file.type || '';
    if (!contentType.startsWith('image/')) {
      return json(400, { error: 'Only image files are supported.' });
    }

    const maxBytes = 2 * 1024 * 1024; // 2MB
    if (file.size > maxBytes) {
      return json(400, { error: 'File is too large (max 2MB).' });
    }

    const bucket = process.env.NEXT_PUBLIC_BRANDING_UPLOADS_BUCKET || 'branding-assets';

    const safeName = sanitizeFilename(file.name || 'logo');
    const objectPath = `branding/logo/${crypto.randomUUID()}-${safeName}`;

    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await adminClient.storage
      .from(bucket)
      .upload(objectPath, bytes, {
        contentType: contentType || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      return json(500, {
        error: 'Upload failed',
        details: uploadError.message,
        hint: 'Ensure the Storage bucket exists and is public if you want anyone to view the logo.',
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
