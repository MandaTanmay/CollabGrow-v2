"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MonogramLogo } from "@/components/MonogramLogo"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  Search,
  Filter,
  Star,
  MessageCircle,
  UserPlus,
  MapPin,
  Calendar,
  Code,
  Palette,
  Database,
  Smartphone,
  Globe,
  Zap,
  Brain,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { SkillMatchingEngine } from "@/components/skill-matching-engine"
import { NotificationSystem } from "@/components/notification-system"
import { handleLogout } from "@/lib/logout"
import { getUserByFirebaseUid } from "@/lib/supabase-queries"
import { supabase } from "@/lib/database"

interface Collaborator {
  id: string
  full_name: string
  profile_image_url: string | null
  university: string | null
  major: string | null
  skills: string[] | null
  bio: string | null
  created_at: string
  is_active?: boolean
}

const SKILL_CATEGORIES = [
  "All Skills",
  "Web Development",
  "Mobile Development",
  "Data Science",
  "UI/UX Design",
  "DevOps",
  "Cybersecurity",
  "Blockchain",
]

const UNIVERSITY_OPTIONS = [
  "All Universities",
  "MIT",
  "Stanford University",
  "UC Berkeley",
  "Carnegie Mellon",
  "University of Washington",
  "Georgia Tech",
]

// Helper function to truncate bio to 2-3 lines (approximately 120-180 characters)
const getTruncatedBio = (bio: string | null, major: string | null): string => {
  if (bio && bio.length > 0) {
    return bio.length > 150 ? bio.substring(0, 150) + "..." : bio
  }
  // Generate a default bio based on major
  if (major) {
    return `${major} student passionate about learning and collaborating on innovative projects. Looking forward to connecting with like-minded individuals.`
  }
  return "Student passionate about learning and collaborating on innovative projects. Looking forward to connecting with like-minded individuals."
}

export default function CollaboratorsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSkill, setSelectedSkill] = useState("All Skills")
  const [selectedUniversity, setSelectedUniversity] = useState("All Universities")
  const [sortBy, setSortBy] = useState("newest")

  useEffect(() => {
    async function loadUser() {
      if (user?.uid) {
        const dbUser = await getUserByFirebaseUid(user.uid)
        setCurrentUser(dbUser)
      }
    }
    loadUser()
  }, [user])

  // Fetch collaborators and set up real-time subscription
  useEffect(() => {
    async function fetchCollaborators() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, full_name, profile_image_url, university, major, skills, bio, created_at")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(100)

        if (error) {
          console.error("Error fetching collaborators:", error)
          return
        }

        if (data) {
          setCollaborators(data as Collaborator[])
        }
      } catch (error) {
        console.error("Error loading collaborators:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCollaborators()

    // Set up real-time subscription for user updates
    const subscription = supabase
      .channel("users-changes")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "users",
        },
        (payload) => {
          console.log("User data changed:", payload)
          setIsUpdating(true)

          if (payload.eventType === "INSERT") {
            // Add new user to the list
            const newUser = payload.new as Collaborator
            if (newUser.is_active) {
              setCollaborators((prev) => [newUser, ...prev])
            }
          } else if (payload.eventType === "UPDATE") {
            // Update existing user in the list
            const updatedUser = payload.new as Collaborator
            setCollaborators((prev) =>
              prev.map((collab) => (collab.id === updatedUser.id ? updatedUser : collab))
            )
          } else if (payload.eventType === "DELETE") {
            // Remove user from the list
            const deletedUser = payload.old as Collaborator
            setCollaborators((prev) => prev.filter((collab) => collab.id !== deletedUser.id))
          }

          // Hide updating indicator after 1 second
          setTimeout(() => setIsUpdating(false), 1000)
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, profile_image_url, university, major, skills, bio, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) {
        console.error("Error refreshing collaborators:", error)
        return
      }

      if (data) {
        setCollaborators(data as Collaborator[])
      }
    } catch (error) {
      console.error("Error refreshing collaborators:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const filteredCollaborators = collaborators.filter((collaborator) => {
    // Exclude current user from the list
    if (currentUser && collaborator.id === currentUser.id) return false

    const matchesSearch =
      collaborator.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      collaborator.skills?.some((skill) => skill.toLowerCase().includes(searchQuery.toLowerCase())) ||
      collaborator.university?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      collaborator.major?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesSkill =
      selectedSkill === "All Skills" ||
      collaborator.skills?.some((skill) => skill.toLowerCase().includes(selectedSkill.toLowerCase()))

    const matchesUniversity =
      selectedUniversity === "All Universities" || collaborator.university === selectedUniversity

    return matchesSearch && matchesSkill && matchesUniversity
  })

  const sortedCollaborators = [...filteredCollaborators].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return (a.full_name || "").localeCompare(b.full_name || "")
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      default:
        return 0
    }
  })

  const getSkillIcon = (skill: string) => {
    if (skill.toLowerCase().includes("react") || skill.toLowerCase().includes("web")) return Globe
    if (skill.toLowerCase().includes("mobile") || skill.toLowerCase().includes("swift")) return Smartphone
    if (skill.toLowerCase().includes("design") || skill.toLowerCase().includes("ui")) return Palette
    if (skill.toLowerCase().includes("data") || skill.toLowerCase().includes("python")) return Database
    if (skill.toLowerCase().includes("ai") || skill.toLowerCase().includes("machine")) return Zap
    return Code
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
            <Link href="/feed" className="text-gray-600 hover:text-blue-600 transition-colors">
              Feed
            </Link>
            <Link href="/collaborators" className="text-blue-600 font-medium">
              Find People
            </Link>
            <Link href="/profile" className="text-gray-600 hover:text-blue-600 transition-colors">
              Profile
            </Link>
          </nav>

          <div className="relative flex items-center gap-4">
            <NotificationSystem />
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Collaborators</h1>
          <p className="text-gray-600">Connect with talented students and build amazing projects together</p>
        </div>

        {/* Tabs for AI matching vs manual browsing */}
        <Tabs defaultValue="ai-matching" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-white/60 backdrop-blur-sm">
            <TabsTrigger value="ai-matching" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              AI Skill Matching
            </TabsTrigger>
            <TabsTrigger value="browse-all" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Browse All
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-matching" className="space-y-6">
            <SkillMatchingEngine />
          </TabsContent>

          <TabsContent value="browse-all" className="space-y-6">
            {/* Filters and Search */}
            <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Search */}
                  <div className="lg:col-span-2 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search by name, skills, or university..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-white/50"
                    />
                  </div>

                  {/* Skill Filter */}
                  <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                    <SelectTrigger className="bg-white/50">
                      <SelectValue placeholder="Skills" />
                    </SelectTrigger>
                    <SelectContent>
                      {SKILL_CATEGORIES.map((skill) => (
                        <SelectItem key={skill} value={skill}>
                          {skill}
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
                      <SelectItem value="newest">Newest Members</SelectItem>
                      <SelectItem value="oldest">Oldest Members</SelectItem>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Results Summary */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <p className="text-gray-600">
                  {loading ? "Loading..." : `Showing ${sortedCollaborators.length} collaborators`}
                </p>
                {isUpdating && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 animate-pulse">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-2 animate-ping" />
                    Updating...
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Filters applied</span>
                </div>
              </div>
            </div>

            {/* All Collaborators */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">All Collaborators</h2>
              
              {loading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Card key={i} className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                      <CardContent className="p-6">
                        <div className="flex flex-col items-center animate-pulse">
                          <div className="w-16 h-16 bg-gray-200 rounded-full mb-3" />
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                          <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
                          <div className="flex gap-2 mb-4">
                            <div className="h-6 bg-gray-200 rounded w-16" />
                            <div className="h-6 bg-gray-200 rounded w-16" />
                          </div>
                          <div className="h-10 bg-gray-200 rounded w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedCollaborators.map((collaborator) => {
                    const PrimarySkillIcon = getSkillIcon(collaborator.skills?.[0] || "")
                    return (
                      <Card
                        key={collaborator.id}
                        className="border-0 bg-white/60 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                      >
                        <CardHeader className="text-center pb-3">
                          {collaborator.profile_image_url ? (
                            <Avatar className="w-20 h-20 mx-auto mb-4">
                              <AvatarImage src={collaborator.profile_image_url} />
                              <AvatarFallback>
                                <MonogramLogo 
                                  name={collaborator.full_name}
                                  variant="vibrant"
                                  size="xl"
                                />
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-20 h-20 mx-auto mb-4">
                              <MonogramLogo 
                                name={collaborator.full_name}
                                variant="vibrant"
                                size="xl"
                              />
                            </div>
                          )}
                          <CardTitle className="text-lg">{collaborator.full_name || "Anonymous User"}</CardTitle>
                          <CardDescription className="space-y-1">
                            <div className="flex items-center justify-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span className="text-xs">{collaborator.university || "University not specified"}</span>
                            </div>
                            <div className="flex items-center justify-center gap-1">
                              <Code className="w-3 h-3" />
                              <span className="text-xs">{collaborator.major || "Major not specified"}</span>
                            </div>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          {/* Bio/Description */}
                          <p className="text-sm text-gray-700 text-center mb-4 line-clamp-3">
                            {getTruncatedBio(collaborator.bio, collaborator.major)}
                          </p>

                          {/* Skills */}
                          {collaborator.skills && collaborator.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 justify-center mb-4">
                              {collaborator.skills.slice(0, 4).map((skill) => (
                                <Badge key={skill} variant="outline" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                              {collaborator.skills.length > 4 && (
                                <Badge variant="outline" className="text-xs">
                                  +{collaborator.skills.length - 4}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Action Button */}
                          <Link href={`/profile/${collaborator.id}`} className="block">
                            <Button className="w-full text-sm bg-gradient-to-r from-blue-600 to-purple-600">
                              <UserPlus className="w-4 h-4 mr-2" />
                              View
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Empty State */}
            {!loading && sortedCollaborators.length === 0 && (
              <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No collaborators found</h3>
                  <p className="text-gray-600 mb-6">Try adjusting your filters or search terms to find more people</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("")
                      setSelectedSkill("All Skills")
                      setSelectedUniversity("All Universities")
                    }}
                  >
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
