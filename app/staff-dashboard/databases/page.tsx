"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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
      return (
        caseItem.title.toLowerCase().includes(searchTermLower) ||
        caseItem.description.toLowerCase().includes(searchTermLower) ||
        caseItem.status.toLowerCase().includes(searchTermLower)
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
      return a.title.localeCompare(b.title) * order
    })

  const filteredDocuments = documents
    .filter((document) => {
      const searchTermLower = searchTerm.toLowerCase()
      return (
        document.title.toLowerCase().includes(searchTermLower) ||
        document.description.toLowerCase().includes(searchTermLower) ||
        document.type.toLowerCase().includes(searchTermLower)
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
      return a.title.localeCompare(b.title) * order
    })

  return (
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="search">Search:</Label>
          <Input
            id="search"
            placeholder="Search cases and documents..."
            value={searchTerm}
            onChange={handleSearch}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="caseStatus">Case Status:</Label>
          <Select
            value={caseFilter}
            onValueChange={handleCaseFilterChange}
          >
            <SelectTrigger id="caseStatus">
              <SelectValue placeholder="Select Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="documentType">Document Type:</Label>
          <Select
            value={documentFilter}
            onValueChange={handleDocumentFilterChange}
          >
            <SelectTrigger id="documentType">
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="word">Word</SelectItem>
              <SelectItem value="excel">Excel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort Order:</Label>
          <Select
            value={sortOrder}
            onValueChange={handleSortOrderChange}
          >
            <SelectTrigger id="sortOrder">
              <SelectValue placeholder="Select Order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Cases</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCases.map((caseItem) => (
              <TableRow key={caseItem.id}>
                <TableCell>{caseItem.title}</TableCell>
                <TableCell>{caseItem.description}</TableCell>
                <TableCell>{caseItem.status}</TableCell>
                <TableCell>
                  {new Date(caseItem.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <h2 className="text-2xl font-bold">Documents</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocuments.map((document) => (
              <TableRow key={document.id}>
                <TableCell>{document.title}</TableCell>
                <TableCell>{document.description}</TableCell>
                <TableCell>{document.type}</TableCell>
                <TableCell>
                  {new Date(document.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
