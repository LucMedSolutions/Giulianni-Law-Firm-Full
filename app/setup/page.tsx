"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { staffRoleNames, type StaffRole } from "@/lib/permissions"
import { AlertCircle } from "lucide-react"

export default function SetupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("admin") // Default to admin for setup
  const [staffRole, setStaffRole] = useState<StaffRole>("senior_attorney") // Default staff role
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

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
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-800 rounded flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {message && <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">{message}</div>}

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
              >
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="client">Client</option>
              </select>
            </div>

            {role === "staff" && (
              <div className="space-y-2">
                <Label htmlFor="staffRole">Staff Role</Label>
                <select
                  id="staffRole"
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as StaffRole)}
                  className="w-full p-2 border rounded"
                  required
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
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create User"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
