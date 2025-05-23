"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Bell, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface Notification {
  id: string
  title: string
  message: string
  created_at: string
  is_read: boolean
}

export default function ClientNotificationsPage() {
  const [userData, setUserData] = useState<any | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchData()
  }, [])

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
        .single()

      if (userError || !user || user.role !== "client") {
        // Sign out if not authorized
        await supabase.auth.signOut()
        router.push("/")
        return
      }

      setUserData(user)

      // Get notifications for this user
      const { data: notificationsData, error: notificationsError } = await supabase
        .from("notifications")
        .select("*")
        .or(`is_global.eq.true,target_role.is.null,target_role.eq.${user.role}`)
        .order("created_at", { ascending: false })

      if (notificationsError) {
        throw notificationsError
      }

      // Get read status for these notifications
      const { data: userNotifications, error: userNotificationsError } = await supabase
        .from("user_notifications")
        .select("notification_id, is_read")
        .eq("user_id", session.user.id)

      if (userNotificationsError) {
        throw userNotificationsError
      }

      // Create a map of notification_id to is_read status
      const readStatusMap = (userNotifications || []).reduce((map: Record<string, boolean>, item) => {
        map[item.notification_id] = item.is_read
        return map
      }, {})

      // Combine the data
      const formattedNotifications = (notificationsData || []).map((notification) => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        created_at: notification.created_at,
        is_read: readStatusMap[notification.id] || false,
      }))

      setNotifications(formattedNotifications)
    } catch (err: any) {
      setError(err.message || "An error occurred while loading notifications")
      console.error("Notifications error:", err)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      // Check if a record already exists
      const { data: existingRecord } = await supabase
        .from("user_notifications")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("notification_id", id)
        .single()

      if (existingRecord) {
        // Update existing record
        await supabase
          .from("user_notifications")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("id", existingRecord.id)
      } else {
        // Insert new record
        await supabase.from("user_notifications").insert({
          user_id: session.user.id,
          notification_id: id,
          is_read: true,
          read_at: new Date().toISOString(),
        })
      }

      // Update local state
      setNotifications(
        notifications.map((notification) =>
          notification.id === id ? { ...notification, is_read: true } : notification,
        ),
      )
    } catch (err) {
      console.error("Error marking notification as read:", err)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="w-16 h-16 border-4 border-t-blue-500 border-b-blue-500 border-gray-200 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-center">
          <Button onClick={() => fetchData()} variant="outline">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-gray-600">
            You have {notifications.filter((n) => !n.is_read).length} unread notifications
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-gray-500">No notifications</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 ${notification.is_read ? "bg-white" : "bg-blue-50"} cursor-pointer`}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                >
                  <div className="flex items-start">
                    <div className="mr-4">
                      <Bell className={`h-5 w-5 ${notification.is_read ? "text-gray-400" : "text-blue-500"}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-medium ${notification.is_read ? "text-gray-700" : "text-black"}`}>
                        {notification.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-2">{new Date(notification.created_at).toLocaleString()}</p>
                    </div>
                    {!notification.is_read && (
                      <div className="ml-2">
                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
