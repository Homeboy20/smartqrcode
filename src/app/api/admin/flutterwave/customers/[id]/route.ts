import { NextRequest, NextResponse } from 'next/server';
import { 
  getFlutterwaveCustomer,
  updateFlutterwaveCustomer,
  type FlutterwaveCustomer 
} from '@/lib/flutterwave';
import { verifyAdminAccess } from '@/lib/supabase/auth';

// GET - Get single customer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await verifyAdminAccess(request);

    const customer = await getFlutterwaveCustomer(params.id);
    
    return NextResponse.json({ customer });
  } catch (error) {
    console.error('Error fetching Flutterwave customer:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch customer';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Update customer
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await verifyAdminAccess(request);

    const body = await request.json();
    const updates: Partial<FlutterwaveCustomer> = {};

    if (body.email) updates.email = body.email;
    if (body.name) updates.name = body.name;
    if (body.phone) updates.phone = body.phone;
    if (body.address) updates.address = body.address;
    if (body.meta) updates.meta = body.meta;

    const customer = await updateFlutterwaveCustomer(params.id, updates);
    
    return NextResponse.json({ customer });
  } catch (error) {
    console.error('Error updating Flutterwave customer:', error);
    const message = error instanceof Error ? error.message : 'Failed to update customer';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
