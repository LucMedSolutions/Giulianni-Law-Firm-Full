import { createClientComponentClient, createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export type AuditAction =
  | "login"
  | "logout"
  | "create_user"
  | "delete_user"
  | "update_user"
  | "create_notification"
  | "delete_notification"
  | "create_case"
  | "update_case"
  | "delete_case"
  | "upload_document"
  | "delete_document"
  | "view_document"
  | "admin_action"

export interface AuditLogEntry {
  user_id: string
  action: AuditAction
  details: string
  resource_type?: string
  resource_id?: string
  ip_address?: string
  document_id?: string // Add document_id to the interface
}

// Client-side audit logging
export async function logAuditEvent(entry: AuditLogEntry) {
  const supabase = createClientComponentClient()

  try {
    // Create a base log entry with required fields
    const logEntry: Record<string, any> = {
      user_id: entry.user_id,
      action: entry.action,
      details: entry.details,
      // Add a default document_id if not provided
      document_id: entry.document_id || "00000000-0000-0000-0000-000000000000", // Default UUID
    }

    // Add optional fields if provided
    if (entry.resource_type) {
      logEntry.resource_type = entry.resource_type
    }

    if (entry.resource_id) {
      logEntry.resource_id = entry.resource_id
    }

    if (entry.ip_address) {
      logEntry.ip_address = entry.ip_address
    } else {
      logEntry.ip_address = "client-side"
    }

    // Insert the log entry
    const { error } = await supabase.from("audit_logs").insert(logEntry)

    if (error) {
      console.error("Error logging audit event:", error)
    }
  } catch (error) {
    console.error("Failed to log audit event:", error)
  }
}

// Server-side audit logging
export async function logAuditEventServer(entry: AuditLogEntry) {
  const supabase = createServerComponentClient({ cookies })

  try {
    // Create a base log entry with required fields
    const logEntry: Record<string, any> = {
      user_id: entry.user_id,
      action: entry.action,
      details: entry.details,
      // Add a default document_id if not provided
      document_id: entry.document_id || "00000000-0000-0000-0000-000000000000", // Default UUID
    }

    // Add optional fields if provided
    if (entry.resource_type) {
      logEntry.resource_type = entry.resource_type
    }

    if (entry.resource_id) {
      logEntry.resource_id = entry.resource_id
    }

    if (entry.ip_address) {
      logEntry.ip_address = entry.ip_address
    } else {
      logEntry.ip_address = "server-side"
    }

    // Insert the log entry
    const { error } = await supabase.from("audit_logs").insert(logEntry)

    if (error) {
      console.error("Error logging audit event:", error)
    }
  } catch (error) {
    console.error("Failed to log audit event:", error)
  }
}
