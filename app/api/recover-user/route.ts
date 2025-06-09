import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { userId, email, fullName, role, staffRole } = await request.json()

    // Validate input
    if (!userId || !email || !fullName || !role) {
      return NextResponse.json({ error: "User ID, email, full name, and role are required" }, { status: 400 })
    }

    // Validate staff role if role is staff
    if (role === "staff" && !staffRole) {
      return NextResponse.json({ error: "Staff role is required for staff users" }, { status: 400 })
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

    // Check if the user already exists in the users table
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle()

    if (checkError) {
      console.error("Error checking for existing user:", checkError)
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }

    if (existingUser) {
      return NextResponse.json({ message: "User already exists in the system" })
    }

    // The supabaseAdmin client (using the service role key) should have
    // sufficient privileges to insert into the 'users' table directly.
    // The call to 'set_admin_flag' is unnecessary and potentially masks
    // RLS issues if any were preventing direct insertion by the service role.
    // If RLS is blocking the service role, that RLS policy needs review.

    // Insert the user profile directly
    const currentTime = new Date().toISOString()
    const { error: insertError } = await supabaseAdmin.from("users").insert({
      id: userId, // This should be the ID from auth.users
      email: email,
      full_name: fullName,
      role: role,
      staff_role: role === "staff" ? staffRole : null,
      created_at: currentTime, // Consider if this should be the auth user's created_at
      last_login: currentTime, // Consider if this should be the auth user's last_sign_in_at
    })

    if (insertError) {
      console.error("Error inserting user profile:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `User account recovered successfully`,
    })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
