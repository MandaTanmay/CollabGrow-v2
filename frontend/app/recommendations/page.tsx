"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MonogramLogo } from "@/components/MonogramLogo"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Users,
  Star,
  TrendingUp,
  Zap,
  Target,
  Brain,
  UserPlus,
  Eye,
  MessageCircle,
  Clock,
  Code,
  Palette,
  Database,
  Smartphone,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { handleLogout } from "@/lib/logout"
import { getUserByFirebaseUid } from "@/lib/supabase-queries"
import { api } from "@/lib/api"

export default function RecommendationsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Dynamic recommendation data
  const [recommendedProjects, setRecommendedProjects] = useState<any[]>([])
  const [recommendedCollaborators, setRecommendedCollaborators] = useState<any[]>([])
  const [recommendedSkills, setRecommendedSkills] = useState<any[]>([])
  const [trendingSkills, setTrendingSkills] = useState<any[]>([])

  useEffect(() => {
    async function loadUser() {
      if (user) {
        const dbUser = await getUserByFirebaseUid(user.uid)
        setCurrentUser(dbUser)
      }
    }
    loadUser()
  }, [user])

  useEffect(() => {
    async function loadRecommendations() {
      if (!currentUser?.id) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        // Fetch ML-based project recommendations
        const mlProjectsRes = await api.recommendations.getMlProjects(10)
        const mlProjects = mlProjectsRes.projects || []
        // Map backend data to frontend format
        const mappedProjects = mlProjects.map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.description || '',
          owner: {
            name: p.creator_name || 'Unknown',
            avatar: '/placeholder.svg?height=40&width=40',
            university: p.university || 'N/A',
            rating: 4.8,
          },
          skills: Array.isArray(p.skills) ? p.skills : [],
          category: p.category || 'General',
          difficulty: p.difficulty_level || 'Intermediate',
          duration: 'Varies',
          members: 0,
          maxMembers: p.max_team_size || 5,
          matchScore: p.match ? Math.round(p.match) : 75,
          matchReasons: ['ML-based recommendation'],
          views: 0,
          applications: 0,
        }))
        setRecommendedProjects(mappedProjects)
        // Optionally, fetch and set collaborators/skills as before
        setRecommendedCollaborators([])
        setRecommendedSkills([])
        setTrendingSkills([])
      } catch (error: any) {
        console.error('Error loading ML recommendations:', error)
        setRecommendedProjects([])
      } finally {
        setLoading(false)
      }
    }
    loadRecommendations()
  }, [currentUser])

  const handleRefreshRecommendations = async () => {
    setRefreshing(true)
    try {
      if (currentUser?.id) {
        const data = await api.recommendations.getAll({
          projects: 10,
          collaborators: 10,
          skills: 6,
        })
        // Re-map the data (same logic as above)
        const mappedProjects = (data.projects || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.description || '',
          owner: {
            name: p.creator_name || 'Unknown',
            avatar: '/placeholder.svg?height=40&width=40',
            university: p.university || 'N/A',
            rating: 4.8,
          },
          skills: Array.isArray(p.required_skills) ? p.required_skills : [],
          category: p.category || 'General',
          difficulty: p.difficulty_level || 'Intermediate',
          duration: 'Varies',
          members: 0,
          maxMembers: p.max_team_size || 5,
          matchScore: p.compatibility_score ? Math.round(p.compatibility_score) : 75,
          matchReasons: p.explanation ? 
            (typeof p.explanation === 'string' ? JSON.parse(p.explanation) : p.explanation) : 
            ['Compatible skills', 'Good fit'],
          views: 0,
          applications: 0,
        }))
        
        const mappedCollaborators = (data.collaborators || []).map((c: any) => ({
          id: c.id,
          name: c.full_name || c.username || 'Unknown',
          avatar: c.profile_image_url || '/placeholder.svg?height=60&width=60',
          university: c.university || 'N/A',
          major: c.major || 'Not specified',
          skills: Array.isArray(c.skills) ? c.skills : [],
          rating: 4.5 + (Math.random() * 0.5),
          projectsCompleted: c.projects_completed || 0,
          matchScore: c.compatibility_score ? Math.round(c.compatibility_score) : 75,
          matchReasons: c.explanation ? 
            (typeof c.explanation === 'string' ? JSON.parse(c.explanation) : c.explanation) : 
            ['Complementary skills', 'Similar interests'],
          availability: c.weekly_availability === 'full-time' ? 'Available' : 'Busy',
          mutualConnections: c.connection_count || 0,
        }))
        
        const mappedSkills = (data.skills || []).map((s: any) => ({
          name: s.skill,
          reason: s.reason === 'complementary' ? 'Complements your current skills' : 'High demand in projects',
          demand: s.project_demand || 0,
          difficulty: s.difficulty === 1 ? 'Beginner' : s.difficulty === 2 ? 'Intermediate' : 'Advanced',
          timeToLearn: s.difficulty === 1 ? '1-2 weeks' : s.difficulty === 2 ? '2-4 weeks' : '1-2 months',
          growthPotential: s.growth_potential || 'medium',
        }))
        
        setRecommendedProjects(mappedProjects)
        setRecommendedCollaborators(mappedCollaborators)
        setRecommendedSkills(mappedSkills)
      }
    } catch (error) {
      console.error('Error refreshing recommendations:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-100"
    if (score >= 80) return "text-blue-600 bg-blue-100"
    if (score >= 70) return "text-yellow-600 bg-yellow-100"
    return "text-gray-600 bg-gray-100"
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
            <Link href="/recommendations" className="text-blue-600 font-medium">
              Recommendations
            </Link>
            <Link href="/profile" className="text-gray-600 hover:text-blue-600 transition-colors">
              Profile
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={handleRefreshRecommendations}
              disabled={refreshing}
              className="bg-transparent"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Updating..." : "Refresh"}
            </Button>
            <div tabIndex={0} className="group relative">
              {currentUser?.profile_image_url || user?.photoURL ? (
                <Avatar>
                  <AvatarImage src={currentUser?.profile_image_url || user?.photoURL || "/placeholder.svg?height=32&width=32"} />
                  <AvatarFallback>
                    <MonogramLogo 
                      name={currentUser?.full_name || user?.displayName || user?.email || "User"}
                      variant="vibrant"
                      size="sm"
                    />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <MonogramLogo 
                  name={currentUser?.full_name || user?.displayName || user?.email || "User"}
                  variant="vibrant"
                  size="sm"
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
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Smart Recommendations</h1>
          </div>
          <p className="text-gray-600">Personalized suggestions based on your skills, interests, and activity</p>
        </div>

        <Tabs defaultValue="projects" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4 bg-white/60 backdrop-blur-sm">
            <TabsTrigger value="projects">Recommended Projects</TabsTrigger>
            <TabsTrigger value="collaborators">Suggested People</TabsTrigger>
            <TabsTrigger value="skills">Skill Development</TabsTrigger>
            <TabsTrigger value="trends">Trending Now</TabsTrigger>
          </TabsList>

          {/* Recommended Projects */}
          <TabsContent value="projects">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Projects Perfect for You</h2>
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  <Brain className="w-3 h-3 mr-1" />
                  AI Powered
                </Badge>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {loading ? (
                  <div className="col-span-2 text-center py-8">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                    <p className="text-gray-600">Loading recommendations...</p>
                  </div>
                ) : recommendedProjects.length === 0 ? (
                  <div className="col-span-2 text-center py-8">
                    <Brain className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-600">No project recommendations available yet.</p>
                  </div>
                ) : recommendedProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="border-0 bg-white/60 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-lg leading-tight">{project.title}</CardTitle>
                            <Badge className={`${getMatchScoreColor(project.matchScore)} text-xs font-medium`}>
                              {project.matchScore}% match
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-green-100 text-green-700">recruiting</Badge>
                            <Badge className="bg-yellow-100 text-yellow-700">{project.difficulty}</Badge>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="text-sm leading-relaxed line-clamp-3">
                        {project.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {/* Match Reasons */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Why this matches you:</h4>
                        <ul className="space-y-1">
                          {project.matchReasons.map((reason, index) => (
                            <li key={index} className="flex items-center gap-2 text-xs text-gray-600">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Skills */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {project.skills.map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>

                      {/* Owner Info */}
                      <div className="flex items-center gap-3 mb-4">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={project.owner.avatar || "/placeholder.svg"} />
                          <AvatarFallback>
                            {project.owner.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{project.owner.name}</p>
                          <p className="text-xs text-gray-600 truncate">{project.owner.university}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-current" />
                          <span className="text-xs text-gray-600">{project.owner.rating}</span>
                        </div>
                      </div>

                      {/* Project Stats */}
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-4">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {project.members}/{project.maxMembers}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {project.views}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            {project.applications}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{project.duration}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Link href={`/projects/${project.id}`} className="flex-1">
                          <Button variant="outline" className="w-full text-sm bg-transparent">
                            View Details
                          </Button>
                        </Link>
                        <Button className="flex-1 text-sm bg-gradient-to-r from-blue-600 to-purple-600">
                          Apply Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Recommended Collaborators */}
          <TabsContent value="collaborators">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">People You Should Connect With</h2>
                <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                  <Target className="w-3 h-3 mr-1" />
                  Compatibility Based
                </Badge>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                  <div className="col-span-3 text-center py-8">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                    <p className="text-gray-600">Loading recommendations...</p>
                  </div>
                ) : recommendedCollaborators.length === 0 ? (
                  <div className="col-span-3 text-center py-8">
                    <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-600">No collaborator recommendations available yet.</p>
                  </div>
                ) : recommendedCollaborators.map((collaborator) => (
                  <Card
                    key={collaborator.id}
                    className="border-0 bg-white/60 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  >
                    <CardHeader className="text-center pb-3">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className={`${getMatchScoreColor(collaborator.matchScore)} text-xs font-medium`}>
                          {collaborator.matchScore}% match
                        </Badge>
                        <Badge
                          className={
                            collaborator.availability === "Available"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }
                        >
                          {collaborator.availability}
                        </Badge>
                      </div>
                      <Avatar className="w-16 h-16 mx-auto mb-3">
                        <AvatarImage src={collaborator.avatar || "/placeholder.svg"} />
                        <AvatarFallback>
                          {collaborator.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <CardTitle className="text-lg">{collaborator.name}</CardTitle>
                      <CardDescription className="space-y-1">
                        <div className="text-xs">{collaborator.university}</div>
                        <div className="text-xs">{collaborator.major}</div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {/* Rating and Stats */}
                      <div className="flex items-center justify-center gap-4 mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium">{collaborator.rating}</span>
                        </div>
                        <div className="text-sm text-gray-600">{collaborator.projectsCompleted} projects</div>
                      </div>

                      {/* Match Reasons */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Perfect match because:</h4>
                        <ul className="space-y-1">
                          {collaborator.matchReasons.slice(0, 2).map((reason, index) => (
                            <li key={index} className="flex items-center gap-2 text-xs text-gray-600">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Skills */}
                      <div className="flex flex-wrap gap-1 justify-center mb-4">
                        {collaborator.skills.slice(0, 3).map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {collaborator.skills.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{collaborator.skills.length - 3}
                          </Badge>
                        )}
                      </div>

                      {/* Mutual Connections */}
                      {collaborator.mutualConnections > 0 && (
                        <div className="text-center mb-4">
                          <Badge variant="outline" className="text-xs">
                            {collaborator.mutualConnections} mutual connections
                          </Badge>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1 text-sm bg-transparent">
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Message
                        </Button>
                        <Button className="flex-1 text-sm bg-gradient-to-r from-blue-600 to-purple-600">
                          <UserPlus className="w-4 h-4 mr-2" />
                          Connect
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Skill Development */}
          <TabsContent value="skills">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Recommended Skills to Learn</h2>
                <Badge className="bg-gradient-to-r from-green-500 to-teal-500 text-white">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Career Growth
                </Badge>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                  <div className="col-span-3 text-center py-8">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                    <p className="text-gray-600">Loading recommendations...</p>
                  </div>
                ) : recommendedSkills.length === 0 ? (
                  <div className="col-span-3 text-center py-8">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-600">No skill recommendations available yet.</p>
                  </div>
                ) : recommendedSkills.map((skill, index) => (
                  <Card key={index} className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {skill.name}
                          {skill.source === 'external' && (
                            <Badge className="bg-blue-100 text-blue-700 text-xs ml-2">GitHub</Badge>
                          )}
                        </CardTitle>
                        <Badge
                          className={
                            skill.difficulty === "Beginner"
                              ? "bg-green-100 text-green-700"
                              : skill.difficulty === "Intermediate"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }
                        >
                          {skill.difficulty}
                        </Badge>
                      </div>
                      <CardDescription>
                        {skill.reason}
                        {skill.source === 'external' && skill.githubCount > 0 && (
                          <span className="ml-2 text-xs text-blue-600">({skill.githubCount} trending repos)</span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Time to learn:</span>
                          <span className="font-medium">{skill.timeToLearn}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Project demand:</span>
                          <span className="font-medium">{skill.demand}</span>
                        </div>
                        <Button className="w-full bg-gradient-to-r from-green-600 to-teal-600">Start Learning</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Trending Skills */}
          <TabsContent value="trends">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">What's Trending in Tech</h2>
                <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Hot Right Now
                </Badge>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                  <div className="col-span-3 text-center py-8">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                    <p className="text-gray-600">Loading trends...</p>
                  </div>
                ) : trendingSkills.length === 0 ? (
                  <div className="col-span-3 text-center py-8">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-600">No trending skills available yet.</p>
                  </div>
                ) : trendingSkills.map((skill, index) => {
                  const IconComponent = skill.icon
                  return (
                    <Card key={index} className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                      <CardHeader>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                            <IconComponent className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                              {skill.name}
                              {skill.source === 'external' && (
                                <Badge className="bg-blue-100 text-blue-700 text-xs ml-2">GitHub</Badge>
                              )}
                            </CardTitle>
                            <Badge className="bg-green-100 text-green-700 text-xs">{skill.growth}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Active projects:</span>
                            <span className="font-medium">{skill.projects}</span>
                          </div>
                          {skill.source === 'external' && skill.githubCount > 0 && (
                            <div className="text-xs text-blue-600 mb-2">Trending on GitHub: {skill.githubCount} repos</div>
                          )}
                          <Progress value={75} className="h-2" />
                          <div className="flex gap-2">
                            <Button variant="outline" className="flex-1 text-sm bg-transparent">
                              Learn More
                            </Button>
                            <Button className="flex-1 text-sm bg-gradient-to-r from-orange-600 to-red-600">
                              Find Projects
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
