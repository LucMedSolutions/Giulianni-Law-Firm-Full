// =================================================================================
// CRITICAL SETUP API - DO NOT DELETE UNLESS DATABASE MIGRATIONS HANDLE THIS FUNCTION
// =================================================================================
// This API route defines the SQL function `delete_user_with_related_records`.
// This function is ESSENTIAL for the primary administrative user deletion functionality
// provided by the `/api/delete-user-sql-direct` API endpoint.
//
// This route should be:
// 1. Protected by admin-only middleware (as it currently is via `hasPermissionServer`).
// 2. Retained to ensure the `delete_user_with_related_records` function can be
//    created or updated as needed in environments where direct DB migrations are not used.
//
// If database migrations are adopted as the primary way to manage DB schema & functions,
// the SQL function definition within this route should be moved to a migration file,
// and this API endpoint could then potentially be deprecated.
// =================================================================================

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { hasPermissionServer } from "lib/permissions"

export async function POST(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const isAdmin = await hasPermissionServer(userId, "admin_access")

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Create a Supabase client with the service role key
    const supabaseAdmin = createRouteHandlerClient(
      { cookies: () => cookieStore },
      {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    )

    // Create the SQL function using raw SQL
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION delete_user_with_related_records(user_id_param UUID)
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        -- Delete from user_notifications
        DELETE FROM user_notifications WHERE user_id = user_id_param;
        
        -- Delete from documents
        DELETE FROM documents WHERE uploaded_by = user_id_param;
        
        -- Add more DELETE statements for other tables that reference users
        -- DELETE FROM other_table WHERE user_id = user_id_param;
        
        -- Finally delete the user
        DELETE FROM users WHERE id = user_id_param;
        
        RETURN TRUE;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE EXCEPTION 'Error deleting user: %', SQLERRM;
          RETURN FALSE;
      END;
      $$;
    `

    // Execute the SQL to create the function
    const { error } = await supabaseAdmin.rpc("exec_sql", { sql: createFunctionSQL })

    if (error) {
      console.error("Error creating delete user function:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Delete user function created successfully",
    })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
