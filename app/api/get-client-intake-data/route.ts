import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure fresh data on every request

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // 1. Authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Error getting session:', sessionError.message);
      return NextResponse.json({ error: 'Authentication Error', details: `Failed to retrieve session: ${sessionError.message}` }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', details: 'No active session found. Please log in.' }, { status: 401 });
    }

    // Optional: User role check (similar to get-cases-for-staff)
    // ... (add if necessary, for now authenticated access is enough for this specific data point if RLS is set up)

    // 2. Get case_id from Query Parameter
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('case_id');

    if (!caseId) {
      return NextResponse.json({ error: 'Bad Request', details: 'The case_id query parameter is required.' }, { status: 400 });
    }

    // 3. Fetch Client Intake Data from Supabase
    const { data: intakeRecord, error: fetchError } = await supabase
      .from('client_intake_data') // Ensure this table name is correct
      .select('data') // Assuming the JSONB column is named 'data'
      .eq('case_id', caseId)
      .maybeSingle();

    if (fetchError) {
      console.error(`Error fetching client intake data for case ${caseId}:`, fetchError.message);
      return NextResponse.json({ error: 'Database Error', details: `Failed to fetch client intake data: ${fetchError.message}` }, { status: 500 });
    }

    // 4. Handle Not Found
    if (!intakeRecord || !intakeRecord.data) {
      // If intakeRecord is null or intakeRecord.data is null/empty
      return NextResponse.json({ error: 'Not Found', details: `No client intake data found for case_id: ${caseId}.` }, { status: 404 });
    }

    // 5. Return Response
    // The actual JSONB data is in the 'data' field of the fetched record.
    return NextResponse.json(intakeRecord.data, { status: 200 });

  } catch (error: any) {
    console.error('Unexpected error in /api/get-client-intake-data:', error.message, error.stack);
    return NextResponse.json({ error: 'Internal Server Error', details: `An unexpected error occurred: ${error.message}` }, { status: 500 });
  }
}
