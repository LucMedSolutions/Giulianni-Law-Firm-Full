import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const storagePathFromQuery = searchParams.get('storage_path');
  const bucketNameFromQuery = searchParams.get('bucket_name');

  if (!storagePathFromQuery || !bucketNameFromQuery) {
    return NextResponse.json({ error: 'Bad Request', details: 'Missing storage_path or bucket_name query parameters.' }, { status: 400 });
  }

  // Authentication check using route handler client
  const cookieStore = cookies();
  const supabaseAuthClient = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { session }, error: sessionError } = await supabaseAuthClient.auth.getSession();

  if (sessionError) {
    console.error('Error getting session:', sessionError.message);
    return NextResponse.json({ error: 'Authentication Error', details: `Failed to retrieve session: ${sessionError.message}` }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized', details: 'No active session found. Please log in.' }, { status: 401 });
  }
  // User is authenticated, proceed to generate signed URL with service key

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Server-side Supabase URL or Service Key is not configured.');
    return NextResponse.json({ error: 'Configuration Error', details: 'Supabase server URL or service key is not configured.' }, { status: 500 });
  }

  // Initialize Supabase client with service role key for privileged operations
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const expiresIn = 60; // URL valid for 60 seconds

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucketNameFromQuery)
      .createSignedUrl(storagePathFromQuery, expiresIn);

    if (error) {
      console.error('Error generating signed URL:', error.message);
      return NextResponse.json({ error: 'Storage Error', details: `Failed to generate signed URL: ${error.message}` }, { status: 500 });
    }

    if (!data || !data.signedUrl) {
      console.error('No signed URL in data despite no error:', data);
      return NextResponse.json({ error: 'Storage Error', details: 'Failed to generate signed URL: No URL was returned from Supabase.' }, { status: 500 });
    }
    
    return NextResponse.json({ signedUrl: data.signedUrl }, { status: 200 });

  } catch (e: any) {
    console.error('Unexpected error during signed URL generation:', e.message, e.stack);
    return NextResponse.json({ error: 'Internal Server Error', details: `An unexpected error occurred while generating the signed URL: ${e.message}` }, { status: 500 });
  }
}
