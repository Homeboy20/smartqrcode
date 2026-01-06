import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

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

function getBrandingUploadConfig(kind: string) {
  // kind is user-controlled input; map it to a safe, known set.
  switch (kind) {
    case 'favicon':
      return {
        folder: 'branding/favicon',
        maxBytes: 512 * 1024,
        isAllowedContentType: (t: string) =>
          t === 'image/x-icon' ||
          t === 'image/vnd.microsoft.icon' ||
          t === 'image/png' ||
          t === 'image/svg+xml' ||
          t === 'image/webp',
        description: 'favicon',
      };
    case 'logoSvg':
      return {
        folder: 'branding/logo-svg',
        maxBytes: 512 * 1024,
        isAllowedContentType: (t: string) => t === 'image/svg+xml',
        description: 'SVG logo',
      };
    case 'logo':
    default:
      return {
        folder: 'branding/logo',
        maxBytes: 2 * 1024 * 1024,
        isAllowedContentType: (t: string) => t.startsWith('image/'),
        description: 'logo',
      };
  }
}

export async function POST(req: NextRequest) {
  try {
    let authResult: { isAdmin: boolean };
    try {
      authResult = await verifyAdminAccess(req);
    } catch (e: any) {
      const message = String(e?.message || 'Authentication failed');
      if (/no authentication token|invalid authentication token|invalid or expired token/i.test(message)) {
        return json(401, { error: message });
      }
      if (/admin access required/i.test(message)) {
        return json(403, { error: message });
      }
      return json(500, { error: message });
    }

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
    const kindRaw = String(form.get('kind') || 'logo');
    const kind = kindRaw === 'favicon' || kindRaw === 'logoSvg' || kindRaw === 'logo' ? kindRaw : 'logo';
    const config = getBrandingUploadConfig(kind);

    // In some Node runtimes, `file` may not satisfy `instanceof File`.
    // We only require it to be a Blob-like object with `arrayBuffer()`.
    if (!file || typeof (file as any).arrayBuffer !== 'function') {
      return json(400, { error: 'Missing file' });
    }

    const contentType = String((file as any).type || '');
    if (!contentType) {
      return json(400, { error: 'File type is missing. Please upload a valid image.' });
    }
    if (!config.isAllowedContentType(contentType)) {
      return json(400, {
        error: `Only ${config.description} image types are supported.`,
        details: `Unsupported content type: ${contentType}`,
      });
    }

    const size = Number((file as any).size || 0);
    if (size > config.maxBytes) {
      return json(400, { error: `File is too large (max ${Math.round(config.maxBytes / 1024)}KB).` });
    }

    const bucket = process.env.NEXT_PUBLIC_BRANDING_UPLOADS_BUCKET || 'branding-assets';

    const name = String((file as any).name || config.description || 'asset');
    const safeName = sanitizeFilename(name);
    const objectPath = `${config.folder}/${crypto.randomUUID()}-${safeName}`;

    const bytes = new Uint8Array(await (file as any).arrayBuffer());

    const { error: uploadError } = await adminClient.storage
      .from(bucket)
      .upload(objectPath, bytes, {
        contentType: contentType || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      const details = uploadError.message || 'Unknown storage error';
      const hint =
        'Ensure the Supabase Storage bucket exists (default: branding-assets). If the bucket is private, make it public or adjust your app to use signed URLs.';

      const maybeNotFound = /not\s*found|bucket/i.test(details);
      const status = maybeNotFound ? 400 : 500;

      return json(status, {
        error: `Upload failed: ${details}`,
        details,
        hint,
        bucket,
        path: objectPath,
      });
    }

    const { data: publicData } = adminClient.storage.from(bucket).getPublicUrl(objectPath);

    return json(200, {
      ok: true,
      url: publicData.publicUrl,
      path: objectPath,
      contentType,
      kind,
    });
  } catch (e: any) {
    return json(500, { error: e?.message || 'Upload failed' });
  }
}
