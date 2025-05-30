import { type NextRequest, NextResponse } from "next/server"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const caseId = searchParams.get("caseId")

    if (!caseId) {
      return NextResponse.json({ error: "Case ID is required" }, { status: 400 })
    }

    const supabase = createServerComponentClient({ cookies })

    // Get the current user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch documents for the case
    const { data: documents, error: documentsError } = await supabase
      .from("documents")
      .select("*")
      .eq("case_id", caseId)
      .order("upload_time", { ascending: false })

    if (documentsError) {
      console.error("Documents fetch error:", documentsError)
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
    }

    return NextResponse.json({ documents: documents || [] })
  } catch (error) {
    console.error("Get case documents API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
