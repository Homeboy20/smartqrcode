import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Fetch all QR codes from Supabase
    const { data: qrCodes, error } = await supabase
      .from('qrcodes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ qrCodes: qrCodes || [] }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching QR codes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch QR codes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const body = await request.json();
    const { userId, name, content, type, format, customizations, userEmail } = body;

    if (!userId || !name || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, name, content' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Create new QR code
    const { data, error } = await supabase
      .from('qrcodes')
      .insert({
        user_id: userId,
        user_email: userEmail || null,
        name,
        content,
        type: type || 'qrcode',
        format: format || 'png',
        scans: 0,
        customizations: customizations || {}
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      { 
        success: true,
        qrCode: data
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating QR code:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create QR code' },
      { status: 500 }
    );
  }
}
