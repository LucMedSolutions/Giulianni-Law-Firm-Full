"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, MessageSquare, Inbox } from "lucide-react"

export default function ClientDashboard() {
  const [userData, setUserData] = useState<any | null>(null)
  const [cases, setCases] = useState<any[]>([])
  const [recentDocuments, setRecentDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
          .select("role, full_name")
          .eq("id", session.user.id)
          .maybeSingle() // Use maybeSingle instead of single

        if (userError) {
          throw userError
        }

        if (!user) {
          throw new Error("User profile not found. Please contact an administrator.")
        }

        if (user.role !== "client") {
          // Sign out if not authorized
          await supabase.auth.signOut()
          router.push("/")
          return
        }

        setUserData(user)

        // Get client cases - try multiple matching strategies
        let clientCases: any[] = []

        // First try exact match on client_name
        const { data: exactMatches, error: exactError } = await supabase
          .from("cases")
          .select("*")
          .eq("client_name", user.full_name)
          .order("created_at", { ascending: false })

        if (exactError) {
          console.error("Error fetching exact matches:", exactError)
        } else {
          clientCases = exactMatches || []
        }

        // If no exact matches, try case-insensitive search
        if (clientCases.length === 0) {
          const { data: fuzzyMatches, error: fuzzyError } = await supabase
            .from("cases")
            .select("*")
            .ilike("client_name", user.full_name)
            .order("created_at", { ascending: false })

          if (fuzzyError) {
            console.error("Error fetching fuzzy matches:", fuzzyError)
          } else {
            clientCases = fuzzyMatches || []
          }
        }

        console.log("Client cases found:", clientCases.length, "for user:", user.full_name, "using name matching")

        setCases(clientCases || [])

        // Get recent documents
        if (clientCases && clientCases.length > 0) {
          const caseIds = clientCases.map((c) => c.id)

          const { data: documents, error: docsError } = await supabase
            .from("documents")
            .select(`
              id, 
              filename, 
              file_type, 
              upload_time, 
              storage_url,
              cases!inner(id, case_number)
            `)
            .in("case_id", caseIds)
            .order("upload_time", { ascending: false })
            .limit(5)

          if (docsError) {
            throw docsError
          }

          setRecentDocuments(documents || [])
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while loading your dashboard")
        console.error("Dashboard error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

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
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p>Loading your dashboard...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !userData) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-red-500">{error || "Failed to load dashboard"}</p>
            <Button onClick={() => router.push("/")} className="mt-4">
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-2">Welcome, {userData.full_name}</h2>
          <p className="text-gray-600">
            View your case information and documents below. Contact your attorney for any questions.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cases */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Your Cases</CardTitle>
            </CardHeader>
            <CardContent>
              {cases.length === 0 ? (
                <p className="text-gray-500 italic">You don't have any active cases at the moment.</p>
              ) : (
                <div className="space-y-4">
                  {cases.map((case_item) => {
                    const status = formatStatus(case_item.status)
                    return (
                      <div key={case_item.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-lg">Case #{case_item.case_number}</h3>
                            <p className="text-sm text-gray-600">Type: {case_item.case_type}</p>
                            <p className="text-sm text-gray-600">
                              Created: {new Date(case_item.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <div className="mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/client-dashboard/case/${case_item.id}`)}
                          >
                            View Case Details
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          {/* Recent Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {recentDocuments.length === 0 ? (
                <p className="text-gray-500 italic">No documents available for your cases.</p>
              ) : (
                <div className="space-y-3">
                  {recentDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center border-b pb-3 last:border-b-0">
                      <div className="bg-blue-100 p-2 rounded mr-3">
                        <FileText className="h-5 w-5 text-blue-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.filename}</p>
                        <p className="text-xs text-gray-500">Case #{doc.cases.case_number}</p>
                      </div>
                      <a
                        href={doc.storage_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push("/client-dashboard/documents")}
                >
                  View All Documents
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/client-dashboard/documents/upload")}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Upload Document
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/client-dashboard/inbox")}
                >
                  <Inbox className="mr-2 h-4 w-4" />
                  Check Messages
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/client-dashboard/chat")}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Chat with Attorney
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
