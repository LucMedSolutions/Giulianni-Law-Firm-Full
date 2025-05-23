"use client"

import { type ReactNode, useEffect, useState } from "react"
import { type Permission, hasPermission } from "@/lib/permissions"

interface PermissionGateProps {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}

export default function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const checkPermission = async () => {
      const result = await hasPermission(permission)
      setAllowed(result)
    }

    checkPermission()
  }, [permission])

  // While checking, render nothing
  if (allowed === null) {
    return null
  }

  // If allowed, render children, otherwise render fallback
  return allowed ? <>{children}</> : <>{fallback}</>
}
