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

interface Case {
  id: string
  case_number: string
  client_name: string | null // Ensure this is fetched for staff/admin if needed for display
  case_type: string
  // Potentially other fields depending on what's needed for display or logic
}

interface DocumentUploadProps {
  userId: string // Required: ID of the user performing the upload
  userRole: "client" | "staff" | "admin" // Required: Role of the user
  caseId?: string // Optional: Pre-select case or hide selector
  onUploadComplete?: (document: any) => void // Optional: Callback after successful upload
}

export default function DocumentUpload({
  userId,
  userRole,
  caseId,
  onUploadComplete,
}: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseId || "")
  const [cases, setCases] = useState<Case[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null)
  const [availableBuckets, setAvailableBuckets] = useState<string[]>([])
  const [loadingCases, setLoadingCases] = useState(true)
  const [loadingStorage, setLoadingStorage] = useState(true)

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
  }, [userId, userRole, caseId]) // Added userId, userRole, caseId as dependencies

  const fetchCases = async () => {
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
        throw new Error("Selected case not found")
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
        try {
          console.log(`Trying to upload to bucket: ${bucketName}`)

          const { data, error } = await supabase.storage.from(bucketName).upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
          })

          if (error) {
            console.error(`Upload to ${bucketName} failed:`, error)
            lastError = error
            continue
          }

          if (data) {
            console.log(`Successfully uploaded to ${bucketName}`)
            uploadData = data
            usedBucket = bucketName
            uploadSuccess = true
            break
          }
        } catch (error) {
          console.error(`Error uploading to ${bucketName}:`, error)
          lastError = error
          continue
        }
      }

      if (!uploadSuccess) {
        const errorMessage = lastError?.message || "Unknown error"
        throw new Error(`Failed to upload to any available bucket. Last error: ${errorMessage}`)
      }

      if (!uploadData || !usedBucket) {
        throw new Error("Upload completed but no data returned")
      }

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
        throw new Error(`Failed to save document metadata: ${dbError.message}`)
      }

      setMessage({ type: "success", text: "Document uploaded successfully!" })
      setFile(null)

      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) fileInput.value = ""

      // Call callback if provided
      if (onUploadComplete) {
        onUploadComplete(documentData)
      }
    } catch (error: any) {
      console.error("Upload error:", error)
      setMessage({
        type: "error",
        text: `Upload failed: ${error.message || "Unknown error"}`,
      })
    } finally {
      setUploading(false)
    }
  }

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
            disabled={availableBuckets.length === 0 || uploading}
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
            uploading ||
            loadingCases ||
            loadingStorage ||
            availableBuckets.length === 0
          }
          className="w-full"
        >
          {uploading ? "Uploading..." : "Upload Document"}
        </Button>

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
