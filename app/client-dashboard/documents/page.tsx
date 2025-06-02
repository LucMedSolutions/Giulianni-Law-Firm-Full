"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileText, Search, Upload, Download, Eye, File, FileImage, FileIcon as FilePdf } from "lucide-react"
import DocumentUpload from "@/components/document-upload" // Import the new component
import { useToast } from "@/components/ui/use-toast" // For success toast

export default function ClientDocuments() {
  const [documents, setDocuments] = useState<any[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null) // Will now also store signedPreviewUrl
  const [viewerOpen, setViewerOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false) // State for modal
  const [currentUserId, setCurrentUserId] = useState<string | null>(null) // State for current user ID
  const [loadingSignedUrlFor, setLoadingSignedUrlFor] = useState<string | null>(null) // Track which doc's URL is loading

  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast() // Initialize toast

  const fetchDocuments = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/")
        return
      }
      setCurrentUserId(session.user.id) // Set current user ID

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("role, full_name")
        .eq("id", session.user.id)
        .single()

      if (userError || !user) {
        setError("Failed to fetch user profile. Please try again.")
        await supabase.auth.signOut()
        router.push("/")
        return
      }

      if (user.role !== "client") {
        setError("Access denied. You are not authorized to view this page.")
        await supabase.auth.signOut()
        router.push("/")
        return
      }

      const { data: clientCases, error: casesError } = await supabase
        .from("cases")
        .select("id, case_number")
        .eq("client_id", session.user.id) // Use client_id which should be user.id for clients

      if (casesError) throw casesError

      if (!clientCases || clientCases.length === 0) {
        setDocuments([])
        setFilteredDocuments([])
        // setLoading(false) //  Moved to finally block
        return
      }

      const caseIds = clientCases.map((c) => c.id)

      const { data: docsData, error: docsError } = await supabase
        .from("documents")
        .select(`
          id,
          filename,
          file_type,
          upload_time,
          storage_url, // This is now the file_path
          bucket_name, // Added bucket_name
          status,
          notes,
          case_id,
          cases(id, case_number)
        `)
        .in("case_id", caseIds)
        .order("upload_time", { ascending: false })

      if (docsError) throw docsError

      setDocuments(docsData || [])
      setFilteredDocuments(docsData || [])
    } catch (err: any) {
      console.error("Error fetching documents:", err)
      setError(err.message || "Failed to load documents")
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch of documents
  useEffect(() => {
    fetchDocuments()
  }, []) // Removed router from dependencies, fetchDocuments handles session checks.

  // Effect for search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredDocuments(documents)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = documents.filter(
        (doc) =>
          doc.filename.toLowerCase().includes(query) ||
          doc.file_type.toLowerCase().includes(query) ||
          (doc.cases?.case_number && doc.cases.case_number.toString().includes(query)),
      )
      setFilteredDocuments(filtered)
    }
  }, [searchQuery, documents])

  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase()
    if (type.includes("pdf")) return <FilePdf className="h-5 w-5 text-red-500" />
    if (type.includes("image") || type.includes("jpg") || type.includes("png") || type.includes("jpeg"))
      return <FileImage className="h-5 w-5 text-blue-500" />
    if (type.includes("doc") || type.includes("word")) return <FileText className="h-5 w-5 text-blue-700" />
    return <File className="h-5 w-5 text-gray-500" />
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString()
  }

  const getSignedUrlAndAct = async (document: any, action: "view" | "download") => {
    if (!document || !document.id) {
      toast({ title: "Error", description: "Document information is missing.", variant: "destructive" })
      return
    }
    setLoadingSignedUrlFor(document.id)
    try {
      const response = await fetch(`/api/download-document?documentId=${document.id}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to get download URL (status: ${response.status})`)
      }
      const { signedUrl } = await response.json()

      if (!signedUrl) {
        throw new Error("No signed URL received from server.")
      }

      if (action === "view") {
        setSelectedDocument({ ...document, signedPreviewUrl: signedUrl })
        setViewerOpen(true)
      } else if (action === "download") {
        window.open(signedUrl, "_blank")
      }
    } catch (error: any) {
      console.error("Error getting signed URL:", error)
      toast({
        title: "Error",
        description: error.message || "Could not retrieve link for the document. Please try again.",
        variant: "destructive",
      })
      // If view action failed, ensure modal doesn't show stale data or open partially
      if (action === "view") {
        setSelectedDocument(null) // Or keep old selectedDocument but don't open viewer
        setViewerOpen(false)
      }
    } finally {
      setLoadingSignedUrlFor(null)
    }
  }

  // This function is now primarily for initiating the process that leads to viewing.
  // The actual opening of the dialog is handled by getSignedUrlAndAct after URL is fetched.
  const handleViewDocument = (document: any) => {
    getSignedUrlAndAct(document, "view")
  }

  if (loading) {
    return (
      <div className="p-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p>Loading documents...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
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
          <h1 className="text-xl font-bold">Documents</h1>
          <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload New Document</DialogTitle>
                <DialogDescription>
                  Select a file and choose the case to associate it with.
                </DialogDescription>
              </DialogHeader>
              {currentUserId && (
                <DocumentUpload
                  userId={currentUserId}
                  userRole="client"
                  onUploadComplete={(uploadResult) => {
                    setIsUploadModalOpen(false);
                    if (uploadResult.dbDocument) {
                      fetchDocuments(); // Refresh document list
                      if (uploadResult.aiTaskId && !uploadResult.aiError) {
                        toast({
                          title: "Upload Successful",
                          description: `Document "${uploadResult.dbDocument.file_name}" uploaded. AI processing started (Task ID: ${uploadResult.aiTaskId}).`,
                          variant: "success",
                        });
                      } else if (uploadResult.aiError) {
                        toast({
                          title: "Upload Complete, AI Issue",
                          description: `Document "${uploadResult.dbDocument.file_name}" uploaded, but AI processing call failed: ${uploadResult.aiError}. You may be able to retry from the upload modal if it was left open or if you reopen it for that file.`,
                          variant: "warning",
                          duration: 10000, // Longer duration for warning with more text
                        });
                      } else {
                        // Fallback if only dbDocument is present (e.g. AI call not attempted or no info returned)
                         toast({
                          title: "Upload Successful",
                          description: `Document "${uploadResult.dbDocument.file_name}" has been uploaded. AI processing status unknown.`,
                          variant: "success",
                        });
                      }
                    }
                    // If dbDocument is null, DocumentUpload handles internal error message, onUploadComplete might not be called.
                  }}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    type="search"
                    placeholder="Search documents..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <h3 className="mt-2 text-lg font-medium text-gray-900">No documents found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {documents.length === 0
                      ? "You don't have any documents yet."
                      : "No documents match your search criteria."}
                  </p>
                  <div className="mt-6">
                     {/* This button inside empty state can also trigger the modal */}
                    <Button onClick={() => setIsUploadModalOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload a document
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Document</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Case</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date Uploaded</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocuments.map((doc) => (
                        <tr key={doc.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <div className="mr-2">{getFileIcon(doc.file_type)}</div>
                              <div className="truncate max-w-[200px]">{doc.filename}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {doc.cases?.case_number ? `Case #${doc.cases.case_number}` : "N/A"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(doc.upload_time)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                doc.status === "approved"
                                  ? "bg-green-100 text-green-800"
                                  : doc.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {doc.status ? doc.status.charAt(0).toUpperCase() + doc.status.slice(1) : "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewDocument(doc)}
                                title="View Document"
                                disabled={loadingSignedUrlFor === doc.id}
                              >
                                {loadingSignedUrlFor === doc.id ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <Eye className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => getSignedUrlAndAct(doc, "download")}
                                title="Download Document"
                                disabled={loadingSignedUrlFor === doc.id}
                              >
                               {loadingSignedUrlFor === doc.id ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <Download className="h-4 w-4" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Document Viewer Dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.filename}</DialogTitle>
            <DialogDescription>
              {selectedDocument?.cases?.case_number
                ? `Case #${selectedDocument.cases.case_number}`
                : "No case associated"}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="document" className="flex-1 flex flex-col">
            <TabsList>
              <TabsTrigger value="document">Document</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>
            <TabsContent value="document" className="flex-1 overflow-hidden">
              {selectedDocument?.signedPreviewUrl && selectedDocument?.file_type.includes("pdf") ? (
                <iframe
                  src={`${selectedDocument.signedPreviewUrl}#toolbar=0`}
                  className="w-full h-full border-0"
                  title={selectedDocument.filename}
                />
              ) : selectedDocument?.signedPreviewUrl && !selectedDocument?.file_type.includes("pdf") ? (
                 // Handle non-PDF preview if signedPreviewUrl is available but not for PDF
                 // For now, show same message as if no preview URL, but offer download
                <div className="flex items-center justify-center h-full bg-gray-100">
                  <div className="text-center p-6">
                    <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">
                      Direct preview not available for this file type. Please download the file to view it.
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => getSignedUrlAndAct(selectedDocument, "download")}
                      disabled={loadingSignedUrlFor === selectedDocument?.id}
                    >
                      {loadingSignedUrlFor === selectedDocument?.id ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <Download className="h-4 w-4 mr-2" />}
                      Download File
                    </Button>
                  </div>
                </div>
              ) : (
                // Case when signedPreviewUrl is not yet loaded or view was not for PDF
                <div className="flex items-center justify-center h-full bg-gray-100">
                  <div className="text-center p-6">
                    {loadingSignedUrlFor === selectedDocument?.id ? (
                      <>
                        <div className="h-16 w-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading secure viewer...</p>
                      </>
                    ) : (
                      <>
                        <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600">
                          {selectedDocument?.file_type && !selectedDocument.file_type.includes("pdf")
                            ? "Direct preview not available for this file type. Please download to view."
                            : "Preparing document viewer..."}
                        </p>
                         <Button
                          className="mt-4"
                          onClick={() => getSignedUrlAndAct(selectedDocument, "download")}
                          disabled={loadingSignedUrlFor === selectedDocument?.id}
                        >
                          {loadingSignedUrlFor === selectedDocument?.id ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <Download className="h-4 w-4 mr-2" />}
                          Download File
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="summary" className="flex-1 overflow-auto p-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium">Document Information</h3>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Filename</p>
                      <p>{selectedDocument?.filename}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">File Type</p>
                      <p>{selectedDocument?.file_type}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Upload Date</p>
                      <p>{selectedDocument?.upload_time && formatDate(selectedDocument.upload_time)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Status</p>
                      <p
                        className={
                          selectedDocument?.status === "approved"
                            ? "text-green-600"
                            : selectedDocument?.status === "rejected"
                              ? "text-red-600"
                              : "text-yellow-600"
                        }
                      >
                        {selectedDocument?.status
                          ? selectedDocument.status.charAt(0).toUpperCase() + selectedDocument.status.slice(1)
                          : "Pending"}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium">Notes</h3>
                  <p className="mt-2 text-gray-700">
                    {selectedDocument?.notes || "No notes available for this document."}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium">Document Summary</h3>
                  <div className="mt-2 p-4 bg-gray-100 rounded-md">
                    <p className="text-gray-500 italic">
                      Document summary will be available here once integrated with n8n.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}
