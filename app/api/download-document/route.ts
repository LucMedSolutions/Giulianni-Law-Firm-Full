import { type NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutError = new Error('Operation timed out')): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(timeoutError), ms))
  ]);
}

const SUPABASE_TIMEOUT_MS = 10000; // 10 seconds, adjust as needed

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId")

    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })

    // Get the current user
    const { data: { user }, error: userError } = await withTimeout(
      supabase.auth.getUser(),
      SUPABASE_TIMEOUT_MS,
      new Error('Timeout getting user')
    );

    if (userError) {
      console.error('User fetch error:', userError.message);
      const status = userError.message === 'Timeout getting user' ? 504 : 401; // 401 for other auth errors
      return NextResponse.json({ error: userError.message || "Unauthorized" }, { status });
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized, no user found" }, { status: 401 });
    }

    // Get document details
    const { data: document, error: docError } = await withTimeout(
      supabase
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .single(),
      SUPABASE_TIMEOUT_MS,
      new Error('Timeout fetching document details')
    );

    if (docError) {
      console.error("Document fetch error:", docError.message);
      const status = docError.message === 'Timeout fetching document details' ? 504 : (docError.code === 'PGRST116' ? 404 : 500); // PGRST116: 'exact one row not found'
      return NextResponse.json({ error: "Document not found or database error", details: docError.message }, { status });
    }
    if (!document) { // Should be caught by docError with .single(), but as a safeguard
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    console.log("Document found:", { id: document.id, filename: document.filename, filePath: document.storage_url, bucket: document.bucket_name });

    // Ensure RLS policies on the 'documents' table correctly restrict access.
    // This endpoint assumes the user fetching the document record is authorized to get its path.

    if (!document.storage_url || !document.bucket_name) {
      return NextResponse.json({ error: "Document path or bucket name is missing" }, { status: 500 })
    }

    const filePath = document.storage_url; // storage_url now holds the file path
    const bucketName = document.bucket_name;
    const expiresIn = 60; // Signed URL expires in 60 seconds

    const { data: signedUrlData, error: signedUrlError } = await withTimeout(
      supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, expiresIn),
      SUPABASE_TIMEOUT_MS,
      new Error('Timeout creating signed URL')
    );

    if (signedUrlError) {
      console.error("Error creating signed URL:", signedUrlError.message);
      const status = signedUrlError.message === 'Timeout creating signed URL' ? 504 : 500;
      return NextResponse.json({ error: "Could not create signed URL", details: signedUrlError.message }, { status });
    }

    if (!signedUrlData || !signedUrlData.signedUrl) {
        console.error("No signed URL data returned from Supabase.");
        // This case might indicate an issue not caught by signedUrlError, potentially a misconfiguration or unexpected response
        return NextResponse.json({ error: "Failed to retrieve signed URL data, unexpected response from storage." }, { status: 500});
    }

    console.log(`Generated signed URL for ${filePath}: ${signedUrlData.signedUrl}`);

    return NextResponse.json({ signedUrl: signedUrlData.signedUrl });

  } catch (error: any) {
    console.error("Get Signed URL API error:", error.message, error);
    if (error.message && error.message.toLowerCase().includes('timeout')) {
      return NextResponse.json({ error: 'An operation timed out.', details: error.message }, { status: 504 });
    }
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
