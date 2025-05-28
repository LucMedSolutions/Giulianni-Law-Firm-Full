"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Upload, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function UploadDocument() {
  const [cases, setCases] = useState<any[]>([])
  const [selectedCase, setSelectedCase] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Fetch user data and cases
  useEffect(() => {
    const fetchData = async () => {
      setInitialLoading(true)
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
          .select("role, full_name")
          .eq("id", session.user.id)
          .maybeSingle()

        if (userError) throw userError
        if (!user) throw new Error("User profile not found")
        if (user.role !== "client") {
          await supabase.auth.signOut()
          router.push("/")
          return
        }

        // Get client cases
        const { data: clientCases, error: casesError } = await supabase
          .from("cases")
          .select("id, case_number, case_type")
          .eq("client_name", user.full_name)
          .order("case_number", { ascending: true })

        if (casesError) throw casesError
        setCases(clientCases || [])
      } catch (err: any) {
        console.error("Error fetching data:", err)
        setError(err.message || "Failed to load data")
      } finally {
        setInitialLoading(false)
      }
    }

    fetchData()
  }, [router])

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  // Handle drop event
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }, [])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedCase) {
      toast({
        title: "Error",
        description: "Please select a case",
        variant: "destructive",
      })
      return
    }

    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get current user
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/")
        return
      }

      // Upload file to storage
      const fileExt = file.name.split(".").pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `documents/${fileName}`

      const { error: uploadError, data: uploadData } = await supabase.storage.from("documents").upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath)

      // Create document record
      const { error: docError } = await supabase.from("documents").insert({
        case_id: selectedCase,
        filename: file.name,
        file_type: file.type,
        storage_url: urlData.publicUrl,
        upload_time: new Date().toISOString(),
        uploaded_by: session.user.id,
        status: "pending",
        notes: notes,
      })

      if (docError) throw docError

      // Call backend API to parse the document
      try {
        console.log(`Attempting to call /parse-document/ for: ${file.name}, URL: ${urlData.publicUrl}, Query: ${notes}`)
        const apiResponse = await fetch('http://localhost:8000/parse-document/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_url: urlData.publicUrl,
            filename: file.name, 
            user_query: notes,
          }),
        });

        if (apiResponse.ok) {
          const result = await apiResponse.json();
          const taskId = result.task_id;
          console.log("Received task_id:", taskId);
          toast({
            title: "Processing Started",
            description: "Document uploaded and AI processing has been initiated.",
          });
          
          // Clear form fields
          setFile(null);
          setNotes("");
          setSelectedCase("");
          // TODO: router.push(`/client-dashboard/tasks/${taskId}`); // Future redirect for task status page

          // For now, redirect to documents list after a short delay to show toast
          setTimeout(() => {
            router.push("/client-dashboard/documents");
          }, 2000);

        } else {
          const errorResult = await apiResponse.json().catch(() => ({ detail: "Unknown error starting AI processing." }));
          const errorMessage = errorResult.detail || errorResult.message || `Failed to start AI processing (status ${apiResponse.status})`;
          console.error("Error from /parse-document/ API:", errorMessage, errorResult);
          throw new Error(errorMessage);
        }
      } catch (apiError: any) {
        console.error("Error calling /parse-document/ API or processing its response:", apiError);
        // Let the outer catch handle displaying the error toast and setting error state
        // but ensure we have a specific message if possible.
        throw new Error(apiError.message || "Failed to communicate with AI backend or process its response.");
      }

    } catch (err: any) {
      // This outer catch now handles errors from Supabase upload OR the /parse-document/ API call
      console.error("Error during document upload or AI processing initiation:", err);
      setError(err.message || "An unexpected error occurred.");
      toast({
        title: "Error",
        description: err.message || "Failed to upload document",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="p-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p>Loading...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error && !loading) {
    return (
      <div className="p-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-red-500">{error}</p>
              <Button onClick={() => router.push("/client-dashboard")} className="mt-4">
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => router.push("/client-dashboard/documents")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold ml-2">Upload Document</h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Upload New Document</CardTitle>
            </CardHeader>
            <CardContent>
              {cases.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <h3 className="mt-2 text-lg font-medium text-gray-900">No cases found</h3>
                  <p className="mt-1 text-sm text-gray-500">You need to have at least one case to upload documents.</p>
                  <div className="mt-6">
                    <Button onClick={() => router.push("/client-dashboard")}>Return to Dashboard</Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="case">Select Case</Label>
                    <Select value={selectedCase} onValueChange={setSelectedCase}>
                      <SelectTrigger id="case">
                        <SelectValue placeholder="Select a case" />
                      </SelectTrigger>
                      <SelectContent>
                        {cases.map((caseItem) => (
                          <SelectItem key={caseItem.id} value={caseItem.id}>
                            Case #{caseItem.case_number} - {caseItem.case_type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="file">Document</Label>
                    <div
                      className={`border-2 border-dashed rounded-md p-6 ${
                        dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
                      }`}
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                    >
                      <div className="text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            Drag and drop your file here, or{" "}
                            <label
                              htmlFor="file-upload"
                              className="relative cursor-pointer text-blue-600 hover:text-blue-500"
                            >
                              <span>browse</span>
                              <Input
                                id="file-upload"
                                name="file-upload"
                                type="file"
                                className="sr-only"
                                onChange={handleFileChange}
                              />
                            </label>
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">PDF, Word, Excel, or image files up to 10MB</p>
                      </div>
                      {file && (
                        <div className="mt-4 flex items-center justify-center text-sm">
                          <FileText className="h-5 w-5 text-blue-500 mr-2" />
                          <span className="text-gray-900">{file.name}</span>
                          <span className="text-gray-500 ml-2">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any notes about this document"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Google Doc Templates</Label>
                    <div className="border rounded-md p-4 bg-gray-50">
                      <p className="text-sm text-gray-500">
                        Google Doc templates will be available here. Your attorney will provide access to specific
                        templates for your case.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/client-dashboard/documents")}
                      className="mr-2"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Uploading..." : "Upload Document"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
