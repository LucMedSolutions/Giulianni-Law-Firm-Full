import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId } = body

    // Validate input
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Create a Supabase client with the service role key
    const cookieStore = cookies()
    const supabaseAdmin = createRouteHandlerClient(
      { cookies: () => cookieStore },
      {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    )

    // First, delete all related records in user_notifications table
    const { error: notificationsError } = await supabaseAdmin.from("user_notifications").delete().eq("user_id", userId)

    if (notificationsError) {
      console.error("Error deleting user notifications:", notificationsError)
      return NextResponse.json({ error: notificationsError.message }, { status: 500 })
    }

    // Check for and delete any other related records in other tables
    // This is where you would add more delete operations for other tables with foreign key constraints
    // For example:
    // await supabaseAdmin.from("user_cases").delete().eq("user_id", userId)
    // await supabaseAdmin.from("user_documents").delete().eq("user_id", userId)

    // Now delete the user from the users table
    const { error: deleteUserError } = await supabaseAdmin.from("users").delete().eq("id", userId)

    if (deleteUserError) {
      console.error("Error deleting user from users table:", deleteUserError)
      return NextResponse.json({ error: deleteUserError.message }, { status: 500 })
    }

    // Finally, delete the user from auth
    try {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (deleteAuthError) {
        // If the error is "User not found", we'll consider this a success
        // since the goal is to ensure the user doesn't exist in auth
        if (deleteAuthError.message.includes("User not found")) {
          return NextResponse.json({
            success: true,
            message: "User deleted successfully (not found in auth system)",
            warning: "User not found in auth system",
          })
        }

        console.error("Error deleting user from auth:", deleteAuthError)
        return NextResponse.json({ error: deleteAuthError.message }, { status: 500 })
      }
    } catch (authError: any) {
      // If the error message contains "User not found", treat it as a non-critical error
      if (authError.message && authError.message.includes("User not found")) {
        return NextResponse.json({
          success: true,
          message: "User deleted successfully (not found in auth system)",
          warning: "User not found in auth system",
        })
      }

      console.error("Auth deletion error:", authError)
      return NextResponse.json({ error: authError.message || "Error deleting user from auth" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
