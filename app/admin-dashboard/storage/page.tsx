"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

export default function StorageManagementPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    success?: boolean
    message?: string
    error?: string
  } | null>(null)

  const createBucket = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/create-storage-bucket")
      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: data.message || "Bucket created successfully",
        })
      } else {
        setResult({
          success: false,
          error: data.error || "Failed to create bucket",
        })
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Storage Management</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create Storage Bucket</CardTitle>
          <CardDescription>Create the "documents" storage bucket for file uploads</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            This will create a new storage bucket named "documents" in your Supabase project. After creation, you'll
            need to set up access policies in the Supabase dashboard.
          </p>

          {result && (
            <Alert className={`mb-4 ${result.success ? "bg-green-50" : "bg-red-50"}`}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
              <AlertDescription>{result.success ? result.message : result.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={createBucket} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Documents Bucket"
            )}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual Setup Instructions</CardTitle>
          <CardDescription>If the automatic creation doesn't work, follow these steps</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Go to your Supabase project dashboard</li>
            <li>Click on "Storage" in the left sidebar</li>
            <li>Click "Create bucket"</li>
            <li>Enter "documents" as the bucket name</li>
            <li>Choose whether it should be public or private (private is recommended)</li>
            <li>Click "Create bucket"</li>
            <li>Go to the "Policies" tab for your new bucket</li>
            <li>Create policies for INSERT, SELECT, UPDATE, and DELETE operations</li>
            <li>For a simple setup, allow all authenticated users to perform these operations</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
