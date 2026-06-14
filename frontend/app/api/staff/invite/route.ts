import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { name, email, password, vendor_id } = await request.json();

    if (!name || !email || !password || !vendor_id) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Name, email, password, and vendor_id are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Access token is missing or malformed.' },
        { status: 401 }
      );
    }
    const token = authHeader.split(' ')[1];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'Database credentials (SUPABASE_SERVICE_ROLE_KEY) are not configured on the server.' },
        { status: 500 }
      );
    }

    // Verify token with anon client
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey || '');
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Session has expired or is invalid.' },
        { status: 401 }
      );
    }

    // Admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is an owner of this vendor
    const { data: callerStaff, error: callerError } = await supabaseAdmin
      .from('staff')
      .select('role, vendor_id')
      .eq('auth_user_id', user.id)
      .eq('vendor_id', vendor_id)
      .single();

    if (callerError || !callerStaff || callerStaff.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only store owners can add staff members.' },
        { status: 403 }
      );
    }

    // 1. Create the auth user
    const { data: newAuthUser, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authCreateError) {
      if (authCreateError.message?.includes('already been registered') || authCreateError.message?.includes('already exists')) {
        return NextResponse.json(
          { error: 'Conflict', message: 'A user with this email address already exists.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Internal Server Error', message: authCreateError.message },
        { status: 500 }
      );
    }

    if (!newAuthUser.user) {
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'Failed to create auth user.' },
        { status: 500 }
      );
    }

    // 2. Create the staff record
    const { data: staffRecord, error: staffError } = await supabaseAdmin
      .from('staff')
      .insert([{
        vendor_id,
        auth_user_id: newAuthUser.user.id,
        name,
        full_name: name,
        email,
        role: 'assistant',
        is_active: true,
      }])
      .select()
      .single();

    if (staffError) {
      // Rollback auth user creation
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id);
      return NextResponse.json(
        { error: 'Internal Server Error', message: staffError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Assistant created successfully.',
      staff: {
        id: staffRecord.id,
        full_name: staffRecord.full_name,
        email: staffRecord.email,
        role: staffRecord.role,
        is_active: staffRecord.is_active,
      },
    }, { status: 201 });

  } catch (err: any) {
    console.error('API Invite Route Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', message: err.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
