import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Create a Supabase client using the environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing Supabase credentials in environment variables" }, { status: 500 })
    }

    // Use the service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Create the documents bucket
    const { data: bucketData, error: bucketError } = await supabase.storage.createBucket("documents", {
      public: false,
      fileSizeLimit: 52428800, // 50MB
    })

    if (bucketError) {
      console.error("Error creating bucket:", bucketError)
      return NextResponse.json({ error: `Failed to create bucket: ${bucketError.message}` }, { status: 500 })
    }

    // Create policies for the bucket
    // Note: Policy creation requires direct SQL or dashboard access
    // This API can only create the bucket itself

    return NextResponse.json({
      success: true,
      message: "Storage bucket 'documents' created successfully",
      data: bucketData,
    })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
