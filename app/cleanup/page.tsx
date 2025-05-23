"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"

export default function CleanupPage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{
    deleted: string[]
    warnings: string[]
    errors: string[]
  } | null>(null)

  const handleCleanup = async () => {
    if (!confirm("Are you sure you want to delete ALL users? This action cannot be undone.")) {
      return
    }

    setLoading(true)
    setResults(null)

    try {
      const response = await fetch("/api/cleanup-database-direct", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "An error occurred during cleanup")
      }

      setResults(data.results || { deleted: [], warnings: [], errors: [] })
    } catch (err: any) {
      setResults({
        deleted: [],
        warnings: [],
        errors: [err.message || "An unexpected error occurred"],
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-3xl py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Database Cleanup Utility</CardTitle>
          <CardDescription>
            This utility will delete ALL users from the database and authentication system. Use with caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
                <div>
                  <h3 className="text-sm font-medium text-amber-800">Warning</h3>
                  <div className="mt-1 text-sm text-amber-700">
                    <p>
                      This action will permanently delete all users from the system. After deletion, you will need to
                      create a new admin user through the setup page.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Button variant="destructive" onClick={handleCleanup} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cleaning Up Database...
                </>
              ) : (
                "Delete All Users"
              )}
            </Button>

            {results && (
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-medium">Results</h3>

                {results.deleted.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-4">
                    <div className="flex">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      <div>
                        <h4 className="text-sm font-medium text-green-800">
                          Successfully deleted {results.deleted.length} users
                        </h4>
                        <ul className="mt-2 text-sm text-green-700 list-disc list-inside max-h-40 overflow-y-auto">
                          {results.deleted.map((user, i) => (
                            <li key={i}>{user}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {results.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <div className="flex">
                      <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                      <div>
                        <h4 className="text-sm font-medium text-yellow-800">Warnings ({results.warnings.length})</h4>
                        <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside max-h-40 overflow-y-auto">
                          {results.warnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {results.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex">
                      <XCircle className="h-5 w-5 text-red-500 mr-2" />
                      <div>
                        <h4 className="text-sm font-medium text-red-800">Errors ({results.errors.length})</h4>
                        <ul className="mt-2 text-sm text-red-700 list-disc list-inside max-h-40 overflow-y-auto">
                          {results.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
          <Button asChild>
            <Link href="/setup">Go to Setup</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
