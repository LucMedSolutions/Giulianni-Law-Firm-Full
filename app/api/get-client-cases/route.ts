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
      .select("role, full_name")
      .eq("id", session.user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (userData.role !== "client") {
      return NextResponse.json({ error: "Access denied - not a client" }, { status: 403 })
    }

    // Get all cases to debug matching
    const { data: allCases, error: allCasesError } = await supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false })

    if (allCasesError) {
      return NextResponse.json({ error: "Error fetching cases", details: allCasesError }, { status: 500 })
    }

    // Try different matching strategies
    const exactMatches = allCases?.filter((c) => c.client_name === userData.full_name) || []
    const caseInsensitiveMatches =
      allCases?.filter((c) => c.client_name?.toLowerCase() === userData.full_name?.toLowerCase()) || []
    const partialMatches =
      allCases?.filter(
        (c) => c.client_name?.includes(userData.full_name) || userData.full_name?.includes(c.client_name),
      ) || []

    // Use the best match available
    let clientCases = exactMatches
    if (clientCases.length === 0) clientCases = caseInsensitiveMatches
    if (clientCases.length === 0) clientCases = partialMatches

    return NextResponse.json({
      user: {
        full_name: userData.full_name,
        role: userData.role,
      },
      totalCases: allCases?.length || 0,
      matchingStrategies: {
        exact: exactMatches.length,
        caseInsensitive: caseInsensitiveMatches.length,
        partial: partialMatches.length,
      },
      clientCases,
      allCaseNames: allCases?.map((c) => c.client_name),
      debugInfo: {
        userFullName: userData.full_name,
        userFullNameLength: userData.full_name?.length,
        caseNames: allCases?.map((c) => ({
          name: c.client_name,
          length: c.client_name?.length,
          exactMatch: c.client_name === userData.full_name,
        })),
      },
    })
  } catch (error: any) {
    console.error("Get client cases API error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
