"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react"

export default function ConfirmEmailPage() {
  const [email, setEmail] = useState("lucmedsolutions@gmail.com")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [details, setDetails] = useState<any>(null)

  const handleConfirmEmail = async () => {
    if (!email) {
      setStatus("error")
      setMessage("Email is required")
      return
    }

    try {
      setStatus("loading")
      setMessage("Confirming email...")

      const response = await fetch("/api/admin-confirm-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to confirm email")
      }

      setStatus("success")
      setMessage(data.message)
      setDetails(data)
    } catch (error) {
      console.error("Error confirming email:", error)
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "An unexpected error occurred")
    }
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Confirm Email Address</CardTitle>
          <CardDescription>Manually confirm a user's email address in the system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          {status === "success" && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Success</AlertTitle>
              <AlertDescription className="text-green-700">
                {message}
                {details && details.user && (
                  <div className="mt-2 text-xs">
                    <p>User ID: {details.user.id}</p>
                    <p>Email: {details.user.email}</p>
                    <p>Confirmed at: {new Date(details.user.confirmed_at).toLocaleString()}</p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-800">Error</AlertTitle>
              <AlertDescription className="text-red-700">{message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleConfirmEmail} disabled={status === "loading" || !email} className="w-full">
            {status === "loading" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              "Confirm Email"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
