"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { ArrowLeft, Clock, Briefcase, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import CaseDocuments from "@/components/case-documents"

export default function ClientCaseDetailPage({ params }: { params: { id: string } }) {
  const [caseData, setCaseData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const fetchCaseDetails = async () => {
      setLoading(true)
      setError(null)

      try {
        // Check if user is authenticated and is a client
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push("/")
          return
        }

        // Get user role and name - use .eq() and handle empty results instead of .single()
        const { data: userDataArray, error: userError } = await supabase
          .from("users")
          .select("role, full_name")
          .eq("id", session.user.id)

        if (userError) {
          throw userError
        }

        if (!userDataArray || userDataArray.length === 0) {
          // Sign out if not authorized
          await supabase.auth.signOut()
          router.push("/")
          return
        }

        const userData = userDataArray[0]

        if (userData.role !== "client") {
          // Sign out if not authorized
          await supabase.auth.signOut()
          router.push("/")
          return
        }

        // Fetch case details - use .eq() and handle empty results instead of .single()
        const { data: caseDetailsArray, error: caseError } = await supabase
          .from("cases")
          .select("*")
          .eq("id", params.id)
          .eq("client_name", userData.full_name) // Ensure client can only see their own cases

        if (caseError) {
          throw caseError
        }

        if (!caseDetailsArray || caseDetailsArray.length === 0) {
          setError("Case not found or you don't have access to this case")
          setLoading(false)
          return
        }

        setCaseData(caseDetailsArray[0])
      } catch (err: any) {
        setError(err.message || "Failed to load case details")
        console.error("Error fetching case details:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchCaseDetails()
  }, [params.id, router])

  // Helper function to format status for display
  const formatStatus = (status: string) => {
    switch (status) {
      case "open":
        return { label: "Open", color: "bg-green-100 text-green-800" }
      case "pending":
        return { label: "Pending", color: "bg-yellow-100 text-yellow-800" }
      case "closed":
        return { label: "Closed", color: "bg-gray-100 text-gray-800" }
      default:
        return { label: status, color: "bg-blue-100 text-blue-800" }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">Loading case details...</div>
        </div>
      </div>
    )
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <p className="text-red-500">{error || "Case not found or you don't have access to this case"}</p>
            <Button onClick={() => router.push("/client-dashboard")} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const status = formatStatus(caseData.status)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="outline" onClick={() => router.push("/client-dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-2">Case #{caseData.case_number}</h1>
              <p className="text-gray-600 mb-4">{caseData.case_type}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${status.color}`}>{status.label}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-4">
              <div className="flex items-center">
                <Briefcase className="h-5 w-5 text-gray-400 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Case Type</p>
                  <p className="font-medium">{caseData.case_type}</p>
                </div>
              </div>

              <div className="flex items-center">
                <FileText className="h-5 w-5 text-gray-400 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium">{status.label}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-gray-400 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Opened On</p>
                  <p className="font-medium">{new Date(caseData.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <CaseDocuments caseId={caseData.id} caseNumber={caseData.case_number} isStaff={false} />
      </div>
    </div>
  )
}
