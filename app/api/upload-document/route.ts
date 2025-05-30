import { type NextRequest, NextResponse } from "next/server"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    // Create a server-side supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const supabase = createServerComponentClient({ cookies })

    // Get the current user
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 })
    }

    const userId = session.user.id

    const formData = await request.formData()
    const file = formData.get("file") as File
    const caseId = formData.get("caseId") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!caseId) {
      return NextResponse.json({ error: "No case ID provided" }, { status: 400 })
    }

    // Get the case information
    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select("case_number")
      .eq("id", caseId)
      .single()

    if (caseError || !caseData) {
      console.error("Case fetch error:", caseError)
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

    // Generate filename with case number
    const fileExt = file.name.split(".").pop()
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const fileName = `${caseData.case_number}/${timestamp}-${randomId}.${fileExt}`

    // Check available buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

    if (bucketsError || !buckets || buckets.length === 0) {
      console.error("Storage buckets error:", bucketsError)
      return NextResponse.json({ error: "No storage buckets available" }, { status: 500 })
    }

    let uploadSuccess = false
    let uploadData = null
    let usedBucket = null
    let lastError = null

    // Try to upload to each available bucket
    for (const bucket of buckets) {
      try {
        console.log(`Trying to upload to bucket: ${bucket.name}`)

        const { data, error } = await supabase.storage.from(bucket.name).upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        })

        if (error) {
          console.error(`Upload to ${bucket.name} failed:`, error)
          lastError = error
          continue
        }

        if (data) {
          console.log(`Successfully uploaded to ${bucket.name}`)
          uploadData = data
          usedBucket = bucket.name
          uploadSuccess = true
          break
        }
      } catch (error) {
        console.error(`Error uploading to ${bucket.name}:`, error)
        lastError = error
        continue
      }
    }

    if (!uploadSuccess) {
      const errorMessage = lastError?.message || "Unknown error"
      return NextResponse.json(
        { error: `Failed to upload to any available bucket. Last error: ${errorMessage}` },
        { status: 500 },
      )
    }

    if (!uploadData || !usedBucket) {
      return NextResponse.json({ error: "Upload completed but no data returned" }, { status: 500 })
    }

    // Generate a storage URL for the uploaded file
    const { data: publicUrl } = supabase.storage.from(usedBucket).getPublicUrl(uploadData.path)

    if (!publicUrl?.publicUrl) {
      console.error("Failed to generate public URL")

      // Try to clean up the uploaded file
      try {
        await supabase.storage.from(usedBucket).remove([uploadData.path])
        console.log("Cleaned up uploaded file after URL generation failure")
      } catch (cleanupError) {
        console.error("Failed to cleanup uploaded file:", cleanupError)
      }

      return NextResponse.json({ error: "Failed to generate file URL" }, { status: 500 })
    }

    // Save document metadata to database
    const { data: documentData, error: dbError } = await supabase
      .from("documents")
      .insert({
        case_id: caseId,
        filename: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        file_type: file.type,
        bucket_name: usedBucket,
        uploaded_by: userId,
        status: "pending",
        upload_time: new Date().toISOString(),
        storage_url: publicUrl.publicUrl,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database error:", dbError)

      // Try to clean up the uploaded file
      try {
        await supabase.storage.from(usedBucket).remove([uploadData.path])
        console.log("Cleaned up uploaded file after database error")
      } catch (cleanupError) {
        console.error("Failed to cleanup uploaded file:", cleanupError)
      }

      return NextResponse.json({ error: `Failed to save document metadata: ${dbError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      document: documentData,
      message: "Document uploaded successfully!",
    })
  } catch (error: any) {
    console.error("Upload API error:", error)
    return NextResponse.json({ error: `Upload failed: ${error.message || "Unknown error"}` }, { status: 500 })
  }
}
