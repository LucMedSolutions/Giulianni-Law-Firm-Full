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

    // Set the admin flag to allow insertion
    try {
      await supabaseAdmin.rpc("set_admin_flag", { is_admin: true })
    } catch (rpcError) {
      console.log("RPC call failed, proceeding with service role permissions:", rpcError)
    }

    // Insert the user directly
    const currentTime = new Date().toISOString()
    const { error: insertError } = await supabaseAdmin.from("users").insert({
      id: userId,
      email: email,
      full_name: fullName,
      role: role,
      staff_role: role === "staff" ? staffRole : null,
      created_at: currentTime,
      last_login: currentTime,
    })

    if (insertError) {
      console.error("Insert error:", insertError)
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
