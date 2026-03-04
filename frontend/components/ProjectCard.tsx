"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, Clock, Heart, Share2, Globe, Smartphone, Zap, Database, Palette, Cpu, MapPin } from "lucide-react"
import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { MonogramLogo } from "@/components/MonogramLogo"

interface ProjectCardProps {
  project: any
  onViewDetails: (project: any) => void
  onLike: (projectId: string) => void
  onShare: (project: any) => void
  onNavigate?: (project: any) => void
  onApply?: (project: any) => void
  currentUserId?: string
  isApplying?: boolean
}

// Category to icon mapping
const CATEGORY_ICONS: Record<string, { Icon: any; gradient: string; bgColor: string }> = {
  "Web Development": { Icon: Globe, gradient: "from-blue-500 to-cyan-500", bgColor: "bg-blue-50" },
  "Mobile Development": { Icon: Smartphone, gradient: "from-purple-500 to-pink-500", bgColor: "bg-purple-50" },
  "Artificial Intelligence": { Icon: Zap, gradient: "from-yellow-500 to-orange-500", bgColor: "bg-yellow-50" },
  "Data Science": { Icon: Database, gradient: "from-green-500 to-emerald-500", bgColor: "bg-green-50" },
  "UI/UX Design": { Icon: Palette, gradient: "from-pink-500 to-rose-500", bgColor: "bg-pink-50" },
  "IoT": { Icon: Cpu, gradient: "from-indigo-500 to-blue-500", bgColor: "bg-indigo-50" },
  "Blockchain": { Icon: Database, gradient: "from-amber-500 to-yellow-500", bgColor: "bg-amber-50" },
  "Game Development": { Icon: Zap, gradient: "from-red-500 to-pink-500", bgColor: "bg-red-50" },
  "DevOps": { Icon: Cpu, gradient: "from-slate-500 to-gray-600", bgColor: "bg-slate-50" },
  "Cybersecurity": { Icon: Zap, gradient: "from-red-600 to-orange-600", bgColor: "bg-red-50" },
}

// Difficulty level color mapping
const DIFFICULTY_COLORS: Record<string, { badge: string; text: string }> = {
  "Beginner": { badge: "bg-green-100", text: "text-green-800" },
  "Intermediate": { badge: "bg-yellow-100", text: "text-yellow-800" },
  "Advanced": { badge: "bg-red-100", text: "text-red-800" },
}

// Status color mapping
const STATUS_COLORS: Record<string, { badge: string; text: string }> = {
  "recruiting": { badge: "bg-blue-500", text: "text-white" },
  "active": { badge: "bg-green-500", text: "text-white" },
  "completed": { badge: "bg-gray-500", text: "text-white" },
}

export function ProjectCard({
  project,
  onViewDetails,
  onLike,
  onShare,
  onNavigate,
  onApply,
  currentUserId,
  isApplying = false,
}: ProjectCardProps) {
  // State for real-time member count updates
  const [totalMembers, setTotalMembers] = useState(() => {
    const collaboratorsCount = project.project_collaborators?.length || 0
    return 1 + collaboratorsCount // creator + collaborators
  })

  // Update member count whenever project data changes and subscribe to real-time updates
  useEffect(() => {
    // Update from props
    const collaboratorsCount = project.project_collaborators?.length || 0
    const newTotal = 1 + collaboratorsCount
    setTotalMembers(newTotal)

    // Subscribe to real-time updates on project_collaborators table
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
      )

      const subscription = supabase
        .from(`project_collaborators:project_id=eq.${project.id}`)
        .on("*", (payload: any) => {
          // Recalculate member count when collaborators change
          // We need to fetch the current count since we don't have access to all data in the payload
          supabase
            .from("project_collaborators")
            .select("*", { count: "exact" })
            .eq("project_id", project.id)
            .then(({ count }) => {
              const newMemberCount = 1 + (count || 0) // creator + collaborators
              setTotalMembers(newMemberCount)
            })
            .catch(() => {
              // Fallback: just increment/decrement based on event type
              if (payload.eventType === "INSERT") {
                setTotalMembers((prev) => prev + 1)
              } else if (payload.eventType === "DELETE") {
                setTotalMembers((prev) => Math.max(1, prev - 1))
              }
            })
        })
        .subscribe()

      return () => {
        supabase.removeSubscription(subscription)
      }
    } catch (error) {
      // Silently handle Supabase initialization errors
      console.debug("Supabase real-time subscription not available")
    }
  }, [project.project_collaborators, project.id])

  const maxMembers = project.max_members || 10
  const isFull = totalMembers >= maxMembers
  
  const isCompleted = project.status === 'completed'
  const isRecruiting = project.status === 'recruiting'
  const isActive = project.status === 'active'
  const isMember = project.isMember
  const isOwner = currentUserId && project.creator_id === currentUserId
  const hasApplied = project.hasApplied || false

  // Get category info
  const category = project.project_type || project.category || "Web Development"
  const categoryInfo = CATEGORY_ICONS[category] || CATEGORY_ICONS["Web Development"]
  const CategoryIcon = categoryInfo.Icon

  // Get difficulty level
  const difficulty = project.difficulty_level || project.difficulty || "Beginner"
  const difficultyColors = DIFFICULTY_COLORS[difficulty] || DIFFICULTY_COLORS["Beginner"]

  // Get status info
  const status = project.status?.toLowerCase() || "recruiting"
  const statusColors = STATUS_COLORS[status] || STATUS_COLORS["recruiting"]

  // Get work style - dynamic from database
  const getWorkStyle = () => {
    if (project.is_remote) return "Remote"
    if (project.location && !project.is_remote) return "Onsite"
    return "Hybrid"
  }
  const workStyle = getWorkStyle()

  // Get duration in months - dynamic from database
  const getDurationDisplay = () => {
    if (!project.estimated_duration) return "Flexible"
    return project.estimated_duration
  }
  const duration = getDurationDisplay()

  if (hasApplied) {
    console.log(`[ProjectCard] Rendered with hasApplied=true for project: ${project.title}`)
  }

  // Get status text
  const getStatusText = () => {
    if (isCompleted) return "Completed"
    if (isActive) return "Active"
    if (isRecruiting) return "Recruiting"
    return project.status || "Recruiting"
  }

  return (
    <Card className="relative overflow-hidden border border-gray-200 bg-white hover:shadow-xl transition-all duration-300 rounded-2xl">
      <CardContent className="p-8 space-y-5">
        {/* Header: Dynamic Icon and Status Badge */}
        <div className="flex items-start justify-between gap-4">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${categoryInfo.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
            <CategoryIcon className="w-8 h-8 text-white" />
          </div>
          <Badge
            className={`${statusColors.badge} ${statusColors.text} border-0 px-3 py-1 text-xs font-medium rounded-lg`}
          >
            {getStatusText()}
          </Badge>
        </div>

        {/* Project Title - More Prominent */}
        <h3 className="text-2xl font-bold text-gray-900 leading-snug line-clamp-2">
          {project.title}
        </h3>

        {/* Category and Difficulty Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={`${categoryInfo.bgColor} text-gray-800 hover:${categoryInfo.bgColor} border-0 text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1`}>
            <CategoryIcon className="w-3 h-3" />
            {category}
          </Badge>
          <Badge className={`${difficultyColors.badge} ${difficultyColors.text} border-0 text-xs px-3 py-1.5 rounded-full font-semibold`}>
            {difficulty}
          </Badge>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 min-h-10">
          {project.description || "No description available"}
        </p>

        {/* Required Skills Section - Enhanced UI */}
        {(project.required_skills && project.required_skills.length > 0) && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Required Skills</p>
            <div className="flex flex-wrap gap-2">
              {project.required_skills.slice(0, 4).map((skill: string, idx: number) => (
                <span
                  key={idx}
                  className="px-3 py-2 rounded-full bg-gradient-to-r from-blue-50 to-purple-50 text-xs font-semibold text-gray-700 border border-blue-200 hover:border-blue-400 transition-colors"
                >
                  {skill}
                </span>
              ))}
              {project.required_skills.length > 4 && (
                <span className="px-3 py-2 rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
                  +{project.required_skills.length - 4}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Project Lead */}
        <div className="flex items-center gap-3 pt-2">
          {project.creator?.profile_image_url ? (
            <Avatar className="w-10 h-10 border-2 border-gray-200">
              <AvatarImage src={project.creator?.profile_image_url} />
              <AvatarFallback>
                <MonogramLogo 
                  initials={project.creator?.full_name?.substring(0, 2).toUpperCase() || "PL"}
                  name={project.creator?.full_name}
                  variant="vibrant"
                  size="sm"
                />
              </AvatarFallback>
            </Avatar>
          ) : (
            <MonogramLogo 
              initials={project.creator?.full_name?.substring(0, 2).toUpperCase() || "PL"}
              name={project.creator?.full_name}
              variant="vibrant"
              size="sm"
            />
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {project.creator?.full_name || "Project Lead"}
            </span>
            <span className="text-xs text-gray-500">Project Lead</span>
          </div>
        </div>

        {/* Stats Row - Member Count, Duration, and Work Style */}
        <div className="flex items-center justify-between text-gray-700 pt-2 pb-2 border-t border-gray-100">
          <div className="flex items-center gap-2" title={`${totalMembers} of ${maxMembers} members`}>
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold">{totalMembers}/{maxMembers}</span>
          </div>

          <div className="flex items-center gap-2" title="Project Duration">
            <Clock className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold">{duration}</span>
          </div>

          <div className="flex items-center gap-2" title="Work Style">
            <MapPin className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-semibold">{workStyle}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {isCompleted ? (
            <Button
              className="flex-1 bg-gray-400 text-white cursor-not-allowed h-10"
              disabled
            >
              Completed
            </Button>
          ) : isMember ? (
            <Button
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold h-10 rounded-lg shadow-sm"
              onClick={() => onNavigate && onNavigate(project)}
            >
              Open Project
            </Button>
          ) : isOwner ? (
            <Button
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold h-10 rounded-lg shadow-sm"
              onClick={() => onViewDetails(project)}
            >
              Manage Project
            </Button>
          ) : hasApplied ? (
            <Button
              className="flex-1 bg-amber-500 text-white cursor-not-allowed h-10"
              disabled
            >
              Application Pending
            </Button>
          ) : (
            <>
              <Button
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold h-10 rounded-lg shadow-sm"
                onClick={() => onApply && onApply(project)}
                disabled={isApplying}
              >
                {isApplying ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Applying...
                  </span>
                ) : (
                  "Apply Project"
                )}
              </Button>
            </>
          )}

          {!isCompleted && (
            <>
              <Button
                variant="outline"
                className="flex items-center gap-1.5 h-10 px-3 border-gray-200 hover:bg-gray-50 rounded-lg"
                onClick={(e) => {
                  e.stopPropagation()
                  onLike(project.id)
                }}
              >
                <Heart
                  className={`w-4 h-4 ${project.isLikedByUser
                    ? "fill-red-500 text-red-500"
                    : "text-gray-600"
                    }`}
                />
                <span className="text-sm font-medium text-gray-600">{project.likes || 0}</span>
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 border-gray-200 hover:bg-gray-50 rounded-lg"
                onClick={(e) => {
                  e.stopPropagation()
                  onShare(project)
                }}
              >
                <Share2 className="w-4 h-4 text-gray-600" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
