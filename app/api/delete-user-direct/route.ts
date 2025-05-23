import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

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

    // Get the current user for audit logging
    const {
      data: { session },
    } = await supabaseAdmin.auth.getSession()

    // Get user details before deletion for the audit log
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from("users")
      .select("full_name, email, role, staff_role")
      .eq("id", userId)
      .single()

    if (userDataError && !userDataError.message.includes("No rows found")) {
      console.error("Error fetching user data:", userDataError)
    }

    // Step 1: Delete from user_notifications first
    const { error: notificationsError } = await supabaseAdmin.from("user_notifications").delete().eq("user_id", userId)

    if (notificationsError) {
      console.error("Error deleting notifications:", notificationsError)
      // Continue anyway, as the user might not have notifications
    }

    // Step 2: Delete from documents table
    const { error: documentsError } = await supabaseAdmin.from("documents").delete().eq("uploaded_by", userId)

    if (documentsError) {
      console.error("Error deleting documents:", documentsError)
      // Continue anyway, as the user might not have documents
    }

    // Step 3: Delete from users table
    const { error: userDeleteError } = await supabaseAdmin.from("users").delete().eq("id", userId)

    if (userDeleteError) {
      console.error("Error deleting user:", userDeleteError)
      return NextResponse.json({ error: userDeleteError.message }, { status: 500 })
    }

    // Step 4: Delete from auth.users
    try {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (authError && !authError.message.includes("not found")) {
        console.error("Error deleting auth user:", authError)
        // Continue anyway, as we've already deleted the user from the users table
      }
    } catch (authError: any) {
      console.error("Error deleting auth user:", authError)
      // Continue anyway, as we've already deleted the user from the users table
    }

    // Log the user deletion in audit logs
    if (session) {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: session.user.id,
        action: "delete_user",
        details: `Deleted user: ${userData?.full_name || "Unknown"} (${userData?.email || "Unknown"}) with role: ${userData?.role || "Unknown"}${userData?.staff_role ? ` (${userData.staff_role})` : ""}`,
        resource_type: "user",
        resource_id: userId,
        ip_address: "API request",
      })
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
