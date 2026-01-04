import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';

function isValidEmail(value: string) {
  // Must align with DB constraint in CREATE_CONTACT_MESSAGES_TABLE.sql
  return /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i.test(value);
}

function sha256Hex(input: string) {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any));

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // basic length bounds to avoid abuse
    if (name.length > 120 || email.length > 200 || subject.length > 200 || message.length > 5000) {
      return NextResponse.json({ error: 'Input too long' }, { status: 400 });
    }

    const supabaseAdmin = createServerClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase server configuration missing' },
        { status: 500 }
      );
    }

    const contentHash = sha256Hex(`${email}\n${subject}\n${message}`);

    const { error } = await supabaseAdmin.from('contact_messages').insert({
      name,
      email,
      subject,
      message,
      content_hash: contentHash,
      source: 'edge_function',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Contact submission error:', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
