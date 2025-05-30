import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Not authenticated", sessionError }, { status: 401 })
    }

    // Get current user data
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle()

    if (userError) {
      return NextResponse.json({ error: "Error fetching user", userError }, { status: 500 })
    }

    // Get all users for comparison
    const { data: allUsers, error: allUsersError } = await supabase
      .from("users")
      .select("id, full_name, email, role, staff_role")

    if (allUsersError) {
      return NextResponse.json({ error: "Error fetching all users", allUsersError }, { status: 500 })
    }

    // Get all cases
    const { data: allCases, error: allCasesError } = await supabase.from("cases").select("*")

    if (allCasesError) {
      return NextResponse.json({ error: "Error fetching all cases", allCasesError }, { status: 500 })
    }

    // Check permissions
    const allowedRoles = ["admin"]
    const allowedStaffRoles = ["senior_attorney", "attorney", "secretary"]
    const canDelete = allowedRoles.includes(userData?.role) || allowedStaffRoles.includes(userData?.staff_role)

    return NextResponse.json({
      currentUser: {
        id: userData?.id,
        full_name: userData?.full_name,
        email: session.user.email,
        role: userData?.role,
        staff_role: userData?.staff_role,
        canDelete,
      },
      allUsers: allUsers?.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        staff_role: u.staff_role,
      })),
      allCases: allCases?.map((c) => ({
        id: c.id,
        case_number: c.case_number,
        client_name: c.client_name,
        case_type: c.case_type,
        status: c.status,
      })),
      clientMatches:
        userData?.role === "client"
          ? allCases?.filter(
              (c) =>
                c.client_name === userData.full_name ||
                c.client_name?.toLowerCase() === userData.full_name?.toLowerCase() ||
                c.client_name?.includes(userData.full_name) ||
                userData.full_name?.includes(c.client_name),
            )
          : [],
    })
  } catch (error: any) {
    console.error("Debug permissions API error:", error)
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
  }
}
