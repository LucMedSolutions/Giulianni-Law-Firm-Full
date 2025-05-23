"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function StaffDashboard() {
  const [userData, setUserData] = useState<any | null>(null)
  const [assignedCases, setAssignedCases] = useState<any[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
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
          .select("role, full_name, staff_role")
          .eq("id", session.user.id)
          .maybeSingle() // Use maybeSingle instead of single

        if (userError) {
          throw userError
        }

        if (!user) {
          throw new Error("User profile not found. Please contact an administrator.")
        }

        if (user.role !== "staff" && user.role !== "admin") {
          // Sign out if not authorized
          await supabase.auth.signOut()
          router.push("/")
          return
        }

        setUserData(user)

        // Get assigned cases
        const { data: cases, error: casesError } = await supabase
          .from("cases")
          .select("*")
          .eq("assigned_to", session.user.id)
          .order("created_at", { ascending: false })

        if (casesError) {
          throw casesError
        }

        setAssignedCases(cases || [])

        // Count unread notifications
        // First get all notifications for this user
        const { data: notificationsData, error: notificationsError } = await supabase
          .from("notifications")
          .select("id")
          .or(`is_global.eq.true,target_role.is.null,target_role.eq.${user.role}`)

        if (notificationsError) {
          throw notificationsError
        }

        if (notificationsData && notificationsData.length > 0) {
          // Get notification IDs
          const notificationIds = notificationsData.map((n) => n.id)

          // Get read status for these notifications
          const { data: userNotifications, error: userNotificationsError } = await supabase
            .from("user_notifications")
            .select("notification_id")
            .eq("user_id", session.user.id)
            .eq("is_read", true)

          if (userNotificationsError) {
            throw userNotificationsError
          }

          // Create a set of read notification IDs
          const readNotificationIds = new Set((userNotifications || []).map((un) => un.notification_id))

          // Count unread notifications
          const unreadCount = notificationIds.filter((id) => !readNotificationIds.has(id)).length
          setUnreadNotifications(unreadCount)
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
        return { label: "Open", color: "text-green-600" }
      case "pending":
        return { label: "Pending", color: "text-yellow-600" }
      case "closed":
        return { label: "Closed", color: "text-gray-600" }
      default:
        return { label: status, color: "text-blue-600" }
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="w-16 h-16 border-4 border-t-blue-500 border-b-blue-500 border-gray-200 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !userData) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Failed to load dashboard"}</p>
          <Button onClick={() => router.push("/")} variant="outline">
            Return to Login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Welcome Back, {userData.full_name}</h1>
        <p className="text-gray-600">
          You are assigned to {assignedCases.length} Case(s).{" "}
          <Link href="/staff-dashboard/cases" className="text-blue-600 hover:underline">
            View more info here.
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Assigned Cases */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>ASSIGNED CASES:</CardTitle>
          </CardHeader>
          <CardContent>
            {assignedCases.length === 0 ? (
              <p className="text-gray-500">No cases assigned to you at the moment.</p>
            ) : (
              <div className="space-y-4">
                {assignedCases.map((case_item) => {
                  const status = formatStatus(case_item.status)
                  return (
                    <div key={case_item.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                      <div className="flex justify-between">
                        <div>
                          <h3 className="font-medium">Case #{case_item.case_number}</h3>
                          <p className="text-sm text-gray-600">Client: {case_item.client_name}</p>
                          <p className="text-sm text-gray-600">Type: {case_item.case_type}</p>
                        </div>
                        <div>
                          <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Link
                          href={`/staff-dashboard/case/${case_item.id}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Upload */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>DOCUMENT UPLOAD</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
              <p className="text-gray-500">Drag and drop files here or click to upload</p>
              <Button asChild className="mt-4">
                <Link href="/staff-dashboard/documents/upload">Select Files</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Chat */}
        <Card>
          <CardHeader>
            <CardTitle>CHAT</CardTitle>
          </CardHeader>
          <CardContent className="h-48 flex items-center justify-center">
            <p className="text-gray-500 text-center">Chat functionality coming soon</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
