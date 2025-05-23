"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { User, Bell, ChevronDown, FileText, MessageSquare, Home, Settings, HelpCircle } from "lucide-react"
import ErrorBoundary from "@/components/error-boundary"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ClientDashboardLayoutProps {
  children: React.ReactNode
}

const ClientDashboardLayout: React.FC<ClientDashboardLayoutProps> = ({ children }) => {
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

        if (user.role !== "client") {
          console.error("User is not a client:", user.role)
          // Sign out if not authorized
          await supabase.auth.signOut()
          router.push("/")
          return
        }

        setUserData(user)

        // Count unread notifications for clients
        try {
          const { data: notificationsData, error: notificationsError } = await supabase
            .from("notifications")
            .select("id")
            .or(`is_global.eq.true,target_role.is.null,target_role.eq.client`)

          if (notificationsError) {
            console.error("Notifications fetch error:", notificationsError)
            setUnreadNotifications(0)
            return
          }

          if (notificationsData && notificationsData.length > 0) {
            const notificationIds = notificationsData.map((n) => n.id)

            const { data: userNotifications, error: userNotificationsError } = await supabase
              .from("user_notifications")
              .select("notification_id")
              .eq("user_id", session.user.id)
              .eq("is_read", true)

            if (userNotificationsError) {
              console.error("User notifications fetch error:", userNotificationsError)
              setUnreadNotifications(notificationsData.length)
              return
            }

            const readNotificationIds = new Set((userNotifications || []).map((un) => un.notification_id))
            const unreadCount = notificationIds.filter((id) => !readNotificationIds.has(id)).length
            setUnreadNotifications(unreadCount)
          }
        } catch (notifError) {
          console.error("Notification count error:", notifError)
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
          <p>Loading client dashboard...</p>
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
        <div className="w-64 bg-white border-r shadow-md">
          <div className="p-4 border-b">
            <Image src="/logo.png" alt="Giuliani Law Firm" width={150} height={50} />
          </div>
          <nav className="py-6">
            <ul className="space-y-2">
              <li>
                <Link
                  href="/client-dashboard"
                  className={`flex items-center px-4 py-2 font-medium ${
                    pathname === "/client-dashboard" ? "text-gray-900 bg-gray-100" : "text-gray-600"
                  } hover:bg-gray-100`}
                >
                  <Home className="h-4 w-4 mr-2" />
                  DASHBOARD
                </Link>
              </li>
              <li>
                <Link
                  href="/client-dashboard/documents"
                  className={`flex items-center px-4 py-2 font-medium ${
                    pathname.startsWith("/client-dashboard/documents") ? "text-gray-900 bg-gray-100" : "text-gray-600"
                  } hover:bg-gray-100`}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  DOCUMENTS
                </Link>
              </li>
              <li>
                <Link
                  href="/client-dashboard/inbox"
                  className={`flex items-center px-4 py-2 font-medium ${
                    pathname === "/client-dashboard/inbox" ? "text-gray-900 bg-gray-100" : "text-gray-600"
                  } hover:bg-gray-100`}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  INBOX
                </Link>
              </li>
              <li>
                <Link
                  href="/client-dashboard/account-settings"
                  className={`flex items-center px-4 py-2 font-medium ${
                    pathname === "/client-dashboard/account-settings" ? "text-gray-900 bg-gray-100" : "text-gray-600"
                  } hover:bg-gray-100`}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  SETTINGS
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b p-4 flex justify-between items-center">
            <div>
              <h1 className="text-lg font-medium">Client Portal</h1>
              <p className="text-sm text-gray-600">Welcome, {userData.full_name}</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/client-dashboard/notifications" className="relative">
                <Bell className="h-6 w-6 text-gray-700" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center text-gray-700 hover:text-gray-900">
                    <User className="h-6 w-6" />
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/client-dashboard/account-settings">Account Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 overflow-y-auto bg-gray-50">{children}</main>

          {/* Footer with Help */}
          <footer className="bg-white border-t p-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Need Help?
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Client Portal Help</DialogTitle>
                  <DialogDescription>
                    Find answers to common questions and learn how to use the client portal effectively.
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="getting-started" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    <TabsTrigger value="communication">Communication</TabsTrigger>
                    <TabsTrigger value="account">Account</TabsTrigger>
                  </TabsList>

                  <TabsContent value="getting-started" className="space-y-4">
                    <h3 className="text-lg font-semibold">Welcome to Your Client Portal</h3>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium">Dashboard Overview</h4>
                        <p className="text-sm text-gray-600">
                          Your dashboard provides a quick overview of your cases, recent documents, and important
                          notifications.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium">Navigation</h4>
                        <p className="text-sm text-gray-600">Use the sidebar to navigate between different sections:</p>
                        <ul className="text-sm text-gray-600 ml-4 list-disc">
                          <li>Dashboard - Overview of your account</li>
                          <li>Documents - View and upload case documents</li>
                          <li>Inbox - Communicate with your legal team</li>
                          <li>Settings - Manage your account preferences</li>
                        </ul>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-4">
                    <h3 className="text-lg font-semibold">Document Management</h3>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium">Viewing Documents</h4>
                        <p className="text-sm text-gray-600">
                          Access all case-related documents in the Documents section. You can preview, download, and
                          organize your files.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium">Uploading Documents</h4>
                        <p className="text-sm text-gray-600">
                          Upload new documents by clicking the "Upload Document" button. Make sure to select the correct
                          case and document type.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium">Document Security</h4>
                        <p className="text-sm text-gray-600">
                          All documents are encrypted and securely stored. Only you and your assigned legal team can
                          access your files.
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="communication" className="space-y-4">
                    <h3 className="text-lg font-semibold">Communication Tools</h3>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium">Inbox</h4>
                        <p className="text-sm text-gray-600">
                          Use the inbox to communicate securely with your legal team. All messages are confidential and
                          case-related.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium">Notifications</h4>
                        <p className="text-sm text-gray-600">
                          Stay updated with important case developments through our notification system. Check the bell
                          icon for new alerts.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium">Response Times</h4>
                        <p className="text-sm text-gray-600">
                          We typically respond to messages within 24-48 hours during business days. Urgent matters will
                          be addressed sooner.
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="account" className="space-y-4">
                    <h3 className="text-lg font-semibold">Account Management</h3>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium">Profile Settings</h4>
                        <p className="text-sm text-gray-600">
                          Update your contact information and preferences in the Account Settings section.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium">Security</h4>
                        <p className="text-sm text-gray-600">
                          Keep your account secure by using a strong password and logging out when finished.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium">Support</h4>
                        <p className="text-sm text-gray-600">
                          Need additional help? Contact us at:
                          <br />
                          Email: support@giulianilawfirm.com
                          <br />
                          Phone: (555) 123-4567
                          <br />
                          Hours: Monday-Friday, 9 AM - 5 PM EST
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </footer>
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default ClientDashboardLayout
