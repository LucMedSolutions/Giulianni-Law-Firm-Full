import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { email, password, fullName, role, staffRole } = await request.json()

    // Validate input
    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: "Email, password, full name, and role are required" }, { status: 400 })
    }

    // Validate staff role if role is staff
    if (role === "staff" && !staffRole) {
      return NextResponse.json({ error: "Staff role is required for staff users" }, { status: 400 })
    }

    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing required environment variables")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Create user directly using the Supabase Auth API
    const supabaseAuthUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`

    const authResponse = await fetch(supabaseAuthUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role,
          staff_role: role === "staff" ? staffRole : null,
        },
      }),
    })

    if (!authResponse.ok) {
      const errorData = await authResponse.json()
      console.error("Auth API error:", errorData)
      return NextResponse.json(
        { error: errorData.msg || "Failed to create user in auth" },
        { status: authResponse.status },
      )
    }

    const authData = await authResponse.json()

    if (!authData || !authData.id) {
      console.error("No user ID returned from Auth API")
      return NextResponse.json({ error: "Failed to create user in auth" }, { status: 500 })
    }

    // Now insert the user into the users table
    const supabaseRestUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users`

    const insertResponse = await fetch(supabaseRestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        id: authData.id,
        email: email,
        full_name: fullName,
        role: role,
        staff_role: role === "staff" ? staffRole : null,
        created_at: new Date().toISOString(),
      }),
    })

    if (!insertResponse.ok) {
      const errorData = await insertResponse.json()
      console.error("REST API error:", errorData)
      return NextResponse.json(
        { error: errorData.message || "Failed to insert user data" },
        { status: insertResponse.status },
      )
    }

    return NextResponse.json({
      success: true,
      message: `User ${fullName} created successfully with role: ${role}${role === "staff" ? ` (${staffRole})` : ""}`,
      note: "User created with raw API method.",
      user_id: authData.id,
    })
  } catch (error: any) {
    console.error("Unexpected error in create-user-raw API:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
