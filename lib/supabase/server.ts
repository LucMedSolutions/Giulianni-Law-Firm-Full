import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

// Create a server-side supabase client
export const createClient = async () => {
  const supabase = createServerComponentClient({
    cookies,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  // Check if the user is an admin and set the session variable
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

  return supabase
}
