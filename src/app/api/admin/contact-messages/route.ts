import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAccess(request);
    if (!authResult.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error: 'Supabase server client is not configured',
          details: 'Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in your environment.'
        },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from('contact_messages')
      .select('id, created_at, name, email, subject, message, user_id')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      const message = (error as any)?.message || 'Failed to fetch contact messages';
      if (message.includes('does not exist') || message.includes('relation')) {
        return NextResponse.json(
          {
            error: 'Database table "contact_messages" does not exist. Please run the SQL migration in Supabase Dashboard.',
            details: 'Run supabase_migrations/CREATE_CONTACT_MESSAGES_TABLE.sql'
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ messages: data || [] });
  } catch (error: any) {
    const message = error?.message || 'Failed to fetch contact messages';
    const status = message.includes('Admin access required') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
