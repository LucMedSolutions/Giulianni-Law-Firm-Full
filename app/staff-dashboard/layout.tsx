"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { User, HelpCircle, Bell, ChevronDown } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function StaffDashboardLayout({ children }: { children: React.ReactNode }) {
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
          .select("role, full_name, staff_role")
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

        // Allow both staff and admin roles to access the staff dashboard
        if (user.role !== "staff" && user.role !== "admin") {
          console.error("User is not authorized:", user.role)
          // Sign out if not authorized
          await supabase.auth.signOut()
          router.push("/")
          return
        }

        setUserData(user)

        // Count unread notifications
        try {
          const { data: notificationsData, error: notificationsError } = await supabase
            .from("notifications")
            .select("id")
            .or(`is_global.eq.true,target_role.is.null,target_role.eq.${user.role}`)

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
          <p>Loading staff dashboard...</p>
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

  // Determine if user is admin for display purposes
  const isAdmin = userData.role === "admin"
  const displayRole = isAdmin ? "Administrator" : userData.staff_role ? userData.staff_role.replace(/_/g, " ") : "Staff"

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
                  href="/staff-dashboard"
                  className={`block px-4 py-2 font-medium ${
                    pathname === "/staff-dashboard" ? "text-gray-900" : "text-gray-600"
                  } hover:bg-gray-100`}
                >
                  DASHBOARD
                </Link>
              </li>
              <li>
                <Link
                  href="/staff-dashboard/cases"
                  className={`block px-4 py-2 font-medium ${
                    pathname.startsWith("/staff-dashboard/cases") ? "text-gray-900" : "text-gray-600"
                  } hover:bg-gray-100`}
                >
                  CASES
                </Link>
              </li>
              <li>
                <Link
                  href="/staff-dashboard/documents"
                  className={`block px-4 py-2 font-medium ${
                    pathname.startsWith("/staff-dashboard/documents") ? "text-gray-900" : "text-gray-600"
                  } hover:bg-gray-100`}
                >
                  DOCUMENTS
                </Link>
              </li>
              <li>
                <Link
                  href="/staff-dashboard/inbox"
                  className={`block px-4 py-2 font-medium ${
                    pathname.startsWith("/staff-dashboard/inbox") ? "text-gray-900" : "text-gray-600"
                  } hover:bg-gray-100`}
                >
                  INBOX
                </Link>
              </li>
              {isAdmin && (
                <li>
                  <Link
                    href="/admin-dashboard"
                    className={`block px-4 py-2 font-medium text-blue-600 hover:bg-gray-100`}
                  >
                    ADMIN PANEL
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Top Header */}
          <header className="bg-white border-b p-4 flex justify-between items-center">
            <div>
              <h1 className="text-lg font-medium">Staff Dashboard</h1>
              <p className="text-sm text-gray-600">
                Welcome, {userData.full_name} ({displayRole})
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/staff-dashboard/notifications" className="relative">
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
                    <Link href="/staff-dashboard/account-settings">Account Settings</Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin-dashboard">Admin Dashboard</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 bg-gray-50">{children}</div>

          {/* Footer with Help Dialog */}
          <footer className="bg-white border-t p-4">
            <Dialog>
              <DialogTrigger asChild>
                <button className="flex items-center text-gray-600 hover:text-gray-900">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  <span>Need Help?</span>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Staff Help Center</DialogTitle>
                  <DialogDescription>
                    Find answers to common questions and learn how to use the staff portal effectively.
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="quickstart" className="mt-4">
                  <TabsList className="grid grid-cols-4">
                    <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
                    <TabsTrigger value="cases">Cases</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    <TabsTrigger value="contact">Contact</TabsTrigger>
                  </TabsList>

                  <TabsContent value="quickstart" className="space-y-4 mt-4">
                    <div>
                      <h3 className="text-lg font-medium">Welcome to the Staff Portal</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        This portal allows you to manage cases, documents, and communications with clients.
                      </p>

                      <h4 className="font-medium mt-4">Quick Actions</h4>
                      <ul className="mt-2 space-y-2">
                        <li>
                          <Link href="/staff-dashboard/cases/new" className="text-blue-600 hover:underline">
                            Create a new case
                          </Link>
                        </li>
                        <li>
                          <Link href="/staff-dashboard/documents/upload" className="text-blue-600 hover:underline">
                            Upload documents
                          </Link>
                        </li>
                        <li>
                          <Link href="/staff-dashboard/inbox" className="text-blue-600 hover:underline">
                            Check messages
                          </Link>
                        </li>
                      </ul>

                      <h4 className="font-medium mt-4">Keyboard Shortcuts</h4>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div>Alt + D</div>
                        <div>Go to Dashboard</div>
                        <div>Alt + C</div>
                        <div>Go to Cases</div>
                        <div>Alt + F</div>
                        <div>Search</div>
                        <div>Alt + N</div>
                        <div>New Item</div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="cases" className="space-y-4 mt-4">
                    <div>
                      <h3 className="text-lg font-medium">Managing Cases</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Learn how to create, update, and manage client cases effectively.
                      </p>

                      <h4 className="font-medium mt-4">Creating Cases</h4>
                      <p className="text-sm mt-1">
                        To create a new case, navigate to Cases and click the "New Case" button. Fill in the required
                        information including client details, case type, and status.
                      </p>

                      <h4 className="font-medium mt-4">Assigning Staff</h4>
                      <p className="text-sm mt-1">
                        You can assign staff members to cases by opening the case and using the assignment panel on the
                        right side. Different roles can be assigned to the same case.
                      </p>

                      <h4 className="font-medium mt-4">Case Statuses</h4>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div>New</div>
                        <div>Case has been created but work hasn't started</div>
                        <div>In Progress</div>
                        <div>Work is currently being done on this case</div>
                        <div>On Hold</div>
                        <div>Case is temporarily paused</div>
                        <div>Closed</div>
                        <div>Case has been completed or closed</div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-4 mt-4">
                    <div>
                      <h3 className="text-lg font-medium">Document Management</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Learn how to upload, organize, and share documents securely.
                      </p>

                      <h4 className="font-medium mt-4">Uploading Documents</h4>
                      <p className="text-sm mt-1">
                        Navigate to Documents and click "Upload". Select the case, document type, and file to upload.
                        You can add notes to provide context about the document.
                      </p>

                      <h4 className="font-medium mt-4">Document Security</h4>
                      <p className="text-sm mt-1">
                        Documents are secured with role-based access. Clients can only see documents related to their
                        cases. Staff can see documents based on their assigned cases.
                      </p>

                      <h4 className="font-medium mt-4">Supported File Types</h4>
                      <p className="text-sm mt-1">
                        The system supports PDF, Word documents, Excel spreadsheets, images (JPG, PNG), and text files.
                        Maximum file size is 25MB per document.
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="contact" className="space-y-4 mt-4">
                    <div>
                      <h3 className="text-lg font-medium">Contact Support</h3>
                      <p className="text-sm text-gray-600 mt-1">Need additional help? Contact our support team.</p>

                      <div className="mt-4 space-y-3">
                        <div>
                          <h4 className="font-medium">IT Support</h4>
                          <p className="text-sm">Email: it-support@giulianilaw.com</p>
                          <p className="text-sm">Phone: (555) 123-4567</p>
                          <p className="text-sm">Hours: Monday-Friday, 9am-5pm EST</p>
                        </div>

                        <div>
                          <h4 className="font-medium">System Administrator</h4>
                          <p className="text-sm">Email: sysadmin@giulianilaw.com</p>
                          <p className="text-sm">For urgent issues outside business hours</p>
                        </div>

                        <div>
                          <h4 className="font-medium">Training Resources</h4>
                          <p className="text-sm">
                            <Link href="/staff-dashboard/training" className="text-blue-600 hover:underline">
                              Access training videos and documentation
                            </Link>
                          </p>
                        </div>
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
