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

    // First, ensure our delete function exists
    await supabaseAdmin
      .from("_sql")
      .select("*")
      .execute(`
      CREATE OR REPLACE FUNCTION public.delete_user_by_id(user_id UUID)
      RETURNS void AS $$
      BEGIN
        -- Delete from user_notifications first
        DELETE FROM public.user_notifications WHERE user_id = $1;
        
        -- Then delete from users table
        DELETE FROM public.users WHERE id = $1;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `)

    // Get all users
    const { data: users, error: fetchError } = await supabaseAdmin.from("users").select("id, email, full_name")

    if (fetchError) {
      return NextResponse.json({ error: `Error fetching users: ${fetchError.message}` }, { status: 500 })
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users found to delete.",
        results: { deleted: [], warnings: [], errors: [] },
      })
    }

    const results = {
      deleted: [] as string[],
      warnings: [] as string[],
      errors: [] as string[],
    }

    // First, clear all notifications directly with SQL
    const { error: clearNotificationsError } = await supabaseAdmin
      .from("_sql")
      .select("*")
      .execute("DELETE FROM public.user_notifications")

    if (clearNotificationsError) {
      results.errors.push(`Failed to clear notifications: ${clearNotificationsError.message}`)
    } else {
      results.warnings.push("Cleared all notifications")
    }

    // Delete each user
    for (const user of users) {
      try {
        // Delete the user with our function
        const { error: deleteError } = await supabaseAdmin.rpc("delete_user_by_id", { user_id: user.id })

        if (deleteError) {
          results.errors.push(`Failed to delete user ${user.email}: ${deleteError.message}`)
          continue
        }

        // Try to delete from auth
        try {
          const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

          if (authError && !authError.message.includes("User not found")) {
            results.errors.push(`Failed to delete user ${user.email} from auth: ${authError.message}`)
          } else if (authError) {
            results.warnings.push(`User ${user.email} not found in auth system`)
          }
        } catch (authErr: any) {
          if (authErr.message?.includes("User not found")) {
            results.warnings.push(`User ${user.email} not found in auth system`)
          } else {
            results.errors.push(`Error deleting user ${user.email} from auth: ${authErr.message}`)
          }
        }

        results.deleted.push(`${user.full_name} (${user.email})`)
      } catch (err: any) {
        results.errors.push(`Error processing user ${user.email}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${results.deleted.length} users with ${results.warnings.length} warnings and ${results.errors.length} errors.`,
      results,
    })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
