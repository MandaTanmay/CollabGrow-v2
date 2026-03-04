"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, FolderKanban, Bell, Users, TrendingUp } from "lucide-react"
import { ApplicationsPanel } from "@/components/ApplicationsPanel"
import { getUserByFirebaseUid } from "@/lib/supabase-queries"
import { useToast } from "@/components/ui/use-toast"

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Project {
  id: string
  title: string
  status: string
  collaborators_count: number
  created_at: string
}

export default function OwnerDashboardPage() {
  const { user: authUser } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    if (!authUser) {
      router.push('/auth/login')
      return
    }
    loadOwnerData()
  }, [authUser])

  const loadOwnerData = async () => {
    try {
      setLoading(true)
      
      // Get current user
      const user = await getUserByFirebaseUid(authUser!.firebaseUid || authUser!.id)
      if (!user) {
        toast({
          title: "Error",
          description: "User not found",
          variant: "destructive"
        })
        return
      }
      setCurrentUser(user)

      // Get projects where user is creator
      const response = await fetch(`${API_URL}/api/projects?creator_id=${user.id}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to load projects')
      }

      const data = await response.json()
      const ownerProjects = data.data || []
      setProjects(ownerProjects)

      // Select first project by default
      if (ownerProjects.length > 0) {
        setSelectedProject(ownerProjects[0])
      }
    } catch (error) {
      toast({
        title: "Error loading dashboard",
        description: "Could not load owner dashboard data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center">
              <FolderKanban className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No Projects Yet</h2>
              <p className="text-gray-600 mb-6">
                Create a project to start receiving applications
              </p>
              <Button 
                onClick={() => router.push('/projects/create')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Owner Dashboard</h1>
          <p className="text-gray-600">Manage your projects and review applications</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Projects</p>
                  <p className="text-3xl font-bold text-gray-900">{projects.length}</p>
                </div>
                <FolderKanban className="w-10 h-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Projects</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {projects.filter(p => p.status === 'active' || p.status === 'recruiting').length}
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Members</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {projects.reduce((sum, p) => sum + (p.collaborators_count || 0), 0)}
                  </p>
                </div>
                <Users className="w-10 h-10 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Recruiting</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {projects.filter(p => p.status === 'recruiting').length}
                  </p>
                </div>
                <Bell className="w-10 h-10 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Projects List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Your Projects</CardTitle>
              <CardDescription>Select a project to manage applications</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-200">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProject(project)}
                    className={`w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors ${
                      selectedProject?.id === project.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{project.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {project.status}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {project.collaborators_count || 0} members
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Applications Panel */}
          <div className="lg:col-span-2">
            {selectedProject ? (
              <Card>
                <CardHeader>
                  <CardTitle>Applications for {selectedProject.title}</CardTitle>
                  <CardDescription>Review and manage project applications</CardDescription>
                </CardHeader>
                <CardContent>
                  <ApplicationsPanel 
                    projectId={selectedProject.id}
                    projectTitle={selectedProject.title}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500">Select a project to view applications</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
