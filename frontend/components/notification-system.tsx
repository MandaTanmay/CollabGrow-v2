"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bell, X, Users, MessageCircle, Heart, UserPlus, Calendar, CheckCircle, Info, MapPin, Mail, Github, Linkedin, Globe, BookOpen } from "lucide-react"
import { MonogramLogo } from "@/components/MonogramLogo"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { fetchWithAuth } from "@/lib/api"
import { getUserByFirebaseUid, getUserNotifications, getUserDetails, markNotificationAsRead, markAllNotificationsAsRead, removeNotification as deleteNotification } from "@/lib/supabase-queries"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { io as socketIOClient } from "socket.io-client"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

interface NotificationSystemProps {
  onStatsRefresh?: () => void | Promise<void>
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  created_at: string
  is_read: boolean
  priority: string
  related_project_id?: string
  related_entity_id?: string  // For application_id
  sender_id?: string
  sender?: {
    profile_image_url?: string
    full_name?: string
  }
}

export function NotificationSystem({ onStatsRefresh }: NotificationSystemProps = {}) {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [dbUser, setDbUser] = useState<any>(null)

  const [senderDetails, setSenderDetails] = useState<any>(null)
  const [showSenderDialog, setShowSenderDialog] = useState(false)
  const [processingApplication, setProcessingApplication] = useState<string | null>(null)

  // Handler to open sender details dialog
  const handleSenderClick = async (senderId: string) => {
    setSenderDetails(null)
    setShowSenderDialog(true)
    const details = await getUserDetails(senderId)
    setSenderDetails(details)
  }



  // Handler for accepting project applications
  const handleAcceptApplication = async (notificationId: string, projectId: string, applicationId: string) => {
    setProcessingApplication(notificationId)
    try {
      const response = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/projects/${projectId}/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' })
      })

      if (response.ok) {
        // Remove notification from list
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        // Refresh stats to update collaborator count
        if (onStatsRefresh) {
          await onStatsRefresh()
        }
        // Show success message
        toast({
          title: "Application Accepted",
          description: "The user has been added to your project and your collaborator count has been updated."
        })
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to accept application')
      }
    } catch (error: any) {
      console.error('Error accepting application:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to accept application. Please try again.",
        variant: "destructive"
      })
    } finally {
      setProcessingApplication(null)
    }
  }

  // Handler for declining project applications
  const handleDeclineApplication = async (notificationId: string, projectId: string, applicationId: string) => {
    setProcessingApplication(notificationId)
    try {
      const response = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/projects/${projectId}/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' })
      })

      if (response.ok) {
        // Remove notification from list
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        // Show success message
        toast({
          title: "Application Declined",
          description: "The application has been declined."
        })
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to decline application')
      }
    } catch (error: any) {
      console.error('Error declining application:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to decline application. Please try again.",
        variant: "destructive"
      })
    } finally {
      setProcessingApplication(null)
    }
  }

  // Handler for connection requests (accept/reject)
  const handleConnectionResponse = async (notificationId: string, connectionId: string, action: 'accept' | 'reject') => {
    setProcessingApplication(notificationId)
    try {
      const response = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/users/connections/${connectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (response.ok) {
        // Remove notification from list
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        // Show success message
        toast({
          title: action === 'accept' ? "Connection Accepted" : "Connection Declined",
          description: action === 'accept' 
            ? "You are now connected!" 
            : "Connection request declined.",
        })
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to ${action} connection`)
      }
    } catch (error: any) {
      console.error(`Error ${action}ing connection:`, error)
      toast({
        title: "Error",
        description: error.message || `Failed to ${action} connection. Please try again.`,
        variant: "destructive"
      })
    } finally {
      setProcessingApplication(null)
    }
  }

  useEffect(() => {
    async function loadUserAndNotifications() {
      if (!user || !user.uid) return
      try {
        const userData = await getUserByFirebaseUid(user.uid)
        setDbUser(userData)

        if (userData) {
          const data = await getUserNotifications(userData.id)
          setNotifications(data || [])
          setUnreadCount(data?.filter((n: any) => !n.is_read).length || 0)
        }
      } catch (error) {
        console.error("Error loading notifications:", error)
      }
    }
    loadUserAndNotifications()
  }, [user])

  // Real-time notifications via Socket.IO (cookie-auth)
  useEffect(() => {
    if (!dbUser?.id) return

    const socket = socketIOClient(API_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    })

    socket.on("connect", () => {
      console.debug("[Notifications] Socket connected", { socketId: socket.id })
    })

    socket.on("notification", (payload: any) => {
      if (!payload?.id) return

      setNotifications((prev) => {
        // Deduplicate by id
        if (prev.some((n) => n.id === payload.id)) return prev
        return [payload as Notification, ...prev]
      })

      if (!payload.is_read) {
        setUnreadCount((prev) => prev + 1)
      }
    })

    socket.on("connect_error", (err: any) => {
      console.warn("[Notifications] Socket connect_error", err?.message || err)
    })

    return () => {
      socket.disconnect()
    }
  }, [dbUser?.id])

  const markAsRead = async (id: string, relatedProjectId?: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((notification) => (notification.id === id ? { ...notification, is_read: true } : notification)),
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    try {
      await markNotificationAsRead(id)
      if (relatedProjectId) {
        // Navigate if project related
        // Check type? If join request -> go to dashboard or project page?
        // The instructions said "Project Owner Actions: View sender's full profile, Accept or decline".
        // If I am the owner receiving a request, I should go to a page to manage requests.
        // Currently I don't have a dedicated "Requests Management" page, but I can redirect to the Project Page where I might surely add a "Requests" tab or similar?
        // OR I can navigate to the workspace if accepted?
        // For now, redirect to project page.
        // router.push(`/projects/${relatedProjectId}`)
      }
    } catch (err) {
      console.error("Error marking read:", err)
      // Revert optimistic update on error
      setNotifications((prev) =>
        prev.map((notification) => (notification.id === id ? { ...notification, is_read: false } : notification)),
      )
      setUnreadCount(prev => prev + 1)
    }
  }

  const markAllAsRead = async () => {
    if (!dbUser?.id) return
    // Optimistic update
    const prevNotifications = notifications
    const prevUnreadCount = unreadCount
    setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })))
    setUnreadCount(0)
    try {
      if (!dbUser?.id) {
        throw new Error('Not logged in')
      }
      await markAllNotificationsAsRead(dbUser.id)
    } catch (err) {
      console.error("Error marking all as read:", err)
      // Revert optimistic update on error
      setNotifications(prevNotifications)
      setUnreadCount(prevUnreadCount)
    }
  }

  const removeNotification = async (id: string) => {
    // Optimistic update
    const prevNotifications = notifications
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
    
    try {
      await deleteNotification(id)
    } catch (err) {
      console.error("Error removing notification:", err)
      // Revert optimistic update on error
      setNotifications(prevNotifications)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like":
        return <Heart className="w-4 h-4 text-red-500" />
      case "comment":
        return <MessageCircle className="w-4 h-4 text-blue-500" />
      case "project_application":
      case "collaboration_request":
        return <Users className="w-4 h-4 text-purple-500" />
      case "connection_request":
        return <UserPlus className="w-4 h-4 text-blue-500" />
      case "connection_response":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "project_invite":
        return <UserPlus className="w-4 h-4 text-green-500" />
      case "event":
        return <Calendar className="w-4 h-4 text-orange-500" />
      case "achievement":
        return <CheckCircle className="w-4 h-4 text-yellow-500" />
      case "system":
        return <Info className="w-4 h-4 text-gray-500" />
      default:
        return <Bell className="w-4 h-4 text-gray-500" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-red-500"
      case "medium":
        return "border-l-yellow-500"
      case "low":
        return "border-l-green-500"
      default:
        return "border-l-gray-300"
    }
  }

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(!isOpen)} className="relative p-2">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-red-500 text-white text-xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-2 w-96 z-50">
            <Card className="border-0 bg-white/95 backdrop-blur-md shadow-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Notifications</CardTitle>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
                        Mark all read
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {unreadCount > 0 && (
                  <CardDescription>
                    You have {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="p-0 max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notifications.slice(0, 5).map((notification) => {
                      const isJoinRequest = notification.type === 'project_application' || notification.type === 'collaboration_request';
                      const isConnectionRequest = notification.type === 'connection_request';
                      const showProjectActionButtons = isJoinRequest && notification.related_project_id && notification.related_entity_id;
                      const showConnectionActionButtons = isConnectionRequest && notification.related_entity_id && !notification.is_read;
                      
                      return (
                        <div
                          key={notification.id}
                          className={`group p-4 border-l-4 ${getPriorityColor(notification.priority)} ${!notification.is_read ? "bg-blue-50/50" : "bg-transparent"} hover:bg-gray-50/50 transition-colors ${(showProjectActionButtons || showConnectionActionButtons) ? '' : 'cursor-pointer'}`}
                          onClick={() => {
                            if (!showProjectActionButtons && !showConnectionActionButtons) {
                              markAsRead(notification.id, notification.related_project_id)
                              if (notification.type === 'system' && notification.title.includes('Accepted')) {
                                router.push(`/projects/${notification.related_project_id}/workspace`)
                              }
                            }
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                {getNotificationIcon(notification.type)}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className={`text-sm font-medium ${!notification.is_read ? "text-gray-900" : "text-gray-700"}`}>{notification.title}</p>
                                  {/* Show sender info for join requests */}
                                  {isJoinRequest && notification.sender_id && (
                                    <div className="flex items-center gap-2 mt-1">
                                      {notification.sender?.profile_image_url ? (
                                        <Avatar className="w-6 h-6">
                                          <AvatarImage src={notification.sender.profile_image_url} />
                                          <AvatarFallback>
                                            <MonogramLogo 
                                              name={notification.sender?.full_name}
                                              variant="vibrant"
                                              size="xs"
                                            />
                                          </AvatarFallback>
                                        </Avatar>
                                      ) : (
                                        <MonogramLogo 
                                          name={notification.sender?.full_name}
                                          variant="vibrant"
                                          size="xs"
                                        />
                                      )}
                                      <button
                                        className="text-blue-600 hover:underline text-sm font-medium"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (notification.sender_id) {
                                            await handleSenderClick(notification.sender_id)
                                          }
                                        }}
                                      >
                                        {notification.sender?.full_name || "View Sender"}
                                      </button>
                                    </div>
                                  )}
                                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{notification.message}</p>
                                  <p className="text-xs text-gray-500 mt-2">{new Date(notification.created_at).toLocaleString()}</p>
                                  
                                  {/* Accept/Decline buttons for project applications */}
                                  {showProjectActionButtons && (
                                    <div className="flex gap-2 mt-3">
                                      <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                        disabled={processingApplication === notification.id}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleAcceptApplication(
                                            notification.id,
                                            notification.related_project_id!,
                                            notification.related_entity_id!
                                          )
                                        }}
                                      >
                                        {processingApplication === notification.id ? 'Processing...' : 'Accept'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-red-300 text-red-600 hover:bg-red-50"
                                        disabled={processingApplication === notification.id}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeclineApplication(
                                            notification.id,
                                            notification.related_project_id!,
                                            notification.related_entity_id!
                                          )
                                        }}
                                      >
                                        Decline
                                      </Button>
                                    </div>
                                  )}

                                  {/* Accept/Decline buttons for connection requests */}
                                  {showConnectionActionButtons && (
                                    <div className="flex gap-2 mt-3">
                                      <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                        disabled={processingApplication === notification.id}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleConnectionResponse(
                                            notification.id,
                                            notification.related_entity_id!,
                                            'accept'
                                          )
                                        }}
                                      >
                                        {processingApplication === notification.id ? 'Processing...' : 'Accept'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-red-300 text-red-600 hover:bg-red-50"
                                        disabled={processingApplication === notification.id}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleConnectionResponse(
                                            notification.id,
                                            notification.related_entity_id!,
                                            'reject'
                                          )
                                        }}
                                      >
                                        Decline
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                  {!notification.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      removeNotification(notification.id)
                                    }}
                                    className="p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Remove notification"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {/* View All Notifications Link */}
                    {notifications.length > 0 && (
                      <div className="border-t border-gray-200 p-3">
                        <Link 
                          href="/notifications"
                          className="block text-center text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                          onClick={() => setIsOpen(false)}
                        >
                          View All Notifications {notifications.length > 5 && `(${notifications.length})`}
                        </Link>
                      </div>
                    )}
                    {/* Sender Details Dialog */}
                    <Dialog open={showSenderDialog} onOpenChange={setShowSenderDialog}>
                      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100">
                        <DialogHeader className="sr-only">
                          <DialogTitle>User Profile</DialogTitle>
                        </DialogHeader>
                        {!senderDetails ? (
                          <div className="py-8 text-center text-gray-500">Loading...</div>
                        ) : (
                          <div className="space-y-6">
                            {/* Profile Header Section */}
                            <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-xl">
                              <CardContent className="p-8">
                                <div className="flex items-start gap-6">
                                  {senderDetails.profile_image_url ? (
                                    <Avatar className="w-24 h-24 ring-4 ring-gray-100">
                                      <AvatarImage src={senderDetails.profile_image_url} />
                                      <AvatarFallback>
                                        <MonogramLogo 
                                          name={senderDetails.full_name}
                                          variant="vibrant"
                                          size="2xl"
                                        />
                                      </AvatarFallback>
                                    </Avatar>
                                  ) : (
                                    <MonogramLogo 
                                      name={senderDetails.full_name}
                                      variant="vibrant"
                                      size="2xl"
                                    />
                                  )}

                                  <div className="flex-1">
                                    <div className="flex items-start justify-between mb-4">
                                      <div>
                                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                          {senderDetails.full_name || "Anonymous User"}
                                        </h1>

                                        <div className="flex flex-wrap items-center gap-4 text-gray-600 mb-3">
                                          <div className="flex items-center gap-1">
                                            <BookOpen className="w-4 h-4" />
                                            <span>{senderDetails.major || "Not specified"}</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <MapPin className="w-4 h-4" />
                                            <span>{senderDetails.university || "Not specified"}</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            <span>Joined {senderDetails.joinDate ? new Date(senderDetails.joinDate).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "N/A"}</span>
                                          </div>
                                        </div>

                                        {senderDetails.location && (
                                          <div className="flex flex-wrap items-center gap-4 text-gray-600 mb-3">
                                            <div className="flex items-center gap-1">
                                              <Globe className="w-4 h-4" />
                                              <span>{senderDetails.location}</span>
                                            </div>
                                          </div>
                                        )}

                                        <div className="flex items-center gap-4 mt-2">
                                          {senderDetails.email && (
                                            <a
                                              href={`mailto:${senderDetails.email}`}
                                              className="text-gray-600 hover:text-blue-600 transition-colors"
                                              title={senderDetails.email}
                                            >
                                              <Mail className="w-5 h-5" />
                                            </a>
                                          )}
                                          {senderDetails.github_username && (
                                            <a
                                              href={`https://github.com/${senderDetails.github_username}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-gray-600 hover:text-blue-600 transition-colors"
                                              title={`GitHub: ${senderDetails.github_username}`}
                                            >
                                              <Github className="w-5 h-5" />
                                            </a>
                                          )}
                                          {senderDetails.linkedin_url && (
                                            <a
                                              href={senderDetails.linkedin_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-gray-600 hover:text-blue-600 transition-colors"
                                              title="LinkedIn Profile"
                                            >
                                              <Linkedin className="w-5 h-5" />
                                            </a>
                                          )}
                                          {senderDetails.portfolio_url && (
                                            <a
                                              href={senderDetails.portfolio_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-gray-600 hover:text-blue-600 transition-colors"
                                              title="Portfolio Website"
                                            >
                                              <Globe className="w-5 h-5" />
                                            </a>
                                          )}
                                        </div>
                                      </div>

                                      {/* Stats on the Right */}
                                      <div className="flex gap-6">
                                        <div className="text-center">
                                          <div className="text-2xl font-bold text-blue-600">{senderDetails.projectsCompleted || 0}</div>
                                          <div className="text-sm text-gray-600">Projects</div>
                                        </div>
                                        <div className="text-center">
                                          <div className="text-2xl font-bold text-purple-600">{senderDetails.followers_count || 0}</div>
                                          <div className="text-sm text-gray-600">Followers</div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Bio */}
                                    <div>
                                      <p className="text-gray-700 leading-relaxed">{senderDetails.bio || "No bio added yet."}</p>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Two Column Layout - Skills & Stats */}
                            <div className="grid lg:grid-cols-3 gap-8">
                              {/* Skills Section - Takes 2 columns */}
                              <div className="lg:col-span-2">
                                {senderDetails.skills && senderDetails.skills.length > 0 && (
                                  <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg">
                                    <CardHeader>
                                      <CardTitle>Skills & Technologies</CardTitle>
                                      <CardDescription>Technologies and skills I'm proficient in</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                      <div>
                                        <h3 className="text-sm font-medium mb-3 block">Current Skills</h3>
                                        <div className="flex flex-wrap gap-2">
                                          {senderDetails.skills.map((skill: string, index: number) => (
                                            <Badge
                                              key={index}
                                              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                                            >
                                              {skill}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}
                              </div>

                              {/* Stats Sidebar - Takes 1 column */}
                              <div className="space-y-6">
                                <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg">
                                  <CardHeader>
                                    <CardTitle className="text-lg">Stats</CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-600">Projects Completed</span>
                                      <Badge variant="secondary" className="text-lg px-3 py-1 bg-green-100 text-green-700">
                                        {senderDetails.projectsCompleted || 0}
                                      </Badge>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-600">Active Projects</span>
                                      <Badge variant="secondary" className="text-lg px-3 py-1 bg-blue-100 text-blue-700">
                                        {senderDetails.activeProjects || 0}
                                      </Badge>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-600">Total Projects</span>
                                      <Badge variant="secondary" className="text-lg px-3 py-1 bg-purple-100 text-purple-700">
                                        {senderDetails.projectsTotal || 0}
                                      </Badge>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
