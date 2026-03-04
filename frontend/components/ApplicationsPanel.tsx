"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, X, Eye, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { UserDetailPanel } from "./UserDetailPanel"
import { MonogramLogo } from "./MonogramLogo"

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Application {
  id: string
  message: string
  status: string
  created_at: string
  updated_at: string
  applicant_id: string
  applicant_name: string
  applicant_username: string
  applicant_image: string
  applicant_bio: string
  applicant_university: string
  applicant_skills: string[]
}

interface ApplicationsPanelProps {
  projectId: string
  projectTitle: string
}

export function ApplicationsPanel({ projectId, projectTitle }: ApplicationsPanelProps) {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedApplicant, setSelectedApplicant] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadApplications()
  }, [projectId])

  const loadApplications = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/projects/${projectId}/applications`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to load applications')
      }

      const data = await response.json()
      setApplications(data.data?.applications || [])
    } catch (error) {
      toast({
        title: "Error loading applications",
        description: "Could not load project applications",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApplication = async (applicationId: string, action: 'accept' | 'reject') => {
    try {
      setProcessingId(applicationId)
      const response = await fetch(
        `${API_URL}/api/projects/${projectId}/applications/${applicationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action })
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to process application')
      }

      toast({
        title: `Application ${action}ed`,
        description: `The application has been ${action}ed successfully`,
      })

      // Reload applications
      await loadApplications()
    } catch (error: any) {
      toast({
        title: "Error processing application",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setProcessingId(null)
    }
  }

  const openApplicantDetails = (application: Application) => {
    setSelectedApplicant({
      id: application.applicant_id,
      full_name: application.applicant_name,
      username: application.applicant_username,
      profile_image_url: application.applicant_image,
      bio: application.applicant_bio,
      university: application.applicant_university,
      skills: application.applicant_skills,
      application_message: application.message,
      applied_at: application.created_at
    })
  }

  const pendingApplications = applications.filter(app => app.status === 'pending')
  const processedApplications = applications.filter(app => app.status !== 'pending')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Pending Applications */}
        {pendingApplications.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Pending Applications ({pendingApplications.length})
            </h3>
            <div className="space-y-3">
              {pendingApplications.map((application) => (
                <Card key={application.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* Applicant Info */}
                      <div className="flex items-start gap-3 flex-1">
                        <Avatar className="w-12 h-12 border-2 border-gray-200">
                          <AvatarImage src={application.applicant_image} />
                          <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold p-0">
                            <MonogramLogo
                              name={application.applicant_name}
                              variant="vibrant"
                              size="sm"
                            />
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => openApplicantDetails(application)}
                            className="text-base font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {application.applicant_name}
                          </button>
                          <p className="text-sm text-gray-500">{application.applicant_university || 'University'}</p>
                          <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                            {application.message || 'No message provided'}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Applied {new Date(application.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openApplicantDetails(application)}
                          className="h-9"
                          title="View Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApplication(application.id, 'accept')}
                          disabled={processingId === application.id}
                          className="bg-green-600 hover:bg-green-700 text-white h-9"
                        >
                          {processingId === application.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Accept
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApplication(application.id, 'reject')}
                          disabled={processingId === application.id}
                          className="border-red-200 text-red-600 hover:bg-red-50 h-9"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* No Pending Applications */}
        {pendingApplications.length === 0 && (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No pending applications</p>
            </CardContent>
          </Card>
        )}

        {/* Processed Applications */}
        {processedApplications.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Processed Applications ({processedApplications.length})
            </h3>
            <div className="space-y-2">
              {processedApplications.map((application) => (
                <Card key={application.id} className="border border-gray-100">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={application.applicant_image} />
                          <AvatarFallback className="bg-gray-100 text-gray-600 text-sm p-0">
                            <MonogramLogo
                              name={application.applicant_name}
                              variant="vibrant"
                              size="xs"
                            />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {application.applicant_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {application.applicant_university}
                          </p>
                        </div>
                      </div>
                      <Badge className={application.status === 'accepted' ? 'bg-green-500' : 'bg-gray-500'}>
                        {application.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User Detail Panel */}
      <UserDetailPanel
        user={selectedApplicant}
        open={!!selectedApplicant}
        onClose={() => setSelectedApplicant(null)}
      />
    </>
  )
}
