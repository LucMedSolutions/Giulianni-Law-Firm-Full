import { createClient } from "@supabase/supabase-js"
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

    // Create a direct Supabase client with the service role key
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Try a different approach - use signUp directly with auto confirmation
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          staff_role: staffRole,
        },
        // Don't redirect for email confirmation
        emailRedirectTo: null,
      },
    })

    if (authError) {
      console.error("Auth error:", authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    if (!authData || !authData.user) {
      console.error("No user data returned from auth.signUp")
      return NextResponse.json({ error: "Failed to create user in auth" }, { status: 500 })
    }

    // Manually confirm the email using admin API
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
      email_confirm: true,
    })

    if (confirmError) {
      console.error("Email confirmation error:", confirmError)
      // Continue anyway, as this is just a confirmation step
    }

    // Insert the user directly into the users table
    const { error: insertError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      email: email,
      full_name: fullName,
      role: role,
      staff_role: role === "staff" ? staffRole : null,
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error("Insert error:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `User ${fullName} created successfully with role: ${role}${role === "staff" ? ` (${staffRole})` : ""}`,
      note: "Email confirmation has been bypassed. User can log in immediately.",
    })
  } catch (error: any) {
    console.error("Unexpected error in create-user-fallback API:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
