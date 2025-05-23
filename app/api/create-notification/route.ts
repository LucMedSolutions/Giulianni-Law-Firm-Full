import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { title, message, isGlobal, targetRole } = await request.json()

    // Validate required fields
    if (!title || !message) {
      return NextResponse.json({ error: "Title and message are required" }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })

    // Check if user is authenticated and has admin or staff role
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user role
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Only admin and staff can create notifications
    if (userData.role !== "admin" && userData.role !== "staff") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Create notification
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        title,
        message,
        created_by: session.user.id,
        is_global: isGlobal || false,
        target_role: targetRole || null,
      })
      .select()

    if (error) {
      console.error("Error creating notification:", error)
      return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error in create-notification route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
