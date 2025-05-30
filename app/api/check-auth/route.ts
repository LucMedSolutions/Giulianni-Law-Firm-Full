import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error || !session?.user) {
      return NextResponse.json({ authenticated: false })
    }

    // Get user role
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json({ authenticated: false })
    }

    return NextResponse.json({
      authenticated: true,
      role: userData.role,
      user: session.user,
    })
  } catch (error: any) {
    console.error("Auth check error:", error)
    return NextResponse.json({ authenticated: false })
  }
}
