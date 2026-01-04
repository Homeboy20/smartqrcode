import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await verifyAdminAccess(request);

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data: qrCode, error } = await supabase
      .from('qrcodes')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !qrCode) {
      return NextResponse.json({ error: 'QR code not found' }, { status: 404 });
    }

    return NextResponse.json({ qrCode }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching QR code:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch QR code' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await verifyAdminAccess(request);

    const body = await request.json();
    const { name, content, type, format, customizations } = body;

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (format !== undefined) updateData.format = format;
    if (customizations !== undefined) updateData.customizations = customizations;

    const { error } = await supabase
      .from('qrcodes')
      .update(updateData)
      .eq('id', params.id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      { success: true, message: 'QR code updated successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating QR code:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update QR code' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await verifyAdminAccess(request);

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { error } = await supabase
      .from('qrcodes')
      .delete()
      .eq('id', params.id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      { success: true, message: 'QR code deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting QR code:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete QR code' },
      { status: 500 }
    );
  }
}
