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

    // Step 1: Delete all user_notifications
    const { error: notificationsError } = await supabaseAdmin
      .from("user_notifications")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")

    if (notificationsError) {
      console.error("Error deleting notifications:", notificationsError)
      return NextResponse.json({ error: notificationsError.message }, { status: 500 })
    }

    // Step 2: Delete all documents
    const { error: documentsError } = await supabaseAdmin
      .from("documents")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")

    if (documentsError) {
      console.error("Error deleting documents:", documentsError)
      return NextResponse.json({ error: documentsError.message }, { status: 500 })
    }

    // Step 3: Get all users
    const { data: users, error: usersError } = await supabaseAdmin.from("users").select("id, email, full_name")

    if (usersError) {
      console.error("Error fetching users:", usersError)
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    // Step 4: Delete all users from the users table
    const { error: deleteUsersError } = await supabaseAdmin
      .from("users")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")

    if (deleteUsersError) {
      console.error("Error deleting users:", deleteUsersError)
      return NextResponse.json({ error: deleteUsersError.message }, { status: 500 })
    }

    // Step 5: Delete all users from auth.users
    const deletedAuthUsers = []
    const authErrors = []

    for (const user of users) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(user.id)

        if (error && !error.message.includes("not found")) {
          authErrors.push({ id: user.id, error: error.message })
        } else {
          deletedAuthUsers.push(`${user.full_name} (${user.email})`)
        }
      } catch (error: any) {
        if (!error.message?.includes("not found")) {
          authErrors.push({ id: user.id, error: error.message })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Database cleaned up successfully",
      results: {
        deleted: deletedAuthUsers,
        warnings: [],
        errors: authErrors.map((e) => `Error deleting auth user ${e.id}: ${e.error}`),
      },
    })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
