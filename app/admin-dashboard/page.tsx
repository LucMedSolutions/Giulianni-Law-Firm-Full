"use client"

export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Users, Bell, FileText, Settings } from "lucide-react"

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    users: 0,
    cases: 0,
    notifications: 0,
    logs: 0,
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      try {
        // Fetch user count
        const { count: userCount, error: userError } = await supabase
          .from("users")
          .select("*", { count: "exact", head: true })

        if (userError) throw userError

        // Fetch case count (assuming you have a cases table)
        const { count: caseCount, error: caseError } = await supabase
          .from("cases")
          .select("*", { count: "exact", head: true })

        // Fetch notification count
        const { count: notificationCount, error: notificationError } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })

        // Fetch log count
        const { count: logCount, error: logError } = await supabase
          .from("audit_logs")
          .select("*", { count: "exact", head: true })

        setStats({
          users: userCount || 0,
          cases: caseCount || 0,
          notifications: notificationCount || 0,
          logs: logCount || 0,
        })
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [supabase])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <Link href="/setup">
          <Button variant="outline">User Setup</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.users}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading..." : `${stats.users} registered users`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.cases}</div>
            <p className="text-xs text-muted-foreground">{loading ? "Loading..." : `${stats.cases} total cases`}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notifications</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.notifications}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading..." : `${stats.notifications} system notifications`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audit Logs</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.logs}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading..." : `${stats.logs} system events logged`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin-dashboard/users">
              <Button className="w-full">Manage Users</Button>
            </Link>
            <Link href="/admin-dashboard/database">
              <Button className="w-full" variant="outline">
                Database Management
              </Button>
            </Link>
            <Link href="/admin-dashboard/audit-logs">
              <Button className="w-full" variant="outline">
                View Audit Logs
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Database Connection</span>
                <span className="text-green-500">Online</span>
              </div>
              <div className="flex justify-between">
                <span>Authentication Service</span>
                <span className="text-green-500">Online</span>
              </div>
              <div className="flex justify-between">
                <span>Storage Service</span>
                <span className="text-green-500">Online</span>
              </div>
              <div className="flex justify-between">
                <span>Last System Check</span>
                <span>{new Date().toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
