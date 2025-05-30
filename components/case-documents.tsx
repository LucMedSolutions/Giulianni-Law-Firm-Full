"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DocumentUpload from "@/components/document-upload"
import DocumentList from "@/components/document-list"

interface CaseDocumentsProps {
  caseId: string
  caseNumber: string
  isStaff: boolean
}

export default function CaseDocuments({ caseId, caseNumber, isStaff }: CaseDocumentsProps) {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = async () => {
    setLoading(true)
    setError(null)

    try {
      // Use a server-side API to fetch documents instead of client-side Supabase
      const response = await fetch(`/api/get-case-documents?caseId=${caseId}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (err: any) {
      setError(err.message || "Failed to load documents")
      console.error("Error fetching documents:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [caseId])

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Case Documents</h2>

      <Tabs defaultValue="documents">
        <TabsList className="mb-4">
          <TabsTrigger value="documents">All Documents</TabsTrigger>
          {isStaff && <TabsTrigger value="upload">Upload Document</TabsTrigger>}
        </TabsList>

        <TabsContent value="documents">
          {loading ? (
            <div className="py-4 text-center">Loading documents...</div>
          ) : error ? (
            <div className="py-4 text-center text-red-500">
              Error: {error}
              <button onClick={fetchDocuments} className="ml-2 text-blue-500 underline">
                Retry
              </button>
            </div>
          ) : (
            <DocumentList documents={documents} caseId={caseId} isStaff={isStaff} onDocumentDeleted={fetchDocuments} />
          )}
        </TabsContent>

        {isStaff && (
          <TabsContent value="upload">
            <DocumentUpload caseId={caseId} caseNumber={caseNumber} onUploadComplete={fetchDocuments} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
