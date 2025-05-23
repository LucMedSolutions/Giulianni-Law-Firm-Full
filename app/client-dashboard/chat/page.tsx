"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Paperclip, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ClientChat() {
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedContact, setSelectedContact] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendingMessage, setSendingMessage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  useEffect(() => {
    const fetchContacts = async () => {
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

        // Get client cases to find assigned attorneys
        const { data: clientCases, error: casesError } = await supabase
          .from("cases")
          .select("id, assigned_attorney")
          .eq("client_name", user.full_name)

        if (casesError) throw casesError

        // Get staff users (attorneys and paralegals)
        const { data: staffUsers, error: staffError } = await supabase
          .from("users")
          .select("id, full_name, role")
          .in("role", ["attorney", "paralegal", "secretary"])
          .order("full_name")

        if (staffError) throw staffError

        // Create contacts list from staff users
        const contactsList = staffUsers || []
        setContacts(contactsList)

        // Select first contact by default
        if (contactsList.length > 0) {
          setSelectedContact(contactsList[0])
        }
      } catch (err: any) {
        console.error("Error fetching contacts:", err)
        setError(err.message || "Failed to load contacts")
      } finally {
        setLoading(false)
      }
    }

    fetchContacts()
  }, [router])

  useEffect(() => {
    if (selectedContact) {
      fetchMessages()
    }
  }, [selectedContact])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = async () => {
    if (!selectedContact) return

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/")
        return
      }

      // Get chat messages between current user and selected contact
      const { data: messagesData, error: messagesError } = await supabase
        .from("chat_messages")
        .select(`
          id, 
          content, 
          created_at, 
          sender_id,
          recipient_id,
          is_read
        `)
        .or(
          `and(sender_id.eq.${session.user.id},recipient_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},recipient_id.eq.${session.user.id})`,
        )
        .order("created_at", { ascending: true })

      if (messagesError) throw messagesError

      setMessages(messagesData || [])

      // Mark unread messages as read
      const unreadMessages = messagesData?.filter((msg) => !msg.is_read && msg.recipient_id === session.user.id)

      if (unreadMessages && unreadMessages.length > 0) {
        const unreadIds = unreadMessages.map((msg) => msg.id)

        const { error: updateError } = await supabase
          .from("chat_messages")
          .update({ is_read: true })
          .in("id", unreadIds)

        if (updateError) console.error("Error marking messages as read:", updateError)
      }
    } catch (err: any) {
      console.error("Error fetching messages:", err)
      toast({
        title: "Error",
        description: err.message || "Failed to load messages",
        variant: "destructive",
      })
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedContact) return

    setSendingMessage(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/")
        return
      }

      // Create new message
      const { error: messageError, data: newMessageData } = await supabase
        .from("chat_messages")
        .insert({
          content: newMessage,
          sender_id: session.user.id,
          recipient_id: selectedContact.id,
          is_read: false,
        })
        .select()

      if (messageError) throw messageError

      // Add the new message to the list
      if (newMessageData && newMessageData.length > 0) {
        setMessages([...messages, newMessageData[0]])
      }

      setNewMessage("")
    } catch (err: any) {
      console.error("Error sending message:", err)
      toast({
        title: "Error",
        description: err.message || "Failed to send message",
        variant: "destructive",
      })
    } finally {
      setSendingMessage(false)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  if (loading) {
    return (
      <div className="p-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p>Loading chat...</p>
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
          <h1 className="text-xl font-bold">Chat</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Contacts */}
            <div className="md:col-span-1">
              <Card className="h-[calc(100vh-220px)] flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle>Contacts</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-0">
                  {contacts.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <User className="h-12 w-12 mx-auto text-gray-400" />
                      <h3 className="mt-2 text-lg font-medium text-gray-900">No contacts found</h3>
                      <p className="mt-1 text-sm text-gray-500">You don't have any contacts available for chat.</p>
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {contacts.map((contact) => (
                        <li
                          key={contact.id}
                          className={`p-4 cursor-pointer hover:bg-gray-50 ${
                            selectedContact?.id === contact.id ? "bg-gray-100" : ""
                          }`}
                          onClick={() => setSelectedContact(contact)}
                        >
                          <div className="flex items-center">
                            <Avatar className="h-10 w-10 mr-3">
                              <AvatarFallback>{getInitials(contact.full_name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{contact.full_name}</p>
                              <p className="text-xs text-gray-500 capitalize">{contact.role}</p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Chat */}
            <div className="md:col-span-3">
              <Card className="h-[calc(100vh-220px)] flex flex-col">
                {selectedContact ? (
                  <>
                    <CardHeader className="pb-2 border-b">
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10 mr-3">
                          <AvatarFallback>{getInitials(selectedContact.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle>{selectedContact.full_name}</CardTitle>
                          <p className="text-sm text-gray-500 capitalize">{selectedContact.role}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto p-4 flex flex-col">
                      {messages.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                          <div className="text-center">
                            <Send className="h-12 w-12 mx-auto text-gray-400" />
                            <h3 className="mt-2 text-lg font-medium text-gray-900">No messages yet</h3>
                            <p className="mt-1 text-sm text-gray-500">Start the conversation by sending a message.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {messages.map((message, index) => {
                            const isCurrentUser = message.sender_id !== selectedContact.id
                            const showDate =
                              index === 0 ||
                              formatDate(messages[index - 1].created_at) !== formatDate(message.created_at)

                            return (
                              <div key={message.id}>
                                {showDate && (
                                  <div className="text-center my-4">
                                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                                      {formatDate(message.created_at)}
                                    </span>
                                  </div>
                                )}
                                <div className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
                                  <div
                                    className={`max-w-[75%] px-4 py-2 rounded-lg ${
                                      isCurrentUser
                                        ? "bg-blue-500 text-white rounded-br-none"
                                        : "bg-gray-100 text-gray-800 rounded-bl-none"
                                    }`}
                                  >
                                    <p>{message.content}</p>
                                    <p
                                      className={`text-xs mt-1 text-right ${
                                        isCurrentUser ? "text-blue-100" : "text-gray-500"
                                      }`}
                                    >
                                      {formatTime(message.created_at)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </CardContent>
                    <div className="p-4 border-t">
                      <div className="flex items-end gap-2">
                        <Textarea
                          placeholder="Type your message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          className="min-h-[80px]"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              handleSendMessage()
                            }
                          }}
                        />
                        <div className="flex flex-col gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            type="button"
                            disabled
                            title="Attach file (coming soon)"
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            type="button"
                            onClick={handleSendMessage}
                            disabled={sendingMessage || !newMessage.trim()}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <CardContent className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <User className="h-12 w-12 mx-auto text-gray-400" />
                      <h3 className="mt-2 text-lg font-medium text-gray-900">Select a contact</h3>
                      <p className="mt-1 text-sm text-gray-500">Choose a contact from the list to start chatting</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
