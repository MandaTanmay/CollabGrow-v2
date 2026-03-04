"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Users,
  Plus,
  Search,
  Filter,
  Code,
  Palette,
  Database,
  Smartphone,
  Globe,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { ProjectSharing } from "@/components/project-sharing"

import { ProjectCard } from "@/components/ProjectCard"
import { MonogramLogo } from "@/components/MonogramLogo"
import { getAllProjects, getProjectLikesWithUserStatus, toggleProjectLike, getUserByFirebaseUid } from "@/lib/supabase-queries"
import { handleLogout } from "@/lib/logout"
import { useToast } from "@/components/ui/use-toast"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { api } from "@/lib/api"

const CATEGORIES = [
  "All Categories",
  "Web Development",
  "Mobile Development",
  "Artificial Intelligence",
  "Data Science",
  "Blockchain",
  "Game Development",
  "UI/UX Design",
  "DevOps",
  "Cybersecurity",
]

const DIFFICULTY_LEVELS = ["All Levels", "Beginner", "Intermediate", "Advanced"]

const STATUS_OPTIONS = ["All Status", "recruiting", "active", "completed"]

const CATEGORY_ICONS: Record<string, any> = {
  "Web Development": Globe,
  "Mobile Development": Smartphone,
  "Artificial Intelligence": Zap,
  "Data Science": Database,
  "UI/UX Design": Palette,
}

const getCategoryIcon = (category: string) => CATEGORY_ICONS[category] || Code


export default function ProjectsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
  const [selectedDifficulty, setSelectedDifficulty] = useState("All Levels")
  const [selectedStatus, setSelectedStatus] = useState("All Status")
  const [sortBy, setSortBy] = useState("newest")
  const [selectedProjectForSharing, setSelectedProjectForSharing] = useState<any>(null)

  // State for View Details Side Panel
  const [viewDetailsProject, setViewDetailsProject] = useState<any>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  // Dynamic state
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [applyingProjectId, setApplyingProjectId] = useState<string | null>(null)

  useEffect(() => {
    async function loadProjects() {
      try {
        // Get current user from database if logged in
        let dbUser = null
        if (user && user.uid) {
          dbUser = await getUserByFirebaseUid(user.uid)
          setCurrentUser(dbUser)
        }

        const data = await getAllProjects({ limit: 50 })

        // Fetch likes and user's applications if logged in
        let likesData: any[] = []
        let myApps: any[] = []

        if (data && data.length > 0) {
          const projectIds = data.map((p: any) => p.id)

          const promises: Promise<any>[] = [
            getProjectLikesWithUserStatus(projectIds, dbUser?.id || null)
          ]

          if (dbUser) {
            promises.push(api.projects.getMyApplications())
          }

          const results = await Promise.all(promises)
          likesData = results[0]
          if (results[1]) {
            const appsResponse = results[1]
            myApps = appsResponse.data || (Array.isArray(appsResponse) ? appsResponse : [])
            console.log('[Projects] My Applications fetched:', myApps.length, myApps)
          }

          console.log('[Projects] User context:', {
            dbUserId: dbUser?.id,
            firebaseUid: user?.uid
          })

          // Merge likes data and application status with projects
          const projectsWithStatus = data.map((project: any) => {
            const likeInfo = Array.isArray(likesData)
              ? likesData.find((l: any) => l.projectId === project.id)
              : null

            // Calculate joined users count (creator + active collaborators)
            const activeCollaborators = project.project_collaborators?.filter((c: any) => c.status === 'Active') || []
            const joinedCount = 1 + activeCollaborators.length // +1 for creator

            // Check if current user is a member
            const isMember = project.creator_id === dbUser?.id || activeCollaborators.some((c: any) => c.user_id === dbUser?.id)

            // Check if current user has applied
            // Use robust ID comparison and status check
            const userApp = Array.isArray(myApps)
              ? myApps.find((a: any) => String(a.project_id).toLowerCase() === String(project.id).toLowerCase())
              : null

            const hasApplied = !!userApp && (String(userApp.status).toLowerCase() === 'pending')

            if (hasApplied) {
              console.log(`[Projects] Match found: User has applied to project ${project.id} (${project.title})`)
            }

            return {
              ...project,
              likes: likeInfo?.likes || 0,
              isLikedByUser: likeInfo?.isLikedByUser || false,
              joinedCount,
              isMember,
              hasApplied
            }
          })

          console.log('[Projects] Final projects with status:', projectsWithStatus)
          setProjects(projectsWithStatus)
        } else {
          setProjects(data || [])
        }
      } catch (error) {
        console.error("Error loading projects:", error)
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [user])

  const toggleLocalLike = useCallback((projectId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          const isLiked = p.isLikedByUser
          return {
            ...p,
            isLikedByUser: !isLiked,
            likes: (p.likes || 0) + (isLiked ? -1 : 1),
          }
        }
        return p
      })
    )
  }, [])

  const handleLike = async (projectId: string) => {
    if (!user || !currentUser) {
      toast({
        title: "Please login to like projects",
        variant: "destructive"
      })
      return
    }

    try {
      toggleLocalLike(projectId)
      await toggleProjectLike(projectId, currentUser.id)
    } catch (error: any) {
      console.error("Error toggling like:", error?.message || error)
      toast({
        title: error?.message || "Failed to like project.",
        description: "Please make sure the database tables are set up correctly.",
        variant: "destructive"
      })
      toggleLocalLike(projectId)
    }
  }

  const handleApply = async (project: any) => {
    if (!user || !currentUser) {
      toast({
        title: "Please login to apply",
        description: "You must be logged in to apply for projects",
        variant: "destructive"
      })
      router.push('/auth/login')
      return
    }

    if (project.creator_id === currentUser.id) {
      toast({
        title: "Cannot apply",
        description: "You cannot apply to your own project",
        variant: "destructive"
      })
      return
    }

    if (project.status === 'completed') {
      toast({
        title: "Project completed",
        description: "This project is no longer accepting applications",
        variant: "destructive"
      })
      return
    }

    // Backend only accepts applications while recruiting
    if (project.status !== 'recruiting') {
      toast({
        title: "Not accepting applications",
        description: `This project is currently "${project.status}" and not accepting applications.`,
        variant: "destructive"
      })
      return
    }

    if (project.joinedCount >= (project.max_members || 10)) {
      toast({
        title: "Project is full",
        description: "This project has reached its maximum member limit",
        variant: "destructive"
      })
      return
    }

    const message = prompt(`Why do you want to join "${project.title}"?\n\nTell the project owner why you're a good fit:`)
    if (message === null) return // User cancelled

    setApplyingProjectId(project.id)
    try {
      const result = await api.projects.apply(project.id, { message: message || "" })
      console.log('[Apply] Success:', result)

      toast({
        title: "Application submitted!",
        description: "The project owner will review your application",
      })

      setProjects(prev =>
        prev.map(p => p.id === project.id ? { ...p, hasApplied: true } : p)
      )
    } catch (error: any) {
      console.error('[Apply] Error:', error?.message, error)
      toast({
        title: "Application failed",
        description: error?.message || "Failed to submit application",
        variant: "destructive"
      })
    } finally {
      setApplyingProjectId(null)
    }
  }

  // Filter and sort logic
  const sortedProjects = useMemo(() => {
    const filtered = projects.filter((project) => {
      const matchesSearch = !searchQuery ||
        project.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory = selectedCategory === "All Categories" || project.category === selectedCategory
      const matchesDifficulty = selectedDifficulty === "All Levels" || project.difficulty_level?.toLowerCase() === selectedDifficulty.toLowerCase()
      const matchesStatus = selectedStatus === "All Status" || project.status === selectedStatus

      return matchesSearch && matchesCategory && matchesDifficulty && matchesStatus
    })

    return [...filtered].sort((a, b) => {
      // 1. Sort by Status: Active/Recruiting first, Completed/Archived last
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      if (a.status === 'completed' && b.status !== 'completed') return 1;

      switch (sortBy) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case "popular":
          return (b.views_count || 0) - (a.views_count || 0)
        default:
          return 0
      }
    })
  }, [projects, searchQuery, selectedCategory, selectedDifficulty, selectedStatus, sortBy])

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
            <Link href="/collaborators" className="text-gray-600 hover:text-blue-600 transition-colors">
              Find People
            </Link>
            <Link href="/profile" className="text-gray-600 hover:text-blue-600 transition-colors">
              Profile
            </Link>
          </nav>

          <div className="relative flex items-center gap-4">

            <Link href="/projects/create">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </Link>
            <div tabIndex={0} className="group relative">
              {currentUser?.profile_image_url ? (
                <Avatar>
                  <AvatarImage src={currentUser.profile_image_url} />
                  <AvatarFallback>
                    <MonogramLogo 
                      name={currentUser?.full_name || user?.email || "User"}
                      variant="vibrant"
                      size="sm"
                    />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <MonogramLogo 
                  name={currentUser?.full_name || user?.email || "User"}
                  variant="vibrant"
                  size="sm"
                  className="cursor-pointer"
                />
              )}
              <div className="absolute right-0 mt-2 w-32 rounded-md bg-white shadow-lg opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 transition-opacity z-50">
                <button
                  onClick={async () => {
                    const success = await handleLogout()
                    if (success) {
                      router.push("/auth/login")
                    }
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Discover Projects</h1>
          <p className="text-gray-600">Find exciting projects to collaborate on and build amazing things together</p>
        </div>

        {/* Filters and Search */}
        <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search projects, skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/50"
                />
              </div>

              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="bg-white/50">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Difficulty Filter */}
              <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                <SelectTrigger className="bg-white/50">
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="bg-white/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-white/50">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="applications">Most Applications</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            Showing {sortedProjects.length} of {projects.length} projects
          </p>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">Filters applied</span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading projects...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && sortedProjects.length === 0 && (
          <div className="text-center py-20">
            <Code className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your filters or create a new project</p>
            <Link href="/projects/create">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </Link>
          </div>
        )}

        {/* All Projects */}
        {!loading && sortedProjects.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">All Projects</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  currentUserId={currentUser?.id}
                  isApplying={applyingProjectId === project.id}
                  onViewDetails={(proj) => {
                    setViewDetailsProject(proj)
                    setIsDetailsOpen(true)
                  }}
                  onLike={handleLike}
                  onShare={(proj) => setSelectedProjectForSharing(proj)}
                  onNavigate={(proj) => router.push(`/projects/${proj.id}/workspace`)}
                  onApply={handleApply}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Project Details Sheet (Side Panel) */}
      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
          {viewDetailsProject && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="text-2xl font-bold">{viewDetailsProject.title}</SheetTitle>
                <SheetDescription>
                  Created by {viewDetailsProject.creator?.full_name || "Unknown"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6">
                {/* Completed Badge in Details Sheet */}
                {viewDetailsProject.status === 'completed' && (
                  <div className="absolute top-4 right-4 z-10">
                    <Badge className="bg-gray-500 text-white border-0 px-3 py-1">
                      Completed
                    </Badge>
                  </div>
                )}
                {/* Main Image/Icon Area */}
                <div className="w-full h-32 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mb-6">
                  {(() => {
                    const Icon = getCategoryIcon(viewDetailsProject.category)
                    return <Icon className="w-12 h-12 text-white" />
                  })()}
                </div>

                {/* Description */}
                <div>
                  <h3 className="font-semibold text-lg mb-2">About Project</h3>
                  <p className="text-gray-600 leading-relaxed">{viewDetailsProject.description}</p>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Timeline</p>
                    <p className="font-medium">{viewDetailsProject.estimated_duration || "Flexible"}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">College</p>
                    <p className="font-medium">{viewDetailsProject.creator?.university || "Not specified"}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Status</p>
                    <p className="font-medium capitalize">{viewDetailsProject.status}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Members</p>
                    <p className="font-medium">{viewDetailsProject.joinedCount || 1} / {viewDetailsProject.max_members || 10}</p>
                  </div>
                </div>

                {/* Skills used */}
                <div>
                  <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-2">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {(viewDetailsProject.required_skills || viewDetailsProject.tags || []).map((skill: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>

                {/* Project Lead */}
                <div>
                  <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-2">Project Lead</h3>
                  <div className="flex items-center gap-3">
                    {viewDetailsProject.creator?.profile_image_url ? (
                      <Avatar>
                        <AvatarImage src={viewDetailsProject.creator?.profile_image_url} />
                        <AvatarFallback>
                          <MonogramLogo 
                            name={viewDetailsProject.creator?.full_name}
                            variant="vibrant"
                            size="sm"
                          />
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <MonogramLogo 
                        name={viewDetailsProject.creator?.full_name}
                        variant="vibrant"
                        size="sm"
                      />
                    )}
                    <div>
                      <p className="font-medium">{viewDetailsProject.creator?.full_name}</p>
                      <p className="text-xs text-gray-500">@{viewDetailsProject.creator?.username}</p>
                    </div>
                  </div>
                </div>

                {/* Joined Members */}
                {viewDetailsProject.project_collaborators && viewDetailsProject.project_collaborators.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-2">Joined Members</h3>
                    <div className="flex flex-wrap gap-2">
                      {viewDetailsProject.project_collaborators
                        .filter((c: any) => c.status === 'Active')
                        .map((collaborator: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 p-1 pr-3 bg-gray-50 rounded-full border border-gray-100">
                            {collaborator.users?.profile_image_url ? (
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={collaborator.users?.profile_image_url} />
                                <AvatarFallback>
                                  <MonogramLogo 
                                    name={collaborator.users?.full_name}
                                    variant="vibrant"
                                    size="xs"
                                  />
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <MonogramLogo 
                                name={collaborator.users?.full_name}
                                variant="vibrant"
                                size="xs"
                              />
                            )}
                            <span className="text-xs font-medium text-gray-700">
                              {collaborator.users?.full_name?.split(' ')[0] || "User"}
                            </span>
                          </div>
                        ))}
                      {viewDetailsProject.project_collaborators.filter((c: any) => c.status === 'Active').length === 0 && (
                        <p className="text-sm text-gray-500 italic">No other members yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 mt-6 border-t">
                  {viewDetailsProject.isMember ? (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => router.push(`/projects/${viewDetailsProject.id}/workspace`)}
                    >
                      View Project Workspace
                    </Button>
                  ) : viewDetailsProject.status === 'completed' ? (
                    <Button className="w-full" disabled>Project Completed</Button>
                  ) : (viewDetailsProject.max_members && (viewDetailsProject.joinedCount || 0) >= viewDetailsProject.max_members) ? (
                    <Button className="w-full" variant="secondary" disabled>Project Full</Button>
                  ) : (
                    <Button
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      onClick={() => {
                        setIsDetailsOpen(false); // Close sheet
                        handleApply(viewDetailsProject); // Trigger apply
                      }}
                    >
                      Request to Join
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Project Sharing Modal */}
      {selectedProjectForSharing && (
        <ProjectSharing
          project={selectedProjectForSharing}
          isOpen={true}
          onClose={() => setSelectedProjectForSharing(null)}
        />
      )}
    </div>
  )
}