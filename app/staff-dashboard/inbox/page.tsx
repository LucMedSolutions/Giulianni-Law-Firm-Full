"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Inbox, User, HelpCircle, Bell } from "lucide-react"

interface Notification {
  id: string
  title: string
  message: string
  created_at: string
  is_read: boolean
}

export default function InboxPage() {
  const [userData, setUserData] = useState<any | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
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
          .single()

        if (userError || !user || (user.role !== "staff" && user.role !== "admin")) {
          // Sign out if not authorized
          await supabase.auth.signOut()
          router.push("/")
          return
        }

        setUserData(user)

        // Get notifications for this user - avoid duplicates by using a more specific query
        const { data: notificationsData, error: notificationsError } = await supabase
          .from("notifications")
          .select("*")
          .or(`is_global.eq.true,target_role.eq.${user.role},target_role.is.null`)
          .order("created_at", { ascending: false })

        if (notificationsError) {
          throw notificationsError
        }

        // Remove any potential duplicates by ID
        const uniqueNotifications =
          notificationsData?.reduce((acc, notification) => {
            if (!acc.find((n) => n.id === notification.id)) {
              acc.push(notification)
            }
            return acc
          }, [] as any[]) || []

        // Get read status for these notifications
        const { data: userNotifications, error: userNotificationsError } = await supabase
          .from("user_notifications")
          .select("notification_id, is_read")
          .eq("user_id", session.user.id)

        if (userNotificationsError) {
          throw userNotificationsError
        }

        // Create a map of notification_id to is_read status
        const readStatusMap = (userNotifications || []).reduce((map, item) => {
          map[item.notification_id] = item.is_read
          return map
        }, {})

        // Combine the data
        const formattedNotifications = uniqueNotifications.map((notification) => ({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          created_at: notification.created_at,
          is_read: readStatusMap[notification.id] || false,
        }))

        setNotifications(formattedNotifications)
      } catch (err: any) {
        setError(err.message || "An error occurred while loading your inbox")
        console.error("Inbox error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
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
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (error || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Failed to load inbox"}</p>
          <button onClick={() => router.push("/")} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Return to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Sidebar Navigation */}
      <div className="w-48 bg-white border-r">
        <div className="p-4 border-b">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-yjaR75Xeuv9XKhwflUzwSOfRVYNEB5.png"
            alt="Giuliani Law Firm"
            width={150}
            height={50}
          />
        </div>
        <nav className="py-6">
          <ul className="space-y-2">
            <li>
              <Link href="/staff-dashboard" className="block px-4 py-2 font-medium text-gray-600 hover:bg-gray-100">
                DASHBOARD
              </Link>
            </li>
            <li>
              <Link
                href="/staff-dashboard/documents"
                className="block px-4 py-2 font-medium text-gray-600 hover:bg-gray-100"
              >
                DOCUMENTS
              </Link>
            </li>
            <li>
              <Link
                href="/staff-dashboard/cases"
                className="block px-4 py-2 font-medium text-gray-600 hover:bg-gray-100"
              >
                VIEW CASES
              </Link>
            </li>
            <li>
              <Link
                href="/staff-dashboard/databases"
                className="block px-4 py-2 font-medium text-gray-600 hover:bg-gray-100"
              >
                DATABASES
              </Link>
            </li>
            <li>
              <Link
                href="/staff-dashboard/inbox"
                className="block px-4 py-2 font-medium text-gray-900 hover:bg-gray-100"
              >
                INBOX
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b p-4 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-medium">Inbox</h1>
            <p className="text-sm text-gray-600">
              You have {notifications.filter((n) => !n.is_read).length} unread notifications
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/staff-dashboard/inbox" className="relative">
              <Inbox className="h-6 w-6 text-gray-700" />
              {notifications.filter((n) => !n.is_read).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  {notifications.filter((n) => !n.is_read).length}
                </span>
              )}
            </Link>
            <button onClick={handleSignOut}>
              <User className="h-6 w-6 text-gray-700" />
            </button>
          </div>
        </header>

        {/* Inbox Content */}
        <div className="flex-1 p-6 bg-gray-50">
          <div className="bg-white border border-gray-200 rounded-sm">
            <div className="p-4 border-b">
              <h2 className="font-medium">NOTIFICATIONS</h2>
            </div>
            <div className="divide-y">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No notifications</div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 ${notification.is_read ? "bg-white" : "bg-blue-50"}`}
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
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
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
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t p-4">
          <div className="flex items-center text-gray-600">
            <HelpCircle className="h-4 w-4 mr-2" />
            <span>Need Help?</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
