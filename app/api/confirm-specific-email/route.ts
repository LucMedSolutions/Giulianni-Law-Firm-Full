import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// This route is specifically for confirming lucmedsolutions@gmail.com
export async function GET() {
  try {
    const targetEmail = "lucmedsolutions@gmail.com"

    // Create a Supabase admin client
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get the user by email
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.listUsers()

    if (getUserError) {
      console.error("Error fetching users:", getUserError)
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    // Find the user with the matching email
    const user = userData.users.find((u) => u.email === targetEmail)

    if (!user) {
      return NextResponse.json({ error: `User with email ${targetEmail} not found` }, { status: 404 })
    }

    // Check if the email is already confirmed
    if (user.email_confirmed_at) {
      return NextResponse.json({
        message: `Email ${targetEmail} already confirmed`,
        confirmed_at: user.email_confirmed_at,
      })
    }

    // Update the user to confirm their email
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email_confirmed_at: new Date().toISOString(),
    })

    if (error) {
      console.error("Error confirming email:", error)
      return NextResponse.json({ error: "Failed to confirm email" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Email ${targetEmail} confirmed successfully`,
      user: {
        id: data.user.id,
        email: data.user.email,
        confirmed_at: data.user.email_confirmed_at,
      },
    })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
