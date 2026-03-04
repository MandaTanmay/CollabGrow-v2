"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { MonogramLogo } from "@/components/MonogramLogo"
import {
  Users,
  Plus,
  Search,
  Filter,
  Star,
  MessageCircle,
  TrendingUp,
  Code,
  Palette,
  Database,
  Smartphone,
  Zap,
  Clock,
  Menu,
  X,
  Home,
  FolderOpen,
  Rss,
  UserCheck,
  Lightbulb,
  User,
  Bell,
} from "lucide-react"
import Link from "next/link"
import { RecommendationEngine } from "@/components/recommendation-engine"
import { NotificationSystem } from "@/components/notification-system"
import { useToast } from "@/components/ui/use-toast"
import {
  getUserByFirebaseUid,
  getUserStats,
  getAllProjects,
  getRecommendedCollaborators,
} from "@/lib/supabase-queries"
import { handleLogout } from "@/lib/logout"
import { supabase } from "@/lib/database"
import { toast } from "sonner"
import { io as socketIOClient } from "socket.io-client"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export default function DashboardPage() {
  const router = useRouter()
  const { user: authUser } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [userData, setUserData] = useState<any>(null)
  const [userStats, setUserStats] = useState<any>(null)
  const [recentProjects, setRecentProjects] = useState<any[]>([])
  const [recommendedCollaborators, setRecommendedCollaborators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [myProjectIds, setMyProjectIds] = useState<string[]>([])

  // Refresh user stats (can be called after accepting collaborators)
  const refreshUserStats = async () => {
    if (!userData?.id) return
    try {
      const stats = await getUserStats(userData.id)
      console.log("User stats refreshed:", stats)
      setUserStats(stats)
    } catch (error) {
      console.error("Error refreshing user stats:", error)
    }
  }

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!authUser) {
        setLoading(false)
        return
      }

      try {
        console.log("Loading dashboard for user:", authUser.uid)

        if (!authUser.uid) {
          console.error("User has no Firebase UID")
          setLoading(false)
          return
        }

        const dbUser = await getUserByFirebaseUid(authUser.uid)
        console.log("DB User loaded:", dbUser)

        if (!dbUser) {
          console.warn("User not found in database. Attempting to re-sync...")
          
          // Try to re-create the user in the database via backend login endpoint
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/login`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                firebaseUid: authUser.uid,
                email: authUser.email,
                fullName: authUser.fullName || authUser.email?.split('@')[0] || 'User',
                username: authUser.username || authUser.email?.split('@')[0] || 'user',
                profileImage: authUser.profileImage || null
              })
            })

            if (response.ok) {
              const result = await response.json()
              // Backend wraps response in { success, message, data } structure
              const data = result.data || result
              console.log("✅ User re-synced successfully")
              setUserData(data.user)
              
              // Re-fetch the user from database to get proper structure
              const reloadedUser = authUser.uid ? await getUserByFirebaseUid(authUser.uid) : null
              if (reloadedUser) {
                setUserData(reloadedUser)
                // Continue with this user
                await loadUserRelatedData(reloadedUser)
              }
            } else {
              const errorData = await response.json().catch(() => ({}));
              console.error("Failed to re-sync user:", errorData)
              toast.error("Unable to sync user data. Please try logging out and back in.")
              setLoading(false)
              return
            }
          } catch (syncError) {
            console.error("Sync error:", syncError)
            toast.error("Unable to connect to the server. Please check your connection and try again.")
            setLoading(false)
            return
          }
        } else {
          setUserData(dbUser)
          await loadUserRelatedData(dbUser)
        }
      } catch (error: any) {
        console.error("Error loading dashboard data:", {
          message: error?.message,
          stack: error?.stack,
          error: error
        })
      } finally {
        setLoading(false)
      }
    }

    const loadUserRelatedData = async (user: any) => {
      if (!user || !user.id) return

      try {
        // Fetch projects I am collaborating on
        const { data: collaborations } = await supabase
          .from('project_collaborators')
          .select('project_id')
          .eq('user_id', user.id)
          .eq('status', 'Active')

        const collabIds = collaborations?.map((c: any) => c.project_id) || []
        setMyProjectIds(collabIds)

        const stats = await getUserStats(user.id)
        console.log("User stats loaded:", stats)
        setUserStats(stats)

        // Fetch all projects the user is involved in (created or collaborating)
        // Increased limit to show all projects on initial load
        const projects = await getAllProjects({ limit: 100, involvedUser: user.id })
        console.log("Projects loaded:", projects?.length || 0, projects)
        setRecentProjects(projects || [])

        const collaborators = await getRecommendedCollaborators(user.id, 3)
        console.log("Collaborators loaded:", collaborators?.length || 0)
        setRecommendedCollaborators(collaborators || [])
      } catch (error: any) {
        console.error("Error loading user-related data:", error)
      }
    }

    loadDashboardData()
  }, [authUser, router])

  // Listen for real-time project completion events and user joining projects
  useEffect(() => {
    const socket = socketIOClient(API_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    })

    socket.on("projectCompleted", (event: any) => {
      const { projectId, status, completedAt } = event
      
      // Update the project in recentProjects with completed status
      setRecentProjects((prev) =>
        prev.map((project) =>
          project.id === projectId
            ? { ...project, status: "completed" }
            : project
        )
      )

      // Increment completed projects count in stats
      setUserStats((prev: any) => {
        if (!prev) return prev
        return {
          ...prev,
          completed_projects: (prev.completed_projects || 0) + 1
        }
      })

      // Show toast notification
      if (status === "completed") {
        const completedProject = recentProjects.find((p) => p.id === projectId)
        if (completedProject) {
          toast.success(`"${completedProject.title}" has been marked as completed!`)
        }
      }
    })

    socket.on("userJoinedProject", (event: any) => {
      const { projectId, projectTitle, userId } = event

      // If this is for the current user, add the project to recentProjects and increment active count
      if (userData?.id === userId) {
        // Increment active projects count in stats
        setUserStats((prev: any) => {
          if (!prev) return prev
          return {
            ...prev,
            active_projects: (prev.active_projects || 0) + 1
          }
        })

        // Add project to recent projects if not already there
        setRecentProjects((prev) => {
          if (!prev.some(p => p.id === projectId)) {
            return [{
              id: projectId,
              title: projectTitle,
              status: 'recruiting'
            }, ...prev]
          }
          return prev
        })

        toast.success(`You've joined "${projectTitle}"!`)
      }
    })

    socket.on("connect_error", (err: any) => {
      console.warn("[Dashboard] Socket connect_error", err?.message || err)
    })

    return () => {
      socket.disconnect()
    }
  }, [recentProjects])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b border-white/20 backdrop-blur-md bg-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              CollabGrow
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">

            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >

              Dashboard
            </Link>
            <Link
              href="/projects"
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >


              Projects
            </Link>
            <Link
              href="/feed"
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >


              Feed
            </Link>
            <Link
              href="/collaborators"
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >


              Find People
            </Link>
            <Link
              href="/recommendations"
              className="text-gray-600 hover:text-blue-600 transition-colors"            >


              Recommendations
            </Link>
            <Link
              href="/profile"
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >


              Profile
            </Link>
          </nav>

          <div className="relative flex items-center gap-4">
            <NotificationSystem onStatsRefresh={refreshUserStats} />
            <Link href="/projects/create">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">New Project</span>
              </Button>
            </Link>
            <div tabIndex={0} className="group relative">
              {userData?.profile_image_url || authUser?.profileImage ? (
                <Avatar
                  className="cursor-pointer hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <AvatarImage src={userData?.profile_image_url || authUser?.profileImage || "/placeholder.svg"} />
                  <AvatarFallback>
                    <MonogramLogo 
                      name={userData?.full_name || authUser?.fullName || authUser?.email || "User"}
                      variant="vibrant"
                      size="sm"
                    />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <MonogramLogo 
                  name={userData?.full_name || authUser?.fullName || authUser?.email || "User"}
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
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/20 bg-white/95 backdrop-blur-md">
            <nav className="container mx-auto px-4 py-4 space-y-2">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 text-blue-600 font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Home className="w-5 h-5" />
                Dashboard
              </Link>
              <Link
                href="/projects"
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 text-gray-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <FolderOpen className="w-5 h-5" />
                Projects
              </Link>
              <Link
                href="/feed"
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 text-gray-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Rss className="w-5 h-5" />
                Feed
              </Link>
              <Link
                href="/collaborators"
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 text-gray-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <UserCheck className="w-5 h-5" />
                Find People
              </Link>
              <Link
                href="/recommendations"
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 text-gray-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Lightbulb className="w-5 h-5" />
                Recommendations
              </Link>
              <Link
                href="/notifications"
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 text-gray-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Bell className="w-5 h-5" />
                Notifications
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 text-gray-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <User className="w-5 h-5" />
                Profile
              </Link>
            </nav>
          </div>
        )}
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your dashboard...</p>
            </div>
          </div>
        )}

        {!loading && (
          <>
            {/* Welcome Section */}
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Welcome back, {userData?.full_name || authUser?.fullName || "User"}!
              </h1>
              <p className="text-gray-600">Ready to collaborate on something amazing today?</p>
            </div>
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Active Projects</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {userStats?.active_projects || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Code className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Collaborators</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {userStats?.collaborators_count || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Completed</p>
                      <p className="text-2xl font-bold text-green-600">
                        {userStats?.completed_projects || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-8">
                <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-md flex items-center justify-center">
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      AI-Powered Recommendations
                    </CardTitle>
                    <CardDescription>Advanced machine learning recommendations tailored for you</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RecommendationEngine
                      userId={userData?.id}
                      preferences={{
                        skills: ["React", "Python", "Machine Learning"],
                        interests: ["AI", "Web Development", "Data Science"],
                        availability: "Part-time",
                        projectTypes: ["Web Apps", "Mobile Apps", "AI Projects"],
                      }}
                    />
                  </CardContent>
                </Card>

                {/* Search and Filter */}
                <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="Search projects, skills, or people..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 bg-white/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          aria-label="Search projects, skills, or people"
                        />
                      </div>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2 bg-transparent hover:bg-white/50 focus:ring-2 focus:ring-blue-500"
                      >
                        <Filter className="w-4 h-4" />
                        <span className="hidden sm:inline">Filter</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Projects */}
                <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      My Projects
                      <Link href="/projects">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-transparent hover:bg-white/50 focus:ring-2 focus:ring-blue-500"
                        >
                          View All ({recentProjects.length})
                        </Button>
                      </Link>
                    </CardTitle>
                    <CardDescription>Projects you are managing or collaborating on</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {recentProjects.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>No projects found. Create your first project!</p>
                        <Link href="/projects/create">
                          <Button className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Project
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      recentProjects.slice(0, 6).map((project) => (
                        <Card
                            key={project.id}
                            onClick={() => {
                              const isMember = project.creator_id === userData?.id || myProjectIds.includes(project.id)
                              router.push(isMember ? `/projects/${project.id}/workspace` : `/projects/${project.id}`)
                            }}
                            className="cursor-pointer p-4 rounded-lg bg-white shadow-sm border border-gray-100 hover:shadow-lg transition-shadow"
                          >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-gray-900 mb-1">{project.title}</h3>
                              <p className="text-sm text-gray-600 mb-2">
                                {project.description?.substring(0, 100)}
                                {project.description?.length > 100 ? "..." : ""}
                              </p>
                              <p className="text-xs text-gray-500">
                                by {project.creator?.full_name || project.creator?.username || "Unknown"}
                              </p>
                            </div>
                            <Badge
                              className={
                                project.status === "Open"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-blue-100 text-blue-700"
                              }
                            >
                              {project.status}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-3">
                            {project.project_skills?.slice(0, 3).map((ps: any, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {ps.skill?.name || "Skill"}
                              </Badge>
                            ))}
                            {project.project_skills?.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{project.project_skills.length - 3} more
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {project.current_collaborators || 0}/{project.max_collaborators || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="w-4 h-4" />
                                Chat
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-transparent hover:bg-white/50 focus:ring-2 focus:ring-blue-500"
                            >
                              View Project
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Recommended Collaborators */}
                <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">Recommended for You</CardTitle>
                    <CardDescription>People with complementary skills</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {recommendedCollaborators.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        <p className="text-sm">No recommendations yet</p>
                      </div>
                    ) : (
                      recommendedCollaborators.map((person) => (
                        <div
                          key={person.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-white/50 cursor-pointer hover:bg-white/70"
                          onClick={() => router.push(`/profile?userId=${person.id}`)}
                        >
                          {person.profile_image_url ? (
                            <Avatar>
                              <AvatarImage src={person.profile_image_url} />
                              <AvatarFallback>
                                <MonogramLogo 
                                  name={person.full_name}
                                  variant="vibrant"
                                  size="sm"
                                />
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <MonogramLogo 
                              name={person.full_name}
                              variant="vibrant"
                              size="sm"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">
                              {person.full_name || person.username}
                            </p>
                            <p className="text-xs text-gray-600">{person.university || "No university"}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-gray-600">
                                {person.total_projects || 0} projects
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs bg-transparent hover:bg-white/50 focus:ring-2 focus:ring-blue-500"
                            onClick={(e) => {
                              e.stopPropagation()
                              // Handle connect action
                            }}
                          >
                            Connect
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Trending Skills */}
                <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">Trending Skills</CardTitle>
                    <CardDescription>Popular technologies this week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { name: "React", trend: "+12%", icon: Code },
                        { name: "Python", trend: "+8%", icon: Database },
                        { name: "UI/UX", trend: "+15%", icon: Palette },
                        { name: "Flutter", trend: "+20%", icon: Smartphone },
                      ].map((skill) => (
                        <div key={skill.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <skill.icon className="w-4 h-4 text-gray-600" />
                            <span className="text-sm font-medium">{skill.name}</span>
                          </div>
                          <Badge className="bg-green-100 text-green-700 text-xs">{skill.trend}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
