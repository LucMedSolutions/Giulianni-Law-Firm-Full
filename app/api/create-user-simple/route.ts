import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Define a local file path for storing users
// This is a fallback approach when Supabase is not available
const LOCAL_USERS_FILE = path.join(process.cwd(), "local-users.json")

// Function to read existing users from the local file
function readLocalUsers() {
  try {
    if (fs.existsSync(LOCAL_USERS_FILE)) {
      const data = fs.readFileSync(LOCAL_USERS_FILE, "utf8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error("Error reading local users file:", error)
  }
  return []
}

// Function to write users to the local file
function writeLocalUsers(users: any[]) {
  try {
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), "utf8")
    return true
  } catch (error) {
    console.error("Error writing to local users file:", error)
    return false
  }
}

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

    // Create a user object
    const newUser = {
      id: userId,
      email: email,
      full_name: fullName,
      role: role,
      staff_role: role === "staff" ? staffRole : null,
      created_at: new Date().toISOString(),
      // Store a hashed version of the password (not secure, but better than plaintext)
      // In a real app, you'd use a proper password hashing library
      password_hash: Buffer.from(password).toString("base64"),
    }

    // Read existing users
    const users = readLocalUsers()

    // Check if user with this email already exists
    if (users.some((user: any) => user.email === email)) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
    }

    // Add the new user
    users.push(newUser)

    // Write the updated users list
    const success = writeLocalUsers(users)

    if (!success) {
      return NextResponse.json({ error: "Failed to save user data" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `User ${fullName} created successfully with role: ${role}${role === "staff" ? ` (${staffRole})` : ""}`,
      note: "User created in local storage only. This is a fallback method and does not create a real auth user.",
      user_id: userId,
    })
  } catch (error: any) {
    console.error("Unexpected error in create-user-simple API:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
