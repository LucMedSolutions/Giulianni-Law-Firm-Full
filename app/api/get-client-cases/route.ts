import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure fresh data on every request

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // 1. Authentication & User ID
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Error getting session:', sessionError.message);
      return NextResponse.json({ error: 'Authentication Error', details: `Failed to retrieve session: ${sessionError.message}` }, { status: 500 });
    }

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized', details: 'No active session found or user ID missing. Please log in.' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Fetch Client's Cases from Supabase
    // Assumes a 'client_id' column in the 'cases' table references 'auth.users.id'.
    // Adjust '.eq('client_id', userId)' if your schema uses a different column name or linking mechanism.
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select('id, case_number, client_name, status, case_type') // Adjust columns as needed for the dropdown
      .eq('client_id', userId) // Filter cases for the currently authenticated client
      .order('created_at', { ascending: false });

    if (casesError) {
      console.error(`Error fetching cases for client ${userId}:`, casesError.message);
      return NextResponse.json({ error: 'Database Error', details: `Failed to fetch client cases: ${casesError.message}` }, { status: 500 });
    }

    // 3. Return Response
    return NextResponse.json(cases || [], { status: 200 }); // Return empty array if cases is null

  } catch (error: any) {
    console.error('Unexpected error in /api/get-client-cases:', error.message, error.stack);
    return NextResponse.json({ error: 'Internal Server Error', details: `An unexpected error occurred: ${error.message}` }, { status: 500 });
  }
}
