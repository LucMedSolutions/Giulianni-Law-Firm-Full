"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import {
  FileText,
  FileIcon as FilePdf,
  FileImage,
  FileArchive,
  Search,
  Filter,
  Plus,
  Download,
  Eye,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import DocumentUpload from "@/components/document-upload" // Import the new component
import { useToast } from "@/components/ui/use-toast" // For success toast

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortOrder, setSortOrder] = useState("newest")
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null) // Will store signedPreviewUrl
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false) // State for modal
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<"staff" | "admin" | null>(null)
  const [loadingSignedUrlFor, setLoadingSignedUrlFor] = useState<string | null>(null) // Track URL loading

  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Initial fetch of documents
  useEffect(() => {
    fetchDocuments()
  }, [])

  // Effect for filtering and sorting
  useEffect(() => {
    filterDocuments()
  }, [documents, searchQuery, statusFilter, typeFilter, sortOrder])

  const fetchDocuments = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/") // Redirect to login if no session
        return
      }
      setCurrentUserId(session.user.id)

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("role") // Only fetch role, other details not needed here for now
        .eq("id", session.user.id)
        .single() // Use single to ensure one user is returned or error

      if (userError || !user) {
        throw new Error(userError?.message || "User profile not found. Please re-login.")
      }

      if (user.role !== "staff" && user.role !== "admin") {
        await supabase.auth.signOut()
        router.push("/") // Redirect if not staff or admin
        setError("Access Denied: You do not have permission to view this page.")
        return
      }
      setCurrentUserRole(user.role as "staff" | "admin")

      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          cases:case_id (
            case_number,
            client_name
          ),
          users:uploaded_by (
            full_name
          )
        `)
        .order("upload_time", { ascending: false })

      if (error) {
        throw error
      }

      setDocuments(data || [])
    } catch (err: any) {
      setError(err.message || "An error occurred while loading documents")
      console.error("Documents page error:", err)
    } finally {
      setLoading(false)
    }
  }

  const filterDocuments = () => {
    let filtered = [...documents]

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (doc) =>
          doc.filename.toLowerCase().includes(query) ||
          doc.cases?.case_number?.toLowerCase().includes(query) ||
          doc.cases?.client_name?.toLowerCase().includes(query),
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((doc) => doc.status === statusFilter)
    }

    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((doc) => {
        if (typeFilter === "pdf" && doc.file_type.includes("pdf")) return true
        if (typeFilter === "word" && (doc.file_type.includes("doc") || doc.file_type.includes("docx"))) return true
        if (typeFilter === "image" && doc.file_type.includes("image")) return true
        return false
      })
    }

    // Apply sorting
    if (sortOrder === "newest") {
      filtered.sort((a, b) => new Date(b.upload_time).getTime() - new Date(a.upload_time).getTime())
    } else {
      filtered.sort((a, b) => new Date(a.upload_time).getTime() - new Date(b.upload_time).getTime())
    }

    setFilteredDocuments(filtered)
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) return <FilePdf className="h-5 w-5 text-red-500" />
    if (fileType.includes("doc")) return <FileText className="h-5 w-5 text-blue-500" />
    if (fileType.includes("image")) return <FileImage className="h-5 w-5 text-green-500" />
    return <FileArchive className="h-5 w-5 text-gray-500" />
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" /> Approved
          </Badge>
        )
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" /> Rejected
          </Badge>
        )
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" /> Pending
          </Badge>
        )
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getSignedUrlAndAct = async (document: any, action: "view" | "download", isModalTrigger: boolean = false) => {
    if (!document || !document.id) {
      toast({ title: "Error", description: "Document information is missing.", variant: "destructive" })
      return
    }
    setLoadingSignedUrlFor(document.id)
    try {
      const response = await fetch(`/api/download-document?documentId=${document.id}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to get URL (status: ${response.status})`)
      }
      const { signedUrl } = await response.json()

      if (!signedUrl) {
        throw new Error("No signed URL received from server.")
      }

      if (action === "view") {
        // If triggered by modal opening, selectedDocument is already set.
        // Just update it with the signed URL.
        setSelectedDocument((prevDoc: any) => ({ ...prevDoc, id: document.id, filename: document.filename, file_type: document.file_type, cases: document.cases, notes: document.notes, storage_url: document.storage_url, bucket_name: document.bucket_name, signedPreviewUrl: signedUrl }))
        // No need to control dialog open state here as it's handled by onOpenChange or already open
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
      if (action === "view" && isModalTrigger) {
        // If it was the modal trigger that failed, prevent opening or clear selection
        setSelectedDocument(null)
      }
    } finally {
      setLoadingSignedUrlFor(null)
    }
  }


  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-t-blue-500 border-blue-200 rounded-full animate-spin"></div>
        <span className="ml-2">Loading documents...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={fetchDocuments}>Try Again</Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-50">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-gray-500">Manage and view all case documents</p>
        </div>
        <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload New Document</DialogTitle>
              <DialogDescription>
                Select a file and choose the case to associate it with. The case list will be based on your role and assignments.
              </DialogDescription>
            </DialogHeader>
            {currentUserId && currentUserRole && (
              <DocumentUpload
                userId={currentUserId}
                userRole={currentUserRole}
                onUploadComplete={(doc) => {
                  setIsUploadModalOpen(false)
                  fetchDocuments() // Refresh document list
                  toast({
                    title: "Upload Successful",
                    description: `${doc.file_name} has been uploaded.`,
                    variant: "success",
                  })
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
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
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <FileText className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="pdf">PDF Documents</SelectItem>
                  <SelectItem value="word">Word Documents</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="w-[180px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium">No documents found</h3>
            <p className="text-gray-500 text-center mt-1 mb-4">
              {documents.length === 0
                ? "There are no documents uploaded yet."
                : "No documents match your current filters."}
            </p>
            {documents.length === 0 ? (
              // Also change this button to open modal
              <Button onClick={() => setIsUploadModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Upload Your First Document
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setStatusFilter("all")
                  setTypeFilter("all")
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center">
                        {getFileIcon(doc.file_type)}
                        <span className="ml-2 font-medium">{doc.filename}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {doc.cases ? (
                        <div>
                          <div className="font-medium">{doc.cases.case_number}</div>
                          <div className="text-sm text-gray-500">{doc.cases.client_name}</div>
                        </div>
                      ) : (
                        <span className="text-gray-500">Unknown Case</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(doc.status)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{formatDate(doc.upload_time)}</span>
                        <span className="text-sm text-gray-500">by {doc.users?.full_name || "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog
                          onOpenChange={(open) => {
                            if (open) {
                              // Set basic info first for quicker modal header population
                              setSelectedDocument(doc);
                              // Then fetch signed URL for content
                              getSignedUrlAndAct(doc, 'view', true);
                            } else {
                              setSelectedDocument(null);
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={loadingSignedUrlFor === doc.id}>
                              {loadingSignedUrlFor === doc.id ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <Eye className="h-4 w-4 mr-1" />}
                              {loadingSignedUrlFor !== doc.id && "View"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl h-[80vh] flex flex-col"> {/* Added flex flex-col */}
                            <DialogHeader>
                              <DialogTitle className="flex items-center">
                                {selectedDocument && getFileIcon(selectedDocument.file_type)}
                                <span className="ml-2">{selectedDocument?.filename}</span>
                              </DialogTitle>
                              <DialogDescription>
                                {selectedDocument?.cases?.case_number} - {selectedDocument?.cases?.client_name}
                              </DialogDescription>
                            </DialogHeader>
                            <Tabs defaultValue="document" className="flex-1 flex flex-col overflow-hidden"> {/* Added flex-1 flex flex-col overflow-hidden */}
                              <TabsList>
                                <TabsTrigger value="document">Document</TabsTrigger>
                                <TabsTrigger value="summary">Summary</TabsTrigger>
                              </TabsList>
                              <TabsContent value="document" className="flex-1 overflow-auto">
                                {!selectedDocument?.signedPreviewUrl && loadingSignedUrlFor === selectedDocument?.id && (
                                  <div className="flex items-center justify-center h-full">
                                    <div className="w-8 h-8 border-4 border-t-blue-500 border-blue-200 rounded-full animate-spin"></div>
                                    <span className="ml-2">Loading secure preview...</span>
                                  </div>
                                )}
                                {selectedDocument?.signedPreviewUrl && selectedDocument?.file_type.includes("pdf") && (
                                  <iframe
                                    src={`${selectedDocument.signedPreviewUrl}#toolbar=0`}
                                    className="w-full h-full border-0"
                                  />
                                )}
                                {selectedDocument?.signedPreviewUrl && selectedDocument?.file_type.includes("image") && (
                                  <div className="flex items-center justify-center h-full p-4">
                                    <img
                                      src={selectedDocument.signedPreviewUrl}
                                      alt={selectedDocument.filename}
                                      className="max-w-full max-h-full object-contain"
                                    />
                                  </div>
                                )}
                                {selectedDocument?.signedPreviewUrl && !selectedDocument?.file_type.includes("pdf") && !selectedDocument?.file_type.includes("image") && (
                                  <div className="flex flex-col items-center justify-center h-full p-4">
                                    <FileText className="h-16 w-16 text-gray-300 mb-4" />
                                    <p className="text-center">
                                      Direct preview is not available for this file type.
                                      <br />
                                      Please download the file to view it.
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
                                )}
                                {/* Fallback if signedPreviewUrl is not available for some reason after loading attempt */}
                                {!selectedDocument?.signedPreviewUrl && loadingSignedUrlFor !== selectedDocument?.id && selectedDocument && (
                                   <div className="flex flex-col items-center justify-center h-full p-4">
                                     <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
                                     <p className="text-center text-red-600">Could not load document preview.</p>
                                     <Button
                                      className="mt-4"
                                      onClick={() => getSignedUrlAndAct(selectedDocument, "download")}
                                      disabled={loadingSignedUrlFor === selectedDocument?.id}
                                    >
                                      {loadingSignedUrlFor === selectedDocument?.id ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <Download className="h-4 w-4 mr-2" />}
                                      Download File
                                    </Button>
                                   </div>
                                )}
                              </TabsContent>
                              <TabsContent value="summary" className="flex-1 overflow-auto"> {/* Ensure summary tab is also scrollable */}
                                <div className="p-4 space-y-6">
                                  {/* ... (rest of summary content remains the same) ... */}
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Card>
                                      <CardHeader>
                                        <CardTitle className="text-base">Document Information</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <dl className="space-y-2">
                                          <div className="flex justify-between">
                                            <dt className="font-medium">Type:</dt>
                                            <dd>{selectedDocument?.file_type}</dd>
                                          </div>
                                          <div className="flex justify-between">
                                            <dt className="font-medium">Status:</dt>
                                            <dd>{selectedDocument?.status}</dd>
                                          </div>
                                          <div className="flex justify-between">
                                            <dt className="font-medium">Uploaded:</dt>
                                            <dd>
                                              {selectedDocument?.upload_time &&
                                                formatDate(selectedDocument.upload_time)}
                                            </dd>
                                          </div>
                                          <div className="flex justify-between">
                                            <dt className="font-medium">Uploaded By:</dt>
                                            <dd>{selectedDocument?.users?.full_name || "Unknown"}</dd>
                                          </div>
                                        </dl>
                                      </CardContent>
                                    </Card>

                                    <Card>
                                      <CardHeader>
                                        <CardTitle className="text-base">Case Information</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <dl className="space-y-2">
                                          <div className="flex justify-between">
                                            <dt className="font-medium">Case Number:</dt>
                                            <dd>{selectedDocument?.cases?.case_number || "Unknown"}</dd>
                                          </div>
                                          <div className="flex justify-between">
                                            <dt className="font-medium">Client:</dt>
                                            <dd>{selectedDocument?.cases?.client_name || "Unknown"}</dd>
                                          </div>
                                        </dl>
                                      </CardContent>
                                    </Card>
                                  </div>

                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-base">Document Notes</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      {selectedDocument?.notes ? (
                                        <p>{selectedDocument.notes}</p>
                                      ) : (
                                        <p className="text-gray-500 italic">No notes provided for this document.</p>
                                      )}
                                    </CardContent>
                                  </Card>

                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-base">AI-Generated Summary</CardTitle>
                                      <CardDescription>This feature will be integrated with n8n</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="bg-gray-100 p-4 rounded-md text-center">
                                        <p className="text-gray-500">
                                          Document summary will be available here after n8n integration.
                                        </p>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              </TabsContent>
                            </Tabs>
                          </DialogContent>
                        </Dialog>
                        <Button variant="outline" size="sm" onClick={() => getSignedUrlAndAct(doc, "download")} disabled={loadingSignedUrlFor === doc.id}>
                           {loadingSignedUrlFor === doc.id ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <Download className="h-4 w-4" />}
                           <span className="sr-only">Download</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
