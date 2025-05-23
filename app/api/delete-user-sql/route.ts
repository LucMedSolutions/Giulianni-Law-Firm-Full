import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId } = body

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

    // Get user info before deletion for logging
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("email, full_name")
      .eq("id", userId)
      .single()

    if (userError && !userError.message.includes("No rows found")) {
      console.error("Error fetching user data:", userError)
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    // Use raw SQL to delete the user, which will handle cascading deletes
    const { error: sqlError } = await supabaseAdmin.rpc("delete_user_by_id", { user_id: userId })

    if (sqlError) {
      console.error("SQL error deleting user:", sqlError)
      return NextResponse.json({ error: sqlError.message }, { status: 500 })
    }

    // Now delete from auth
    try {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (authError && !authError.message.includes("User not found")) {
        console.error("Error deleting user from auth:", authError)
        return NextResponse.json({ error: authError.message }, { status: 500 })
      }
    } catch (authErr: any) {
      if (!authErr.message?.includes("User not found")) {
        console.error("Auth deletion error:", authErr)
        return NextResponse.json({ error: authErr.message || "Error deleting user from auth" }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: `User ${userData?.full_name || userId} deleted successfully`,
    })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
