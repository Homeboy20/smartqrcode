import { NextRequest, NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';
import { decryptString } from '@/lib/codeEncryption';

export const dynamic = 'force-dynamic';

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getClientIp(headers: Headers): string | null {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null
  );
}

function getCountry(headers: Headers): string | null {
  return (
    headers.get('cf-ipcountry') ||
    headers.get('x-vercel-ip-country') ||
    headers.get('cloudfront-viewer-country') ||
    null
  );
}

function isSafeRedirectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data: code, error } = await supabase
      .from('qrcodes')
      .select('id, content, scans, customizations')
      .eq('id', params.id)
      .single();

    if (error || !code) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    const rawContent = String(code.content || '').trim();
    const encryptedFlag = (code as any)?.customizations?.encrypted;
    const shouldDecrypt =
      encryptedFlag === true ||
      encryptedFlag === 'true' ||
      encryptedFlag === 1 ||
      encryptedFlag === '1';

    let destination: string | null = null;

    if (shouldDecrypt) {
      try {
        destination = decryptString(rawContent);
      } catch {
        return NextResponse.json({ error: 'Invalid encrypted destination' }, { status: 400 });
      }
    } else {
      // Backward/forward compatible behavior:
      // - If content is already a safe URL, use it.
      // - Otherwise, attempt decrypt as a fallback (older rows might not have the flag).
      if (isSafeRedirectUrl(rawContent)) {
        destination = rawContent;
      } else {
        try {
          const maybeDecrypted = decryptString(rawContent);
          if (isSafeRedirectUrl(maybeDecrypted)) {
            destination = maybeDecrypted;
          }
        } catch {
          // Ignore; we'll validate below.
        }
      }
    }

    if (!destination) {
      return NextResponse.json({ error: 'Invalid destination URL' }, { status: 400 });
    }

    if (!isSafeRedirectUrl(destination)) {
      return NextResponse.json({ error: 'Invalid destination URL' }, { status: 400 });
    }

    // Prevent redirect loops if a dynamic code accidentally points to another /c/* URL on this host.
    try {
      const destUrl = new URL(destination);
      const requestHost = request.nextUrl.host;
      if (destUrl.host === requestHost && destUrl.pathname.startsWith('/c/')) {
        return new NextResponse(
          `<!doctype html><html><head><meta charset="utf-8" /><title>Invalid destination</title></head>
<body style="font-family:system-ui;padding:24px;max-width:720px;margin:0 auto;">
  <h1 style="margin:0 0 8px">Invalid destination</h1>
  <p style="margin:0 0 12px">This dynamic code points to another short link on the same site, which would cause a redirect loop.</p>
  <p style="margin:0;color:#555">Please edit the dynamic code destination in your dashboard.</p>
</body></html>`,
          { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } }
        );
      }
    } catch {
      // ignore
    }

    // Best-effort scan increment.
    try {
      const nextScans = Number(code.scans || 0) + 1;
      await supabase.from('qrcodes').update({
        scans: nextScans,
        last_scan: new Date().toISOString(),
      }).eq('id', params.id);

      // Best-effort scan event logging
      const userAgent = request.headers.get('user-agent');
      const referer = request.headers.get('referer');
      const country = getCountry(request.headers);
      const ip = getClientIp(request.headers);
      const ipHash = ip ? await sha256Hex(ip) : null;

      await supabase.from('qrcode_scan_events').insert({
        code_id: params.id,
        country,
        referer,
        user_agent: userAgent,
        ip_hash: ipHash,
      });
    } catch (e) {
      console.warn('Failed to increment scans:', e);
    }

    return NextResponse.redirect(destination, 302);
  } catch (error: any) {
    console.error('GET /c/[id] error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to resolve code' },
      { status: 500 }
    );
  }
}
