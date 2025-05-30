import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  try {
    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        {
          error: "Missing Supabase configuration",
          bucketExists: false,
          bucketPublic: false,
          message: "Supabase environment variables not configured",
        },
        { status: 500 },
      )
    }

    // Create admin client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Check if documents bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

    if (bucketsError) {
      console.error("Error listing buckets:", bucketsError)
      return NextResponse.json(
        {
          error: `Failed to list buckets: ${bucketsError.message}`,
          bucketExists: false,
          bucketPublic: false,
          message: "Could not check bucket status",
        },
        { status: 500 },
      )
    }

    const documentsBucket = buckets.find((bucket) => bucket.name === "documents")
    const bucketExists = !!documentsBucket
    const bucketPublic = documentsBucket?.public || false

    let message = ""
    if (bucketExists && bucketPublic) {
      message = "Documents bucket is properly configured and ready for use"
    } else if (bucketExists && !bucketPublic) {
      message = "Documents bucket exists but public access is disabled"
    } else {
      message = "Documents bucket does not exist"
    }

    return NextResponse.json({
      bucketExists,
      bucketPublic,
      message,
      bucketInfo: documentsBucket
        ? {
            name: documentsBucket.name,
            id: documentsBucket.id,
            public: documentsBucket.public,
            created_at: documentsBucket.created_at,
            updated_at: documentsBucket.updated_at,
          }
        : null,
    })
  } catch (error) {
    console.error("Error in check-storage-status:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        bucketExists: false,
        bucketPublic: false,
        message: "Failed to check storage status",
      },
      { status: 500 },
    )
  }
}
