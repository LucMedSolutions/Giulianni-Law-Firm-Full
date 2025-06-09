import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const cookieStore = cookies()

    // Client for getting current session (admin performing the action)
    const supabaseSessionClient = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { session },
    } = await supabaseSessionClient.auth.getSession()

    // Admin client for performing privileged operations
    const supabaseAdmin = createRouteHandlerClient(
      { cookies: () => cookieStore },
      {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    )

    // Get details of the user being deleted for audit logging
    let deletedUserDetails = "ID: " + userId // Fallback detail
    try {
      const { data: userData, error: userFetchError } = await supabaseAdmin
        .from("users")
        .select("full_name, email, role, staff_role")
        .eq("id", userId)
        .single()

      if (userFetchError && !userFetchError.message.includes("No rows found")) {
        console.warn("Error fetching details of user to be deleted:", userFetchError.message)
      } else if (userData) {
        deletedUserDetails = `User: ${userData.full_name || "N/A"} (${userData.email || "N/A"}), Role: ${userData.role || "N/A"}${userData.staff_role ? ` (${userData.staff_role})` : ""}, ID: ${userId}`
      }
    } catch (fetchErr: any) {
        console.warn("Exception fetching user details for audit log:", fetchErr.message)
    }


    // Step 1: Delete user data from public schema using the RPC
    const { error: rpcError } = await supabaseAdmin.rpc("delete_user_with_related_records", {
      user_id_param: userId,
    })

    if (rpcError) {
      console.error("Error deleting user with related records (RPC):", rpcError)
      // Attempt to log this failure if possible, then return
      if (session) {
        await supabaseAdmin.from("audit_logs").insert({
          user_id: session.user.id,
          action: "delete_user_sql_direct_failed_rpc",
          details: `Failed to delete user (RPC error) for ${deletedUserDetails}. Error: ${rpcError.message}`,
          resource_type: "user",
          resource_id: userId,
          ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"), // Get IP if available
        })
      }
      return NextResponse.json({ error: `RPC Error: ${rpcError.message}` }, { status: 500 })
    }

    // Step 2: Delete from auth.users
    let authDeletionErrorOccurred = false
    let authDeletionErrorMessage = ""
    try {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (authError && !authError.message.includes("User not found")) { // "User not found" is not an error in this context
        authDeletionErrorOccurred = true
        authDeletionErrorMessage = authError.message
        console.error("Error deleting auth user:", authError)
      }
    } catch (authCatchError: any) {
      if (!authCatchError.message?.includes("User not found")) {
        authDeletionErrorOccurred = true
        authDeletionErrorMessage = authCatchError.message
        console.error("Exception deleting auth user:", authCatchError)
      }
    }

    // Step 3: Log the deletion attempt
    if (session) {
      const auditAction = authDeletionErrorOccurred ? "delete_user_sql_direct_auth_failed" : "delete_user_sql_direct"
      let auditDetails = `Attempted to delete ${deletedUserDetails}. Public schema records deleted.`
      if(authDeletionErrorOccurred) {
        auditDetails += ` Auth deletion failed: ${authDeletionErrorMessage}`
      } else {
        auditDetails += ` Auth user also deleted (or did not exist).`
      }

      await supabaseAdmin.from("audit_logs").insert({
        user_id: session.user.id,
        action: auditAction,
        details: auditDetails,
        resource_type: "user",
        resource_id: userId,
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      })
    }

    if (authDeletionErrorOccurred) {
      // Decide if this is a partial success or full failure.
      // For now, let's say public data is gone, so it's a kind of success but with a warning.
      return NextResponse.json({
        success: true, // Or false, depending on strictness
        message: "User data deleted from tables, but failed to delete from authentication system. Please check logs.",
        warning: `Auth Deletion Error: ${authDeletionErrorMessage}`,
      })
    }

    return NextResponse.json({
      success: true,
      message: "User deleted successfully from all systems.",
    })
  } catch (error: any) {
    console.error("Unexpected error in delete-user-sql-direct:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
