import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  console.log("Accessed /api/create-supabase-user POST route");
  console.log("Supabase URL from env:", supabaseUrl ? "SET" : "NOT SET");
  // Log only a few chars of the key for security if it's set
  if (serviceRoleKey) {
    console.log("Service Role Key from env: SET (starts with: " + serviceRoleKey.substring(0,5) + "...)");
  } else {
    console.log("Service Role Key from env: NOT SET");
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase URL or Service Role Key is not configured in environment variables.');
    return NextResponse.json({ error: 'Server configuration error. Check environment variables. Ensure SUPABASE_SERVICE_ROLE_KEY is set for the backend.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let email, password, metadata;

  try {
    const body = await request.json();
    console.log("Request body received:", body);
    email = body.email;
    password = body.password;
    metadata = body.metadata;
  } catch (jsonError: any) {
    console.error('API route error - Invalid JSON payload:', jsonError.message);
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!email || !password) {
    console.log("Validation failed: Email or password missing.");
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  if (password.length < 6) {
    console.log("Validation failed: Password too short.");
    return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
  }
  if (metadata && typeof metadata !== 'object') {
    console.log("Validation failed: Metadata is not a valid JSON object.");
    return NextResponse.json({ error: 'Metadata must be a valid JSON object.' }, { status: 400 });
  }

  console.log(`Attempting to create user in Supabase: ${email} with metadata:`, metadata);

  try {
    const { data, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: metadata || {},
    });

    if (createUserError) {
      console.error('Supabase admin.createUser returned an error:', createUserError.message);
      return NextResponse.json({ error: createUserError.message || 'Failed to create user due to Supabase error.' }, { status: 500 });
    }
    
    const safeUserResponse = {
      id: data.user?.id,
      email: data.user?.email,
    };
    console.log("Supabase admin.createUser supposedly successful:", safeUserResponse);
    return NextResponse.json({ message: 'User created successfully', user: safeUserResponse }, { status: 200 });

  } catch (generalError: any) {
    console.error('API route error during createUser block:', generalError.message);
    return NextResponse.json({ error: generalError.message || 'An unexpected error occurred during user creation.' }, { status: 500 });
  }
}
