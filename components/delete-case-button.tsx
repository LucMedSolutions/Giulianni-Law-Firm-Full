"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

interface DeleteCaseButtonProps {
  caseId: string
  caseNumber: string
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
}

export default function DeleteCaseButton({
  caseId,
  caseNumber,
  variant = "destructive",
  size = "sm",
  className,
}: DeleteCaseButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const router = useRouter()
  const { toast } = useToast()

  const checkPermissions = async () => {
    try {
      const response = await fetch("/api/debug-permissions")
      const data = await response.json()
      setDebugInfo(data)
      console.log("Permission check:", data)

      if (!data.currentUser?.canDelete) {
        setError(
          `Insufficient permissions. Role: ${data.currentUser?.role}, Staff Role: ${data.currentUser?.staff_role}`,
        )
        return false
      }
      return true
    } catch (error: any) {
      console.error("Permission check failed:", error)
      setError("Failed to check permissions")
      return false
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      // First check permissions
      const hasPermission = await checkPermissions()
      if (!hasPermission) {
        return
      }

      console.log("Attempting to delete case:", caseId)

      const response = await fetch("/api/force-delete-case", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ caseId }),
      })

      const data = await response.json()
      console.log("Delete response:", data)

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${data.details || "Unknown error"}`)
      }

      toast({
        title: "Case deleted",
        description: `Case #${caseNumber} has been deleted successfully.`,
      })

      // Redirect to the appropriate dashboard
      router.push("/staff-dashboard/cases")
      router.refresh()
    } catch (error: any) {
      console.error("Error deleting case:", error)
      setError(error.message || "Failed to delete case")
      toast({
        title: "Error",
        description: error.message || "Failed to delete case",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setIsOpen(true)}>
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Case
      </Button>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete Case #{caseNumber} and all associated documents
              and records.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
              {debugInfo && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm">Debug Info</summary>
                  <pre className="text-xs mt-1 overflow-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
                </details>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Case"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
