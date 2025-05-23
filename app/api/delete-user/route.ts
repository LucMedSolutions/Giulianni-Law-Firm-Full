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

    try {
      // Delete the user from auth
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (deleteAuthError) {
        // If the error is "User not found", we'll consider this a success
        // since the goal is to ensure the user doesn't exist in auth
        if (deleteAuthError.message.includes("User not found")) {
          return NextResponse.json({
            success: true,
            message: "User not found in auth system, but that's okay",
            warning: "User not found in auth system",
          })
        }

        console.error("Error deleting user from auth:", deleteAuthError)
        return NextResponse.json({ error: deleteAuthError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "User deleted successfully",
      })
    } catch (authError: any) {
      // Handle any other errors that might occur
      console.error("Auth deletion error:", authError)

      // If the error message contains "User not found", treat it as a non-critical error
      if (authError.message && authError.message.includes("User not found")) {
        return NextResponse.json({
          success: true,
          message: "User not found in auth system, but that's okay",
          warning: "User not found in auth system",
        })
      }

      return NextResponse.json({ error: authError.message || "Error deleting user from auth" }, { status: 500 })
    }
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
