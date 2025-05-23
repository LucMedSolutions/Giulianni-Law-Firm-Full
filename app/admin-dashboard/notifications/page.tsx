"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Plus, Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bell } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Import the audit logger
import { logAuditEvent } from "@/lib/audit-logger"

export default function AdminNotificationsPage() {
  const [userData, setUserData] = useState<any | null>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newNotification, setNewNotification] = useState({
    title: "",
    message: "",
    is_global: true,
    target_role: null,
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null)
  const [submitStatus, setSubmitStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [deletingNotificationId, setDeletingNotificationId] = useState<string | null>(null)
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

        if (userError || !user || user.role !== "admin") {
          // Sign out if not authorized
          await supabase.auth.signOut()
          router.push("/")
          return
        }

        setUserData(user)

        // Get notifications from the database
        const { data: notificationsData, error: notificationsError } = await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })

        if (notificationsError) {
          throw notificationsError
        }

        setNotifications(notificationsData || [])
      } catch (err: any) {
        setError(err.message || "An error occurred while loading notifications")
        console.error("Notifications error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const handleCreateNotification = async () => {
    if (!newNotification.title || !newNotification.message) {
      setSubmitStatus({
        type: "error",
        message: "Please provide both a title and message for the notification",
      })
      return
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error("You must be logged in to create notifications")
      }

      // Insert the notification into the database
      const { data, error } = await supabase
        .from("notifications")
        .insert({
          title: newNotification.title,
          message: newNotification.message,
          created_by: session.user.id,
          is_global: newNotification.is_global,
          target_role: newNotification.target_role,
        })
        .select()

      if (error) {
        throw error
      }

      // Log the notification creation in audit logs
      try {
        await logAuditEvent({
          user_id: session.user.id,
          action: "create_notification",
          details: `Created notification: ${newNotification.title}`,
          resource_type: "notification",
          resource_id: data[0].id,
          // Add a document_id even though it's not relevant for notifications
          document_id: "00000000-0000-0000-0000-000000000000",
        })
      } catch (logError) {
        console.error("Error logging audit event:", logError)
        // Continue even if logging fails
      }

      // Add the new notification to the state
      setNotifications([data[0], ...notifications])

      // Reset the form
      setNewNotification({
        title: "",
        message: "",
        is_global: true,
        target_role: null,
      })

      setSubmitStatus({
        type: "success",
        message: "Notification created successfully",
      })

      setIsDialogOpen(false)
    } catch (err: any) {
      setSubmitStatus({
        type: "error",
        message: err.message || "Failed to create notification",
      })
    }
  }

  const confirmDeleteNotification = (id: string) => {
    setNotificationToDelete(id)
    setIsConfirmDialogOpen(true)
  }

  const handleDeleteNotification = async () => {
    if (!notificationToDelete) return

    try {
      setDeletingNotificationId(notificationToDelete)
      setIsConfirmDialogOpen(false)

      // Get notification details before deletion for the audit log
      const notificationToLog = notifications.find((n) => n.id === notificationToDelete)

      // Use our dedicated API endpoint to delete the notification
      const response = await fetch(`/api/delete-notification?id=${notificationToDelete}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete notification")
      }

      // Get the current user session for the audit log
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        // Log the notification deletion in audit logs
        try {
          await logAuditEvent({
            user_id: session.user.id,
            action: "delete_notification",
            details: `Deleted notification: ${notificationToLog?.title || "Unknown"}`,
            resource_type: "notification",
            resource_id: notificationToDelete,
            // Add a document_id even though it's not relevant for notifications
            document_id: "00000000-0000-0000-0000-000000000000",
          })
        } catch (logError) {
          console.error("Error logging audit event:", logError)
          // Continue even if logging fails
        }
      }

      // Remove the notification from the state
      setNotifications(notifications.filter((notification) => notification.id !== notificationToDelete))
    } catch (err: any) {
      console.error("Error deleting notification:", err)
      alert("Failed to delete notification: " + err.message)
    } finally {
      setDeletingNotificationId(null)
      setNotificationToDelete(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-16 h-16 border-4 border-t-blue-500 border-b-blue-500 border-gray-200 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !userData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Failed to load notifications"}</p>
          <Button onClick={() => router.push("/")} variant="outline">
            Return to Login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
          <p className="text-muted-foreground">Create and manage system notifications for staff members and clients</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Notification
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Notification</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {submitStatus && (
                <Alert variant={submitStatus.type === "error" ? "destructive" : "default"}>
                  <AlertDescription>{submitStatus.message}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                  placeholder="Notification title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={newNotification.message}
                  onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
                  placeholder="Notification message"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target">Target Audience</Label>
                <Select
                  value={newNotification.is_global ? "global" : newNotification.target_role || "all"}
                  onValueChange={(value) => {
                    if (value === "global") {
                      setNewNotification({
                        ...newNotification,
                        is_global: true,
                        target_role: null,
                      })
                    } else {
                      setNewNotification({
                        ...newNotification,
                        is_global: false,
                        target_role: value === "all" ? null : value,
                      })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (All Users)</SelectItem>
                    <SelectItem value="all">All Authenticated Users</SelectItem>
                    <SelectItem value="staff">Staff Only</SelectItem>
                    <SelectItem value="client">Clients Only</SelectItem>
                    <SelectItem value="admin">Admins Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateNotification}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <p>Are you sure you want to delete this notification? This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteNotification}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <div key={notification.id} className="py-4">
                  <div className="flex items-start">
                    <div className="mr-4">
                      <Bell className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="font-medium text-gray-700">{notification.title}</h3>
                        <span className="ml-2 px-2 py-0.5 bg-gray-100 text-xs rounded-full">
                          {notification.is_global
                            ? "Global"
                            : notification.target_role
                              ? `${notification.target_role.charAt(0).toUpperCase() + notification.target_role.slice(1)} Only`
                              : "All Users"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Created: {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => confirmDeleteNotification(notification.id)}
                      className="text-red-500 hover:text-red-700"
                      disabled={deletingNotificationId === notification.id}
                    >
                      {deletingNotificationId === notification.id ? (
                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></span>
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </button>
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
