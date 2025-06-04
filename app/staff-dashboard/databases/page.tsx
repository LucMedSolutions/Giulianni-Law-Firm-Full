"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

export default function DatabasesPage() {
  const [userData, setUserData] = useState<any | null>(null)
  const [cases, setCases] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [caseFilter, setCaseFilter] = useState("all")
  const [documentFilter, setDocumentFilter] = useState("all")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [unreadNotifications, setUnreadNotifications] = useState(0)

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
        const { data: user, error: userError } = await supabase.from("users").select("*").single()

        if (userError) {
          console.error("Error fetching user data:", userError)
          setError("Failed to load user data.")
          return
        }

        setUserData(user)

        // Get cases
        const { data: casesData, error: casesError } = await supabase
          .from("cases")
          .select("*")
          .order("created_at", { ascending: false })

        if (casesError) {
          console.error("Error fetching cases:", casesError)
          setError("Failed to load cases.")
          return
        }

        setCases(casesData)

        // Get documents
        const { data: documentsData, error: documentsError } = await supabase
          .from("documents")
          .select("*")
          .order("created_at", { ascending: false })

        if (documentsError) {
          console.error("Error fetching documents:", documentsError)
          setError("Failed to load documents.")
          return
        }

        setDocuments(documentsData)

        // Get unread notifications count
        const { count: unreadCount, error: notificationsError } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.user.id)
          .eq("is_read", false)

        if (notificationsError) {
          console.error("Error fetching unread notifications:", notificationsError)
        } else {
          setUnreadNotifications(unreadCount || 0)
        }
      } catch (err: any) {
        console.error("Error fetching data:", err)
        setError(err.message || "An unexpected error occurred.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase, router])

  // Function to handle marking a notification as read
  const markNotificationAsRead = async (notificationId: string) => {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId)

    if (error) {
      console.error("Error marking notification as read:", error)
      // Optionally, display an error message to the user
    } else {
      // Optimistically update the state to reflect the change
      setUnreadNotifications((prevCount) => Math.max(0, prevCount - 1))
      // Optionally, refresh the notifications list
    }
  }

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value)
  }

  const handleCaseFilterChange = (filter: string) => {
    setCaseFilter(filter)
  }

  const handleDocumentFilterChange = (filter: string) => {
    setDocumentFilter(filter)
  }

  const handleSortOrderChange = () => {
    setSortOrder((prevOrder) => (prevOrder === "asc" ? "desc" : "asc"))
  }

  const filteredCases = cases
    .filter((caseItem) => {
      const searchTermLower = searchTerm.toLowerCase()
      // Ensure properties exist and are strings before calling toLowerCase
      return (
        (caseItem.title && caseItem.title.toLowerCase().includes(searchTermLower)) ||
        (caseItem.description && caseItem.description.toLowerCase().includes(searchTermLower)) ||
        (caseItem.status && caseItem.status.toLowerCase().includes(searchTermLower))
      )
    })
    .filter((caseItem) => {
      if (caseFilter === "all") {
        return true
      }
      return caseItem.status === caseFilter
    })
    .sort((a, b) => {
      const order = sortOrder === "asc" ? 1 : -1
      // Ensure title exists for sorting
      const titleA = a.title || ""
      const titleB = b.title || ""
      return titleA.localeCompare(titleB) * order
    })

  const filteredDocuments = documents
    .filter((document) => {
      const searchTermLower = searchTerm.toLowerCase()
      // Ensure properties exist and are strings before calling toLowerCase
      return (
        (document.title && document.title.toLowerCase().includes(searchTermLower)) ||
        (document.description && document.description.toLowerCase().includes(searchTermLower)) ||
        (document.type && document.type.toLowerCase().includes(searchTermLower))
      )
    })
    .filter((document) => {
      if (documentFilter === "all") {
        return true
      }
      return document.type === documentFilter
    })
    .sort((a, b) => {
      const order = sortOrder === "asc" ? 1 : -1
      // Ensure title exists for sorting
      const titleA = a.title || ""
      const titleB = b.title || ""
      return titleA.localeCompare(titleB) * order
    })

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Databases Dashboard</h1>

      {loading && <p>Loading data...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <>
          {/* Filter Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 border rounded shadow-sm">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Search:
              </label>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={handleSearch}
                placeholder="Search cases and documents..."
                className="w-full p-2 border rounded"
              />
            </div>

            <div>
              <label htmlFor="caseStatusFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Case Status:
              </label>
              <select
                id="caseStatusFilter"
                value={caseFilter}
                onChange={(e) => handleCaseFilterChange(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="all">All</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="Pending">Pending</option>
                {/* Add other statuses from your data if necessary */}
              </select>
            </div>

            <div>
              <label htmlFor="documentTypeFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Document Type:
              </label>
              <select
                id="documentTypeFilter"
                value={documentFilter}
                onChange={(e) => handleDocumentFilterChange(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="all">All</option>
                <option value="PDF">PDF</option>
                <option value="Word">Word</option>
                <option value="Excel">Excel</option>
                {/* Add other document types from your data if necessary */}
              </select>
            </div>

            <div>
              <label htmlFor="sortOrder" className="block text-sm font-medium text-gray-700 mb-1">
                Sort Order (by Title):
              </label>
              <button
                onClick={handleSortOrderChange}
                className="w-full p-2 border rounded bg-gray-200 hover:bg-gray-300"
              >
                {sortOrder === "asc" ? "Ascending" : "Descending"}
              </button>
            </div>
          </div>

          {/* Cases Table */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-3">Cases ({filteredCases.length})</h2>
            <div className="overflow-x-auto border rounded shadow-sm">
              <table className="min-w-full bg-white">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Title</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Description</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.length > 0 ? (
                    filteredCases.map((caseItem) => (
                      <tr key={caseItem.id} className="hover:bg-gray-50 border-b">
                        <td className="px-4 py-2 whitespace-nowrap">{caseItem.title}</td>
                        <td className="px-4 py-2">{caseItem.description}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{caseItem.status}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {new Date(caseItem.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-4">
                        No cases found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Documents Table */}
          <div>
            <h2 className="text-xl font-semibold mb-3">Documents ({filteredDocuments.length})</h2>
            <div className="overflow-x-auto border rounded shadow-sm">
              <table className="min-w-full bg-white">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Title</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Description</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Type</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.length > 0 ? (
                    filteredDocuments.map((document) => (
                      <tr key={document.id} className="hover:bg-gray-50 border-b">
                        <td className="px-4 py-2 whitespace-nowrap">{document.title}</td>
                        <td className="px-4 py-2">{document.description}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{document.type}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {new Date(document.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-4">
                        No documents found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
