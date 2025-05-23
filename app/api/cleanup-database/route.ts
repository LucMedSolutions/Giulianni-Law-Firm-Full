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

    const results = {
      deleted: [] as string[],
      warnings: [] as string[],
      errors: [] as string[],
    }

    // STEP 1: Clear all tables with foreign key constraints first
    console.log("Clearing user_notifications table...")
    const { error: clearNotificationsError } = await supabaseAdmin.from("user_notifications").delete().neq("id", 0)

    if (clearNotificationsError) {
      results.errors.push(`Failed to clear user notifications: ${clearNotificationsError.message}`)
      console.error("Error clearing notifications:", clearNotificationsError)
    } else {
      results.warnings.push("Cleared all user notifications")
    }

    // Add more cleanup for other tables with foreign key constraints here
    // For example:
    // await supabaseAdmin.from("user_cases").delete().neq("id", 0)
    // await supabaseAdmin.from("user_documents").delete().neq("id", 0)

    // STEP 2: Get all users from the users table
    console.log("Fetching users...")
    const { data: users, error: fetchError } = await supabaseAdmin.from("users").select("id, email, full_name")

    if (fetchError) {
      return NextResponse.json({ error: `Error fetching users: ${fetchError.message}` }, { status: 500 })
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users found to delete.",
        results,
      })
    }

    console.log(`Found ${users.length} users to delete`)

    // STEP 3: Delete each user
    for (const user of users) {
      try {
        console.log(`Deleting user ${user.email}...`)

        // Delete from users table
        const { error: deleteError } = await supabaseAdmin.from("users").delete().eq("id", user.id)

        if (deleteError) {
          results.errors.push(`Failed to delete user ${user.email} from users table: ${deleteError.message}`)
          console.error(`Error deleting user ${user.email}:`, deleteError)
          continue
        }

        // Try to delete from auth
        try {
          const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

          if (authError) {
            if (authError.message.includes("User not found")) {
              results.warnings.push(`User ${user.email} not found in auth system`)
            } else {
              results.errors.push(`Failed to delete user ${user.email} from auth: ${authError.message}`)
              console.error(`Error deleting user ${user.email} from auth:`, authError)
              continue
            }
          }
        } catch (authErr: any) {
          if (authErr.message && authErr.message.includes("User not found")) {
            results.warnings.push(`User ${user.email} not found in auth system`)
          } else {
            results.errors.push(`Error deleting user ${user.email} from auth: ${authErr.message}`)
            console.error(`Error deleting user ${user.email} from auth:`, authErr)
            continue
          }
        }

        results.deleted.push(`${user.full_name} (${user.email})`)
        console.log(`Successfully deleted user ${user.email}`)
      } catch (err: any) {
        results.errors.push(`Error processing user ${user.email}: ${err.message}`)
        console.error(`Unexpected error processing user ${user.email}:`, err)
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
