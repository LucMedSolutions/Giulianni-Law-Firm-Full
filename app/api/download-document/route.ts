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

    console.log("Document found:", { id: document.id, filename: document.filename, filePath: document.storage_url, bucket: document.bucket_name })

    // Ensure RLS policies on the 'documents' table correctly restrict access.
    // This endpoint assumes the user fetching the document record is authorized to get its path.

    if (!document.storage_url || !document.bucket_name) {
      return NextResponse.json({ error: "Document path or bucket name is missing" }, { status: 500 })
    }

    const filePath = document.storage_url; // storage_url now holds the file path
    const bucketName = document.bucket_name;
    const expiresIn = 60; // Signed URL expires in 60 seconds

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn)

    if (signedUrlError) {
      console.error("Error creating signed URL:", signedUrlError)
      return NextResponse.json({ error: "Could not create signed URL" }, { status: 500 })
    }

    if (!signedUrlData || !signedUrlData.signedUrl) {
        console.error("No signed URL data returned from Supabase.")
        return NextResponse.json({ error: "Failed to retrieve signed URL data" }, { status: 500})
    }

    console.log(`Generated signed URL for ${filePath}: ${signedUrlData.signedUrl}`)

    return NextResponse.json({ signedUrl: signedUrlData.signedUrl })

  } catch (error) {
    console.error("Get Signed URL API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
