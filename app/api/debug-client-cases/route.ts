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
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get all cases to see what's available
    const { data: allCases, error: allCasesError } = await supabase
      .from("cases")
      .select("id, case_number, client_name, client_email, case_type, status")
      .order("created_at", { ascending: false })

    if (allCasesError) {
      return NextResponse.json({ error: "Error fetching cases" }, { status: 500 })
    }

    // Try different matching strategies
    const exactMatches = allCases?.filter((c) => c.client_name === userData.full_name) || []
    const fuzzyMatches =
      allCases?.filter((c) => c.client_name?.toLowerCase().includes(userData.full_name?.toLowerCase())) || []

    return NextResponse.json({
      user: {
        id: userData.id,
        full_name: userData.full_name,
        email: session.user.email,
        role: userData.role,
      },
      totalCases: allCases?.length || 0,
      exactMatches: exactMatches.length,
      fuzzyMatches: fuzzyMatches.length,
      cases: {
        exact: exactMatches,
        fuzzy: fuzzyMatches,
      },
      allCases: allCases?.map((c) => ({
        id: c.id,
        case_number: c.case_number,
        client_name: c.client_name,
      })),
    })
  } catch (error: any) {
    console.error("Debug API error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
