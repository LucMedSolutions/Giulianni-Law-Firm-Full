import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

// Create a server-side supabase client
export const createClient = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables")
    throw new Error("Supabase configuration is missing. Please check your environment variables.")
  }

  const supabase = createServerComponentClient({
    cookies,
    supabaseUrl,
    supabaseKey,
  })

  // Check if the user is an admin and set the session variable
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) {
      // Get user role from the users table
      const { data: userData } = await supabase.from("users").select("role").eq("id", session.user.id).single()

      if (userData?.role === "admin") {
        // Set the session variable for admin
        await supabase.rpc("set_is_admin", { is_admin: true })
      }
    }
  } catch (error) {
    console.error("Error setting up admin session:", error)
  }

  return supabase
}
