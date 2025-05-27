"use client"

import { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { FileText, Download, Trash2, ExternalLink, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

interface Document {
  id: string
  filename: string
  file_type: string
  upload_time: string
  notes: string
  status: string
  storage_url: string
  uploaded_by: string
}

interface DocumentListProps {
  documents: Document[]
  caseId: string
  isStaff: boolean
  onDocumentDeleted?: () => void
}

export default function DocumentList({ documents, caseId, isStaff, onDocumentDeleted }: DocumentListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const supabase = createClientComponentClient()

  const regenerateStorageUrl = async (documentId: string, filename: string) => {
    setRegenerating(documentId)
    setError(null)

    try {
      // Get the document to find its storage path
      const { data: document, error: docError } = await supabase
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .single()

      if (docError || !document) {
        throw new Error("Document not found")
      }

      // Try to get a new signed URL from the storage
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from("documents")
        .createSignedUrl(document.storage_path || `${caseId}/${filename}`, 3600) // 1 hour expiry

      if (urlError) {
        // If signed URL fails, try to get public URL
        const { data: publicUrlData } = supabase.storage
          .from("documents")
          .getPublicUrl(document.storage_path || `${caseId}/${filename}`)

        if (publicUrlData?.publicUrl) {
          // Update the document with new URL
          const { error: updateError } = await supabase
            .from("documents")
            .update({ storage_url: publicUrlData.publicUrl })
            .eq("id", documentId)

          if (updateError) {
            console.error("Error updating storage URL:", updateError)
          }

          return publicUrlData.publicUrl
        }
        throw urlError
      }

      // Update the document with new signed URL
      const { error: updateError } = await supabase
        .from("documents")
        .update({ storage_url: signedUrlData.signedUrl })
        .eq("id", documentId)

      if (updateError) {
        console.error("Error updating storage URL:", updateError)
      }

      return signedUrlData.signedUrl
    } catch (error: any) {
      console.error("Error regenerating storage URL:", error)
      throw error
    } finally {
      setRegenerating(null)
    }
  }

  const handleDownload = async (documentId: string, filename: string, storageUrl: string) => {
    setDownloading(documentId)
    setError(null)

    try {
      let downloadUrl = storageUrl

      // First, try the existing URL
      try {
        const testResponse = await fetch(storageUrl, { method: "HEAD" })
        if (!testResponse.ok) {
          throw new Error("URL not accessible")
        }
      } catch {
        // If the URL doesn't work, try to regenerate it
        console.log("Storage URL not accessible, attempting to regenerate...")
        downloadUrl = await regenerateStorageUrl(documentId, filename)
      }

      // Create download link
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = filename
      link.target = "_blank"
      link.rel = "noopener noreferrer"

      // Add to DOM temporarily
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Refresh the page to show updated URLs
      if (onDocumentDeleted) {
        onDocumentDeleted()
      }
    } catch (error: any) {
      console.error("Download error:", error)
      if (error.message.includes("Bucket not found") || error.message.includes("bucket")) {
        setError("Storage bucket not found. Please contact an administrator to set up file storage at Admin → Storage.")
      } else if (error.message.includes("not found") || error.message.includes("does not exist")) {
        setError("File not found in storage. The file may have been moved or deleted.")
      } else {
        setError(`Download failed: ${error.message}`)
      }
    } finally {
      setDownloading(null)
    }
  }

  const handleDelete = async (documentId: string) => {
    setDeleting(true)
    setError(null)

    try {
      // Get the document details
      const { data: document, error: fetchError } = await supabase
        .from("documents")
        .select("storage_path, storage_url")
        .eq("id", documentId)
        .single()

      if (fetchError) {
        throw new Error(`Error fetching document: ${fetchError.message}`)
      }

      // Try to delete from storage if we have a storage path
      if (document.storage_path) {
        const { error: storageError } = await supabase.storage.from("documents").remove([document.storage_path])

        if (storageError) {
          console.error("Error deleting file from storage:", storageError)
          // Continue anyway to delete the database record
        }
      }

      // Delete the document record
      const { error: deleteError } = await supabase.from("documents").delete().eq("id", documentId)

      if (deleteError) {
        throw new Error(`Error deleting document record: ${deleteError.message}`)
      }

      setConfirmDelete(null)
      if (onDocumentDeleted) {
        onDocumentDeleted()
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while deleting the document")
      console.error("Delete error:", err)
    } finally {
      setDeleting(false)
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) {
      return <FileText className="h-8 w-8 text-red-500" />
    } else if (fileType.includes("word") || fileType.includes("doc")) {
      return <FileText className="h-8 w-8 text-blue-500" />
    } else if (fileType.includes("image")) {
      return <FileText className="h-8 w-8 text-green-500" />
    } else {
      return <FileText className="h-8 w-8 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Pending Review</span>
      case "approved":
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Approved</span>
      case "rejected":
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Rejected</span>
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">{status}</span>
    }
  }

  if (documents.length === 0) {
    return <p className="text-gray-500 italic">No documents available for this case.</p>
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <p>{error}</p>
            {error.includes("Storage bucket") && isStaff && (
              <p className="text-sm mt-1">
                Administrators can set up storage at{" "}
                <a href="/admin-dashboard/storage" className="underline font-medium">
                  Admin → Storage
                </a>
              </p>
            )}
          </div>
        </div>
      )}

      {documents.map((doc) => (
        <div key={doc.id} className="flex items-start p-4 border rounded-lg bg-white">
          <div className="mr-4 mt-1">{getFileIcon(doc.file_type)}</div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-gray-900 truncate">{doc.filename}</h4>
              {getStatusBadge(doc.status)}
            </div>
            <p className="text-xs text-gray-500">
              Uploaded on {new Date(doc.upload_time).toLocaleDateString()} at{" "}
              {new Date(doc.upload_time).toLocaleTimeString()}
            </p>
            {doc.notes && <p className="text-xs text-gray-600 mt-1">{doc.notes}</p>}
          </div>

          <div className="flex space-x-2 ml-4">
            <a
              href={doc.storage_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800"
              title="Open in new tab"
            >
              <ExternalLink className="h-5 w-5" />
              <span className="sr-only">View</span>
            </a>

            <button
              onClick={() => handleDownload(doc.id, doc.filename, doc.storage_url)}
              className="text-green-600 hover:text-green-800 disabled:opacity-50"
              disabled={downloading === doc.id}
              title="Download file"
            >
              <Download className="h-5 w-5" />
              <span className="sr-only">{downloading === doc.id ? "Downloading..." : "Download"}</span>
            </button>

            {isStaff && (
              <>
                <button
                  onClick={() => regenerateStorageUrl(doc.id, doc.filename)}
                  className="text-orange-600 hover:text-orange-800 disabled:opacity-50"
                  disabled={regenerating === doc.id}
                  title="Refresh download link"
                >
                  <RefreshCw className={`h-5 w-5 ${regenerating === doc.id ? "animate-spin" : ""}`} />
                  <span className="sr-only">Refresh link</span>
                </button>

                <button
                  onClick={() => setConfirmDelete(doc.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Delete document"
                >
                  <Trash2 className="h-5 w-5" />
                  <span className="sr-only">Delete</span>
                </button>
              </>
            )}
          </div>
        </div>
      ))}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
