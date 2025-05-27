import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

// Create a single supabase client for the entire client-side application
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables")
    throw new Error("Supabase configuration is missing. Please check your environment variables.")
  }

  return createClientComponentClient({
    supabaseUrl,
    supabaseKey,
  })
}

// Function to set admin status in the session
export const setAdminStatus = async (supabase: ReturnType<typeof createClientComponentClient>, isAdmin: boolean) => {
  try {
    await supabase.rpc("set_is_admin", { is_admin: isAdmin })
    return true
  } catch (error) {
    console.error("Error setting admin status:", error)
    return false
  }
}
