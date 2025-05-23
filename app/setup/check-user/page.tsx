"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import Link from "next/link"
import { staffRoleNames } from "@/lib/permissions"

export default function CheckUserPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setError("")

    try {
      const response = await fetch("/api/check-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to check user")
      }

      setResult(data)
    } catch (err: any) {
      setError(err.message || "An error occurred while checking the user")
      console.error("Check user error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check User Account</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter user email"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Checking..." : "Check User"}
            </Button>
          </form>

          {result && (
            <div className="mt-6 p-4 bg-gray-100 rounded-md">
              <h3 className="font-medium mb-2">Results:</h3>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>User exists in Auth:</strong> {result.exists ? "Yes" : "No"}
                </p>

                {result.authUser && (
                  <>
                    <p>
                      <strong>Auth User ID:</strong> {result.authUser.id}
                    </p>
                    <p>
                      <strong>Email:</strong> {result.authUser.email}
                    </p>
                    <p>
                      <strong>Email Confirmed:</strong> {result.authUser.emailConfirmed ? "Yes" : "No"}
                    </p>
                    <p>
                      <strong>Created At:</strong> {new Date(result.authUser.createdAt).toLocaleString()}
                    </p>
                  </>
                )}

                <p>
                  <strong>User exists in Users table:</strong> {result.userData ? "Yes" : "No"}
                </p>

                {result.userData && (
                  <>
                    <p>
                      <strong>User Role:</strong> {result.userData.role}
                    </p>
                    {result.userData.role === "staff" && result.userData.staff_role && (
                      <p>
                        <strong>Staff Role:</strong>{" "}
                        {staffRoleNames[result.userData.staff_role] || result.userData.staff_role}
                      </p>
                    )}
                    <p>
                      <strong>Full Name:</strong> {result.userData.full_name}
                    </p>
                  </>
                )}

                {result.userTableError && (
                  <p className="text-red-600">
                    <strong>User Table Error:</strong> {result.userTableError}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Link href="/setup" className="w-full">
            <Button variant="outline" className="w-full">
              Back to Setup
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
