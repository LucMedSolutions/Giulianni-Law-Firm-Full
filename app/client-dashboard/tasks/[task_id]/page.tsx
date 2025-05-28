"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Info, CheckCircle, XCircle, Loader2 } from "lucide-react"

// Define a type for the task status object from the backend
interface TaskStatusData {
  status: string
  message: string
  last_updated: string
  // 'details' field from crew_runner.py for 'completed' or 'error' status
  // In crew_runner, this was 'results' for success, and 'message' for error.
  // And 'details' for status updates. Let's assume it comes as 'details' or 'results'.
  details?: any 
  results?: any // Added to cover the case from run_crew directly
}


export default function TaskStatusPage() {
  const params = useParams()
  const taskId = params.task_id as string

  const [taskStatus, setTaskStatus] = useState<TaskStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null)

  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const router = useRouter()

  const fetchStatus = useCallback(async (currentTaskId: string) => {
    if (!currentTaskId) return

    // Only set loading to true on initial fetch or if explicitly needed
    if (!taskStatus) {
      setLoading(true)
    }

    try {
      const response = await fetch(`http://localhost:8000/agent-status/?task_id=${currentTaskId}`)
      
      if (response.ok) {
        const data: TaskStatusData = await response.json()
        setTaskStatus(data)
        setError(null) // Clear previous errors on successful fetch

        if (data.status === "completed" || data.status === "error") {
          if (pollingIntervalId) {
            clearInterval(pollingIntervalId)
            setPollingIntervalId(null)
          }
          // Display toast for final states
          if (data.status === "completed") {
            toast({ title: "Task Completed", description: data.message })
          } else {
            toast({ title: "Task Error", description: data.message, variant: "destructive" })
          }
        }
      } else if (response.status === 404) {
        setError(`Task with ID '${currentTaskId}' not found.`)
        if (pollingIntervalId) {
          clearInterval(pollingIntervalId)
          setPollingIntervalId(null)
        }
        toast({ title: "Error", description: "Task not found.", variant: "destructive"})
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.detail || `Failed to fetch task status (HTTP ${response.status}).`)
        if (pollingIntervalId) {
          clearInterval(pollingIntervalId)
          setPollingIntervalId(null)
        }
        toast({ title: "Error", description: `Failed to fetch status.`, variant: "destructive"})
      }
    } catch (err) {
      console.error("Fetch status error:", err)
      setError("An error occurred while fetching status. Please check your connection.")
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId)
        setPollingIntervalId(null)
      }
       toast({ title: "Network Error", description: "Could not connect to the server.", variant: "destructive"})
    } finally {
      // Only stop global loading after the first successful fetch or if an error stops polling
      if (taskStatus || error) { // if taskStatus is not null OR error is set, then global loading is done
         setLoading(false)
      }
      if (!taskStatus && error) { // If it was an initial load error
        setLoading(false)
      }
    }
  }, [pollingIntervalId, taskStatus, error, toast]) // Added error to dependencies

  useEffect(() => {
    if (taskId) {
      fetchStatus(taskId) // Initial fetch

      const intervalId = setInterval(() => {
        // Check if polling should continue
        if (taskStatus && (taskStatus.status === "completed" || taskStatus.status === "error")) {
          clearInterval(intervalId)
          setPollingIntervalId(null) // Ensure it's cleared
        } else {
          fetchStatus(taskId)
        }
      }, 5000)
      setPollingIntervalId(intervalId)

      return () => {
        if (intervalId) {
          clearInterval(intervalId)
        }
      }
    }
  }, [taskId, fetchStatus]) // fetchStatus is now memoized with useCallback

  const renderStatusIcon = () => {
    if (!taskStatus) return <Loader2 className="h-5 w-5 animate-spin mr-2" />
    switch (taskStatus.status) {
      case "pending":
      case "in_progress":
        return <Loader2 className="h-5 w-5 animate-spin mr-2 text-blue-500" />
      case "completed":
        return <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
      case "error":
        return <XCircle className="h-5 w-5 mr-2 text-red-500" />
      default:
        return <Info className="h-5 w-5 mr-2 text-gray-500" />
    }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 p-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold ml-2">Task Status</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                {renderStatusIcon()}
                Task Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && !taskStatus && <p className="text-center py-4">Loading task status...</p>}
              
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {taskStatus && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="taskId" className="font-semibold">Task ID:</Label>
                    <p id="taskId" className="text-sm text-gray-700 break-all">{taskId}</p>
                  </div>
                  <div>
                    <Label htmlFor="status" className="font-semibold">Status:</Label>
                    <p id="status" className="text-sm font-medium capitalize">
                      {taskStatus.status.replace("_", " ")}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="message" className="font-semibold">Message:</Label>
                    <p id="message" className="text-sm text-gray-700">{taskStatus.message}</p>
                  </div>
                  <div>
                    <Label htmlFor="lastUpdated" className="font-semibold">Last Updated:</Label>
                    <p id="lastUpdated" className="text-sm text-gray-700">
                      {new Date(taskStatus.last_updated).toLocaleString()}
                    </p>
                  </div>

                  {(taskStatus.status === "pending" || taskStatus.status === "in_progress") && (
                    <div>
                      <Label className="font-semibold">Progress</Label>
                      <Progress value={taskStatus.status === "in_progress" ? 50 : 25} className="mt-1" /> 
                      {/* Placeholder progress value */}
                    </div>
                  )}

                  {taskStatus.status === "completed" && (taskStatus.details || taskStatus.results) && (
                    <div>
                      <Label className="font-semibold">Results:</Label>
                      <pre className="mt-1 p-3 bg-gray-100 rounded-md text-sm overflow-x-auto">
                        {JSON.stringify(taskStatus.details || taskStatus.results, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {taskStatus.status === "error" && taskStatus.details && (
                     <div>
                      <Label className="font-semibold">Error Details:</Label>
                      <pre className="mt-1 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm overflow-x-auto">
                        {JSON.stringify(taskStatus.details, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="pt-4">
                     <Button variant="outline" onClick={() => fetchStatus(taskId)} disabled={loading || (taskStatus?.status === 'completed' || taskStatus?.status === 'error')}>
                        Refresh Status
                     </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
