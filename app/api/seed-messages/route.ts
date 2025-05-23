import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Get the current user
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Get user data
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("id, role, full_name")
      .eq("id", session.user.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Find a staff member to be the sender (if current user is client) or recipient (if current user is staff)
    let otherUserId: string | null = null
    let otherUserName: string | null = null

    if (currentUser.role === "client") {
      // Find a staff member
      const { data: staffUsers } = await supabase.from("users").select("id, full_name").eq("role", "staff").limit(1)

      if (staffUsers && staffUsers.length > 0) {
        otherUserId = staffUsers[0].id
        otherUserName = staffUsers[0].full_name
      }
    } else {
      // Find a client
      const { data: clientUsers } = await supabase.from("users").select("id, full_name").eq("role", "client").limit(1)

      if (clientUsers && clientUsers.length > 0) {
        otherUserId = clientUsers[0].id
        otherUserName = clientUsers[0].full_name
      }
    }

    if (!otherUserId) {
      return NextResponse.json({ error: "No other users found to create sample messages" }, { status: 404 })
    }

    // Create sample messages
    const sampleMessages = [
      {
        subject: "Welcome to Giuliani Law Firm",
        content:
          "Welcome to our client portal. We're excited to have you on board. This secure platform allows you to communicate with our team, access your case documents, and stay updated on your case progress.\n\nPlease let us know if you have any questions or need assistance navigating the portal.",
        sender_id: currentUser.role === "client" ? otherUserId : currentUser.id,
        recipient_id: currentUser.role === "client" ? currentUser.id : otherUserId,
        is_read: false,
      },
      {
        subject: "Your Case Documents",
        content:
          "We've uploaded some important documents related to your case. Please review them at your earliest convenience and let us know if you have any questions.\n\nYou can find these documents in the Documents section of your dashboard.",
        sender_id: currentUser.role === "client" ? otherUserId : currentUser.id,
        recipient_id: currentUser.role === "client" ? currentUser.id : otherUserId,
        is_read: false,
      },
      {
        subject: "Upcoming Consultation",
        content:
          "This is a reminder about your upcoming consultation scheduled for next week. Please make sure to prepare any questions you might have.\n\nIf you need to reschedule, please let us know as soon as possible.",
        sender_id: currentUser.role === "client" ? otherUserId : currentUser.id,
        recipient_id: currentUser.role === "client" ? currentUser.id : otherUserId,
        is_read: false,
      },
    ]

    // Insert the sample messages
    const { error: insertError } = await supabase.from("messages").insert(sampleMessages)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Sample messages created successfully",
      count: sampleMessages.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
