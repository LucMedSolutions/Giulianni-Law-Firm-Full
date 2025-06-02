import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutError = new Error('Operation timed out')): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(timeoutError), ms))
  ]);
}

const SUPABASE_TIMEOUT_MS = 10000; // 10 seconds, adjust as needed

export const dynamic = 'force-dynamic'; // Ensure fresh data on every request

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // 1. Authentication & User ID
    const { data: { session }, error: sessionError } = await withTimeout(
      supabase.auth.getSession(),
      SUPABASE_TIMEOUT_MS,
      new Error('Timeout getting session')
    );

    if (sessionError) {
      console.error('Error getting session:', sessionError.message);
      const status = sessionError.message === 'Timeout getting session' ? 504 : 500;
      return NextResponse.json({ error: 'Authentication Error', details: `Failed to retrieve session: ${sessionError.message}` }, { status });
    }

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized', details: 'No active session found or user ID missing. Please log in.' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Fetch Client's Cases from Supabase
    const { data: cases, error: casesError } = await withTimeout(
      supabase
        .from('cases')
        .select('id, case_number, client_name, status, case_type') // Adjust columns as needed for the dropdown
        .eq('client_id', userId) // Filter cases for the currently authenticated client
        .order('created_at', { ascending: false }),
      SUPABASE_TIMEOUT_MS,
      new Error('Timeout fetching client cases')
    );

    if (casesError) {
      console.error(`Error fetching cases for client ${userId}:`, casesError.message);
      const status = casesError.message === 'Timeout fetching client cases' ? 504 : 500;
      return NextResponse.json({ error: 'Database Error', details: `Failed to fetch client cases: ${casesError.message}` }, { status });
    }

    // 3. Return Response
    return NextResponse.json(cases || [], { status: 200 }); // Return empty array if cases is null

  } catch (error: any) {
    console.error('Unexpected error in /api/get-client-cases:', error.message, error.stack);
    if (error.message && error.message.toLowerCase().includes('timeout')) {
      return NextResponse.json({ error: 'An operation timed out.', details: error.message }, { status: 504 });
    }
    return NextResponse.json({ error: 'Internal Server Error', details: `An unexpected error occurred: ${error.message}` }, { status: 500 });
  }
}
