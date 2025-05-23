"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { User, HelpCircle, Bell } from "lucide-react"
import ErrorBoundary from "@/components/error-boundary"

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const checkAuth = async () => {
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
          .maybeSingle()

        if (userError) {
          console.error("User data fetch error:", userError)
          throw new Error("Failed to fetch user data")
        }

        if (!user) {
          console.error("No user data found")
          throw new Error("User profile not found")
        }

        if (user.role !== "admin") {
          console.error("User is not an admin:", user.role)
          // Sign out if not authorized
          await supabase.auth.signOut()
          router.push("/")
          return
        }

        // Set admin status
        try {
          await supabase.rpc("set_is_admin", { is_admin: true })
        } catch (rpcError) {
          console.error("RPC error:", rpcError)
          // Continue anyway, this is not critical
        }

        setUserData(user)

        // Count unread notifications
        try {
          const { data: notificationsData, error: notificationsError } = await supabase
            .from("notifications")
            .select("id")
            .or(`is_global.eq.true,target_role.is.null,target_role.eq.admin`)

          if (notificationsError) {
            console.error("Notifications fetch error:", notificationsError)
            // Don't throw, just set unread to 0
            setUnreadNotifications(0)
            return
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
              console.error("User notifications fetch error:", userNotificationsError)
              // Don't throw, just set unread to length of all notifications
              setUnreadNotifications(notificationsData.length)
              return
            }

            // Create a set of read notification IDs
            const readNotificationIds = new Set((userNotifications || []).map((un) => un.notification_id))

            // Count unread notifications
            const unreadCount = notificationIds.filter((id) => !readNotificationIds.has(id)).length
            setUnreadNotifications(unreadCount)
          }
        } catch (notifError) {
          console.error("Notification count error:", notifError)
          // Don't throw, just set unread to 0
          setUnreadNotifications(0)
        }
      } catch (err: any) {
        console.error("Auth check error:", err)
        setError(err.message || "An error occurred while checking authentication")
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-blue-500 border-b-blue-500 border-gray-200 rounded-full animate-spin mb-4"></div>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Failed to authenticate"}</p>
          <button onClick={() => router.push("/")} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Return to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex">
        {/* Left Sidebar Navigation */}
        <div className="w-48 bg-white border-r">
          <div className="p-4 border-b">
            <Image src="/logo.png" alt="Giuliani Law Firm" width={150} height={50} />
          </div>
          <nav className="py-6">
            <ul className="space-y-2">
              <li>
                <Link
                  href="/admin-dashboard"
                  className={`block px-4 py-2 font-medium ${
                    pathname === "/admin-dashboard" ? "text-gray-900" : "text-gray-600"
                  } hover:bg-gray-100`}
                >
                  DASHBOARD
                </Link>
              </li>
              <li>
                <Link
                  href="/admin-dashboard/users"
                  className={`block px-4 py-2 font-medium ${
                    pathname === "/admin-dashboard/users" ? "text-gray-900" : "text-gray-600"
                  } hover:bg-gray-100`}
                >
                  USERS
                </Link>
              </li>
              <li>
                <Link
                  href="/admin-dashboard/database"
                  className={`block px-4 py-2 font-medium ${
                    pathname === "/admin-dashboard/database" ? "text-gray-900" : "text-gray-600"
                  } hover:bg-gray-100`}
                >
                  DATABASE
                </Link>
              </li>
              <li>
                <Link
                  href="/admin-dashboard/notifications"
                  className={`block px-4 py-2 font-medium ${
                    pathname === "/admin-dashboard/notifications" ? "text-gray-900" : "text-gray-600"
                  } hover:bg-gray-100`}
                >
                  NOTIFICATIONS
                </Link>
              </li>
              <li>
                <Link
                  href="/admin-dashboard/audit-logs"
                  className={`block px-4 py-2 font-medium ${
                    pathname === "/admin-dashboard/audit-logs" ? "text-gray-900" : "text-gray-600"
                  } hover:bg-gray-100`}
                >
                  AUDIT LOGS
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
              <h1 className="text-lg font-medium">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome, {userData.full_name}</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/admin-dashboard/notifications" className="relative">
                <Bell className="h-6 w-6 text-gray-700" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </Link>
              <button onClick={handleSignOut}>
                <User className="h-6 w-6 text-gray-700" />
              </button>
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 p-6 bg-gray-50">{children}</div>

          {/* Footer */}
          <footer className="bg-white border-t p-4">
            <div className="flex items-center text-gray-600">
              <HelpCircle className="h-4 w-4 mr-2" />
              <span>Need Help?</span>
            </div>
          </footer>
        </div>
      </div>
    </ErrorBoundary>
  )
}
