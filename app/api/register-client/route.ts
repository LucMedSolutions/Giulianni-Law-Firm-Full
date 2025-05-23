import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
  try {
    const { email, password, fullName } = await request.json()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Create admin client for user creation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // First, set the admin flag
    await supabaseAdmin.rpc("set_admin_flag", { is_admin: true })

    // Create the auth user with confirmed email
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
        role: "client",
      },
    })

    if (authError) {
      console.error("Auth user creation error:", authError)
      throw authError
    }

    if (!authData.user) {
      throw new Error("Failed to create auth user")
    }

    // Create the user profile in the users table
    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      email: authData.user.email,
      full_name: fullName,
      role: "client",
      created_at: new Date().toISOString(),
      last_login: null,
    })

    if (profileError) {
      console.error("Profile creation error:", profileError)
      // If profile creation fails, clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }

    console.log(`Client registered successfully: ${email}`)

    return NextResponse.json({
      success: true,
      message: "Client registered successfully",
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: "client",
      },
    })
  } catch (error: any) {
    console.error("Registration error:", error)
    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred during registration",
      },
      { status: 500 },
    )
  }
}
