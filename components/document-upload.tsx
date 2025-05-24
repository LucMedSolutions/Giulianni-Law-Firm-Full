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
  client_name: string | null
  case_type: string
}

interface DocumentUploadProps {
  caseId?: string
  onUploadComplete?: (document: any) => void
}

export default function DocumentUpload({ caseId, onUploadComplete }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseId || "")
  const [cases, setCases] = useState<Case[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null)
  const [availableBuckets, setAvailableBuckets] = useState<string[]>([])
  const [loadingCases, setLoadingCases] = useState(true)
  const [loadingStorage, setLoadingStorage] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    fetchCases()
    checkStorageBuckets()
  }, [])

  const fetchCases = async () => {
    try {
      setLoadingCases(true)
      const { data: casesData, error } = await supabase
        .from("cases")
        .select("id, case_number, client_name, case_type")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching cases:", error)
        setMessage({ type: "error", text: "Failed to load cases" })
        return
      }

      console.log("Fetched cases:", casesData?.length || 0)
      setCases(casesData || [])
    } catch (error) {
      console.error("Error in fetchCases:", error)
      setMessage({ type: "error", text: "Failed to load cases" })
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
          file_path: uploadData.path,
          file_size: file.size,
          file_type: file.type,
          bucket_name: usedBucket,
          status: "pending",
          upload_time: new Date().toISOString(),
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
    if (selectedFile) {
      // Check file size (50MB limit)
      if (selectedFile.size > 50 * 1024 * 1024) {
        setMessage({ type: "error", text: "File size must be less than 50MB" })
        return
      }
      setFile(selectedFile)
      setMessage(null)
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
            <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a case" />
              </SelectTrigger>
              <SelectContent>
                {cases.length === 0 ? (
                  <SelectItem value="no-cases" disabled>
                    No cases found
                  </SelectItem>
                ) : (
                  cases.map((case_) => (
                    <SelectItem key={case_.id} value={case_.id}>
                      Case #{case_.case_number} - {case_.client_name || "No client name"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* File Selection */}
        <div className="space-y-2">
          <Label htmlFor="file-upload">Select File</Label>
          <Input
            id="file-upload"
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
            className="cursor-pointer"
            disabled={availableBuckets.length === 0}
          />
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
          disabled={!file || !selectedCaseId || uploading || loadingCases || availableBuckets.length === 0}
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
