import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST() {
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

    // Create the delete_user_by_id function using rpc
    const { error } = await supabaseAdmin.rpc("create_delete_user_function", {})

    if (error) {
      // If the function doesn't exist yet, create both functions
      console.log("Creating functions directly...")

      // First create the delete_user_by_id function
      const { error: error1 } = await supabaseAdmin.rpc("create_delete_user_function_direct", {})

      if (error1) {
        console.error("Error creating delete function:", error1)

        // Try a different approach - use a direct query
        const { error: directError } = await supabaseAdmin.query(`
          CREATE OR REPLACE FUNCTION public.delete_user_by_id(user_id UUID)
          RETURNS void AS $$
          BEGIN
            -- Delete from user_notifications first
            DELETE FROM public.user_notifications WHERE user_id = $1;
            
            -- Then delete from users table
            DELETE FROM public.users WHERE id = $1;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
          
          CREATE OR REPLACE FUNCTION public.create_delete_user_function()
          RETURNS void AS $$
          BEGIN
            -- This is just a placeholder since we're creating the function directly
            RETURN;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
          
          CREATE OR REPLACE FUNCTION public.create_delete_user_function_direct()
          RETURNS void AS $$
          BEGIN
            -- Create the delete_user_by_id function
            CREATE OR REPLACE FUNCTION public.delete_user_by_id(user_id UUID)
            RETURNS void AS $inner$
            BEGIN
              -- Delete from user_notifications first
              DELETE FROM public.user_notifications WHERE user_id = $1;
              
              -- Then delete from users table
              DELETE FROM public.users WHERE id = $1;
            END;
            $inner$ LANGUAGE plpgsql SECURITY DEFINER;
            
            RETURN;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
        `)

        if (directError) {
          console.error("Error with direct query:", directError)
          return NextResponse.json({ error: directError.message }, { status: 500 })
        }
      }
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
