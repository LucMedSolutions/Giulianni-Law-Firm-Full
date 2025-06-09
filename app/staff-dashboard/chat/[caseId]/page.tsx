"use client"

import { useState, useEffect, useRef, ChangeEvent } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClientComponentClient, SupabaseClient } from "@supabase/auth-helpers-nextjs"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Paperclip, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// TODO: Potentially use caseId from params to filter/pre-select contact
export default function StaffChat() {
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedContact, setSelectedContact] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendingMessage, setSendingMessage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const params = useParams() // For caseId, if needed later
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const [currentUser, setCurrentUser] = useState<any | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true)
      setError(null)

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError
        if (!session) {
          router.push("/") // Redirect to login if not authenticated
          return
        }

        const { data: user, error: userError } = await supabase
          .from("users")
          .select("role, full_name, id")
          .eq("id", session.user.id)
          .maybeSingle()

        if (userError) throw userError
        if (!user) throw new Error("User profile not found.")

        // Authorize staff/admin
        if (user.role !== "staff" && user.role !== "admin" && user.role !== "attorney" && user.role !== "paralegal" && user.role !== "secretary") {
          await supabase.auth.signOut()
          toast({ title: "Access Denied", description: "You are not authorized to view this page.", variant: "destructive" })
          router.push("/")
          return
        }
        setCurrentUser(user)

        // Fetch clients as contacts for staff
        const { data: clientUsers, error: clientsError } = await supabase
          .from("users")
          .select("id, full_name, role")
          .eq("role", "client") // Staff sees clients
          .order("full_name")

        if (clientsError) throw clientsError

        const contactsList = clientUsers || []
        setContacts(contactsList)

        // TODO: Later, use caseId from params to select a contact if provided
        // For now, select the first contact if available
        if (contactsList.length > 0) {
          setSelectedContact(contactsList[0])
        }
      } catch (err: any) {
        console.error("Error fetching initial data:", err)
        setError(err.message || "Failed to load initial data")
        toast({ title: "Error", description: err.message || "Failed to load data.", variant: "destructive"})
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()
  }, [router, supabase, toast])

  useEffect(() => {
    if (selectedContact && currentUser) {
      fetchMessages().then(() => {
        // Subscribe to real-time messages after initial fetch
        if (channelRef.current) {
          // Clean up previous channel if it exists
          channelRef.current.unsubscribe()
          supabase.removeChannel(channelRef.current)
        }

        const newChannel = supabase
          .channel(`chat_messages_for_${currentUser.id}_with_${selectedContact.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "chat_messages",
              filter: `recipient_id=eq.${currentUser.id}`, // Messages sent to current staff user
            },
            async (payload) => {
              const newMessage = payload.new as any
              // Ensure the message is from the selected client contact
              if (newMessage.sender_id === selectedContact.id) {
                setMessages((prevMessages) => {
                  // Avoid adding duplicate messages
                  if (prevMessages.find(msg => msg.id === newMessage.id)) {
                    return prevMessages;
                  }
                  return [...prevMessages, newMessage]
                });

                // Mark as read if this chat is active
                if (!newMessage.is_read) {
                  await supabase
                    .from("chat_messages")
                    .update({ is_read: true })
                    .eq("id", newMessage.id)
                }
              }
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              console.log('Subscribed to chat messages for staff:', currentUser.id);
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error('Subscription error:', err);
              toast({ title: "Real-time Error", description: "Could not connect to real-time chat. Please refresh.", variant: "destructive" });
            }
          });
        channelRef.current = newChannel;
      });
    }

    // Cleanup subscription on component unmount or when selectedContact/currentUser changes
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        console.log('Unsubscribed from chat messages for staff:', currentUser?.id);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContact, currentUser, supabase, toast]);

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = async () => {
    if (!selectedContact || !currentUser) return

    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from("chat_messages")
        .select("id, content, created_at, sender_id, recipient_id, is_read")
        .or(
          `and(sender_id.eq.${currentUser.id},recipient_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},recipient_id.eq.${currentUser.id})`,
        )
        .order("created_at", { ascending: true })

      if (messagesError) throw messagesError

      setMessages(messagesData || [])

      // Mark initially fetched unread messages as read (messages sent by selectedContact to currentUser)
      const unreadMessages = messagesData?.filter(
        (msg) => !msg.is_read && msg.recipient_id === currentUser.id && msg.sender_id === selectedContact.id
      )

      if (unreadMessages && unreadMessages.length > 0) {
        const unreadIds = unreadMessages.map((msg) => msg.id)
        await supabase.from("chat_messages").update({ is_read: true }).in("id", unreadIds)
      }
    } catch (err: any) {
      console.error("Error fetching messages:", err)
      // Toast for fetch errors, subscription errors are handled in the subscription callback
      toast({ title: "Error", description: err.message || "Failed to load messages.", variant: "destructive" })
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !selectedContact || !currentUser) return

    setSendingMessage(true)
    let attachmentUrl: string | null = null
    let attachmentFilename: string | null = null

    try {
      if (selectedFile) {
        setUploadingFile(true)
        const fileName = `${currentUser.id}/${uuidv4()}-${selectedFile.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("chat_attachments")
          .upload(fileName, selectedFile)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from("chat_attachments").getPublicUrl(fileName)
        attachmentUrl = urlData.publicUrl
        attachmentFilename = selectedFile.name
        setUploadingFile(false)
        setSelectedFile(null) // Clear file after successful upload prep
      }

      const messageContent = newMessage.trim()
      if (!messageContent && !attachmentUrl) { // Don't send empty messages unless there's an attachment
        setSendingMessage(false)
        return;
      }

      const { error: messageError, data: newMessageData } = await supabase
        .from("chat_messages")
        .insert({
          content: messageContent,
          sender_id: currentUser.id, // Staff's ID
          recipient_id: selectedContact.id, // Client's ID
          is_read: false,
          attachment_url: attachmentUrl,
          attachment_filename: attachmentFilename,
        })
        .select()

      if (messageError) throw messageError

      if (newMessageData && newMessageData.length > 0) {
        setMessages((prevMessages) => [...prevMessages, newMessageData[0]])
      }
      setNewMessage("")
      // selectedFile is already cleared
    } catch (err: any) {
      console.error("Error sending message or uploading file:", err)
      toast({
        title: "Error",
        description: err.message || "Failed to send message or upload file.",
        variant: "destructive",
      })
      setUploadingFile(false) // Reset on error
    } finally {
      setSendingMessage(false)
    }
  }

   const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]
      if (file.size > 10 * 1024 * 1024) { // Max 10MB
        toast({ title: "File too large", description: "Please select a file smaller than 10MB.", variant: "destructive"})
        return;
      }
      setSelectedFile(file)
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
    if (!name) return "?";
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
              <Button onClick={() => router.push("/staff-dashboard")} className="mt-4">
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
          <h1 className="text-xl font-bold">Staff Chat</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Contacts (Clients) */}
            <div className="md:col-span-1">
              <Card className="h-[calc(100vh-220px)] flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle>Clients</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-0">
                  {contacts.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <User className="h-12 w-12 mx-auto text-gray-400" />
                      <h3 className="mt-2 text-lg font-medium text-gray-900">No clients found</h3>
                      <p className="mt-1 text-sm text-gray-500">There are no clients available for chat.</p>
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
                              <AvatarFallback>{getInitials(contact.full_name || "?")}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{contact.full_name}</p>
                              {/* <p className="text-xs text-gray-500 capitalize">{contact.role}</p> */}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Chat Area */}
            <div className="md:col-span-3">
              <Card className="h-[calc(100vh-220px)] flex flex-col">
                {selectedContact && currentUser ? (
                  <>
                    <CardHeader className="pb-2 border-b">
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10 mr-3">
                          <AvatarFallback>{getInitials(selectedContact.full_name || "?")}</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle>{selectedContact.full_name}</CardTitle>
                          <p className="text-sm text-gray-500 capitalize">Client</p>
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
                            const isSentByCurrentUser = message.sender_id === currentUser.id
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
                                <div className={`flex ${isSentByCurrentUser ? "justify-end" : "justify-start"}`}>
                                  <div
                                    className={`max-w-[75%] px-4 py-2 rounded-lg ${
                                      isSentByCurrentUser
                                        ? "bg-blue-500 text-white rounded-br-none"
                                        : "bg-gray-100 text-gray-800 rounded-bl-none"
                                    }`}
                                  >
                                    {message.content && <p>{message.content}</p>}
                                    {message.attachment_url && (
                                      <a
                                        href={message.attachment_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`mt-1 text-sm underline ${
                                          isSentByCurrentUser ? "text-blue-200 hover:text-blue-100" : "text-gray-600 hover:text-gray-900"
                                        }`}
                                      >
                                        {message.attachment_filename || "View Attachment"}
                                      </a>
                                    )}
                                    <p
                                      className={`text-xs mt-1 text-right ${
                                        isSentByCurrentUser ? "text-blue-100" : "text-gray-500"
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
                      {selectedFile && (
                        <div className="mb-2 text-sm text-gray-600">
                          Selected file: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                           <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)} className="ml-2">Clear</Button>
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <Textarea
                          placeholder={uploadingFile ? "Uploading..." : "Type your message..."}
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          className="min-h-[80px]"
                          disabled={uploadingFile}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !uploadingFile) {
                              e.preventDefault()
                              handleSendMessage()
                            }
                          }}
                        />
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: "none" }} />
                        <div className="flex flex-col gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingFile}
                            title="Attach file"
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            type="button"
                            onClick={handleSendMessage}
                            disabled={sendingMessage || uploadingFile || (!newMessage.trim() && !selectedFile)}
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
                      <h3 className="mt-2 text-lg font-medium text-gray-900">Select a client</h3>
                      <p className="mt-1 text-sm text-gray-500">Choose a client from the list to start chatting.</p>
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
