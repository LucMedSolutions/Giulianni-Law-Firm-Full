"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Users, UserPlus } from "lucide-react"

interface User {
  id: string
  email: string
  full_name: string
  role: string
  staff_role: string
}

interface CaseAssignment {
  id: string
  user_id: string
  role: string
  assigned_at: string
  user: {
    full_name: string
    email: string
    staff_role: string
  }
}

interface CaseAssignmentManagerProps {
  caseId: string
  caseNumber: string
}

export default function CaseAssignmentManager({ caseId, caseNumber }: CaseAssignmentManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [assignments, setAssignments] = useState<CaseAssignment[]>([])
  const [staffUsers, setStaffUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [selectedRole, setSelectedRole] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("case_assignments")
        .select(`
          id,
          user_id,
          role,
          assigned_at,
          user:user_id (
            full_name,
            email,
            staff_role
          )
        `)
        .eq("case_id", caseId)

      if (error) {
        throw error
      }

      setAssignments(data || [])
    } catch (error: any) {
      console.error("Error fetching case assignments:", error)
      toast({
        title: "Error",
        description: `Failed to load case assignments: ${error.message}`,
        variant: "destructive",
      })
    }
  }

  const fetchStaffUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, full_name, role, staff_role")
        .in("role", ["staff", "admin"])
        .order("full_name")

      if (error) {
        throw error
      }

      setStaffUsers(data || [])
    } catch (error: any) {
      console.error("Error fetching staff users:", error)
      toast({
        title: "Error",
        description: `Failed to load staff users: ${error.message}`,
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    fetchAssignments()
    fetchStaffUsers()
  }, [caseId])

  const handleAssign = async () => {
    if (!selectedUserId || !selectedRole) {
      toast({
        title: "Missing information",
        description: "Please select both a user and a role",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Check if assignment already exists
      const { data: existingAssignment } = await supabase
        .from("case_assignments")
        .select("id")
        .eq("case_id", caseId)
        .eq("user_id", selectedUserId)
        .eq("role", selectedRole)
        .maybeSingle()

      if (existingAssignment) {
        toast({
          title: "Assignment exists",
          description: "This user is already assigned to this case with this role",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      // Get current user
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error("Not authenticated")
      }

      // Create assignment
      const { error } = await supabase.from("case_assignments").insert({
        case_id: caseId,
        user_id: selectedUserId,
        role: selectedRole,
        assigned_by: session.user.id,
      })

      if (error) {
        throw error
      }

      // Log the action
      await supabase.from("audit_logs").insert({
        user_id: session.user.id,
        action: "create",
        resource_type: "case_assignment",
        resource_id: caseId,
        details: `User assigned to case #${caseNumber} with role ${selectedRole}`,
      })

      toast({
        title: "User assigned",
        description: `User has been assigned to case #${caseNumber}`,
      })

      // Reset form and refresh assignments
      setSelectedUserId("")
      setSelectedRole("")
      fetchAssignments()
    } catch (error: any) {
      console.error("Error assigning user to case:", error)
      toast({
        title: "Error",
        description: `Failed to assign user: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveAssignment = async (assignmentId: string, userName: string, role: string) => {
    try {
      // Get current user
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error("Not authenticated")
      }

      const { error } = await supabase.from("case_assignments").delete().eq("id", assignmentId)

      if (error) {
        throw error
      }

      // Log the action
      await supabase.from("audit_logs").insert({
        user_id: session.user.id,
        action: "delete",
        resource_type: "case_assignment",
        resource_id: caseId,
        details: `User ${userName} removed from case #${caseNumber} (role: ${role})`,
      })

      toast({
        title: "Assignment removed",
        description: `${userName} has been removed from case #${caseNumber}`,
      })

      fetchAssignments()
    } catch (error: any) {
      console.error("Error removing case assignment:", error)
      toast({
        title: "Error",
        description: `Failed to remove assignment: ${error.message}`,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Case Assignments</h3>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Assign User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign User to Case #{caseNumber}</DialogTitle>
              <DialogDescription>Select a user and role to assign to this case.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="user">User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger id="user">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name} ({user.staff_role || user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead_attorney">Lead Attorney</SelectItem>
                    <SelectItem value="associate_attorney">Associate Attorney</SelectItem>
                    <SelectItem value="paralegal">Paralegal</SelectItem>
                    <SelectItem value="legal_assistant">Legal Assistant</SelectItem>
                    <SelectItem value="case_manager">Case Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={isLoading}>
                {isLoading ? "Assigning..." : "Assign User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-md">
          <Users className="h-8 w-8 mx-auto text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">No users assigned to this case yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Role</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Staff Position</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Assigned</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{assignment.user.full_name}</td>
                    <td className="px-4 py-3 capitalize">{assignment.role.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 capitalize">{assignment.user.staff_role?.replace(/_/g, " ") || "-"}</td>
                    <td className="px-4 py-3">{new Date(assignment.assigned_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleRemoveAssignment(assignment.id, assignment.user.full_name, assignment.role)
                        }
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
