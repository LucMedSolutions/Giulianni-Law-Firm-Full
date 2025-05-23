"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Search, Mail, MailOpen, User, Clock, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ClientInbox() {
  const [messages, setMessages] = useState<any[]>([])
  const [filteredMessages, setFilteredMessages] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const [seedingMessages, setSeedingMessages] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const fetchMessages = async () => {
    setLoading(true)
    setError(null)

    try {
      // Check if user is authenticated
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/")
        return
      }

      // Get user data
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("role, full_name, id")
        .eq("id", session.user.id)
        .maybeSingle()

      if (userError) throw userError
      if (!user) throw new Error("User profile not found")
      if (user.role !== "client") {
        await supabase.auth.signOut()
        router.push("/")
        return
      }

      // Get messages for this client - using explicit joins instead of relationship inference
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select(`
          id, 
          subject, 
          content, 
          created_at, 
          is_read,
          sender_id,
          recipient_id
        `)
        .or(`recipient_id.eq.${user.id},sender_id.eq.${user.id}`)
        .order("created_at", { ascending: false })

      if (messagesError) throw messagesError

      // If we have messages, fetch the sender and recipient details separately
      if (messagesData && messagesData.length > 0) {
        // Get unique user IDs from sender_id and recipient_id
        const userIds = new Set<string>()
        messagesData.forEach((msg) => {
          if (msg.sender_id) userIds.add(msg.sender_id)
          if (msg.recipient_id) userIds.add(msg.recipient_id)
        })

        // Fetch user details for all these IDs
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, full_name, role")
          .in("id", Array.from(userIds))

        if (usersError) throw usersError

        // Create a map of user details
        const userMap = (usersData || []).reduce(
          (map, user) => {
            map[user.id] = user
            return map
          },
          {} as Record<string, any>,
        )

        // Attach sender and recipient details to each message
        const messagesWithUsers = messagesData.map((msg) => ({
          ...msg,
          sender: userMap[msg.sender_id] || null,
          recipient: userMap[msg.recipient_id] || null,
        }))

        setMessages(messagesWithUsers)
        setFilteredMessages(messagesWithUsers)
      } else {
        setMessages([])
        setFilteredMessages([])
      }
    } catch (err: any) {
      console.error("Error fetching messages:", err)
      setError(err.message || "Failed to load messages")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredMessages(messages)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = messages.filter(
        (msg) =>
          msg.subject.toLowerCase().includes(query) ||
          msg.content.toLowerCase().includes(query) ||
          (msg.sender?.full_name && msg.sender.full_name.toLowerCase().includes(query)),
      )
      setFilteredMessages(filtered)
    }
  }, [searchQuery, messages])

  const handleViewMessage = async (message: any) => {
    setSelectedMessage(message)

    // Mark as read if it's not already read and user is the recipient
    if (!message.is_read && message.recipient_id === message.recipient?.id) {
      try {
        const { error: updateError } = await supabase.from("messages").update({ is_read: true }).eq("id", message.id)

        if (updateError) throw updateError

        // Update local state
        setMessages((prev) => prev.map((msg) => (msg.id === message.id ? { ...msg, is_read: true } : msg)))
        setFilteredMessages((prev) => prev.map((msg) => (msg.id === message.id ? { ...msg, is_read: true } : msg)))
      } catch (err) {
        console.error("Error marking message as read:", err)
      }
    }
  }

  const handleReply = () => {
    setReplyOpen(true)
  }

  const sendReply = async () => {
    if (!replyText.trim() || !selectedMessage) return

    setSendingReply(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/")
        return
      }

      // Create new message
      const { error: messageError, data: newMessage } = await supabase
        .from("messages")
        .insert({
          subject: `Re: ${selectedMessage.subject}`,
          content: replyText,
          sender_id: session.user.id,
          recipient_id: selectedMessage.sender_id,
          is_read: false,
          parent_message_id: selectedMessage.id,
        })
        .select()

      if (messageError) throw messageError

      toast({
        title: "Reply Sent",
        description: "Your reply has been sent successfully",
      })

      // Add the new message to the list
      if (newMessage && newMessage.length > 0) {
        // Get current user details
        const { data: currentUser } = await supabase
          .from("users")
          .select("id, full_name, role")
          .eq("id", session.user.id)
          .maybeSingle()

        const newMessageWithSender = {
          ...newMessage[0],
          sender: currentUser || {
            id: session.user.id,
            full_name: "You",
            role: "client",
          },
          recipient: selectedMessage.sender,
        }

        setMessages([newMessageWithSender, ...messages])
        setFilteredMessages([newMessageWithSender, ...filteredMessages])
      }

      setReplyText("")
      setReplyOpen(false)
    } catch (err: any) {
      console.error("Error sending reply:", err)
      toast({
        title: "Error",
        description: err.message || "Failed to send reply",
        variant: "destructive",
      })
    } finally {
      setSendingReply(false)
    }
  }

  const seedSampleMessages = async () => {
    setSeedingMessages(true)
    try {
      const response = await fetch("/api/seed-messages", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create sample messages")
      }

      toast({
        title: "Sample Messages Created",
        description: `${data.count} sample messages have been added to your inbox.`,
      })

      // Refresh the messages
      await fetchMessages()
    } catch (err: any) {
      console.error("Error seeding messages:", err)
      toast({
        title: "Error",
        description: err.message || "Failed to create sample messages",
        variant: "destructive",
      })
    } finally {
      setSeedingMessages(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else if (diffDays === 1) {
      return "Yesterday"
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "long" })
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p>Loading messages...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-red-500">{error}</p>
              <Button onClick={() => router.push("/client-dashboard")} className="mt-4">
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <h1 className="text-xl font-bold">Inbox</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchMessages} className="flex items-center gap-1">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {messages.length === 0 && (
              <Button size="sm" onClick={seedSampleMessages} disabled={seedingMessages}>
                {seedingMessages ? "Creating..." : "Create Sample Messages"}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    type="search"
                    placeholder="Search messages..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Message List */}
            <div className="md:col-span-1">
              <Card className="h-[calc(100vh-220px)] flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle>Messages</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-0">
                  {filteredMessages.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <Mail className="h-12 w-12 mx-auto text-gray-400" />
                      <h3 className="mt-2 text-lg font-medium text-gray-900">No messages found</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {messages.length === 0 ? "Your inbox is empty." : "No messages match your search criteria."}
                      </p>
                      {messages.length === 0 && (
                        <Button onClick={seedSampleMessages} className="mt-4" disabled={seedingMessages}>
                          {seedingMessages ? "Creating..." : "Create Sample Messages"}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {filteredMessages.map((message) => (
                        <li
                          key={message.id}
                          className={`p-4 cursor-pointer hover:bg-gray-50 ${
                            selectedMessage?.id === message.id ? "bg-gray-50" : ""
                          } ${!message.is_read && message.recipient_id === message.recipient?.id ? "bg-blue-50" : ""}`}
                          onClick={() => handleViewMessage(message)}
                        >
                          <div className="flex items-start">
                            <div className="flex-shrink-0 mr-3">
                              {!message.is_read && message.recipient_id === message.recipient?.id ? (
                                <Mail className="h-5 w-5 text-blue-500" />
                              ) : (
                                <MailOpen className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm font-medium ${
                                  !message.is_read && message.recipient_id === message.recipient?.id
                                    ? "text-gray-900"
                                    : "text-gray-700"
                                }`}
                              >
                                {message.sender_id === message.recipient?.id
                                  ? "Me"
                                  : message.sender?.full_name || "Unknown"}
                              </p>
                              <p className="text-sm truncate text-gray-500">{message.subject}</p>
                            </div>
                            <div className="ml-3 flex-shrink-0">
                              <p className="text-xs text-gray-500">{formatDate(message.created_at)}</p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Message Content */}
            <div className="md:col-span-2">
              <Card className="h-[calc(100vh-220px)] flex flex-col">
                {selectedMessage ? (
                  <>
                    <CardHeader className="pb-2 border-b">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{selectedMessage.subject}</CardTitle>
                          <div className="flex items-center mt-1 text-sm text-gray-500">
                            <User className="h-4 w-4 mr-1" />
                            <span className="mr-3">
                              {selectedMessage.sender_id === selectedMessage.recipient?.id
                                ? "Me"
                                : selectedMessage.sender?.full_name || "Unknown"}
                            </span>
                            <Clock className="h-4 w-4 mr-1" />
                            <span>{new Date(selectedMessage.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <Button onClick={handleReply}>Reply</Button>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto p-4">
                      <div className="prose max-w-none">
                        {selectedMessage.content.split("\n").map((paragraph: string, i: number) => (
                          <p key={i}>{paragraph}</p>
                        ))}
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <CardContent className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <Mail className="h-12 w-12 mx-auto text-gray-400" />
                      <h3 className="mt-2 text-lg font-medium text-gray-900">Select a message</h3>
                      <p className="mt-1 text-sm text-gray-500">Choose a message from the list to view its contents</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Reply Dialog */}
      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reply to Message</DialogTitle>
            <DialogDescription>Replying to: {selectedMessage?.subject}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              placeholder="Type your reply here..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={6}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendReply} disabled={sendingReply || !replyText.trim()}>
              {sendingReply ? "Sending..." : "Send Reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
