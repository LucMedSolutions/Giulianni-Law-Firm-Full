import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    // Create a Supabase client with the service role key
    const cookieStore = cookies()
    const supabaseAdmin = createRouteHandlerClient(
      { cookies: () => cookieStore },
      {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    )

    // Create the SQL function using raw SQL
    const { error } = await supabaseAdmin
      .from("_rpc")
      .select("*", {
        head: true,
      })
      .rpc("create_delete_cascade_function")

    if (error) {
      console.error("Error creating delete cascade function:", error)

      // If the function already exists, that's okay
      if (error.message.includes("already exists")) {
        return NextResponse.json({
          success: true,
          message: "Delete cascade function already exists",
        })
      }

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Delete cascade function created successfully",
    })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}
