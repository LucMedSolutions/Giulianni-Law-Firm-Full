import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const { caseId } = await request.json()

    if (!caseId) {
      return NextResponse.json({ error: "Case ID is required" }, { status: 400 })
    }

    // Use both regular client and service role client
    const supabase = createRouteHandlerClient({ cookies })

    // Also create service role client for admin operations
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Check authentication with regular client
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Not authenticated", sessionError }, { status: 401 })
    }

    // Get user permissions
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role, staff_role, full_name")
      .eq("id", session.user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found", userError }, { status: 404 })
    }

    // Check permissions
    const allowedRoles = ["admin"]
    const allowedStaffRoles = ["senior_attorney", "attorney", "secretary"]
    const canDelete = allowedRoles.includes(userData.role) || allowedStaffRoles.includes(userData.staff_role)

    if (!canDelete) {
      return NextResponse.json(
        {
          error: "Insufficient permissions",
          userRole: userData.role,
          staffRole: userData.staff_role,
          allowedRoles,
          allowedStaffRoles,
        },
        { status: 403 },
      )
    }

    // Use service role client for deletion to bypass RLS
    console.log("Starting case deletion for case:", caseId)

    // 1. Delete documents first
    const { error: documentsError } = await supabaseAdmin.from("documents").delete().eq("case_id", caseId)

    if (documentsError) {
      console.error("Error deleting documents:", documentsError)
    } else {
      console.log("Documents deleted successfully")
    }

    // 2. Delete case assignments
    const { error: assignmentsError } = await supabaseAdmin.from("case_assignments").delete().eq("case_id", caseId)

    if (assignmentsError) {
      console.error("Error deleting assignments:", assignmentsError)
    } else {
      console.log("Assignments deleted successfully")
    }

    // 3. Delete messages
    const { error: messagesError } = await supabaseAdmin.from("messages").delete().eq("case_id", caseId)

    if (messagesError) {
      console.error("Error deleting messages:", messagesError)
    } else {
      console.log("Messages deleted successfully")
    }

    // 4. Finally delete the case
    const { error: caseError } = await supabaseAdmin.from("cases").delete().eq("id", caseId)

    if (caseError) {
      console.error("Error deleting case:", caseError)
      return NextResponse.json(
        {
          error: "Failed to delete case",
          details: caseError,
          caseId,
        },
        { status: 500 },
      )
    }

    console.log("Case deleted successfully")

    // Log the action
    await supabaseAdmin.from("audit_logs").insert({
      user_id: session.user.id,
      action: "delete",
      resource_type: "case",
      resource_id: caseId,
      details: `Case deleted by ${userData.full_name} (${userData.role}/${userData.staff_role})`,
    })

    return NextResponse.json({
      success: true,
      message: "Case deleted successfully",
      deletedBy: userData.full_name,
      caseId,
    })
  } catch (error: any) {
    console.error("Force delete case error:", error)
    return NextResponse.json(
      {
        error: "Unexpected error during deletion",
        details: error.message,
        stack: error.stack,
      },
      { status: 500 },
    )
  }
}
