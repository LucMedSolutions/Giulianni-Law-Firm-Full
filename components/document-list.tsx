"use client"

import { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { FileText, Download, Trash2, ExternalLink } from "lucide-react"
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
  const supabase = createClientComponentClient()

  const handleDelete = async (documentId: string) => {
    setDeleting(true)
    setError(null)

    try {
      // 1. Get the document details to find the storage path
      const { data: document, error: fetchError } = await supabase
        .from("documents")
        .select("storage_url")
        .eq("id", documentId)
        .single()

      if (fetchError) {
        throw new Error(`Error fetching document: ${fetchError.message}`)
      }

      // 2. Extract the path from the URL
      const url = new URL(document.storage_url)
      const pathMatch = url.pathname.match(/\/case-documents\/(.+)/)

      if (pathMatch && pathMatch[1]) {
        // 3. Delete the file from storage
        const { error: storageError } = await supabase.storage
          .from("case-documents")
          .remove([decodeURIComponent(pathMatch[1])])

        if (storageError) {
          console.error("Error deleting file from storage:", storageError)
          // Continue anyway to delete the database record
        }
      }

      // 4. Delete the document record
      const { error: deleteError } = await supabase.from("documents").delete().eq("id", documentId)

      if (deleteError) {
        throw new Error(`Error deleting document record: ${deleteError.message}`)
      }

      // 5. Close the dialog and refresh
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
            >
              <ExternalLink className="h-5 w-5" />
              <span className="sr-only">View</span>
            </a>

            <a href={doc.storage_url} download className="text-green-600 hover:text-green-800">
              <Download className="h-5 w-5" />
              <span className="sr-only">Download</span>
            </a>

            {isStaff && (
              <button onClick={() => setConfirmDelete(doc.id)} className="text-red-600 hover:text-red-800">
                <Trash2 className="h-5 w-5" />
                <span className="sr-only">Delete</span>
              </button>
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
