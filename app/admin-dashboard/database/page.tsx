"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Search,
  Filter,
  ArrowUpDown,
  FileText,
  Download,
  ExternalLink,
} from "lucide-react";

export default function DatabaseManagement() {
  const [activeTab, setActiveTab] = useState("cases");
  const [cases, setCases] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [caseFilter, setCaseFilter] = useState("all");
  const [documentFilter, setDocumentFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (activeTab === "cases" || activeTab === "all") {
        const { data: casesData, error: casesError } = await supabase
          .from("cases")
          .select("*")
          .order("created_at", { ascending: false });

        if (casesError) throw casesError;
        setCases(casesData || []);
      }

      if (activeTab === "documents" || activeTab === "all") {
        const { data: documentsData, error: documentsError } = await supabase
          .from("documents")
          .select(
            `
            id,
            filename,
            file_type,
            upload_time,
            notes,
            status,
            storage_url,
            case_id,
            cases(case_number, client_name)
          `
          )
          .order("upload_time", { ascending: false });

        if (documentsError) throw documentsError;
        setDocuments(documentsData || []);
      }

      if (activeTab === "users" || activeTab === "all") {
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("*")
          .order("created_at", { ascending: false });

        if (usersError) throw usersError;
        setUsers(usersData || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch data");
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort cases
  const filteredCases = cases
    .filter((caseItem) => {
      // Apply search filter
      const matchesSearch =
        caseItem.case_number
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        caseItem.client_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        caseItem.case_type?.toLowerCase().includes(searchTerm.toLowerCase());

      // Apply status filter
      const matchesFilter =
        caseFilter === "all" || caseItem.status === caseFilter;

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      // Sort by created_at date
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

  // Filter and sort documents
  const filteredDocuments = documents
    .filter((doc) => {
      // Apply search filter
      const matchesSearch =
        doc.filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.notes &&
          doc.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (doc.cases &&
          doc.cases.case_number
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()));

      // Apply status filter
      const matchesFilter =
        documentFilter === "all" || doc.status === documentFilter;

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      // Sort by upload_time date
      const dateA = new Date(a.upload_time).getTime();
      const dateB = new Date(b.upload_time).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

  // Filter and sort users
  const filteredUsers = users
    .filter((user) => {
      // Apply search filter
      const matchesSearch =
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());

      // Apply role filter
      const matchesFilter = userFilter === "all" || user.role === userFilter;

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      // Sort by created_at date
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

  // Helper function to format status for display
  const formatStatus = (status: string) => {
    switch (status) {
      case "open":
        return { label: "Open", color: "bg-green-100 text-green-800" };
      case "pending":
        return { label: "Pending", color: "bg-yellow-100 text-yellow-800" };
      case "closed":
        return { label: "Closed", color: "bg-gray-100 text-gray-800" };
      case "approved":
        return { label: "Approved", color: "bg-green-100 text-green-800" };
      case "rejected":
        return { label: "Rejected", color: "bg-red-100 text-red-800" };
      default:
        return { label: status, color: "bg-blue-100 text-blue-800" };
    }
  };

  if (loading) {
    return (
      <div className="text-center py-10">Loading database information...</div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Database Management</h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Database Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <Input
                placeholder="Search records..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              title={`Sort by ${sortOrder === "asc" ? "newest" : "oldest"}`}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>

          <Tabs defaultValue="cases" onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="cases">Cases</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
            </TabsList>

            <TabsContent value="cases">
              <div className="flex items-center space-x-2 mb-4">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={caseFilter} onValueChange={setCaseFilter}>
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Case #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCases.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          No cases found matching your criteria
                        </td>
                      </tr>
                    ) : (
                      filteredCases.map((caseItem) => {
                        const status = formatStatus(caseItem.status);
                        return (
                          <tr key={caseItem.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {caseItem.case_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {caseItem.client_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {caseItem.case_type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${status.color}`}
                              >
                                {status.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(
                                caseItem.created_at
                              ).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <a
                                href={`/staff-dashboard/case/${caseItem.id}`}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                View Details
                              </a>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="documents">
              <div className="flex items-center space-x-2 mb-4">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select
                  value={documentFilter}
                  onValueChange={setDocumentFilter}
                >
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Document
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Case #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Uploaded
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredDocuments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          No documents found matching your criteria
                        </td>
                      </tr>
                    ) : (
                      filteredDocuments.map((doc) => {
                        const status = formatStatus(doc.status);
                        return (
                          <tr key={doc.id}>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              <div className="flex items-center">
                                <FileText className="h-4 w-4 mr-2 text-blue-500" />
                                <span className="truncate max-w-xs">
                                  {doc.filename}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {doc.cases?.case_number || "N/A"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {doc.file_type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${status.color}`}
                              >
                                {status.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(doc.upload_time).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex space-x-2">
                                <a
                                  href={doc.storage_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  <span className="sr-only">View</span>
                                </a>
                                <a
                                  href={doc.storage_url}
                                  download
                                  className="text-green-600 hover:text-green-800"
                                >
                                  <Download className="h-4 w-4" />
                                  <span className="sr-only">Download</span>
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <div className="flex items-center space-x-2 mb-4">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Login
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          No users found matching your criteria
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {user.full_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                user.role === "admin"
                                  ? "bg-purple-100 text-purple-800"
                                  : user.role === "staff"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {user.role}
                              {user.role === "staff" &&
                                user.staff_role &&
                                ` (${user.staff_role})`}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.created_at
                              ? new Date(user.created_at).toLocaleDateString()
                              : "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.last_login
                              ? new Date(user.last_login).toLocaleDateString()
                              : "Never"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
