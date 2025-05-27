import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Create the documents bucket with public access
    const { data: bucketData, error: bucketError } = await supabase.storage.createBucket("documents", {
      public: true, // This is crucial for downloads to work
      allowedMimeTypes: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/png",
        "image/gif",
        "text/plain",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
      fileSizeLimit: 52428800, // 50MB
    })

    if (bucketError) {
      // If bucket already exists, try to update it to be public
      if (bucketError.message.includes("already exists")) {
        const { error: updateError } = await supabase.storage.updateBucket("documents", {
          public: true,
        })

        if (updateError) {
          console.error("Error updating bucket:", updateError)
        }

        return NextResponse.json({
          message: "Storage bucket already exists and has been configured for public access",
          bucket: "documents",
        })
      }
      throw bucketError
    }

    return NextResponse.json({
      message: "Storage bucket created successfully with public access enabled",
      bucket: bucketData,
    })
  } catch (error: any) {
    console.error("Storage bucket creation error:", error)
    return NextResponse.json({ error: error.message || "Failed to create storage bucket" }, { status: 500 })
  }
}
