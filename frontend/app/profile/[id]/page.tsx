"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MonogramLogo } from "@/components/MonogramLogo"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  ArrowLeft,
  MapPin,
  Calendar,
  Mail,
  Github,
  Linkedin,
  Globe,
  Award,
  Code,
  MessageCircle,
  UserPlus,
  UserCheck,
  Star,
  BookOpen,
} from "lucide-react"
import Link from "next/link"
import { ActivityTimeline } from "@/components/activity-timeline"
import { NotificationSystem } from "@/components/notification-system"
import { getUserStats, getAllProjects } from "@/lib/supabase-queries"
import { supabase } from "@/lib/database"
import { handleLogout } from "@/lib/logout"
import { toast } from "sonner"

export default function UserProfilePage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const userId = params.id as string

  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<any>(null)
  const [userStats, setUserStats] = useState<any>(null)
  const [userProjects, setUserProjects] = useState<any[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    async function loadUserProfile() {
      if (!userId) return

      setLoading(true)
      try {
        // Fetch user data
        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single()

        if (profileError || !profileData) {
          console.error("Error fetching user profile:", profileError)
          toast.error("User not found")
          router.push("/collaborators")
          return
        }

        setUserData(profileData)

        // Fetch user stats
        const stats = await getUserStats(userId)
        setUserStats(stats)

        // Fetch user's projects
        const projects = await getAllProjects()
        const userProjects = projects.filter(
          (p: any) => p.creator_id === userId || p.collaborators?.some((c: any) => c.user_id === userId)
        )
        setUserProjects(userProjects)

        // Get current user info
        if (user?.uid) {
          const { data: currentUserData } = await supabase
            .from("users")
            .select("id")
            .eq("firebase_uid", user.uid)
            .single()

          setCurrentUser(currentUserData)

          // Check if already connected (this would need a connections table)
          // For now, we'll just set it to false
          setIsConnected(false)
        }
      } catch (error) {
        console.error("Error loading user profile:", error)
        toast.error("Failed to load profile")
      } finally {
        setLoading(false)
      }
    }

    loadUserProfile()
  }, [userId, user, router])

  const handleConnect = async () => {
    if (!currentUser) {
      toast.error("Please login to connect with users")
      router.push("/auth/login")
      return
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      
      const response = await fetch(`${API_URL}/api/users/${userId}/connect`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        credentials: 'include', // Send authentication cookies
        body: JSON.stringify({
          message: '' // Optional message
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send connection request');
      }

      const data = await response.json();
      console.log('Connection request sent:', data);
      
      toast.success(`Connection request sent to ${userData.full_name}!`)
      setIsConnected(true)
    } catch (error: any) {
      console.error("Error connecting:", error)
      toast.error(error.message || "Failed to send connection request")
    }
  }

  if (loading) {
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
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!userData) {
    return null
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
            <Link href="/projects" className="text-gray-600 hover:text-blue-600 transition-colors">
              Projects
            </Link>
            <Link href="/collaborators" className="text-gray-600 hover:text-blue-600 transition-colors">
              Find People
            </Link>
            <Link href="/profile" className="text-gray-600 hover:text-blue-600 transition-colors">
              My Profile
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <NotificationSystem />
            {user && (
              <div tabIndex={0} className="group relative">
                <Avatar>
                  <AvatarImage src={currentUser?.profile_image_url || "/placeholder.svg"} />
                  <AvatarFallback>
                    {user?.email?.substring(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
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
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6 text-gray-600 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  {userData.profile_image_url ? (
                    <Avatar className="w-32 h-32 mb-4 ring-4 ring-white shadow-lg">
                      <AvatarImage src={userData.profile_image_url} />
                      <AvatarFallback>
                        <MonogramLogo 
                          name={userData.full_name}
                          variant="vibrant"
                          size="2xl"
                        />
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="mb-4">
                      <MonogramLogo 
                        name={userData.full_name}
                        variant="vibrant"
                        size="2xl"
                      />
                    </div>
                  )}

                  <h1 className="text-2xl font-bold text-gray-900 mb-2">{userData.full_name || "Anonymous User"}</h1>
                  
                  {userData.bio && (
                    <p className="text-gray-600 text-sm mb-4">{userData.bio}</p>
                  )}

                  {/* Connect Button */}
                  {currentUser && currentUser.id !== userData.id && (
                    <Button
                      onClick={handleConnect}
                      disabled={isConnected}
                      className="w-full mb-4 bg-gradient-to-r from-blue-600 to-purple-600"
                    >
                      {isConnected ? (
                        <>
                          <UserCheck className="w-4 h-4 mr-2" />
                          Connected
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Connect
                        </>
                      )}
                    </Button>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 w-full mt-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{userStats?.totalProjects || 0}</div>
                      <div className="text-xs text-gray-600">Projects</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{userStats?.completedProjects || 0}</div>
                      <div className="text-xs text-gray-600">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{userData.skills?.length || 0}</div>
                      <div className="text-xs text-gray-600">Skills</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {userData.university && (
                  <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{userData.university}</span>
                  </div>
                )}
                {userData.major && (
                  <div className="flex items-center gap-2 text-sm">
                    <Code className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{userData.major}</span>
                  </div>
                )}
                {userData.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{userData.location}</span>
                  </div>
                )}
                {userData.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{userData.email}</span>
                  </div>
                )}
                {userData.created_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      Joined {new Date(userData.created_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Skills Card */}
            {userData.skills && userData.skills.length > 0 && (
              <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {userData.skills.map((skill: string) => (
                      <Badge key={skill} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Social Links */}
            {(userData.github_username || userData.linkedin_url || userData.portfolio_url) && (
              <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {userData.github_username && (
                    <a
                      href={`https://github.com/${userData.github_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <Github className="w-4 h-4" />
                      <span>@{userData.github_username}</span>
                    </a>
                  )}
                  {userData.linkedin_url && (
                    <a
                      href={userData.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <Linkedin className="w-4 h-4" />
                      <span>LinkedIn</span>
                    </a>
                  )}
                  {userData.portfolio_url && (
                    <a
                      href={userData.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      <span>Portfolio</span>
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Activity & Projects */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="projects">
              <TabsList className="bg-white/60 backdrop-blur-sm">
                <TabsTrigger value="projects">Projects</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="projects" className="space-y-6">
                <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                  <CardHeader>
                    <CardTitle>Projects</CardTitle>
                    <CardDescription>
                      {userProjects.length} project{userProjects.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {userProjects.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Code className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No projects yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userProjects.map((project) => (
                          <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            className="block p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold text-gray-900">{project.title}</h3>
                              <Badge className={
                                project.status === 'completed' ? 'bg-green-100 text-green-700' :
                                project.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                'bg-yellow-100 text-yellow-700'
                              }>
                                {project.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                              {project.description}
                            </p>
                            {project.category && (
                              <Badge variant="outline" className="text-xs">
                                {project.category}
                              </Badge>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activity">
                <ActivityTimeline userId={userId} limit={10} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
