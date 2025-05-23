"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Inbox, User, HelpCircle, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"

export default function AccountSettingsPage() {
  const [userData, setUserData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

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
          .select("role, full_name, email")
          .eq("id", session.user.id)
          .maybeSingle()

        if (userError) {
          throw userError
        }

        if (!user) {
          throw new Error("User profile not found. Please contact an administrator.")
        }

        setUserData(user)

        // Count unread notifications
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
        setError(err.message || "An error occurred while loading user information")
        console.error("Account settings page error:", err)
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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate passwords
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must match.",
        variant: "destructive",
      })
      return
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        throw error
      }

      // Clear form
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")

      toast({
        title: "Password updated",
        description: "Your password has been successfully changed.",
        variant: "default",
      })
    } catch (err: any) {
      toast({
        title: "Error updating password",
        description: err.message || "There was a problem updating your password.",
        variant: "destructive",
      })
      console.error("Password update error:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading account information...</p>
      </div>
    )
  }

  if (error || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Failed to load account information"}</p>
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
                className="block px-4 py-2 font-medium text-gray-600 hover:bg-gray-100"
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
            <h1 className="text-lg font-medium">Account Settings</h1>
            <p className="text-sm text-gray-600">Manage your account preferences and security</p>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/staff-dashboard/inbox" className="relative">
              <Inbox className="h-6 w-6 text-gray-700" />
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

        {/* Account Settings Content */}
        <div className="flex-1 p-6 bg-gray-50">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>User Information</CardTitle>
                <CardDescription>Your account details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input id="fullName" value={userData.full_name} disabled />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" value={userData.email} disabled />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Input id="role" value={userData.role.charAt(0).toUpperCase() + userData.role.slice(1)} disabled />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <form onSubmit={handlePasswordChange}>
                <CardContent>
                  <div className="space-y-4">
                    <div className="relative">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-500" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-500" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-500" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Updating..." : "Update Password"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
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
      <Toaster />
    </div>
  )
}
