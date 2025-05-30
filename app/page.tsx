"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, HelpCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        setCheckingAuth(true)

        // Check if user is already authenticated
        const response = await fetch("/api/check-auth", {
          method: "GET",
          credentials: "include",
        })

        if (response.ok) {
          const data = await response.json()
          if (data.authenticated && data.role) {
            // Redirect based on role
            switch (data.role) {
              case "admin":
                router.push("/admin-dashboard")
                break
              case "staff":
                router.push("/staff-dashboard")
                break
              case "client":
                router.push("/client-dashboard")
                break
              default:
                setError("Invalid user role. Please contact support.")
            }
            return
          }
        }
      } catch (authError: any) {
        console.log("Auth check error:", authError.message)
        // If auth check fails, just continue to login page
      } finally {
        setCheckingAuth(false)
      }
    }

    checkExistingAuth()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Login failed")
      }

      if (!data.success || !data.role) {
        throw new Error("Invalid login response")
      }

      // Redirect based on role
      switch (data.role) {
        case "admin":
          router.push("/admin-dashboard")
          break
        case "staff":
          router.push("/staff-dashboard")
          break
        case "client":
          router.push("/client-dashboard")
          break
        default:
          throw new Error("Invalid user role. Please contact support.")
      }
    } catch (err: any) {
      console.error("Login error:", err)
      setError(err.message || "Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-blue-500 border-b-blue-500 border-gray-200 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Image src="/logo.png" alt="Giuliani Law Firm" width={200} height={80} className="mx-auto mb-6" priority />
          <h2 className="text-3xl font-bold text-gray-900">Client Portal</h2>
          <p className="mt-2 text-sm text-gray-600">Sign in to access your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the portal</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Enter your email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Enter your password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                <HelpCircle className="h-4 w-4 mr-2" />
                Need Help?
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Portal Help & Support</DialogTitle>
                <DialogDescription>
                  Find answers to common questions and get support for accessing your account.
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="login">Login Help</TabsTrigger>
                  <TabsTrigger value="account">Account Issues</TabsTrigger>
                  <TabsTrigger value="technical">Technical Support</TabsTrigger>
                  <TabsTrigger value="contact">Contact Us</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-4">
                  <h3 className="text-lg font-semibold">Login Assistance</h3>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium">Forgot Your Password?</h4>
                      <p className="text-sm text-gray-600">
                        Contact our support team at support@giulianilawfirm.com to reset your password. For security
                        reasons, password resets must be handled by our staff.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Account Locked?</h4>
                      <p className="text-sm text-gray-600">
                        If you've attempted to log in multiple times unsuccessfully, your account may be temporarily
                        locked. Please wait 15 minutes before trying again, or contact support for immediate assistance.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">First Time Logging In?</h4>
                      <p className="text-sm text-gray-600">
                        New clients should have received login credentials via email. If you haven't received your
                        credentials, please contact our office directly.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="account" className="space-y-4">
                  <h3 className="text-lg font-semibold">Account Issues</h3>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium">Can't Access Your Case Information?</h4>
                      <p className="text-sm text-gray-600">
                        Ensure you're using the correct email address associated with your case. If you've recently
                        changed your email, please notify our office to update your account.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Missing Documents?</h4>
                      <p className="text-sm text-gray-600">
                        Documents are uploaded by your legal team as they become available. If you're expecting specific
                        documents, please contact your assigned attorney or case manager.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Account Permissions</h4>
                      <p className="text-sm text-gray-600">
                        Your account access is configured based on your case requirements. If you need access to
                        additional features, please discuss this with your legal team.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="technical" className="space-y-4">
                  <h3 className="text-lg font-semibold">Technical Support</h3>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium">Browser Compatibility</h4>
                      <p className="text-sm text-gray-600">
                        This portal works best with modern browsers including Chrome, Firefox, Safari, and Edge. Please
                        ensure your browser is up to date.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Mobile Access</h4>
                      <p className="text-sm text-gray-600">
                        The portal is optimized for mobile devices. If you're experiencing issues on mobile, try
                        accessing from a desktop computer or contact support.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Document Download Issues</h4>
                      <p className="text-sm text-gray-600">
                        If documents won't download, check your browser's download settings and ensure pop-ups are
                        allowed for this site. Some corporate firewalls may block downloads.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Clearing Browser Cache</h4>
                      <p className="text-sm text-gray-600">
                        If you're experiencing unusual behavior, try clearing your browser cache and cookies, then log
                        in again.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="contact" className="space-y-4">
                  <h3 className="text-lg font-semibold">Contact Information</h3>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium">Technical Support</h4>
                      <p className="text-sm text-gray-600">
                        Email: support@giulianilawfirm.com
                        <br />
                        Phone: (555) 123-4567
                        <br />
                        Hours: Monday-Friday, 9 AM - 5 PM EST
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Legal Team</h4>
                      <p className="text-sm text-gray-600">
                        For case-related questions, please contact your assigned attorney or case manager directly, or
                        use the secure messaging system within the portal.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Office Location</h4>
                      <p className="text-sm text-gray-600">
                        Giuliani Law Firm
                        <br />
                        123 Legal Street
                        <br />
                        New York, NY 10001
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Emergency Contact</h4>
                      <p className="text-sm text-gray-600">
                        For urgent legal matters outside business hours, please call our emergency line at (555)
                        123-4568.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
