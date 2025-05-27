"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, AlertCircle, Database, ExternalLink } from "lucide-react"

export default function StoragePage() {
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [bucketExists, setBucketExists] = useState(false)
  const [bucketPublic, setBucketPublic] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    checkStorageStatus()
  }, [])

  const checkStorageStatus = async () => {
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
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle()

      if (userError) throw userError
      if (!user || user.role !== "admin") {
        router.push("/")
        return
      }

      // Check if documents bucket exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

      if (bucketsError) {
        console.error("Error listing buckets:", bucketsError)
        setBucketExists(false)
        setBucketPublic(false)
      } else {
        const documentsBucket = buckets.find((bucket) => bucket.name === "documents")
        setBucketExists(!!documentsBucket)
        setBucketPublic(documentsBucket?.public || false)
      }
    } catch (err: any) {
      console.error("Error checking storage status:", err)
      setError(err.message || "Failed to check storage status")
    } finally {
      setLoading(false)
    }
  }

  const createStorageBucket = async () => {
    setCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/create-storage-bucket", {
        method: "POST",
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create storage bucket")
      }

      setSuccess(result.message)
      setBucketExists(true)
      setBucketPublic(true)
    } catch (err: any) {
      console.error("Error creating storage bucket:", err)
      setError(err.message || "Failed to create storage bucket")
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-t-blue-500 border-blue-200 rounded-full animate-spin"></div>
        <span className="ml-2">Checking storage status...</span>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Storage Management</h1>
          <p className="text-gray-500">Manage Supabase storage buckets for document uploads</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="h-5 w-5 mr-2" />
              Documents Storage Bucket Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  {bucketExists ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-green-700">Bucket exists</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-500" />
                      <span className="text-red-700">Bucket missing</span>
                    </>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {bucketPublic ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-green-700">Public access enabled</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-500" />
                      <span className="text-red-700">Public access disabled</span>
                    </>
                  )}
                </div>
              </div>

              {(!bucketExists || !bucketPublic) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-yellow-400 mr-2 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-yellow-800">Storage Configuration Required</h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        {!bucketExists && "The documents storage bucket needs to be created. "}
                        {!bucketPublic && "Public access must be enabled for downloads to work properly."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <XCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-red-800">Error</h3>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-green-800">Success</h3>
                      <p className="text-sm text-green-700 mt-1">{success}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-4">
                {(!bucketExists || !bucketPublic) && (
                  <Button onClick={createStorageBucket} disabled={creating}>
                    {creating ? "Setting up..." : "Setup Storage Bucket"}
                  </Button>
                )}
                <Button variant="outline" onClick={checkStorageStatus}>
                  Refresh Status
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/project/default/storage/buckets`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Supabase Dashboard
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storage Configuration Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Bucket Settings</h3>
                <ul className="text-sm text-gray-600 mt-1 space-y-1">
                  <li>
                    • <strong>Name:</strong> documents
                  </li>
                  <li>
                    • <strong>Public access:</strong> Enabled (required for downloads)
                  </li>
                  <li>
                    • <strong>File size limit:</strong> 50MB
                  </li>
                  <li>
                    • <strong>Allowed types:</strong> PDF, Word, Images, Excel, Text
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900">Troubleshooting</h3>
                <ul className="text-sm text-gray-600 mt-1 space-y-1">
                  <li>• If downloads fail, ensure the bucket has public access enabled</li>
                  <li>• Check that files are being uploaded to the correct bucket path</li>
                  <li>• Verify storage URLs are properly formatted</li>
                  <li>• Use the "Refresh link" button on documents if URLs are outdated</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900">Manual Setup</h3>
                <p className="text-sm text-gray-600 mt-1">
                  If automatic setup fails, manually create a bucket named "documents" in your Supabase dashboard and
                  ensure it has public access enabled.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
