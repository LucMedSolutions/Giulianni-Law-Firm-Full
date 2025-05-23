import { NextResponse } from "next/server"

// In-memory storage for users (will be lost on server restart)
const memoryUsers: any[] = []

export async function POST(request: Request) {
  try {
    const { email, password, fullName, role, staffRole } = await request.json()

    // Validate input
    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: "Email, password, full name, and role are required" }, { status: 400 })
    }

    // Validate staff role if role is staff
    if (role === "staff" && !staffRole) {
      return NextResponse.json({ error: "Staff role is required for staff users" }, { status: 400 })
    }

    // Generate a UUID for the user
    const userId = crypto.randomUUID()

    // Check if user with this email already exists
    if (memoryUsers.some((user) => user.email === email)) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
    }

    // Create a user object
    const newUser = {
      id: userId,
      email: email,
      full_name: fullName,
      role: role,
      staff_role: role === "staff" ? staffRole : null,
      created_at: new Date().toISOString(),
    }

    // Add the new user to memory
    memoryUsers.push(newUser)

    return NextResponse.json({
      success: true,
      message: `User ${fullName} created successfully with role: ${role}${role === "staff" ? ` (${staffRole})` : ""}`,
      note: "User created in memory only. This is a fallback method and will be lost on server restart.",
      user_id: userId,
    })
  } catch (error: any) {
    console.error("Unexpected error in create-user-memory API:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
