import { type NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get("documentId")

    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get document details
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single()

    if (docError || !document) {
      console.error("Document fetch error:", docError)
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    console.log("Document found:", { id: document.id, filename: document.filename, storage_url: document.storage_url })

    // For now, let's try a simple redirect to the storage URL
    // This bypasses the storage download issues
    try {
      const response = await fetch(document.storage_url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()

      return new NextResponse(arrayBuffer, {
        headers: {
          "Content-Type": document.file_type || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${document.filename}"`,
          "Content-Length": arrayBuffer.byteLength.toString(),
          "Cache-Control": "no-cache",
        },
      })
    } catch (fetchError) {
      console.error("Direct fetch error:", fetchError)

      // Fallback: redirect to the storage URL
      return NextResponse.redirect(document.storage_url)
    }
  } catch (error) {
    console.error("Download API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
