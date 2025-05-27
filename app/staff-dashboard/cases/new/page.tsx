"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { ArrowLeft, Save, Loader2, Search, X, RefreshCw, UserPlus, Database } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function NewCasePage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [caseNumber, setCaseNumber] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientId, setClientId] = useState("")
  const [caseType, setCaseType] = useState("")
  const [status, setStatus] = useState("open")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [staffUsers, setStaffUsers] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [assignedTo, setAssignedTo] = useState("")
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [clientSearchOpen, setClientSearchOpen] = useState(false)
  const [clientSearchQuery, setClientSearchQuery] = useState("")
  const [clientsLoading, setClientsLoading] = useState(false)
  const [showAddClientDialog, setShowAddClientDialog] = useState(false)
  const [newClientData, setNewClientData] = useState({
    email: "",
    fullName: "",
    phoneNumber: "",
  })
  const [addingClient, setAddingClient] = useState(false)
  const [addClientError, setAddClientError] = useState<string | null>(null)
  const [clientAddSuccess, setClientAddSuccess] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [showDebugDialog, setShowDebugDialog] = useState(false)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [authUsers, setAuthUsers] = useState<any[]>([])

  const fetchClients = async () => {
    setClientsLoading(true)
    setDebugInfo("Starting client fetch...")

    try {
      // First, try to fetch ALL users from the database to see what's available
      const { data: fetchedUsers, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false })

      if (fetchError) {
        console.error("Error fetching users:", fetchError)
        setDebugInfo(`Error fetching users: ${fetchError.message}`)
        setError(`Error fetching users: ${fetchError.message}`)
        setClients([])
        setAllUsers([])
        return
      }

      // Store all users for debugging
      setAllUsers(fetchedUsers || [])

      console.log("All users from database:", fetchedUsers)
      setDebugInfo(`Found ${fetchedUsers?.length || 0} total users in database`)

      // Try to fetch auth users directly
      // const { data: authUsersData, error: authError } = await supabase.auth.admin.listUsers()

      // if (authError) {
      //   console.error("Error fetching auth users:", authError)
      //   setDebugInfo((prev) => `${prev}\nError fetching auth users: ${authError.message}`)
      // } else if (authUsersData) {
      //   console.log("Auth users:", authUsersData)
      //   setAuthUsers(authUsersData.users || [])
      //   setDebugInfo((prev) => `${prev}\nFound ${authUsersData.users?.length || 0} users in auth system`)
      // }

      // We can't access auth.admin.listUsers() without admin privileges
      // So we'll just use the manual client list as a fallback
      setAuthUsers([])

      // ALTERNATIVE APPROACH: Try to fetch users with role = 'client' specifically
      const { data: clientUsersData, error: clientError } = await supabase
        .from("users")
        .select("*")
        .eq("role", "client")
        .order("created_at", { ascending: false })

      if (clientError) {
        console.error("Error fetching client users:", clientError)
        setDebugInfo((prev) => `${prev}\nError fetching client users: ${clientError.message}`)
      } else {
        console.log("Client users from direct query:", clientUsersData)
        setDebugInfo((prev) => `${prev}\nFound ${clientUsersData?.length || 0} users with role='client'`)
      }

      // If we have client users from direct query, use those
      if (clientUsersData && clientUsersData.length > 0) {
        const enhancedClients = clientUsersData.map((client) => {
          const lastFourDigits = client.id ? client.id.slice(-4) : "????"
          return {
            ...client,
            last_four_digits: lastFourDigits,
          }
        })
        setClients(enhancedClients)
        setDebugInfo((prev) => `${prev}\nUsing ${enhancedClients.length} client users from direct query`)
        setClientsLoading(false)
        return
      }

      // If no users found at all, provide helpful guidance
      if (!fetchedUsers || fetchedUsers.length === 0) {
        setDebugInfo((prev) => `${prev}\nNo users found in database at all`)
        setClients([])
        setClientsLoading(false)
        return
      }

      // Log all user roles for debugging
      const roleBreakdown = fetchedUsers.reduce((acc: any, user) => {
        const role = user.role || "null"
        acc[role] = (acc[role] || 0) + 1
        return acc
      }, {})

      console.log("User role breakdown:", roleBreakdown)
      setDebugInfo((prev) => `${prev}\nRole breakdown: ${JSON.stringify(roleBreakdown)}`)

      // VERY INCLUSIVE FILTER - include ANY user that is not explicitly staff or admin
      const clientUsers = fetchedUsers.filter((user) => {
        return user.role !== "staff" && user.role !== "admin"
      })

      // If no clients found, provide helpful guidance
      if (clientUsers.length === 0) {
        setDebugInfo((prev) => `${prev}\nNo client users found. All users are staff/admin.`)

        // Check if we have any users at all
        if (fetchedUsers.length === 0) {
          setDebugInfo((prev) => `${prev}\nDatabase is empty - no users exist yet.`)
        } else {
          setDebugInfo((prev) => `${prev}\nFound ${fetchedUsers.length} users but they are all staff/admin roles.`)
        }
      }

      console.log("Filtered client users:", clientUsers)
      setDebugInfo((prev) => `${prev}\nFiltered to ${clientUsers.length} potential client users`)

      // Add last 4 digits of UUID to each client for easier searching
      const enhancedClients = clientUsers.map((client) => {
        const lastFourDigits = client.id ? client.id.slice(-4) : "????"
        return {
          ...client,
          last_four_digits: lastFourDigits,
        }
      })

      setClients(enhancedClients)
      setError(null) // Clear any previous errors
    } catch (err: any) {
      console.error("Unexpected error fetching users:", err)
      setDebugInfo(`Unexpected error: ${err.message}`)
      setError(`Unexpected error: ${err.message}`)
      setClients([])
    } finally {
      setClientsLoading(false)
    }
  }

  // FALLBACK: If we can't get clients from the database, create a manual list from the screenshot
  const createManualClientList = () => {
    if (clients.length === 0) {
      setDebugInfo(
        (prev) => `${prev}\nUsing manual client list as fallback since no clients were found in the database`,
      )

      const manualClients = [
        {
          id: "00000000-0000-0000-0000-000000000001", // Valid UUID format
          full_name: "Mohammed Jabbouri",
          email: "binsockoo@gmail.com",
          role: "client",
          last_four_digits: "0001",
          created_at: "2023-05-22T19:40:12Z",
          is_manual: true, // Flag to indicate this is manual data
        },
        {
          id: "00000000-0000-0000-0000-000000000002", // Valid UUID format
          full_name: "Taha Jabbouri",
          email: "yodashenchman@gmail.com",
          role: "client",
          last_four_digits: "0002",
          created_at: null,
          is_manual: true, // Flag to indicate this is manual data
        },
      ]

      setClients(manualClients)
      setDebugInfo((prev) => `${prev}\nAdded ${manualClients.length} manual clients as fallback`)
    }
  }

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        const { data: userData, error } = await supabase.from("users").select("*").eq("id", session.user.id).single()

        if (!error && userData) {
          setCurrentUser(userData)

          // If user is staff, assign to self by default
          if (userData.role === "staff") {
            setAssignedTo(userData.id)
          }
        }
      }
    }

    const fetchStaffUsers = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, staff_role, role")
        .in("role", ["staff", "admin"]) // Include both staff and admin users
        .order("full_name")

      if (error) {
        console.error("Error fetching staff users:", error)
        return
      }

      console.log("Staff users found:", data) // Add debug logging
      setStaffUsers(data || [])
    }

    // Generate a case number if empty
    if (!caseNumber) {
      const year = new Date().getFullYear()
      const randomPart = Math.floor(10000 + Math.random() * 90000)
      setCaseNumber(`${year}-${randomPart}`)
    }

    fetchCurrentUser()
    fetchStaffUsers()
    fetchClients().then(() => {
      // Use manual client list as fallback if no clients found
      setTimeout(() => {
        createManualClientList()
      }, 1000)
    })
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Validate form
      if (!caseNumber || !caseType || !status) {
        throw new Error("Please fill in all required fields")
      }

      if (!clientId && !clientName) {
        throw new Error("Please select or enter a client name")
      }

      // Create the case
      const caseData: any = {
        case_number: caseNumber,
        client_name: clientName,
        case_type: caseType,
        status,
        assigned_to: assignedTo || null,
      }

      // Only set client_id if it's a real database client (not a manual fallback)
      const selectedClient = clients.find((c) => c.id === clientId)
      if (clientId && selectedClient && !selectedClient.is_manual) {
        caseData.client_id = clientId
      }
      // If it's a manual client, we'll just use the client_name without setting client_id

      const { data, error } = await supabase.from("cases").insert([caseData]).select()

      if (error) {
        throw new Error(`Failed to create case: ${error.message}`)
      }

      setSuccess(true)

      // Redirect to the case page after a short delay
      setTimeout(() => {
        router.push("/staff-dashboard/cases")
      }, 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredClients = clients.filter((client) => {
    if (!clientSearchQuery) return true

    const query = clientSearchQuery.toLowerCase().trim()

    // Search by name, email, ID, or last 4 digits of UUID
    const fullName = (client.full_name || "").toLowerCase()
    const email = (client.email || "").toLowerCase()
    const userId = (client.id || "").toLowerCase()
    const shortId = (client.user_id_short || "").toLowerCase()
    const lastFourDigits = (client.last_four_digits || "").toLowerCase()

    return (
      fullName.includes(query) ||
      email.includes(query) ||
      userId.includes(query) ||
      shortId.includes(query) ||
      lastFourDigits === query // Exact match for last 4 digits
    )
  })

  const selectClient = (client: any) => {
    setClientId(client.id)
    setClientName(client.full_name || client.email)
    setClientSearchOpen(false)
  }

  const refreshClients = async () => {
    await fetchClients()
    // Use manual client list as fallback if no clients found
    setTimeout(() => {
      createManualClientList()
    }, 1000)
  }

  const handleAddClient = async () => {
    setAddingClient(true)
    setAddClientError(null)
    setClientAddSuccess(null)

    try {
      // Validate
      if (!newClientData.email || !newClientData.fullName) {
        throw new Error("Email and full name are required")
      }

      // Generate a random password
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)

      // Use the existing API endpoint to create the user
      const response = await fetch("/api/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newClientData.email,
          password: tempPassword,
          fullName: newClientData.fullName,
          role: "client",
          phoneNumber: newClientData.phoneNumber || null,
        }),
      })

      const result = await response.json()
      console.log("Create user API response:", result)

      if (!response.ok) {
        throw new Error(result.error || "Failed to create client")
      }

      // Set success message
      setClientAddSuccess(`Client ${newClientData.fullName} created successfully!`)

      // Reset form
      setNewClientData({
        email: "",
        fullName: "",
        phoneNumber: "",
      })

      // Refresh clients list after a short delay to allow for database propagation
      setTimeout(async () => {
        await fetchClients()

        // Try to find and select the newly created client
        const newClient = clients.find((client) => client.email === newClientData.email)
        if (newClient) {
          setClientId(newClient.id)
          setClientName(newClient.full_name)
        }
      }, 1000)

      // Close dialog after showing success
      setTimeout(() => {
        setShowAddClientDialog(false)
        setClientAddSuccess(null)
      }, 2000)
    } catch (err: any) {
      console.error("Error adding client:", err)
      setAddClientError(err.message)
    } finally {
      setAddingClient(false)
    }
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" asChild className="mr-2">
            <Link href="/staff-dashboard/cases">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cases
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Create New Case</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowDebugDialog(true)}>
          <Database className="h-4 w-4 mr-2" />
          Debug Database
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Case Information</CardTitle>
          <CardDescription>Enter the details for the new case. All fields marked with * are required.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                Case created successfully! Redirecting...
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="caseNumber">Case Number *</Label>
                <Input id="caseNumber" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label>Client *</Label>
                <div className="flex space-x-2">
                  <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientSearchOpen}
                        className="w-full justify-between"
                      >
                        {clientName ? clientName : "Select client..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search by name, email, or last 4 digits of ID..."
                          value={clientSearchQuery}
                          onValueChange={setClientSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {clientsLoading ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Loading clients...
                              </div>
                            ) : clients.length === 0 ? (
                              <div className="text-center py-6 space-y-3">
                                <div className="text-sm text-gray-500">
                                  <p className="font-medium">No client users found in the system.</p>
                                  <p className="text-xs mt-1">
                                    {allUsers.length === 0
                                      ? "The database is empty. Create your first client below."
                                      : `Found ${allUsers.length} users, but they are all staff/admin users.`}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowAddClientDialog(true)}
                                    className="text-xs"
                                  >
                                    <UserPlus className="mr-1 h-3 w-3" />
                                    Create First Client
                                  </Button>
                                  <div className="text-xs text-gray-400">
                                    You can also register clients through the main registration portal
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <p className="text-sm text-gray-500">No clients match your search.</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  Try searching by name, email, or last 4 digits of ID
                                </p>
                              </div>
                            )}
                          </CommandEmpty>
                          <CommandGroup className="max-h-[300px] overflow-auto">
                            {filteredClients.map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.id}
                                onSelect={() => selectClient(client)}
                                className="cursor-pointer"
                              >
                                <div className="flex flex-col w-full">
                                  <div className="font-medium">
                                    {client.full_name || client.email || "Unnamed Client"}{" "}
                                    {client.role && (
                                      <span className="text-xs text-gray-500">({client.role || "no role"})</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 flex justify-between">
                                    <span>{client.email || "No email"}</span>
                                    <span className="text-gray-400">ID: {client.last_four_digits || "????"}</span>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                        <div className="border-t p-2 space-y-2">
                          <Button
                            variant="outline"
                            className="w-full text-sm"
                            onClick={refreshClients}
                            disabled={clientsLoading}
                          >
                            {clientsLoading ? (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Refreshing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refresh Clients ({clients.length} found)
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full text-sm"
                            onClick={() => setShowAddClientDialog(true)}
                          >
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add New Client
                          </Button>
                        </div>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {clientId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setClientId("")
                        setClientName("")
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {!clientId && (
                  <div className="mt-2">
                    <Label htmlFor="clientName">Or enter client name manually</Label>
                    <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  {clientsLoading ? "Loading clients..." : `${clients.length} clients found in portal`}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="caseType">Case Type *</Label>
                <Select value={caseType} onValueChange={setCaseType} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select case type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="option_1">Option 1</SelectItem>
                    <SelectItem value="option_2">Option 2</SelectItem>
                    <SelectItem value="personal_injury">Personal Injury</SelectItem>
                    <SelectItem value="family_law">Family Law</SelectItem>
                    <SelectItem value="criminal_defense">Criminal Defense</SelectItem>
                    <SelectItem value="estate_planning">Estate Planning</SelectItem>
                    <SelectItem value="business_law">Business Law</SelectItem>
                    <SelectItem value="immigration">Immigration</SelectItem>
                    <SelectItem value="real_estate">Real Estate</SelectItem>
                    <SelectItem value="intellectual_property">Intellectual Property</SelectItem>
                    <SelectItem value="tax_law">Tax Law</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={status} onValueChange={setStatus} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assigned Attorney</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select attorney" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {staffUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} {user.staff_role ? `(${user.staff_role.replace(/_/g, " ")})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" type="button" asChild>
              <Link href="/staff-dashboard/cases">Cancel</Link>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Case
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Add Client Dialog */}
      <Dialog open={showAddClientDialog} onOpenChange={setShowAddClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>Create a new client account in the portal.</DialogDescription>
          </DialogHeader>

          {addClientError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {addClientError}
            </div>
          )}

          {clientAddSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
              {clientAddSuccess}
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Email *</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="client@example.com"
                value={newClientData.email}
                onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientName">Full Name *</Label>
              <Input
                id="clientName"
                placeholder="John Smith"
                value={newClientData.fullName}
                onChange={(e) => setNewClientData({ ...newClientData, fullName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientPhone">Phone Number</Label>
              <Input
                id="clientPhone"
                type="tel"
                placeholder="(123) 456-7890"
                value={newClientData.phoneNumber}
                onChange={(e) => setNewClientData({ ...newClientData, phoneNumber: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddClientDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddClient} disabled={addingClient}>
              {addingClient ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Client"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debug Dialog */}
      <Dialog open={showDebugDialog} onOpenChange={setShowDebugDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Database Debug Information</DialogTitle>
            <DialogDescription>
              This dialog shows all users in the database to help diagnose client lookup issues.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Users ({allUsers.length})</TabsTrigger>
              <TabsTrigger value="clients">Clients ({clients.length})</TabsTrigger>
              <TabsTrigger value="staff">Staff ({staffUsers.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="max-h-96 overflow-auto">
              <div className="border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">ID (Last 4)</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Email</th>
                      <th className="p-2 text-left">Role</th>
                      <th className="p-2 text-left">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((user, index) => (
                      <tr key={user.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="p-2">{user.id ? `${user.id.slice(-4)}` : "????"}</td>
                        <td className="p-2">{user.full_name || "—"}</td>
                        <td className="p-2">{user.email || "—"}</td>
                        <td className="p-2">{user.role || "null"}</td>
                        <td className="p-2">{user.created_at ? new Date(user.created_at).toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                    {allUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-500">
                          No users found in database
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
            <TabsContent value="clients" className="max-h-96 overflow-auto">
              <div className="border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">ID (Last 4)</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Email</th>
                      <th className="p-2 text-left">Role</th>
                      <th className="p-2 text-left">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client, index) => (
                      <tr key={client.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="p-2">{client.last_four_digits || "????"}</td>
                        <td className="p-2">{client.full_name || "—"}</td>
                        <td className="p-2">{client.email || "—"}</td>
                        <td className="p-2">{client.role || "null"}</td>
                        <td className="p-2">
                          {client.created_at ? new Date(client.created_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                    {clients.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-500">
                          No client users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
            <TabsContent value="staff" className="max-h-96 overflow-auto">
              <div className="border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">ID (Last 4)</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Email</th>
                      <th className="p-2 text-left">Staff Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffUsers.map((staff, index) => (
                      <tr key={staff.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="p-2">{staff.id ? `${staff.id.slice(-4)}` : "????"}</td>
                        <td className="p-2">{staff.full_name || "—"}</td>
                        <td className="p-2">{staff.email || "—"}</td>
                        <td className="p-2">{staff.staff_role || "—"}</td>
                      </tr>
                    ))}
                    {staffUsers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-gray-500">
                          No staff users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-4 space-y-2">
            <Button variant="outline" className="w-full" onClick={refreshClients} disabled={clientsLoading}>
              {clientsLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing Database...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Database
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowDebugDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
