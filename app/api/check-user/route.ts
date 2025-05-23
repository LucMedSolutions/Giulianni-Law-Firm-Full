import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    // Validate input
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
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

    // Check if the user exists in auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      filter: {
        email: email,
      },
    })

    if (authError) {
      console.error("User lookup error:", authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    const authUser = authData.users.length > 0 ? authData.users[0] : null

    // Check if the user exists in the users table
    let userData = null
    let userTableError = null

    if (authUser) {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, email, role, staff_role, full_name")
        .eq("id", authUser.id)
        .maybeSingle()

      userData = data
      userTableError = error
    }

    // Get permissions if the user is staff
    let permissions = []
    if (userData && userData.role === "staff" && userData.staff_role) {
      const { data: permissionsData, error: permissionsError } = await supabaseAdmin
        .from("role_permissions_view")
        .select("permission_name")
        .eq("staff_role", userData.staff_role)

      if (!permissionsError) {
        permissions = permissionsData.map((p) => p.permission_name)
      }
    }

    return NextResponse.json({
      exists: !!authUser,
      authUser: authUser
        ? {
            id: authUser.id,
            email: authUser.email,
            emailConfirmed: authUser.email_confirmed_at !== null,
            createdAt: authUser.created_at,
          }
        : null,
      userData,
      permissions: userData?.role === "staff" ? permissions : [],
      userTableError: userTableError ? userTableError.message : null,
    })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
