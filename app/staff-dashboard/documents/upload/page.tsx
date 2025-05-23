"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { ArrowLeft, Upload, FileText, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function UploadDocumentPage() {
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [selectedCase, setSelectedCase] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("pending")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Check if user is authenticated
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push("/")
          return
        }

        // Get user data
        const { data: user, error: userError } = await supabase
          .from("users")
          .select("role, full_name, staff_role")
          .eq("id", session.user.id)
          .maybeSingle()

        if (userError) {
          throw userError
        }

        if (!user) {
          throw new Error("User profile not found. Please contact an administrator.")
        }

        if (user.role !== "staff" && user.role !== "admin") {
          // Sign out if not authorized
          await supabase.auth.signOut()
          router.push("/")
          return
        }

        // Fetch cases based on role
        let casesData = []

        // If admin, fetch all cases
        if (user.role === "admin") {
          const { data, error: casesError } = await supabase
            .from("cases")
            .select("*")
            .order("created_at", { ascending: false })

          if (casesError) {
            throw casesError
          }

          casesData = data || []
        } else {
          // For staff, fetch cases they're assigned to
          const { data: assignedCases, error: assignmentsError } = await supabase
            .from("case_assignments")
            .select("case_id")
            .eq("user_id", session.user.id)

          if (assignmentsError) {
            throw assignmentsError
          }

          if (assignedCases && assignedCases.length > 0) {
            const caseIds = assignedCases.map((a) => a.case_id)

            const { data, error: casesError } = await supabase
              .from("cases")
              .select("*")
              .in("id", caseIds)
              .order("created_at", { ascending: false })

            if (casesError) {
              throw casesError
            }

            casesData = data || []
          }
        }

        setCases(casesData)
      } catch (err: any) {
        setError(err.message || "An error occurred while loading data")
        console.error("Upload page error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
      setUploadError(null)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      setUploadError("Please select a file to upload")
      return
    }

    if (!selectedCase) {
      setUploadError("Please select a case for this document")
      return
    }

    setUploading(true)
    setUploadError(null)
    setUploadSuccess(false)

    try {
      // 1. Get the current user
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error("You must be logged in to upload documents")
      }

      // 2. Get the case details for the file name
      const selectedCaseData = cases.find((c) => c.id === selectedCase)
      if (!selectedCaseData) {
        throw new Error("Selected case not found")
      }

      // 3. Upload the file to Supabase Storage
      const fileExt = file.name.split(".").pop()
      const fileName = `${selectedCaseData.case_number}/${Date.now()}.${fileExt}`
      const { data: fileData, error: uploadError } = await supabase.storage.from("documents").upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      })

      if (uploadError) {
        throw new Error(`Error uploading file: ${uploadError.message}`)
      }

      // 4. Get the public URL for the file
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(fileName)

      // 5. Insert a record in the documents table
      const { error: insertError } = await supabase.from("documents").insert({
        id: crypto.randomUUID(),
        case_id: selectedCase,
        filename: file.name,
        file_type: file.type,
        uploaded_by: session.user.id,
        upload_time: new Date().toISOString(),
        encrypted: false,
        notes: notes,
        status: status,
        storage_url: publicUrl,
      })

      if (insertError) {
        throw new Error(`Error saving document metadata: ${insertError.message}`)
      }

      // 6. Success!
      setUploadSuccess(true)
      setFile(null)
      setNotes("")
      setStatus("pending")
      setSelectedCase("")

      // Reset the file input
      const fileInput = document.getElementById("file") as HTMLInputElement
      if (fileInput) {
        fileInput.value = ""
      }
    } catch (err: any) {
      setUploadError(err.message || "An error occurred during upload")
      console.error("Upload error:", err)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-t-blue-500 border-blue-200 rounded-full animate-spin"></div>
        <span className="ml-2">Loading...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-center">
          <Button onClick={() => router.push("/staff-dashboard")}>Return to Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-50">
      <div className="mb-6">
        <Button variant="outline" onClick={() => router.push("/staff-dashboard/documents")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Documents
        </Button>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Upload New Document</CardTitle>
          <CardDescription>Add a new document to a case</CardDescription>
        </CardHeader>
        <CardContent>
          {uploadError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {uploadSuccess && (
            <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
              <Check className="h-4 w-4 mr-2" />
              <AlertDescription>Document uploaded successfully!</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <Label htmlFor="case">Select Case</Label>
              <Select value={selectedCase} onValueChange={setSelectedCase} required>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a case" />
                </SelectTrigger>
                <SelectContent>
                  {cases.length === 0 ? (
                    <SelectItem value="no-cases" disabled>
                      No cases available
                    </SelectItem>
                  ) : (
                    cases.map((caseItem) => (
                      <SelectItem key={caseItem.id} value={caseItem.id}>
                        {caseItem.case_number} - {caseItem.client_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="file">Select Document</Label>
              <div className="mt-1 flex items-center">
                <label className="block w-full">
                  <span className="sr-only">Choose file</span>
                  <Input
                    id="file"
                    type="file"
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                </label>
              </div>
            </div>

            {file && (
              <div className="flex items-center p-2 bg-blue-50 rounded">
                <FileText className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-700 truncate flex-1">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} className="text-gray-500 hover:text-gray-700">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove file</span>
                </button>
              </div>
            )}

            <div>
              <Label htmlFor="status">Document Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this document"
                className="mt-1"
              />
            </div>

            <Button type="submit" disabled={uploading || !file || !selectedCase} className="w-full">
              {uploading ? (
                <>Uploading...</>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
