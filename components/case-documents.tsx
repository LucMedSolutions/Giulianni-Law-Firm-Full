"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
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
  const supabase = createClientComponentClient()

  const fetchDocuments = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("case_id", caseId)
        .order("upload_time", { ascending: false })

      if (error) {
        throw error
      }

      setDocuments(data || [])
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
            <div className="py-4 text-center text-red-500">{error}</div>
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
