import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { caseId } = await request.json()

  if (!caseId) {
    return NextResponse.json({ error: "Case ID is required" }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })

  try {
    // Check if user is authenticated and has appropriate role
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user role - use maybeSingle() instead of single() to handle no rows
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role, staff_role")
      .eq("id", session.user.id)
      .maybeSingle()

    if (userError) {
      return NextResponse.json({ error: `Error fetching user: ${userError.message}` }, { status: 500 })
    }

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user has permission to delete cases
    const allowedRoles = ["admin"]
    const allowedStaffRoles = ["senior_attorney", "attorney", "secretary"]

    if (!allowedRoles.includes(userData.role) && !allowedStaffRoles.includes(userData.staff_role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Check if case exists - use maybeSingle() instead of single()
    const { data: caseData, error: caseCheckError } = await supabase
      .from("cases")
      .select("id")
      .eq("id", caseId)
      .maybeSingle()

    if (caseCheckError) {
      return NextResponse.json({ error: `Error checking case: ${caseCheckError.message}` }, { status: 500 })
    }

    if (!caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

    // Delete in the correct order to handle foreign key constraints

    // 1. First delete case documents
    const { error: documentsError } = await supabase.from("documents").delete().eq("case_id", caseId)

    if (documentsError) {
      console.error("Error deleting case documents:", documentsError)
      // Continue anyway, as there might not be any documents
    }

    // 2. Delete case assignments
    const { error: assignmentsError } = await supabase.from("case_assignments").delete().eq("case_id", caseId)

    if (assignmentsError) {
      console.error("Error deleting case assignments:", assignmentsError)
      // Continue anyway, as there might not be any assignments
    }

    // 3. Delete case messages - now we can use the case_id column
    const { error: messagesError } = await supabase.from("messages").delete().eq("case_id", caseId)

    if (messagesError) {
      console.error("Error deleting case messages:", messagesError)
      // Continue anyway, as there might not be any messages
    }

    // 4. Finally delete the case
    const { error: caseError } = await supabase.from("cases").delete().eq("id", caseId)

    if (caseError) {
      return NextResponse.json({ error: `Error deleting case: ${caseError.message}` }, { status: 500 })
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: session.user.id,
      action: "delete",
      resource_type: "case",
      resource_id: caseId,
      details: `Case deleted by ${userData.role === "admin" ? "admin" : userData.staff_role}`,
    })

    return NextResponse.json({ success: true, message: "Case deleted successfully" })
  } catch (error: any) {
    console.error("Error deleting case:", error)
    return NextResponse.json({ error: `Unexpected error: ${error.message}` }, { status: 500 })
  }
}
