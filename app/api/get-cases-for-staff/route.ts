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

    // Optional: User role check (example, assuming you have a 'user_roles' table or similar)
    // const { data: userRoleData, error: roleError } = await supabase
    //   .from('user_profiles') // or your table storing roles
    //   .select('role')
    //   .eq('user_id', session.user.id)
    //   .single();

    // if (roleError || !userRoleData) {
    //   console.error('Error fetching user role:', roleError);
    //   return NextResponse.json({ error: 'Failed to fetch user role.' }, { status: 500 });
    // }
    // const userRole = userRoleData.role;
    // if (!['staff', 'admin'].includes(userRole)) {
    //    return NextResponse.json({ error: 'Forbidden: Insufficient privileges.' }, { status: 403 });
    // }


    // 2. Fetch Cases from Supabase
    // TODO: Implement role-based filtering.
    // If user is 'staff' and not 'admin', filter by cases assigned to this user.
    // This requires knowing the user's role and potentially joining with a case_assignments table.
    // For now, fetching all cases for any authenticated staff/admin.
    const { data: cases, error: casesError } = await supabase
      .from('cases') // Make sure this table name is correct
      .select('id, case_number, client_name, status, case_type') // Added 'status' as it's often useful
      .order('created_at', { ascending: false });

    if (casesError) {
      console.error('Error fetching cases:', casesError.message);
      return NextResponse.json({ error: 'Database Error', details: `Failed to fetch cases: ${casesError.message}` }, { status: 500 });
    }

    // 3. Return Response
    return NextResponse.json(cases || [], { status: 200 }); // Return empty array if cases is null

  } catch (error: any) {
    console.error('Unexpected error in /api/get-cases-for-staff:', error.message, error.stack);
    return NextResponse.json({ error: 'Internal Server Error', details: `An unexpected error occurred: ${error.message}` }, { status: 500 });
  }
}
