import { NextRequest, NextResponse } from 'next/server';
import { 
  listFlutterwaveCustomers,
  createFlutterwaveCustomer,
  searchFlutterwaveCustomers,
  type FlutterwaveCustomer 
} from '@/lib/flutterwave';
import { verifyAdminAccess } from '@/lib/supabase/auth';

// GET - List customers
export async function GET(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const size = parseInt(searchParams.get('size') || '10');
    const email = searchParams.get('email');
    const name = searchParams.get('name');

    // Search if filters provided
    if (email || name) {
      const results = await searchFlutterwaveCustomers({ 
        email: email || undefined, 
        name: name || undefined 
      });
      return NextResponse.json({ 
        customers: results,
        meta: { total: results.length }
      });
    }

    // List all customers with pagination
    const result = await listFlutterwaveCustomers({ page, size });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching Flutterwave customers:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch customers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Create customer
export async function POST(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const body = await request.json();
    const { email, name, phone, address, meta } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const customerData: FlutterwaveCustomer = {
      email,
      ...(name && { name }),
      ...(phone && { phone }),
      ...(address && { address }),
      ...(meta && { meta }),
    };

    const customer = await createFlutterwaveCustomer(customerData);
    
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error('Error creating Flutterwave customer:', error);
    const message = error instanceof Error ? error.message : 'Failed to create customer';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
