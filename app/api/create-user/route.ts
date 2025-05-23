import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

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

    // Get the current user for audit logging
    const supabaseClient = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabaseClient.auth.getSession()

    // Create a direct Supabase client with the service role key
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Create the user with the admin API and explicitly set email_confirm to true
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Explicitly confirm the email
      user_metadata: {
        full_name: fullName,
        role,
        staff_role: staffRole,
      },
    })

    if (authError) {
      console.error("Auth error:", authError)

      // Check if it's a duplicate user error
      if (authError.message.includes("already exists") || authError.message.includes("duplicate")) {
        return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 })
      }

      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    if (!authData || !authData.user) {
      console.error("No user data returned from auth.admin.createUser")
      return NextResponse.json({ error: "Failed to create user in auth" }, { status: 500 })
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

      // If we fail to insert into the users table, try to delete the auth user to maintain consistency
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      } catch (deleteError) {
        console.error("Failed to clean up auth user after insert error:", deleteError)
      }

      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Log the user creation in audit logs
    if (session) {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: session.user.id,
        action: "create_user",
        details: `Created user: ${fullName} (${email}) with role: ${role}${role === "staff" ? ` (${staffRole})` : ""}`,
        resource_type: "user",
        resource_id: authData.user.id,
        ip_address: "API request",
      })
    }

    return NextResponse.json({
      success: true,
      message: `User ${fullName} created successfully with role: ${role}${role === "staff" ? ` (${staffRole})` : ""}`,
      note: "Email confirmation has been bypassed. User can log in immediately.",
    })
  } catch (error: any) {
    console.error("Unexpected error in create-user API:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
