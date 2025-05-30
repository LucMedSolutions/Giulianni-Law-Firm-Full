import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Get all cases with their details
    const { data: allCases, error: casesError } = await supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false })

    if (casesError) {
      return NextResponse.json({ error: "Error fetching cases", details: casesError }, { status: 500 })
    }

    // Get all users to see client names
    const { data: allUsers, error: usersError } = await supabase
      .from("users")
      .select("id, full_name, email, role")
      .eq("role", "client")

    if (usersError) {
      return NextResponse.json({ error: "Error fetching users", details: usersError }, { status: 500 })
    }

    return NextResponse.json({
      totalCases: allCases?.length || 0,
      totalClients: allUsers?.length || 0,
      cases: allCases?.map((c) => ({
        id: c.id,
        case_number: c.case_number,
        client_name: c.client_name,
        case_type: c.case_type,
        status: c.status,
        created_at: c.created_at,
      })),
      clients: allUsers?.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
      })),
      nameMatches: allUsers?.map((user) => ({
        client: user.full_name,
        matchingCases: allCases?.filter((c) => c.client_name === user.full_name).length || 0,
      })),
    })
  } catch (error: any) {
    console.error("Debug cases API error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
