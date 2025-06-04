"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, AlertCircle, CheckCircle, Database, ExternalLink } from "lucide-react"

// ... other code above remains unchanged

const [file, setFile] = useState<File | null>(null)
const [selectedCaseId, setSelectedCaseId] = useState<string>(caseId || "")
const [cases, setCases] = useState<Case[]>([])
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

const sessionLostDuringOperationRef = React.useRef(false)
const aiCallAbortControllerRef = React.useRef<AbortController | null>(null)

  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseId || "")
  const [cases, setCases] = useState<Case[]>([])
  const [uploading, setUploading] = useState(false) // Covers file upload to Supabase Storage & DB insert
  const [processingAICall, setProcessingAICall] = useState(false) // For the backend /parse-document/ call
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null)
  const [availableBuckets, setAvailableBuckets] = useState<string[]>([])
  const [loadingCases, setLoadingCases] = useState(true)
  const [loadingStorage, setLoadingStorage] = useState(true)

  // State for AI processing retry
  const [aiProcessingError, setAiProcessingError] = useState<string | null>(null)
  const [showAiRetryButton, setShowAiRetryButton] = useState(false)
    filePath: string
    bucketName: string
    fileName: string // Original filename from client side
    dbDocumentId: string // ID of the record in 'documents' table
  } | null>(null)

  // Ref for session status and AbortController
  const sessionLostDuringOperationRef = React.useRef(false)
  const aiCallAbortControllerRef = React.useRef<AbortController | null>(null)

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
    // Add other relevant types like .txt, .csv if needed, ensure they match 'accept' prop and backend
    'text/plain', // .txt
    'text/csv', // .csv
  ]
  const MAX_FILE_SIZE_MB = 10
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
  // --- End Validation Constants ---

  useEffect(() => {
    // Initialize selectedCaseId if caseId prop is provided
    if (caseId) {
      setSelectedCaseId(caseId)
    }
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
        setShowAiRetryButton(false) // Hide retry if session is lost

        // Attempt to abort in-flight AI processing call
        if (aiCallAbortControllerRef.current) {
          aiCallAbortControllerRef.current.abort()
          console.log("AI processing call aborted due to session expiry.")
        }
      } else if (event === "SIGNED_IN") {
        // If user signs back in (e.g. in another tab), reset the ref.
        // New operations should re-check session anyway.
        sessionLostDuringOperationRef.current = false
      }
    })

    return () => {
      authListener?.unsubscribe()
    }
  }, [userId, userRole, caseId, supabase]) // Added supabase to dependencies

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
    if (!await checkSessionAndProceed()) return;
    // If caseId is provided, we might not need to fetch all cases,
    // or we can use it to pre-select the case from the fetched list.
    // For now, if caseId is provided and valid, we could potentially skip fetching.
    // However, the dropdown still needs to be populated if it's visible.
    // If caseId is provided, the dropdown could be hidden or pre-filled.

    // For now, we will always fetch cases, and if caseId is provided,
    // it will be used for initial selection by `selectedCaseId` state.
    // The component can be enhanced later to hide the dropdown if caseId is fixed.

    setLoadingCases(true)
    setMessage(null)
    setCases([]) // Clear previous cases

    try {
      let fetchedCasesData: Case[] | null = null
      let fetchError: any = null

      const baseQuery = "id, case_number, client_name, case_type" // Ensure client_name is fetched

      if (userRole === "client") {
        // Assumes cases table has a 'client_id' column linked to the users.id of the client.
        // This is a common convention. If schema is different, this needs adjustment.
        const { data, error } = await supabase
          .from("cases")
          .select(baseQuery)
          .eq("client_id", userId) // Filter by client_id
          .order("created_at", { ascending: false })
        fetchedCasesData = data
        fetchError = error
      } else if (userRole === "staff") {
        // Fetch case_ids staff is assigned to, then fetch those cases.
        const { data: assignments, error: assignmentsError } = await supabase
          .from("case_assignments")
          .select("case_id")
          .eq("user_id", userId) // Filter by staff user's ID

        if (assignmentsError) {
          throw assignmentsError
        }

        if (assignments && assignments.length > 0) {
          const caseIds = assignments.map((a) => a.case_id)
          const { data, error } = await supabase
            .from("cases")
            .select(baseQuery)
            .in("id", caseIds) // Filter by the fetched case_ids
            .order("created_at", { ascending: false })
          fetchedCasesData = data
          fetchError = error
        } else {
          // Staff is not assigned to any cases
          fetchedCasesData = []
        }
      } else if (userRole === "admin") {
        // Admin fetches all cases
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

      console.log(`Fetched ${fetchedCasesData?.length || 0} cases for ${userRole} (${userId})`)
      setCases(fetchedCasesData || [])

      // Handle pre-selection or warning if caseId prop is provided
      if (caseId) {
        if (fetchedCasesData?.some(c => c.id === caseId)) {
          setSelectedCaseId(caseId)
        } else {
          // caseId was provided but not found in the fetched list for this user/role
          setMessage({
            type: "warning",
            text: `The pre-selected case (ID: ${caseId}) is not accessible or valid for your user role. Please select another case.`,
          })
          setSelectedCaseId("") // Clear invalid pre-selection
          // If caseId was mandatory (dropdown hidden), this might be an error state.
          // For now, selector remains visible.
        }
      } else {
         // If no caseId prop, and no specific case was pre-selected, clear selection
        setSelectedCaseId("")
      }

    } catch (error: any) {
      console.error("Error in fetchCases:", error)
      setMessage({ type: "error", text: `Failed to load cases: ${error.message}` })
    } finally {
      setLoadingCases(false)
    }
  }

  const checkStorageBuckets = async () => {
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
      console.log("Available buckets:", bucketNames)
      setAvailableBuckets(bucketNames)

      if (bucketNames.length === 0) {
        setMessage({
          type: "warning",
          text: "No storage buckets found. Please contact your administrator to set up file storage.",
        })
      } else {
        setMessage({
          type: "success",
          text: `Storage is ready. Found ${bucketNames.length} bucket(s): ${bucketNames.join(", ")}`,
        })
      }
    } catch (error) {
      console.error("Error checking storage:", error)
      setMessage({
        type: "warning",
        text: "Unable to check storage configuration.",
      })
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

    if (!selectedCaseId) {
      setMessage({ type: "error", text: "Please select a case" })
      return
    }

    if (availableBuckets.length === 0) {
      setMessage({
        type: "error",
        text: "No storage buckets available. Please contact your administrator to set up file storage.",
      })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      // Get the selected case data
      const selectedCase = cases.find((c) => c.id === selectedCaseId)
      if (!selectedCase) {
        // This error is less likely if cases are loaded correctly and UI prevents empty selection
        setMessage({ type: "error", text: "Selected case information is missing. Please refresh and try again." })
        throw new Error("Selected case not found internally")
      }

      // Generate filename with case number
      const fileExt = file.name.split(".").pop()
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 8)
      const fileName = `${selectedCase.case_number}/${timestamp}-${randomId}.${fileExt}`

      console.log("Attempting to upload file:", fileName)
      console.log("Available buckets:", availableBuckets)

      let uploadSuccess = false
      let uploadData = null
      let usedBucket = null
      let lastError = null

      // Try to upload to each available bucket
      for (const bucketName of availableBuckets) {
        if (!await checkSessionAndProceed()) { // Check session before each attempt if it's a loop that could span time
            setUploading(false); // Abort further upload attempts
            return;
        }
        try {
          console.log(`Trying to upload to bucket: ${bucketName}`)

          const { data, error: uploadError } = await supabase.storage.from(bucketName).upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
          })

          if (uploadError) {
            console.error(`Upload to ${bucketName} failed:`, uploadError)
             // Check for auth error specifically
            if (uploadError.message.includes("JWT") || uploadError.message.includes("Unauthorized") || uploadError.message.includes("token")) {
              sessionLostDuringOperationRef.current = true; // Mark session as lost
              setMessage({ type: 'error', text: 'Upload failed: Your session may have expired. Please log in and try again.' });
              setUploading(false);
              return; // Stop further processing
            }
            lastError = uploadError
            continue
          }

          if (data) {
            console.log(`Successfully uploaded to ${bucketName}`)
            uploadData = data
            usedBucket = bucketName
            uploadSuccess = true
            break
          }
        } catch (error) { // Catch network or other errors during this specific attempt
          console.error(`Error uploading to ${bucketName}:`, error)
          lastError = error // Keep track of the last error
          continue
        }
      }

      if (!uploadSuccess) {
        const userFriendlyMessage = "File upload failed. Please ensure you have a stable connection and try again."
        const technicalError = lastError?.message || "Unknown storage upload error."
        console.error("Upload to Supabase storage error:", technicalError)
        // If lastError specifically indicated an auth issue, that would have been caught above.
        // So this is likely a network or bucket policy issue if not auth.
        throw new Error(`${userFriendlyMessage} (Details: ${technicalError})`)
      }

      if (!uploadData || !usedBucket) {
        // This case should ideally not be reached if uploadSuccess is true.
        throw new Error("Upload completed but no data returned from storage.")
      }

      if (!await checkSessionAndProceed()) { setUploading(false); return; }
      // Save document metadata to database
      const { data: documentData, error: dbError } = await supabase
        .from("documents")
        .insert({
          case_id: selectedCaseId,
          file_name: file.name,
          // Store the file path from Supabase Storage, not a public URL.
          // Assuming 'storage_url' column will now store this path.
          // If the column name is e.g. 'file_path', this should be: file_path: uploadData.path
          storage_url: uploadData.path,
          file_size: file.size,
          file_type: file.type,
          bucket_name: usedBucket, // Store the bucket name for reconstructing paths or direct access if needed
          status: "pending", // Default status
          upload_time: new Date().toISOString(),
          uploaded_by: userId, // Associate upload with the user
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
        // Check for auth error specifically from DB insert
        if (dbError.message.includes("JWT") || dbError.message.includes("Unauthorized") || dbError.message.includes("token")) {
            sessionLostDuringOperationRef.current = true;
            setMessage({ type: 'error', text: 'Saving document details failed: Your session may have expired. Please log in and try again.' });
            setUploading(false); // Ensure uploading stops
            return;
        }
        throw new Error(`Failed to save document details after upload. Error: ${dbError.message}`);
      }

      // --- AI Processing Call ---
      // Store info needed for potential retry BEFORE clearing file state
      setLastUploadedDocumentInfo({
        filePath: documentData.storage_url, // This is the file_path
        bucketName: documentData.bucket_name,
        fileName: documentData.file_name, // Use filename from DB record
        dbDocumentId: documentData.id,
      });

      setFile(null); // Clear file from state now that upload and DB insert are done.
      // File input element value is cleared after AI call attempt.

      await triggerAiProcessing(
        documentData.storage_url,
        documentData.bucket_name,
        documentData.file_name, // Pass original filename from DB record
        documentData // Pass the full dbDocument to onUploadComplete
      );

    } catch (error: any) { // This outer catch handles errors from Supabase upload or DB insert
      console.error("Upload error:", error)
      setMessage({
        type: "error",
        // Error message might already be user-friendly if it came from the new throw statements
        text: error.message || "Upload failed. An unexpected error occurred.",
      })
    } finally {
      setUploading(false); // Covers Supabase upload and DB insert phase
    }
  }

  const triggerAiProcessing = async (
    filePath: string,
    bucketName: string,
    fileName: string, // original filename
    dbDocument: any // document record from DB
  ) => {
    if (!await checkSessionAndProceed()) {
      // If session lost before starting, update states and don't proceed
      setProcessingAICall(false); // Ensure this is false if we bail early
      setShowAiRetryButton(true); // Show retry because upload was done, but AI step cannot start
      setAiProcessingError("Session expired before AI processing could start.");
      // onUploadComplete might be called by the checkSessionAndProceed's effect or here explicitly
      if (onUploadComplete) {
        onUploadComplete({ dbDocument, aiError: "Session expired before AI processing could start." });
      }
      return;
    }

    setMessage({ type: "success", text: "Document uploaded. Initiating AI processing..." })
    setProcessingAICall(true)
    setAiProcessingError(null)
    setShowAiRetryButton(false)

    aiCallAbortControllerRef.current = new AbortController(); // Create new AbortController for this call
    const signal = aiCallAbortControllerRef.current.signal;

    let aiTaskId: string | undefined = undefined
    let aiError: string | undefined = undefined

    try {
      const backendApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
      if (!backendApiUrl) {
        setMessage({ type: "error", text: "Backend API URL is not configured. Cannot start AI processing." });
        setProcessingAICall(false); // Ensure this is reset
        setShowAiRetryButton(true); // Allow retry if URL gets configured
        setAiProcessingError("Backend API URL not configured.");
        if (onUploadComplete) {
          onUploadComplete({ dbDocument, aiError: "Backend API URL not configured." });
        }
        return;
      }

      const aiResponse = await fetch(`${backendApiUrl}/parse-document/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_path: filePath,
          bucket_name: bucketName,
          filename: fileName,
          user_query: "",
        }),
        signal, // Pass the abort signal to fetch
      })

      if (!aiResponse.ok) {
        const errorResult = await aiResponse.json().catch(() => ({}))
        const errorDetail = errorResult.detail?.message || errorResult.detail || `AI processing API request failed: ${aiResponse.statusText} (Status: ${aiResponse.status})`
        throw new Error(errorDetail)
      }

      const aiResult = await aiResponse.json()
      aiTaskId = aiResult.task_id
      setMessage({ type: "success", text: `Document uploaded successfully. AI processing started. Task ID: ${aiTaskId}` })
      setLastUploadedDocumentInfo(null); // Clear info after successful AI call initiation

    } catch (processingError: any) {
      console.error("AI Processing API call error:", processingError)
      aiError = processingError.message || "Unknown error during AI processing."
      setAiProcessingError(aiError) // Store specific AI error
      setShowAiRetryButton(true) // Show retry button
      setMessage({
        type: "warning",
        text: `Document uploaded, but AI processing call failed: ${aiError}. You can retry processing.`,
      })
    } finally {
      setProcessingAICall(false)
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) fileInput.value = "" // Clear file input after first attempt or retry

      if (onUploadComplete) {
        onUploadComplete({ dbDocument, aiTaskId, aiError })
      }
    }
  }

  const handleRetryAiProcessing = async () => {
    if (!lastUploadedDocumentInfo) {
      setMessage({ type: "error", text: "Cannot retry: Document information not found." });
      setShowAiRetryButton(false); // Hide button if info is lost
      return;
    }
    // Fetch the full document record again for onUploadComplete, though only id is strictly needed for retry
    const {data: dbDoc, error: fetchErr} = await supabase.from("documents").select("*").eq("id", lastUploadedDocumentInfo.dbDocumentId).single();
    if (fetchErr || !dbDoc) {
         setMessage({ type: "error", text: `Cannot retry: Failed to retrieve document details. ${fetchErr?.message}` });
         setShowAiRetryButton(false);
         return;
    }

    await triggerAiProcessing(
      lastUploadedDocumentInfo.filePath,
      lastUploadedDocumentInfo.bucketName,
      lastUploadedDocumentInfo.fileName,
      dbDoc
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    const fileInput = e.target // Keep a reference to the input for clearing

    if (selectedFile) {
      // TODO: For enhanced security, implement server-side validation using Supabase Storage policies
      // or Edge Functions to restrict file types and sizes directly at the storage layer.

      // Type Check
      if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
        setMessage({
          type: "error",
          text: `Invalid file type: ${selectedFile.type}. Allowed types: PDF, Word, Excel, JPG, PNG, TXT, CSV.`,
        })
        setFile(null) // Clear any previously selected valid file
        if (fileInput) fileInput.value = "" // Clear the file input
        return
      }

      // Size Check
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        setMessage({
          type: "error",
          text: `File is too large (${(selectedFile.size / 1024 / 1024).toFixed(2)}MB). Maximum size: ${MAX_FILE_SIZE_MB}MB.`,
        })
        setFile(null) // Clear any previously selected valid file
        if (fileInput) fileInput.value = "" // Clear the file input
        return
      }

      // If all checks pass
      setFile(selectedFile)
      setMessage({ type: "success", text: `File "${selectedFile.name}" selected and valid.` }) // Or setMessage(null)
    } else {
      // No file selected, or selection was cancelled
      setFile(null)
      setMessage(null) // Clear any previous messages
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
        {/* Storage Status */}
        {loadingStorage ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Checking storage configuration...</AlertDescription>
          </Alert>
        ) : availableBuckets.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium">Storage Setup Required</p>
                <p className="text-sm">
                  No storage buckets are available. An administrator needs to create a storage bucket in the Supabase
                  dashboard.
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Administrator Instructions:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to your Supabase project dashboard</li>
                    <li>Navigate to Storage in the left sidebar</li>
                    <li>Click "Create bucket"</li>
                    <li>Name it "documents" and set it to private</li>
                    <li>Set up appropriate RLS policies for authenticated users</li>
                  </ol>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("https://supabase.com/docs/guides/storage", "_blank")}
                  className="mt-2"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Storage Documentation
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription>Storage ready. Available buckets: {availableBuckets.join(", ")}</AlertDescription>
          </Alert>
        )}

        {/* Case Selection */}
        <div className="space-y-2">
          <Label htmlFor="case-select">Select Case</Label>
          {loadingCases ? (
            <div className="text-sm text-muted-foreground">Loading cases...</div>
          ) : (
            <Select
              value={selectedCaseId}
              onValueChange={setSelectedCaseId}
              disabled={!!caseId} // Disable selector if caseId is provided via props
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a case" />
              </SelectTrigger>
              <SelectContent>
                {cases.length === 0 && !loadingCases ? (
                  <SelectItem value="no-cases" disabled>
                    No cases available for your role or no cases exist.
                  </SelectItem>
                ) : (
                  cases.map((case_) => (
                    <SelectItem key={case_.id} value={case_.id}>
                      Case #{case_.case_number} - {case_.client_name || case_.case_type || "N/A"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
          {caseId && <p className="text-sm text-muted-foreground mt-1">This document will be uploaded to the pre-selected case.</p>}
        </div>

        {/* File Selection */}
        <div className="space-y-2">
          <Label htmlFor="file-upload">Select File</Label>
          <Input
            id="file-upload"
            type="file"
            onChange={handleFileChange}
            // Consolidated accept string based on defined MIME types (approximated)
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.txt,.csv"
            className="cursor-pointer"
            disabled={availableBuckets.length === 0 || uploading || processingAICall || showAiRetryButton }
          />
          {/* Validation messages are handled by the main message state.
              This area remains for displaying selected file info. */}
          {file && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
          )}
        </div>

        {/* Status Message */}
        {message && (
          <Alert
            className={
              message.type === "error"
                ? "border-red-200 bg-red-50"
                : message.type === "warning"
                  ? "border-yellow-200 bg-yellow-50"
                  : "border-green-200 bg-green-50"
            }
          >
            {message.type === "error" ? (
              <AlertCircle className="h-4 w-4" />
            ) : message.type === "warning" ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={
            !file ||
            !selectedCaseId ||
            uploading || // True during Supabase upload + DB insert
            processingAICall ||
            loadingCases ||
            loadingStorage ||
            availableBuckets.length === 0 ||
            showAiRetryButton // Disable main upload if retry is pending
          }
          className="w-full"
        >
          {uploading
            ? "Uploading file..."
            : processingAICall
              ? "Processing document..."
              : "Upload Document"}
        </Button>

        {/* Retry Button for AI Processing */}
        {showAiRetryButton && !processingAICall && (
          <div className="mt-4 text-center">
            <p className="text-sm text-red-600 mb-2">AI processing previously failed: {aiProcessingError}</p>
            <Button
              onClick={handleRetryAiProcessing}
              variant="outline"
              disabled={processingAICall}
            >
              {processingAICall ? "Retrying AI Processing..." : "Retry AI Processing"}
            </Button>
          </div>
        )}

        {/* Help Section */}
        {availableBuckets.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Need Help?</p>
                <p className="text-sm">
                  Contact your system administrator to set up file storage. They will need to create storage buckets and
                  configure the appropriate permissions in your Supabase project.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
