"use client"

import type React from "react" // Keep this
import { useState, useEffect, useRef } from "react" // Ensure useRef is imported
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, AlertCircle, CheckCircle, Database, ExternalLink } from "lucide-react"

// Assuming Case type is defined elsewhere or globally, e.g.:
// interface Case { id: string; case_number: string; client_name?: string; case_type?: string; /* ... other properties */ }

interface DocumentUploadProps {
  caseId?: string;
  userId?: string;
  userRole?: "client" | "staff" | "admin";
  onUploadComplete?: (details: { dbDocument: any; aiTaskId?: string; aiError?: string }) => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ caseId, userId, userRole, onUploadComplete }) => {
  const [file, setFile] = useState<File | null>(null)
  // Initialize selectedCaseId using the caseId prop inside the component
  const [currentSelectedCaseId, setSelectedCaseId] = useState<string>(caseId || "")
  const [cases, setCases] = useState<any[]>([]) // Using any[] for now, replace 'any' with 'Case' if defined
  const [uploading, setUploading] = useState(false)
  const [processingAICall, setProcessingAICall] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null)
  const [availableBuckets, setAvailableBuckets] = useState<string[]>([])
  const [loadingCases, setLoadingCases] = useState(true)
  const [loadingStorage, setLoadingStorage] = useState(true)
  const [aiProcessingError, setAiProcessingError] = useState<string | null>(null)
  const [showAiRetryButton, setShowAiRetryButton] = useState(false)

  const [lastUploadedDocumentInfo, setLastUploadedDocumentInfo] = useState<{
    filePath: string;
    bucketName: string;
    fileName: string;
    dbDocumentId: string;
  } | null>(null)

  const sessionLostDuringOperationRef = useRef(false) // Changed React.useRef to useRef
  const aiCallAbortControllerRef = useRef<AbortController | null>(null) // Changed React.useRef to useRef

  const supabase = createClient()

  // IMPORTANT: For signed URLs to work correctly and securely,
  // the Supabase storage bucket (e.g., "documents") MUST be set to PRIVATE.
  // Public buckets will not use or respect signed URL expiration times.
  // Ensure RLS policies are in place to control access via Supabase SDK if direct SDK access is also used.

  // --- Validation Constants ---
  const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'image/jpeg', // .jpeg, .jpg
    'image/png', // .png
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/plain', // .txt
    'text/csv', // .csv
  ]
  const MAX_FILE_SIZE_MB = 10
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
  // --- End Validation Constants ---

  useEffect(() => {
    // Initialize currentSelectedCaseId if caseId prop is provided and changes
    if (caseId) {
      setSelectedCaseId(caseId)
    } else {
      // If caseId prop is not provided or becomes undefined, clear selection
      // This behavior might need adjustment based on desired UX
      setSelectedCaseId("")
    }
    // Initial fetch
    fetchCases()
    checkStorageBuckets()

    // Setup onAuthStateChange listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        sessionLostDuringOperationRef.current = true
        setMessage({
          type: "error",
          text: "Your session has expired. The current operation may fail or has been cancelled. Please log in again.",
        })
        setUploading(false)
        setProcessingAICall(false)
        setShowAiRetryButton(false)

        if (aiCallAbortControllerRef.current) {
          aiCallAbortControllerRef.current.abort()
          console.log("AI processing call aborted due to session expiry.")
        }
      } else if (event === "SIGNED_IN") {
        sessionLostDuringOperationRef.current = false
      }
    })

    return () => {
      authListener?.unsubscribe()
    }
  }, [userId, userRole, caseId, supabase]) // supabase added as per original, caseId added to re-init currentSelectedCaseId

  const checkSessionAndProceed = async (): Promise<boolean> => {
    if (sessionLostDuringOperationRef.current) {
       setMessage({ type: 'error', text: 'Session lost. Please log in again and retry.' });
       return false;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      sessionLostDuringOperationRef.current = true;
      setMessage({ type: 'error', text: 'Your session has expired. Please log in and try again.' });
      setUploading(false);
      setProcessingAICall(false);
      setShowAiRetryButton(false);
      return false;
    }
    return true;
  };

  const fetchCases = async () => {
    if (!userId || !userRole) { // Ensure userId and userRole are available
        // setMessage({ type: "warning", text: "User information not available to fetch cases." });
        setLoadingCases(false); // Stop loading if essential info is missing
        return;
    }
    if (!await checkSessionAndProceed()) { setLoadingCases(false); return; }


    setLoadingCases(true)
    setMessage(null) // Clear previous messages related to case fetching
    setCases([])

    try {
      let fetchedCasesData: any[] | null = null // Using any for now
      let fetchError: any = null

      const baseQuery = "id, case_number, client_name, case_type"

      if (userRole === "client") {
        const { data, error } = await supabase
          .from("cases")
          .select(baseQuery)
          .eq("client_id", userId)
          .order("created_at", { ascending: false })
        fetchedCasesData = data
        fetchError = error
      } else if (userRole === "staff") {
        const { data: assignments, error: assignmentsError } = await supabase
          .from("case_assignments")
          .select("case_id")
          .eq("user_id", userId)

        if (assignmentsError) throw assignmentsError;

        if (assignments && assignments.length > 0) {
          const caseIdsToFetch = assignments.map((a) => a.case_id)
          const { data, error } = await supabase
            .from("cases")
            .select(baseQuery)
            .in("id", caseIdsToFetch)
            .order("created_at", { ascending: false })
          fetchedCasesData = data
          fetchError = error
        } else {
          fetchedCasesData = []
        }
      } else if (userRole === "admin") {
        const { data, error } = await supabase
          .from("cases")
          .select(baseQuery)
          .order("created_at", { ascending: false })
        fetchedCasesData = data
        fetchError = error
      }

      if (fetchError) {
        console.error(`Error fetching cases for ${userRole} (${userId}):`, fetchError)
        setMessage({ type: "error", text: `Failed to load cases: ${fetchError.message}` })
        return
      }

      setCases(fetchedCasesData || [])

      if (caseId) { // prop caseId
        if (fetchedCasesData?.some(c => c.id === caseId)) {
          setSelectedCaseId(caseId) // state currentSelectedCaseId
        } else {
          setMessage({
            type: "warning",
            text: `The pre-selected case (ID: ${caseId}) is not accessible or valid. Please select another case.`,
          })
          setSelectedCaseId("") // Clear invalid pre-selection
        }
      } else {
        setSelectedCaseId("") // No caseId prop, clear selection
      }

    } catch (error: any) {
      console.error("Error in fetchCases:", error)
      setMessage({ type: "error", text: `An error occurred while fetching cases: ${error.message}` })
    } finally {
      setLoadingCases(false)
    }
  }

  const checkStorageBuckets = async () => {
    if (!await checkSessionAndProceed()) { setLoadingStorage(false); return; }
    try {
      setLoadingStorage(true)
      const { data: buckets, error } = await supabase.storage.listBuckets()

      if (error) {
        console.error("Error checking storage buckets:", error)
        setAvailableBuckets([])
        setMessage({
          type: "warning",
          text: "Unable to check storage buckets. Storage may need to be configured by an administrator.",
        })
        return
      }

      const bucketNames = buckets?.map((bucket) => bucket.name) || []
      setAvailableBuckets(bucketNames)

      if (bucketNames.length === 0) {
        // Keep existing message or set a new one, this might overwrite case loading messages
        // Consider a more robust message handling system if needed
        setMessage(prev => ({ ...prev, type: "warning", text: prev?.text ? `${prev.text} Also, no storage buckets found.` : "No storage buckets found. Please contact your administrator."}));
      } else {
         // setMessage({ type: "success", text: `Storage is ready. Found ${bucketNames.length} bucket(s).` })
      }
    } catch (error: any) {
      console.error("Error checking storage:", error)
      setMessage({ type: "warning", text: `Unable to check storage configuration: ${error.message}` })
    } finally {
      setLoadingStorage(false)
    }
  }

  const handleUpload = async () => {
    if (!await checkSessionAndProceed()) return;

    if (!file) {
      setMessage({ type: "error", text: "Please select a file" })
      return
    }

    if (!currentSelectedCaseId) { // Use currentSelectedCaseId (state)
      setMessage({ type: "error", text: "Please select a case" })
      return
    }

    if (availableBuckets.length === 0) {
      setMessage({ type: "error", text: "No storage buckets available. Contact admin." })
      return
    }

    setUploading(true)
    setMessage(null)
    setAiProcessingError(null)
    setShowAiRetryButton(false)

    try {
      const selectedCaseDetails = cases.find((c) => c.id === currentSelectedCaseId)
      if (!selectedCaseDetails) {
        setMessage({ type: "error", text: "Selected case details not found. Please refresh." })
        throw new Error("Selected case not found internally")
      }

      const fileExt = file.name.split(".").pop()
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 8)
      const newFileName = `${selectedCaseDetails.case_number}/${timestamp}-${randomId}.${fileExt}` // Use newFileName to avoid conflict

      let uploadSuccess = false
      let uploadDataSupabase = null // Renamed to avoid conflict
      let usedBucket = null
      let lastError: any = null

      for (const bucketName of availableBuckets) {
        if (!await checkSessionAndProceed()) { setUploading(false); return; }
        try {
          const { data, error: uploadError } = await supabase.storage.from(bucketName).upload(newFileName, file, {
            cacheControl: "3600",
            upsert: false,
          })

          if (uploadError) {
            if (uploadError.message.includes("JWT") || uploadError.message.includes("Unauthorized") || uploadError.message.includes("token")) {
              sessionLostDuringOperationRef.current = true;
              setMessage({ type: 'error', text: 'Upload failed: Session expired. Please log in again.' });
              setUploading(false); return;
            }
            lastError = uploadError; continue;
          }
          if (data) {
            uploadDataSupabase = data; usedBucket = bucketName; uploadSuccess = true; break;
          }
        } catch (error) { lastError = error; continue; }
      }

      if (!uploadSuccess) {
        throw new Error(`File upload failed. ${lastError?.message || "Unknown storage error."}`);
      }
      if (!uploadDataSupabase || !usedBucket) {
        throw new Error("Upload completed but no data returned from storage.");
      }

      if (!await checkSessionAndProceed()) { setUploading(false); return; }
      const { data: documentData, error: dbError } = await supabase
        .from("documents")
        .insert({
          case_id: currentSelectedCaseId, // Use state variable
          file_name: file.name, // Original file name
          storage_url: uploadDataSupabase.path,
          file_size: file.size,
          file_type: file.type,
          bucket_name: usedBucket,
          status: "pending",
          upload_time: new Date().toISOString(),
          uploaded_by: userId,
        })
        .select()
        .single()

      if (dbError) {
        try { await supabase.storage.from(usedBucket).remove([uploadDataSupabase.path]); } catch (cleanupError) { console.error("Failed to cleanup uploaded file:", cleanupError); }
        if (dbError.message.includes("JWT") || dbError.message.includes("Unauthorized") || dbError.message.includes("token")) {
            sessionLostDuringOperationRef.current = true;
            setMessage({ type: 'error', text: 'Saving document failed: Session expired. Log in again.' });
            setUploading(false); return;
        }
        throw new Error(`Failed to save document details: ${dbError.message}`);
      }

      setLastUploadedDocumentInfo({
        filePath: documentData.storage_url,
        bucketName: documentData.bucket_name,
        fileName: documentData.file_name,
        dbDocumentId: documentData.id,
      });

      setFile(null); // Clear file from state

      await triggerAiProcessing(
        documentData.storage_url,
        documentData.bucket_name,
        documentData.file_name,
        documentData
      );

    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Upload failed. An unexpected error occurred." })
    } finally {
      setUploading(false);
    }
  }

  const triggerAiProcessing = async (
    filePath: string,
    bucketName: string,
    originalFileName: string, // Renamed for clarity
    dbDocument: any
  ) => {
    if (!await checkSessionAndProceed()) {
      setProcessingAICall(false); setShowAiRetryButton(true);
      setAiProcessingError("Session expired before AI processing.");
      if (onUploadComplete) onUploadComplete({ dbDocument, aiError: "Session expired before AI processing." });
      return;
    }

    setMessage({ type: "success", text: "Document uploaded. Initiating AI processing..." })
    setProcessingAICall(true)
    setAiProcessingError(null)
    setShowAiRetryButton(false)

    aiCallAbortControllerRef.current = new AbortController();
    const signal = aiCallAbortControllerRef.current.signal;

    let aiTaskId: string | undefined = undefined
    let aiError: string | undefined = undefined

    try {
      const backendApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
      if (!backendApiUrl) {
        throw new Error("Backend API URL is not configured.");
      }

      const aiResponse = await fetch(`${backendApiUrl}/parse-document/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath, bucket_name: bucketName, filename: originalFileName, user_query: "" }),
        signal,
      })

      if (!aiResponse.ok) {
        const errorResult = await aiResponse.json().catch(() => ({}))
        throw new Error(errorResult.detail?.message || errorResult.detail || `AI processing API failed: ${aiResponse.statusText}`);
      }

      const aiResult = await aiResponse.json()
      aiTaskId = aiResult.task_id
      setMessage({ type: "success", text: `AI processing started. Task ID: ${aiTaskId}` })
      setLastUploadedDocumentInfo(null);

    } catch (processingError: any) {
      aiError = processingError.message || "Unknown error during AI processing."
      setAiProcessingError(aiError)
      setShowAiRetryButton(true)
      setMessage({ type: "warning", text: `Document uploaded, but AI processing failed: ${aiError}. You can retry.` })
    } finally {
      setProcessingAICall(false)
      const fileInputEl = document.querySelector('input[type="file"]') as HTMLInputElement // Renamed for clarity
      if (fileInputEl) fileInputEl.value = ""

      if (onUploadComplete) {
        onUploadComplete({ dbDocument, aiTaskId, aiError })
      }
    }
  }

  const handleRetryAiProcessing = async () => {
    if (!lastUploadedDocumentInfo) {
      setMessage({ type: "error", text: "Cannot retry: Document information not found." });
      setShowAiRetryButton(false); return;
    }
    const {data: dbDoc, error: fetchErr} = await supabase.from("documents").select("*").eq("id", lastUploadedDocumentInfo.dbDocumentId).single();
    if (fetchErr || !dbDoc) {
         setMessage({ type: "error", text: `Cannot retry: Failed to retrieve document details. ${fetchErr?.message}` });
         setShowAiRetryButton(false); return;
    }
    await triggerAiProcessing(lastUploadedDocumentInfo.filePath, lastUploadedDocumentInfo.bucketName, lastUploadedDocumentInfo.fileName, dbDoc);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    const fileInputEl = e.target // Renamed

    if (selectedFile) {
      if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
        setMessage({ type: "error", text: `Invalid file type. Allowed: PDF, Word, Excel, JPG, PNG, TXT, CSV.`})
        setFile(null); if (fileInputEl) fileInputEl.value = ""; return;
      }
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        setMessage({ type: "error", text: `File too large (max ${MAX_FILE_SIZE_MB}MB).`})
        setFile(null); if (fileInputEl) fileInputEl.value = ""; return;
      }
      setFile(selectedFile)
      setMessage({ type: "success", text: `File "${selectedFile.name}" selected.` })
    } else {
      setFile(null); setMessage(null);
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Document
        </CardTitle>
        <CardDescription>Upload a document and associate it with a case</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadingStorage ? (
          <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Checking storage...</AlertDescription></Alert>
        ) : availableBuckets.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium">Storage Setup Required</p>
                <p className="text-sm">No storage buckets available. Admin setup needed.</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to Supabase project dashboard</li>
                    <li>Navigate to Storage</li>
                    <li>Create bucket (e.g., "documents"), private</li>
                    <li>Set RLS policies</li>
                </ol>
                <Button variant="outline" size="sm" onClick={() => window.open("https://supabase.com/docs/guides/storage", "_blank")} className="mt-2">
                  <ExternalLink className="h-4 w-4 mr-2" /> Docs
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert><Database className="h-4 w-4" /><AlertDescription>Storage ready: {availableBuckets.join(", ")}</AlertDescription></Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="case-select">Select Case</Label>
          {loadingCases ? (
            <div className="text-sm text-muted-foreground">Loading cases...</div>
          ) : (
            <Select
              value={currentSelectedCaseId} // Use state variable
              onValueChange={setSelectedCaseId}
              disabled={!!caseId} // Disable if caseId prop is fixed
            >
              <SelectTrigger><SelectValue placeholder="Choose a case" /></SelectTrigger>
              <SelectContent>
                {cases.length === 0 && !loadingCases ? (
                  <SelectItem value="no-cases" disabled>No cases available.</SelectItem>
                ) : (
                  cases.map((c) => ( // Renamed case_ to c
                    <SelectItem key={c.id} value={c.id}>
                      #{c.case_number} - {c.client_name || c.case_type || "N/A"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
          {caseId && <p className="text-sm text-muted-foreground mt-1">Pre-selected case.</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="file-upload">Select File</Label>
          <Input
            id="file-upload" type="file" onChange={handleFileChange}
            accept={ALLOWED_MIME_TYPES.join(",")} // More accurate accept
            className="cursor-pointer"
            disabled={availableBuckets.length === 0 || uploading || processingAICall || showAiRetryButton }
          />
          {file && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
          )}
        </div>

        {message && (
          <Alert className={ message.type === "error" ? "border-red-200 bg-red-50" : message.type === "warning" ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"}>
            {message.type === "error" ? <AlertCircle className="h-4 w-4" /> : message.type === "warning" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleUpload}
          disabled={ !file || !currentSelectedCaseId || uploading || processingAICall || loadingCases || loadingStorage || availableBuckets.length === 0 || showAiRetryButton }
          className="w-full"
        >
          {uploading ? "Uploading..." : processingAICall ? "Processing..." : "Upload Document"}
        </Button>

        {showAiRetryButton && !processingAICall && (
          <div className="mt-4 text-center">
            <p className="text-sm text-red-600 mb-2">AI processing failed: {aiProcessingError}</p>
            <Button onClick={handleRetryAiProcessing} variant="outline" disabled={processingAICall}>
              {processingAICall ? "Retrying AI..." : "Retry AI Processing"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentUpload;
