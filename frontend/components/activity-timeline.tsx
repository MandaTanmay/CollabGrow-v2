"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Clock,
  Users,
  Code,
  Star,
  MessageCircle,
  UserPlus,
  Award,
  Share2,
  Heart,
  GitBranch,
  CheckCircle,
} from "lucide-react"

import { supabase } from "@/lib/database"

interface ActivityItem {
  id: string
  type:
  | "project_joined"
  | "project_completed"
  | "skill_added"
  | "collaboration_started"
  | "achievement_earned"
  | "post_liked"
  | "post_shared"
  | "milestone_reached"
  | "connection_made"
  | "application_sent"
  | "application_accepted"
  | "application_declined"
  title: string
  description: string
  timestamp: string
  relativeTime: string
  metadata?: {
    projectName?: string
    skillName?: string
    collaboratorName?: string
    achievementName?: string
    milestone?: string
    connectionCount?: number
    rating?: number
  }
  avatar?: string
  isImportant?: boolean
}

const ACTIVITY_DATA: ActivityItem[] = [
  {
    id: "1",
    type: "project_completed",
    title: "Project Completed",
    description: 'Successfully completed "EcoTracker Mobile App"',
    timestamp: "2024-01-15T10:30:00Z",
    relativeTime: "2 hours ago",
    metadata: {
      projectName: "EcoTracker Mobile App",
    },
    isImportant: true,
  },
  {
    id: "2",
    type: "collaboration_started",
    title: "New Collaboration",
    description: "Started collaborating with Sarah Chen on AI Study Assistant project",
    timestamp: "2024-01-15T08:15:00Z",
    relativeTime: "4 hours ago",
    metadata: {
      collaboratorName: "Sarah Chen",
      projectName: "AI Study Assistant",
    },
    avatar: "/generic-placeholder-graphic.png",
  },
  {
    id: "3",
    type: "achievement_earned",
    title: "Achievement Unlocked",
    description: 'Earned "Team Player" badge for completing 5+ collaborative projects',
    timestamp: "2024-01-14T16:45:00Z",
    relativeTime: "1 day ago",
    metadata: {
      achievementName: "Team Player",
    },
    isImportant: true,
  },
  {
    id: "4",
    type: "skill_added",
    title: "Skill Added",
    description: 'Added "Machine Learning" to skill set',
    timestamp: "2024-01-14T14:20:00Z",
    relativeTime: "1 day ago",
    metadata: {
      skillName: "Machine Learning",
    },
  },
  {
    id: "5",
    type: "post_liked",
    title: "Post Engagement",
    description: "Your project post received 15 likes and 8 comments",
    timestamp: "2024-01-14T11:30:00Z",
    relativeTime: "1 day ago",
  },
  {
    id: "6",
    type: "connection_made",
    title: "New Connection",
    description: "Connected with 3 new collaborators this week",
    timestamp: "2024-01-13T09:00:00Z",
    relativeTime: "2 days ago",
    metadata: {
      connectionCount: 3,
    },
  },
  {
    id: "7",
    type: "project_joined",
    title: "Project Joined",
    description: 'Joined "Campus Event Discovery Platform" as Frontend Developer',
    timestamp: "2024-01-12T15:45:00Z",
    relativeTime: "3 days ago",
    metadata: {
      projectName: "Campus Event Discovery Platform",
    },
  },
  {
    id: "9",
    type: "milestone_reached",
    title: "Milestone Reached",
    description: "Reached 100 profile views this month",
    timestamp: "2024-01-10T10:15:00Z",
    relativeTime: "5 days ago",
    metadata: {
      milestone: "100 Profile Views",
    },
  },
  {
    id: "10",
    type: "post_shared",
    title: "Content Shared",
    description: "Your project was shared 12 times across social platforms",
    timestamp: "2024-01-09T16:30:00Z",
    relativeTime: "6 days ago",
  },
]

export function ActivityTimeline({ userId, limit }: { userId?: string; limit?: number }) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "projects" | "social" | "achievements">("all")

  const getActivityIcon = useCallback((type: string) => {
    switch (type) {
      case "project_joined":
        return <Code className="w-4 h-4" />
      case "project_completed":
        return <CheckCircle className="w-4 h-4" />
      case "skill_added":
        return <Star className="w-4 h-4" />
      case "collaboration_started":
        return <Users className="w-4 h-4" />
      case "achievement_earned":
        return <Award className="w-4 h-4" />
      case "post_liked":
        return <Heart className="w-4 h-4" />
      case "post_shared":
        return <Share2 className="w-4 h-4" />
      case "review_received":
        return <MessageCircle className="w-4 h-4" />
      case "milestone_reached":
        return <GitBranch className="w-4 h-4" />
      case "connection_made":
        return <UserPlus className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }, [])

  const getActivityColor = useCallback((type: string) => {
    switch (type) {
      case "project_completed":
        return "text-green-600 bg-green-100"
      case "achievement_earned":
        return "text-yellow-600 bg-yellow-100"
      case "collaboration_started":
        return "text-purple-600 bg-purple-100"
      case "skill_added":
        return "text-blue-600 bg-blue-100"
      case "post_liked":
        return "text-red-600 bg-red-100"
      case "milestone_reached":
        return "text-orange-600 bg-orange-100"
      default:
        return "text-gray-600 bg-gray-100"
    }
  }, [])

  useEffect(() => {
    const fetchActivities = async () => {
      if (!userId) {
        setActivities([])
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      try {
        // Fetch collaboration request activities (sent by user)
        const { data: requests, error: reqError } = await supabase
          .from("collaboration_requests")
          .select("*, project:projects(title)")
          .eq("requester_id", userId)
          .order("created_at", { ascending: false })
          .limit(20)
        let activityItems: ActivityItem[] = []
        if (requests && requests.length > 0) {
          activityItems = requests.map((req: any) => ({
            id: req.id,
            type: req.status === "pending" ? "application_sent" : req.status === "accepted" ? "application_accepted" : "application_declined",
            title: req.status === "pending" ? "Request Sent" : req.status === "accepted" ? "Request Accepted" : "Request Declined",
            description: req.status === "pending"
              ? `You sent a request to join "${req.project?.title || "a project"}".`
              : req.status === "accepted"
                ? `Your request to join "${req.project?.title || "a project"}" was accepted!`
                : `Your request to join "${req.project?.title || "a project"}" was declined.`,
            timestamp: req.created_at,
            relativeTime: new Date(req.created_at).toLocaleString(),
            isImportant: req.status === "accepted",
            metadata: { projectName: req.project?.title },
          }))
        }
        setActivities(activityItems)
      } catch (error) {
        console.error("[v0] Error loading activities:", error)
        setActivities([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchActivities()
  }, [userId])

  useEffect(() => {
    if (activities.length > 0 && !isLoading) {
      const timeoutId = setTimeout(() => {
        try {
          localStorage.setItem(`collabgrow_activities_${userId}`, JSON.stringify(activities))
        } catch (error) {
          console.error("[v0] Error saving activities:", error)
        }
      }, 500)

      return () => clearTimeout(timeoutId)
    }
  }, [activities, userId, isLoading])

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.05) {
        // Reduced from 0.1 to 0.05 (5% chance)
        const newActivities = [
          {
            id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: "post_liked" as const,
            title: "New Like",
            description: "Someone liked your recent project post",
            timestamp: new Date().toISOString(),
            relativeTime: "Just now",
          },
          {
            id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: "connection_made" as const,
            title: "New Connection",
            description: "A new developer wants to connect with you",
            timestamp: new Date().toISOString(),
            relativeTime: "Just now",
          },
        ]

        const randomActivity = newActivities[Math.floor(Math.random() * newActivities.length)]
        setActivities((prev) => [randomActivity, ...prev.slice(0, 24)]) // Keep 25 items max
      }
    }, 60000) // Increased to 60 seconds

    return () => clearInterval(interval)
  }, [])

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      if (filter === "all") return true
      if (filter === "projects")
        return ["project_joined", "project_completed", "collaboration_started"].includes(activity.type)
      if (filter === "social") return ["post_liked", "post_shared", "connection_made"].includes(activity.type)
      if (filter === "achievements")
        return ["achievement_earned", "milestone_reached", "review_received"].includes(activity.type)
      return true
    })
  }, [activities, filter])

  const displayedActivities = useMemo(() => {
    return limit ? filteredActivities.slice(0, limit) : filteredActivities
  }, [filteredActivities, limit])

  const filterOptions = useMemo(
    () => [
      { key: "all", label: "All Activity" },
      { key: "projects", label: "Projects" },
      { key: "social", label: "Social" },
      { key: "achievements", label: "Achievements" },
    ],
    [],
  )

  const loadingSkeleton = useMemo(
    () => (
      <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    ),
    [],
  )

  if (isLoading) {
    return loadingSkeleton
  }

  return (
    <div className="space-y-4">
      {!limit && (
        <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Activity Timeline
            </CardTitle>
            <CardDescription>Your recent activity and achievements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              {filterOptions.map((filterOption) => (
                <Button
                  key={filterOption.key}
                  variant={filter === filterOption.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(filterOption.key as any)}
                  className={
                    filter === filterOption.key ? "bg-gradient-to-r from-blue-600 to-purple-600" : "bg-transparent"
                  }
                >
                  {filterOption.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-6">
            {displayedActivities.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Activity Yet</h3>
                <p className="text-gray-600">Start collaborating on projects to see your activity timeline!</p>
              </div>
            ) : (
              displayedActivities.map((activity, index) => (
                <div key={activity.id} className="relative">
                  {/* Timeline Line */}
                  {index < displayedActivities.length - 1 && (
                    <div className="absolute left-4 top-8 w-0.5 h-6 bg-gray-200" />
                  )}

                  <div className="flex items-start gap-4">
                    {/* Activity Icon */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(activity.type)} ${activity.isImportant ? "ring-2 ring-blue-200" : ""}`}
                    >
                      {getActivityIcon(activity.type)}
                    </div>

                    {/* Activity Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-gray-900">{activity.title}</h4>
                            {activity.isImportant && (
                              <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs">
                                Important
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{activity.description}</p>

                          {/* Metadata */}
                          {activity.metadata && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {activity.metadata.projectName && (
                                <Badge variant="outline" className="text-xs">
                                  <Code className="w-3 h-3 mr-1" />
                                  {activity.metadata.projectName}
                                </Badge>
                              )}
                              {activity.metadata.skillName && (
                                <Badge variant="outline" className="text-xs">
                                  <Star className="w-3 h-3 mr-1" />
                                  {activity.metadata.skillName}
                                </Badge>
                              )}
                              {activity.metadata.rating && (
                                <Badge variant="outline" className="text-xs">
                                  <Star className="w-3 h-3 mr-1 fill-current text-yellow-500" />
                                  {activity.metadata.rating}/5
                                </Badge>
                              )}
                              {activity.metadata.connectionCount && (
                                <Badge variant="outline" className="text-xs">
                                  <Users className="w-3 h-3 mr-1" />
                                  {activity.metadata.connectionCount} connections
                                </Badge>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {activity.relativeTime}
                            </span>
                            {activity.metadata?.collaboratorName && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {activity.metadata.collaboratorName}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Avatar (if applicable) */}
                        {activity.avatar && (
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={activity.avatar || "/placeholder.svg"} />
                            <AvatarFallback>
                              {activity.metadata?.collaboratorName
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("") || "U"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Load More Button */}
          {limit && filteredActivities.length > limit && (
            <div className="text-center mt-6">
              <Button variant="outline" className="bg-transparent">
                View All Activity
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
