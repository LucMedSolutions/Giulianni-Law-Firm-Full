import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase URL or Service Role Key is not configured.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    const body = await request.json();
    const { email, password, metadata } = body;
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }
    if (metadata && typeof metadata !== 'object') {
        return NextResponse.json({ error: 'Metadata must be a valid JSON object.' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: metadata || {},
    });
    if (error) {
      console.error('Supabase admin createUser error:', error.message);
      return NextResponse.json({ error: error.message || 'Failed to create user.' }, { status: 500 });
    }
    const safeUserResponse = { id: data.user?.id, email: data.user?.email };
    return NextResponse.json({ message: 'User created successfully', user: safeUserResponse }, { status: 200 });
  } catch (error: any) {
    console.error('API route error:', error.message);
    if (error.name === 'SyntaxError') { 
        return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
} // Ensure this brace closes the POST function
