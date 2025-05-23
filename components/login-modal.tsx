"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { setAdminStatus } from "@/lib/supabase/client"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  userType: "staff" | "client" | null
}

export default function LoginModal({ isOpen, onClose, userType }: LoginModalProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<any>(null)
  const [showRecoveryOption, setShowRecoveryOption] = useState(false)
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [recoverySuccess, setRecoverySuccess] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setShowRecoveryOption(false)
    setAuthUser(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      if (data?.user) {
        // Store the auth user in case we need it for recovery
        setAuthUser(data.user)

        // Get user role from the users table
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role, staff_role")
          .eq("id", data.user.id)
          .maybeSingle() // Use maybeSingle instead of single to handle no rows

        if (userError) {
          throw userError
        }

        if (!userData) {
          setShowRecoveryOption(true)
          throw new Error(
            "User profile not found in the system. This may happen if your account was recently created. You can try to recover your account below.",
          )
        }

        // Check if user role matches the selected login type
        if (userType === "staff" && userData.role !== "staff" && userData.role !== "admin") {
          await supabase.auth.signOut()
          throw new Error(
            `This account is registered as a ${userData.role}, not as staff. Please use the correct login option.`,
          )
        }

        if (userType === "client" && userData.role !== "client") {
          await supabase.auth.signOut()
          throw new Error(
            `This account is registered as a ${userData.role}, not as a client. Please use the correct login option.`,
          )
        }

        // Set admin status if the user is an admin
        if (userData.role === "admin") {
          await setAdminStatus(supabase, true)
        }

        // Update last_login timestamp
        await supabase.from("users").update({ last_login: new Date().toISOString() }).eq("id", data.user.id)

        // Redirect based on role
        if (userData.role === "admin") {
          router.push("/admin-dashboard")
        } else if (userData.role === "staff") {
          router.push("/staff-dashboard")
        } else if (userData.role === "client") {
          router.push("/client-dashboard")
        }
      }
    } catch (error: any) {
      setError(error.message || "An error occurred during login")
    } finally {
      setLoading(false)
    }
  }

  const handleRecoverAccount = async () => {
    if (!authUser) return

    setRecoveryLoading(true)
    setRecoveryError(null)
    setRecoverySuccess(false)

    try {
      // Get user metadata from auth
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError || !userData.user) {
        throw new Error("Could not retrieve user information")
      }

      const metadata = userData.user.user_metadata || {}
      const role = metadata.role || (userType === "staff" ? "staff" : "client")
      const staffRole = metadata.staff_role || null
      const fullName = metadata.full_name || email.split("@")[0]

      // Create the user record
      const response = await fetch("/api/recover-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: authUser.id,
          email: authUser.email,
          fullName,
          role,
          staffRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to recover user account")
      }

      setRecoverySuccess(true)

      // Wait a moment before redirecting
      setTimeout(() => {
        // Redirect based on role
        if (role === "admin") {
          router.push("/admin-dashboard")
        } else if (role === "staff") {
          router.push("/staff-dashboard")
        } else if (role === "client") {
          router.push("/client-dashboard")
        }
      }, 2000)
    } catch (error: any) {
      setRecoveryError(error.message || "An error occurred while recovering your account")
      console.error("Account recovery error:", error)
    } finally {
      setRecoveryLoading(false)
    }
  }

  const handleMagicLinkLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/${userType === "staff" ? "staff" : "client"}-dashboard`,
        },
      })

      if (error) {
        throw error
      }

      setEmail("")
      onClose()
      alert("Check your email for the login link")
    } catch (error: any) {
      setError(error.message || "An error occurred sending the magic link")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {userType === "staff" ? "Staff Login" : "Client Login"}
          </DialogTitle>
        </DialogHeader>

        {showRecoveryOption ? (
          <div className="space-y-4">
            <Alert variant="warning" className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Your account exists but is missing profile information. This can happen if your account was recently
                created. You can recover your account by clicking the button below.
              </AlertDescription>
            </Alert>

            {recoveryError && <div className="text-sm text-red-500">{recoveryError}</div>}

            {recoverySuccess && (
              <Alert variant="success" className="bg-green-50 border-green-200">
                <AlertDescription className="text-green-800">
                  Your account has been recovered successfully! You will be redirected shortly.
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleRecoverAccount}
              className="w-full bg-amber-600 hover:bg-amber-700"
              disabled={recoveryLoading}
            >
              {recoveryLoading ? "Recovering Account..." : "Recover My Account"}
            </Button>

            <Button variant="outline" onClick={() => setShowRecoveryOption(false)} className="w-full">
              Back to Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}

            <DialogFooter className="flex flex-col sm:flex-col gap-2 sm:gap-2">
              <Button type="submit" className="w-full bg-[#4a4a5e] hover:bg-[#3a3a4a]" disabled={loading}>
                {loading ? "Logging in..." : "Login with Password"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleMagicLinkLogin}
                disabled={loading || !email}
              >
                {loading ? "Sending..." : "Login with Magic Link"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
