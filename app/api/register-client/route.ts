import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Use public anonymous key for client-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: Request) {
  try {
    const { email, password, fullName } = await request.json()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Email, password, and full name are required" }, { status: 400 })
    }

    // Ensure environment variables are loaded
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Supabase URL or Anon Key is not defined.")
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Use standard supabase.auth.signUp()
    // RLS policies on the 'users' table or database triggers on 'auth.users'
    // should handle the creation of the public user profile.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          // The role 'client' will be part of the user_metadata in the auth.users table.
          // A trigger can then use this to populate the 'role' in the public.users table.
          // Or RLS on public.users can allow insert if role is 'client' from metadata.
          role: "client",
        },
        // Supabase typically sends a confirmation email by default.
        // The user will need to confirm their email to log in,
        // unless "Enable email confirmations" is disabled in your Supabase project settings.
      },
    })

    if (signUpError) {
      console.error("Client registration sign-up error:", signUpError)
      // Provide a more user-friendly error message for common issues
      if (signUpError.message.includes("User already registered") || signUpError.message.includes("already exists")) {
        return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 }) // 409 Conflict
      }
      if (signUpError.message.includes("Password should be at least 6 characters")) {
        return NextResponse.json({ error: "Password should be at least 6 characters." }, { status: 400 })
      }
      return NextResponse.json({ error: signUpError.message || "Failed to register user." }, { status: 500 })
    }

    if (!signUpData.user) {
      console.error("No user data returned from signUp but no error was thrown.")
      return NextResponse.json({ error: "Failed to register user due to an unexpected issue." }, { status: 500 })
    }

    // At this point, the user is created in auth.users.
    // A confirmation email should have been sent by Supabase if email confirmations are enabled.
    // The public.users table entry should be handled by RLS or a trigger.

    let responseMessage = "Registration successful. "
    if (signUpData.user.identities && signUpData.user.identities.length > 0 && !signUpData.user.email_confirmed_at) {
      responseMessage += "Please check your email to confirm your registration."
    } else if (signUpData.user.email_confirmed_at) {
      responseMessage += "Your email is already confirmed. You can now log in."
    } else {
       // Fallback message if identities is unexpectedly empty but email not confirmed
      responseMessage += "Please check your email to confirm your registration, if required by system."
    }

    console.log(`Client registration initiated for: ${email}`)

    return NextResponse.json({
      success: true,
      message: responseMessage,
      user: { // Return minimal, non-sensitive user information
        id: signUpData.user.id,
        email: signUpData.user.email,
        // Avoid returning full_name or role directly from here if it's meant to be confirmed/set by backend post-confirmation
      },
    })
  } catch (error: any) {
    console.error("Unexpected error during client registration:", error)
    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred during registration",
      },
      { status: 500 },
    )
  }
}
