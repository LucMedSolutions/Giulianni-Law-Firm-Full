import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    // Create a Supabase client with the service role key
    const cookieStore = cookies()
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
