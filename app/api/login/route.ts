import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // Create Supabase client
    const supabase = createRouteHandlerClient({ cookies })

    // Attempt to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      console.error("Login error:", error)
      return NextResponse.json({ error: error.message || "Login failed" }, { status: 401 })
    }

    if (!data.user) {
      return NextResponse.json({ error: "Login failed - no user data" }, { status: 401 })
    }

    // Get user role
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle()

    if (userError) {
      console.error("Error fetching user role:", userError)
      return NextResponse.json({ error: "Failed to fetch user information" }, { status: 500 })
    }

    if (!userData) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      role: userData.role,
    })
  } catch (error: any) {
    console.error("Login API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
