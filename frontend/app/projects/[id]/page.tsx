"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ArrowLeft,
  Users,
  Settings,
  MessageCircle,
  UserPlus,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { MonogramLogo } from "@/components/MonogramLogo"
import { getProjectById, getUserByFirebaseUid, incrementProjectView } from "@/lib/supabase-queries"
import { supabase } from "@/lib/database"
import { useToast } from "@/components/ui/use-toast"
import { api } from "@/lib/api"

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Owner & Requests management
  const [joinRequests, setJoinRequests] = useState<any[]>([])
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    async function checkOwnerAndFetchRequests() {
      if (!user || !user.uid || !project) return

      // Determine if owner
      // project.creator_id is usually UUID. user.uid is Firebase.
      // We need DB user.
      const dbUser = await getUserByFirebaseUid(user.uid)
      if (!dbUser) return

      const isOwnerCheck = project.creator_id === dbUser.id
      setIsOwner(isOwnerCheck)

      if (isOwnerCheck) {
        // Fetch pending requests
        const { data: requests } = await supabase
          .from("collaboration_requests")
          .select("*, requester:users(*)")
          .eq("project_id", project.id)
          .eq("status", "pending")

        setJoinRequests(requests || [])
      }
    }

    checkOwnerAndFetchRequests()
  }, [user, project])

  const handleRequestAction = async (requestId: string, action: 'accepted' | 'rejected') => {
    try {
      await api.requests.update(requestId, action)

      // Remove from list
      setJoinRequests(prev => prev.filter(r => r.id !== requestId))
      toast({
        title: `Request ${action}!`,
        description: `The collaboration request has been ${action}.`
      })

      // Optionally refresh project members (would require reloading project)
      // window.location.reload() or re-fetch project
    } catch (err) {
      toast({
        title: "Error",
        description: String(err),
        variant: "destructive"
      })
    }
  }

  // Check for existing request status
  const [requestStatus, setRequestStatus] = useState<string | null>(null)

  useEffect(() => {
    async function checkRequestStatus() {
      if (!user || !user.uid || !project) return

      try {
        // Need current user DB ID
        const dbUser = await getUserByFirebaseUid(user.uid)
        if (!dbUser) return

        const { data: request } = await supabase
          .from("collaboration_requests")
          .select("status")
          .eq("project_id", project.id)
          .eq("requester_id", dbUser.id)
          .maybeSingle()

        if (request) {
          setRequestStatus(request.status)
        }

        // Also check if already a collaborator
        const { data: collab } = await supabase
          .from("project_collaborators")
          .select("status")
          .eq("project_id", project.id)
          .eq("user_id", dbUser.id)
          .eq("status", "Active")
          .maybeSingle()

        if (collab) {
          setRequestStatus("accepted")
        }

      } catch (err) {
        console.error("Error checking status:", err)
      }
    }

    if (project) {
      checkRequestStatus()
    }
  }, [user, project])

  const handleJoinRequest = async () => {
    // Logic handled below, just defining function here
    const maxMembers = project?.max_members || 0
    const totalMembers = 1 + (project?.project_collaborators?.length || 0)
    const isProjectFull = maxMembers > 0 && totalMembers >= maxMembers

    if (isProjectFull) return;

    // Backend only accepts applications while recruiting
    if (project?.status && project.status !== 'recruiting') {
      toast({
        title: "Not accepting applications",
        description: `This project is currently "${project.status}" and not accepting applications.`,
        variant: "destructive",
      })
      return
    }

    if (!user) {
      toast({ title: "You must be logged in to request to join.", variant: "destructive" })
      return;
    }

    const message = prompt("Why do you want to join this project? (Optional)")

    try {
      await api.projects.apply(project.id, { message: message || "" })
      toast({ title: "Request sent successfully!" })
      setRequestStatus("pending")
    } catch (err: any) {
      toast({
        title: "Failed to send request",
        description: err?.message || "An error occurred",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    async function loadProject() {
      if (!params.id) {
        setError("No project ID provided")
        setLoading(false)
        return
      }

      try {
        console.log("🔍 Fetching project with ID:", params.id)
        const data = await getProjectById(params.id as string)
        console.log("✅ Project loaded:", data)
        setProject(data)
        setError(null)

        // Increment view count dynamically (DB for analytics)
        incrementProjectView(params.id as string).then((res) => {
          if (res?.success && typeof res.views === 'number') {
            console.log("👁️ View count incremented:", res.views)
            setProject((prev: any) => ({ ...prev, views: res.views }))
          }
        })
        // Record view interaction for ML
        if (user) {
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/projects/${params.id as string}/interaction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'view' }),
              credentials: 'include'
            })
          } catch (e) {
            // Ignore errors for analytics
          }
        }
      } catch (err: any) {
        console.error("❌ Error loading project:", err)
        setError(err.message || "Failed to load project")
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-2">
            {error || "Project not found"}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            {params.id && `Project ID: ${params.id}`}
          </p>
          <Button onClick={() => router.push("/projects")} className="mt-4">
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "recruiting":
        return "bg-blue-100 text-blue-700"
      case "active":
        return "bg-green-100 text-green-700"
      case "completed":
        return "bg-gray-100 text-gray-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case "beginner":
        return "bg-green-100 text-green-700"
      case "intermediate":
        return "bg-yellow-100 text-yellow-700"
      case "advanced":
        return "bg-red-100 text-red-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  // Count total members: creator + collaborators
  const totalMembers = 1 + (project.project_collaborators?.length || 0)
  const maxMembers = project.max_members || 0
  const isProjectFull = maxMembers > 0 && totalMembers >= maxMembers

  // Handler functions
  const handleApply = async () => {
    try {
      await api.projects.apply(project.id, { message: "" })
      toast({ title: "Request sent successfully!" })
      setRequestStatus("pending")
    } catch (err: any) {
      toast({
        title: "Failed to send request",
        description: err?.message || "An error occurred",
        variant: "destructive"
      })
    }
  }

  const handleLike = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/projects/${project.id}/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like' }),
        credentials: 'include'
      })
      if (response.ok) {
        toast({ title: "Project liked!" })
      }
    } catch (err) {
      toast({ title: "Failed to like project", variant: "destructive" })
    }
  }

  const handleBookmark = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/projects/${project.id}/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bookmark' }),
        credentials: 'include'
      })
      if (response.ok) {
        toast({ title: "Project bookmarked!" })
      }
    } catch (err) {
      toast({ title: "Failed to bookmark", variant: "destructive" })
    }
  }

  const handleCollaborate = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/projects/${project.id}/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'collaborate' }),
        credentials: 'include'
      })
      if (response.ok) {
        toast({ title: "Collaboration started!" })
      }
    } catch (err) {
      toast({ title: "Failed to collaborate", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b border-white/20 backdrop-blur-md bg-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              CollabGrow
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 transition-colors">
              Dashboard
            </Link>
            <Link href="/projects" className="text-blue-600 font-medium">
              Projects
            </Link>
            <Link href="/feed" className="text-gray-600 hover:text-blue-600 transition-colors">
              Feed
            </Link>
            <Link href="/profile" className="text-gray-600 hover:text-blue-600 transition-colors">
              Profile
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <div 
              className="cursor-pointer" 
              onClick={() => router.push("/profile")}
              title="Go to profile"
            >
              <MonogramLogo 
                name={user?.displayName || user?.email || "User"}
                variant="vibrant"
                size="sm"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Back Button */}
            <div>
              <Button
                variant="outline"
                onClick={() => router.push("/projects")}
                className="bg-white/60 backdrop-blur-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Projects
              </Button>
            </div>

            {/* Project Header Card */}
            <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
              <CardContent className="p-8">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-gray-900 mb-1">{project.title}</h1>
                  <p className="text-sm text-gray-500 mb-4">Created by {project.creator?.full_name || 'Unknown'}</p>

                  {/* Hero banner */}
                  <div className="w-full rounded-xl overflow-hidden mb-6">
                    <div className="w-full h-36 md:h-44 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <div className="w-full max-w-3xl px-12 py-6 flex items-center justify-center">
                        <div className="w-full h-28 md:h-32 bg-gradient-to-r from-blue-400 to-purple-400 rounded-xl flex items-center justify-center shadow-lg">
                          <Zap className="w-12 h-12 text-white opacity-90" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* About Project */}
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">About Project</h3>
                  <p className="text-gray-700 leading-relaxed mb-6">
                    {project.description?.replace(/Be Responsible\s+Requirements:\s*On time\s+Timeline:\s*/gi, '').trim() || 'No description available'}
                  </p>

                  {/* Metadata grid (Timeline, College, Status, Members, Category, Difficulty) */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <p className="text-xs text-gray-500">Category</p>
                      <p className="font-semibold mt-1">{project.project_type || project.category || 'Web Development'}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <p className="text-xs text-gray-500">Level</p>
                      <p className="font-semibold mt-1">{project.difficulty_level || project.difficulty || 'Beginner'}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <p className="text-xs text-gray-500">Status</p>
                      <p className="font-semibold mt-1 capitalize">{project.status || 'Recruiting'}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <p className="text-xs text-gray-500">Members</p>
                      <p className="font-semibold mt-1">{totalMembers} / {maxMembers || '10'}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <p className="text-xs text-gray-500">Timeline</p>
                      <p className="font-semibold mt-1">{project.estimated_duration || 'Flexible'}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <p className="text-xs text-gray-500">University</p>
                      <p className="font-semibold mt-1">{project.creator?.university || 'Not specified'}</p>
                    </div>
                  </div>

                  {/* Skills heading (keeps the section even if empty) */}
                  <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-3">SKILLS</h4>

                  {/* Project Lead (compact) */}
                  <div className="border-t border-gray-100 pt-6 mt-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Project Lead</h3>
                    <div className="flex items-center gap-4">
                      {project.creator?.profile_image_url ? (
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={project.creator?.profile_image_url} />
                          <AvatarFallback>
                            <MonogramLogo 
                              name={project.creator?.full_name}
                              variant="vibrant"
                              size="md"
                            />
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <MonogramLogo 
                          name={project.creator?.full_name}
                          variant="vibrant"
                          size="md"
                        />
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">{project.creator?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">@{project.creator?.username || (project.creator?.full_name?.split(' ')[0]?.toLowerCase() || 'lead')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Full-width action button matching screenshot */}
                  <div className="mt-8">
                    <Button
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg"
                      onClick={handleJoinRequest}
                      disabled={isProjectFull}
                    >
                      {isProjectFull ? 'Project Full' : 'Request to Join'}
                    </Button>
                  </div>
                </div>

                {/* Project Links */}
                {(project.repository_url || project.demo_url || project.documentation_url) && (
                  <div className="mb-6 pb-6 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Project Resources
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {project.repository_url && (
                        <a
                          href={project.repository_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition-colors"
                        >
                          <span>🔗</span> Repository
                        </a>
                      )}
                      {project.demo_url && (
                        <a
                          href={project.demo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                        >
                          <span>🚀</span> Live Demo
                        </a>
                      )}
                      {project.documentation_url && (
                        <a
                          href={project.documentation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                        >
                          <span>📚</span> Documentation
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Required Skills */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Required Skills
                  </h3>
                  {project.required_skills && project.required_skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {project.required_skills.map((skill: string, index: number) => (
                        <Badge key={index} className="bg-gradient-to-r from-blue-50 to-purple-50 text-gray-800 border border-blue-100 hover:border-blue-300 px-4 py-2 rounded-full font-medium transition-colors">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No specific skills listed</p>
                  )}
                </div>

                {/* Tags */}
                {project.tags && project.tags.length > 0 && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="outline" className="bg-white/50 text-gray-700 border-gray-300">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Project Lead */}
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    Project Lead
                  </h3>
                  <div className="flex items-center gap-4">
                    {project.creator?.profile_image_url ? (
                      <Avatar className="w-14 h-14">
                        <AvatarImage src={project.creator?.profile_image_url} />
                        <AvatarFallback>
                          <MonogramLogo 
                            name={project.creator?.full_name}
                            variant="vibrant"
                            size="lg"
                          />
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <MonogramLogo 
                        name={project.creator?.full_name}
                        variant="vibrant"
                        size="lg"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-lg">
                        {project.creator?.full_name || "Unknown"}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {project.creator?.university || "No university listed"}
                      </p>
                      {project.creator?.major && (
                        <p className="text-xs text-gray-500 mt-1">
                          🎓 {project.creator.major}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Join Requests Card (Owner Only) */}
            {isOwner && joinRequests.length > 0 && (
              <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg mb-6 border-l-4 border-l-orange-500">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-orange-500" />
                    Join Requests
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 ml-auto">{joinRequests.length}</Badge>
                  </h3>
                  <div className="space-y-4">
                    {joinRequests.map(req => (
                      <div key={req.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                          {req.requester?.profile_image_url ? (
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={req.requester?.profile_image_url} />
                              <AvatarFallback>
                                <MonogramLogo 
                                  name={req.requester?.full_name}
                                  variant="vibrant"
                                  size="xs"
                                />
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <MonogramLogo 
                              name={req.requester?.full_name}
                              variant="vibrant"
                              size="xs"
                            />
                          )}
                          <div>
                            <p className="text-sm font-semibold">{req.requester?.full_name}</p>
                            <p className="text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {req.message && <p className="text-sm text-gray-700 italic mb-3">"{req.message}"</p>}
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleRequestAction(req.id, 'accepted')}>Accept</Button>
                          <Button size="sm" variant="outline" className="flex-1 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50" onClick={() => handleRequestAction(req.id, 'rejected')}>Decline</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Stats Card */}
            <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
              <CardContent className="p-6 space-y-6">
                {/* Members */}
                <div className="text-center pb-4">
                  <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {maxMembers > 0 ? `${totalMembers}/${maxMembers}` : totalMembers}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Members {isProjectFull && <span className="text-red-600 font-medium">(Full)</span>}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-4">
                  {isOwner ? (
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => router.push(`/projects/${project.id}/workspace`)}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Manage Workspace
                    </Button>
                  ) : requestStatus === "accepted" ? (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => router.push(`/projects/${project.id}/workspace`)}
                    >
                      Go to Workspace
                    </Button>
                  ) : requestStatus === "pending" ? (
                    <Button className="w-full bg-gray-400 cursor-not-allowed" disabled>
                      Request Pending
                    </Button>
                  ) : isProjectFull ? (
                    <Button className="w-full bg-red-400 cursor-not-allowed" disabled>
                      Project Full
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={handleApply}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Send Join Request
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Project Owner Card */}
            <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Project Owner
                </h3>
                <div className="space-y-3">
                  {/* Project Creator/Owner */}
                  {project.creator ? (
                    <div className="flex items-center gap-3">
                      {project.creator?.profile_image_url ? (
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={project.creator.profile_image_url} />
                          <AvatarFallback>
                            <MonogramLogo 
                              name={project.creator?.full_name}
                              variant="vibrant"
                              size="sm"
                            />
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <MonogramLogo 
                          name={project.creator?.full_name}
                          variant="vibrant"
                          size="sm"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {project.creator?.full_name || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          Project Lead
                        </p>
                        {project.creator?.university && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {project.creator.university}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No project owner information
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
