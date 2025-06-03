import { createClientComponentClient, createServerComponentClient } from "@supabase/auth-helpers-nextjs"

// Define permission types
export type Permission =
  | "view_all_cases"
  | "view_assigned_cases"
  | "create_case"
  | "edit_case"
  | "delete_case"
  | "assign_case"
  | "unassign_case"
  | "view_all_documents"
  | "view_assigned_documents"
  | "upload_document"
  | "delete_document"
  | "manage_users"
  | "view_all_users"
  | "admin_access"

// Define staff role types
export type StaffRole = "senior_attorney" | "attorney" | "secretary" | "paralegal" | "clerk"

// Staff role display names
export const staffRoleNames: Record<StaffRole, string> = {
  senior_attorney: "Senior Attorney",
  attorney: "Attorney",
  secretary: "Secretary",
  paralegal: "Paralegal",
  clerk: "Clerk",
}

// Permission display names
export const permissionNames: Record<Permission, string> = {
  view_all_cases: "View All Cases",
  view_assigned_cases: "View Assigned Cases",
  create_case: "Create Cases",
  edit_case: "Edit Cases",
  delete_case: "Delete Cases",
  assign_case: "Assign Cases",
  unassign_case: "Unassign Cases",
  view_all_documents: "View All Documents",
  view_assigned_documents: "View Documents for Assigned Cases",
  upload_document: "Upload Documents",
  delete_document: "Delete Documents",
  manage_users: "Manage Users",
  view_all_users: "View All Users",
  admin_access: "Full Administrative Access",
}

// Default permissions for each staff role
export const defaultRolePermissions: Record<StaffRole, Permission[]> = {
  senior_attorney: [
    "view_all_cases",
    "view_assigned_cases",
    "create_case",
    "edit_case",
    "delete_case",
    "assign_case",
    "unassign_case",
    "view_all_documents",
    "view_assigned_documents",
    "upload_document",
    "delete_document",
  ],
  attorney: [
    "view_assigned_cases",
    "create_case",
    "edit_case",
    "delete_case",
    "view_assigned_documents",
    "upload_document",
  ],
  secretary: [
    "view_all_cases",
    "view_assigned_cases",
    "create_case",
    "edit_case",
    "delete_case",
    "view_all_documents",
    "view_assigned_documents",
    "upload_document",
  ],
  paralegal: ["view_assigned_cases", "view_assigned_documents", "upload_document"],
  clerk: ["view_assigned_cases", "view_assigned_documents"],
}

// Client-side permission check
export async function hasPermission(permission: Permission): Promise<boolean> {
  const supabase = createClientComponentClient()

  try {
    const { data: session } = await supabase.auth.getSession()

    if (!session.session) {
      return false
    }

    const { data, error } = await supabase.rpc("user_has_permission", {
      user_id: session.session.user.id,
      permission_name: permission,
    })

    if (error) {
      console.error("Permission check error:", error)
      return false
    }

    return data
  } catch (error) {
    console.error("Permission check error:", error)
    return false
  }
}

// Server-side permission check
export async function hasPermissionServer(userId: string, permission: Permission, cookieStore: ReturnType<typeof import("next/headers").cookies>): Promise<boolean> {
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  try {
    const { data, error } = await supabase.rpc("user_has_permission", {
      user_id: userId,
      permission_name: permission,
    })

    if (error) {
      console.error("Permission check error:", error)
      return false
    }

    return data
  } catch (error) {
    console.error("Permission check error:", error)
    return false
  }
}

// Get all permissions for a staff role
export async function getPermissionsForRole(role: StaffRole): Promise<Permission[]> {
  const supabase = createClientComponentClient()

  try {
    const { data, error } = await supabase
      .from("role_permissions_view")
      .select("permission_name")
      .eq("staff_role", role)

    if (error) {
      console.error("Get permissions error:", error)
      return []
    }

    return data.map((item) => item.permission_name as Permission)
  } catch (error) {
    console.error("Get permissions error:", error)
    return []
  }
}

// Get user's staff role
export async function getUserStaffRole(): Promise<StaffRole | null> {
  const supabase = createClientComponentClient()

  try {
    const { data: session } = await supabase.auth.getSession()

    if (!session.session) {
      return null
    }

    const { data, error } = await supabase
      .from("users")
      .select("staff_role")
      .eq("id", session.session.user.id)
      .maybeSingle()

    if (error || !data) {
      console.error("Get staff role error:", error)
      return null
    }

    return data.staff_role
  } catch (error) {
    console.error("Get staff role error:", error)
    return null
  }
}

// Check if user can delete cases
export async function canDeleteCase(): Promise<boolean> {
  const supabase = createClientComponentClient()

  try {
    const { data: session } = await supabase.auth.getSession()

    if (!session.session) {
      return false
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role, staff_role")
      .eq("id", session.session.user.id)
      .single()

    if (userError || !userData) {
      console.error("Get user role error:", userError)
      return false
    }

    if (userData.role === "admin") {
      return true
    }

    if (userData.role === "staff" && ["senior_attorney", "attorney", "secretary"].includes(userData.staff_role || "")) {
      return true
    }

    return false
  } catch (error) {
    console.error("Permission check error:", error)
    return false
  }
}
