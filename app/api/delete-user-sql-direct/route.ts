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

    // Use raw SQL to delete all related records and the user in a single transaction
    const { data, error } = await supabaseAdmin.rpc("delete_user_with_related_records", {
      user_id_param: userId,
    })

    if (error) {
      console.error("Error deleting user with related records:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Delete from auth.users
    try {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (authError && !authError.message.includes("not found")) {
        console.error("Error deleting auth user:", authError)
        // Continue anyway, as we've already deleted the user from the users table
      }
    } catch (authError: any) {
      // If the user doesn't exist in auth, that's okay
      if (!authError.message?.includes("not found")) {
        console.error("Error deleting auth user:", authError)
        // Continue anyway, as we've already deleted the user from the users table
      }
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
