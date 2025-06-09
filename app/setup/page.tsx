"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation" // For redirection
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { staffRoleNames, type StaffRole } from "@/lib/permissions"
import { AlertCircle, Info, Loader2 } from "lucide-react" // Added Info and Loader2

export default function SetupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("admin") // Default to admin for setup
  const [staffRole, setStaffRole] = useState<StaffRole>("senior_attorney") // Default staff role
  const [loading, setLoading] = useState(false) // For form submission
  const [message, setMessage] = useState("")
  const [error, setError] = useState("") // For form submission errors
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

  // New state variables for setup check
  const [isSetupCheckLoading, setIsSetupCheckLoading] = useState(true)
  const [isAdminSetupComplete, setIsAdminSetupComplete] = useState(false)
  const [setupCheckError, setSetupCheckError] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    const checkSetupStatus = async () => {
      setIsSetupCheckLoading(true)
      setSetupCheckError(null)
      try {
        const response = await fetch("/api/check-initial-setup-status")
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        if (data.isAdminSetupComplete) {
          setIsAdminSetupComplete(true)
          setMessage("Initial setup is complete. Admin user already exists. This page is no longer active.")
          // Optional: Redirect after a delay
          setTimeout(() => {
            router.push("/") // Redirect to login page
          }, 5000) // 5 seconds delay
        } else {
          setIsAdminSetupComplete(false)
        }
      } catch (err: any) {
        console.error("Error checking setup status:", err)
        setSetupCheckError(err.message || "Failed to check setup status.")
      } finally {
        setIsSetupCheckLoading(false)
      }
    }

    checkSetupStatus()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")
    setError("")
    setDebugInfo(null)

    // Basic validation
    if (password.length < 6) {
      setError("Password must be at least 6 characters long")
      setLoading(false)
      return
    }

    const userData = {
      email,
      password,
      fullName,
      role,
      staffRole: role === "staff" ? staffRole : null,
    }

    try {
      // Try the direct API first as it's most reliable
      const debugMessages = ["Attempting to create user..."]

      const response = await fetch("/api/create-user-direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      })

      const responseData = await response.json()

      if (response.ok) {
        debugMessages.push("User created successfully!")
        setMessage(
          `Success! User ${fullName} (${email}) created successfully with role: ${role}${
            role === "staff" ? ` (${staffRoleNames[staffRole]})` : ""
          }. ${responseData.note || "You can now log in with these credentials."}`,
        )

        // Clear the form
        setEmail("")
        setPassword("")
        setFullName("")
      } else {
        debugMessages.push(`API failed: ${responseData.error || "Unknown error"}`)
        throw new Error(responseData.error || "Failed to create user")
      }

      // Set debug info
      setDebugInfo(debugMessages.join("\n"))
    } catch (err: any) {
      console.error("Setup error:", err)
      setError(err.message || "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Initial Setup</CardTitle>
        </CardHeader>
        <CardContent>
          {isSetupCheckLoading && (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              <p className="ml-2 text-gray-600">Checking setup status...</p>
            </div>
          )}

          {setupCheckError && !isSetupCheckLoading && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Error checking setup status:</p>
                <p>{setupCheckError}</p>
              </div>
            </div>
          )}

          {isAdminSetupComplete && !isSetupCheckLoading && !setupCheckError && (
            <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 rounded flex items-start">
              <Info className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Setup Complete</p>
                <p>{message || "Initial setup is complete. Admin user already exists. This page is no longer active."}</p>
                <p className="mt-2 text-sm">You will be redirected to the login page shortly.</p>
              </div>
            </div>
          )}

          {!isSetupCheckLoading && !isAdminSetupComplete && !setupCheckError && (
            <>
              {error && ( // Form submission error
                <div className="mb-4 p-3 bg-red-100 text-red-800 rounded flex items-start">
                  <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                  <div>{error}</div>
                </div>
              )}

              {message && !isAdminSetupComplete && ( // Form submission success message
                 <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">{message}</div>
              )}

              {debugInfo && (
                <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded text-xs font-mono whitespace-pre-wrap">
                  {debugInfo}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
              <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Admin User"
                  required
                  disabled={isAdminSetupComplete || loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
              <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  disabled={isAdminSetupComplete || loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
              <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  required
                  minLength={6}
                  disabled={isAdminSetupComplete || loading}
                />
                <p className="text-xs text-gray-500">Password must be at least 6 characters long</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
              <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                  disabled={isAdminSetupComplete || loading}
                >
                  <option value="admin">Admin</option>
                  {/* Only admin can be created from setup page, other roles are for example or future use */}
                  {/* <option value="staff">Staff</option> */}
                  {/* <option value="client">Client</option> */}
                </select>
                 <p className="text-xs text-gray-500">Only an 'admin' user can be created during initial setup.</p>
              </div>

              {/* Conditional rendering for staffRole can be removed if only admin setup is allowed */}
              {/* {role === "staff" && (
                <div className="space-y-2">
                  <Label htmlFor="staffRole">Staff Role</Label>
                <select
                    id="staffRole"
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value as StaffRole)}
                    className="w-full p-2 border rounded"
                    required
                    disabled={isAdminSetupComplete || loading}
                  >
                    {Object.entries(staffRoleNames).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {staffRole === "senior_attorney" && "Full admin privileges, can manage all aspects of the system"}
                    {staffRole === "attorney" && "Can view all databases and edit most of them"}
                    {staffRole === "secretary" && "Can view all databases and manage users"}
                    {staffRole === "paralegal" && "Can view, assign, edit, create and delete records"}
                    {staffRole === "clerk" && "Can view all databases and manage users"}
                  </p>
                </div>
              )} */}

              <Button type="submit" className="w-full" disabled={isAdminSetupComplete || loading}>
                {loading ? "Creating Admin User..." : "Create Admin User"}
              </Button>
            </form>
          </>
        )}
        </CardContent>
      </Card>
    </div>
  )
}
