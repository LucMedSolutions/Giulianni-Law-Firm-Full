import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Notification ID is required" }, { status: 400 })
  }

  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Check if user is authenticated and is an admin
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single()

    if (userError || !userData || userData.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Use the SQL function we created to delete the notification and related records
    const { data, error } = await supabase.rpc("delete_notification_with_related", {
      notification_id_param: id,
    })

    if (error) {
      console.error("Error deleting notification:", error)
      return NextResponse.json({ error: `Error deleting notification: ${error.message}` }, { status: 500 })
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: session.user.id,
      action: "delete_notification",
      details: `Deleted notification with ID: ${id}`,
      ip_address: "API request",
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
