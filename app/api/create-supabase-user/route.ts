import { createClient } from '@supabase/supabase-js'; // Corrected: 'import' not 'port'
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

  let email, password, metadata;

  try {
    const body = await request.json();
    email = body.email;
    password = body.password;
    metadata = body.metadata;
  } catch (jsonError: any) {
    console.error('API route error - Invalid JSON payload:', jsonError.message);
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
  }
  if (metadata && typeof metadata !== 'object') {
    return NextResponse.json({ error: 'Metadata must be a valid JSON object.' }, { status: 400 });
  }

  try {
    const { data, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: metadata || {},
    });

    if (createUserError) {
      console.error('Supabase admin createUser error:', createUserError.message);
      return NextResponse.json({ error: createUserError.message || 'Failed to create user.' }, { status: 500 });
    }
    
    const safeUserResponse = {
      id: data.user?.id,
      email: data.user?.email,
    };
    return NextResponse.json({ message: 'User created successfully', user: safeUserResponse }, { status: 200 });

  } catch (generalError: any) {
    console.error('API route general error:', generalError.message);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}
