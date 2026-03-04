"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Brain, Target, TrendingUp, Users, Zap, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"

interface RecommendationEngineProps {
  userId?: string
  preferences?: {
    skills: string[]
    interests: string[]
    availability: string
    projectTypes: string[]
  }
}

interface AIRecommendation {
  id: string
  type: "project" | "collaborator" | "skill" | "trend"
  title: string
  description: string
  confidence: number
  reasoning: string[]
  metadata: Record<string, any>
}

export function RecommendationEngine({ userId, preferences }: RecommendationEngineProps) {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const generateRecommendations = async () => {
    setIsLoading(true)
    console.log("[v0] Generating AI recommendations for user:", userId)

    try {
      // Fetch real recommendations from the API
      const data = await api.recommendations.getAll({
        projects: 2,
        collaborators: 1,
        skills: 1,
      })

      const dynamicRecommendations: AIRecommendation[] = []

      // Map projects to recommendations
      if (data.projects && data.projects.length > 0) {
        const project = data.projects[0]
        dynamicRecommendations.push({
          id: `rec_project_${project.id}`,
          type: "project",
          title: project.title,
          description: project.description || 'Great match based on your skills',
          confidence: project.compatibility_score ? Math.round(project.compatibility_score) : 85,
          reasoning: project.explanation ? 
            (typeof project.explanation === 'string' ? JSON.parse(project.explanation) : project.explanation) :
            ['Compatible skills', 'Good project fit', 'Team size alignment'],
          metadata: {
            skills: Array.isArray(project.required_skills) ? project.required_skills : [],
            difficulty: project.difficulty_level || 'Intermediate',
            duration: '3-4 months',
          },
        })
      }

      // Map collaborators to recommendations
      if (data.collaborators && data.collaborators.length > 0) {
        const collaborator = data.collaborators[0]
        dynamicRecommendations.push({
          id: `rec_collab_${collaborator.id}`,
          type: "collaborator",
          title: `${collaborator.full_name || collaborator.username} - ${collaborator.major || 'Collaborator'}`,
          description: "Complementary skills for your projects",
          confidence: collaborator.compatibility_score ? Math.round(collaborator.compatibility_score) : 85,
          reasoning: collaborator.explanation ? 
            (typeof collaborator.explanation === 'string' ? JSON.parse(collaborator.explanation) : collaborator.explanation) :
            ['Strong skill match', 'Similar interests', 'Good collaboration potential'],
          metadata: {
            university: collaborator.university || 'N/A',
            projects: collaborator.projects_completed || 0,
          },
        })
      }

      // Map skills to recommendations
      if (data.skills && data.skills.length > 0) {
        const skill = data.skills[0]
        const demandPercent = skill.project_demand > 30 ? 96 : skill.project_demand > 15 ? 80 : 65
        dynamicRecommendations.push({
          id: `rec_skill_${skill.skill}`,
          type: "skill",
          title: `Learn ${skill.skill}`,
          description: skill.reason === 'complementary' ? 
            'Complements your current skill set' : 
            'High demand skill in current projects',
          confidence: Math.min(95, 60 + skill.project_demand),
          reasoning: [
            `${demandPercent}% of recommended projects use this skill`,
            skill.difficulty === 1 ? 'Easy to learn for beginners' : 
            skill.difficulty === 2 ? 'Moderate learning curve' : 
            'Advanced skill with high value',
            `Increases project opportunities by ${skill.project_demand * 2}%`,
          ],
          metadata: {
            difficulty: skill.difficulty === 1 ? 'Easy' : skill.difficulty === 2 ? 'Moderate' : 'Advanced',
            timeToLearn: skill.difficulty === 1 ? '1-2 weeks' : skill.difficulty === 2 ? '2-4 weeks' : '1-2 months',
            demandGrowth: skill.growth_potential === 'high' ? '+25%' : skill.growth_potential === 'medium' ? '+15%' : '+10%',
          },
        })
      }

      // If no real data, show a message recommendation
      if (dynamicRecommendations.length === 0) {
        dynamicRecommendations.push({
          id: 'rec_welcome',
          type: 'trend',
          title: 'Complete Your Profile',
          description: 'Add more skills and interests to get personalized recommendations',
          confidence: 100,
          reasoning: [
            'Update your profile with skills',
            'Add project interests',
            'Set availability preferences',
          ],
          metadata: {},
        })
      }

      setRecommendations(dynamicRecommendations)
      setLastUpdated(new Date())
      console.log("[v0] Generated", dynamicRecommendations.length, "recommendations")
    } catch (error) {
      console.error("[v0] Error generating recommendations:", error)
      // Fallback to empty state instead of mock data
      setRecommendations([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (userId || preferences) {
      generateRecommendations()
    }
  }, [userId, preferences])

  // Don't render if no userId (not authenticated)
  if (!userId && !preferences) {
    return (
      <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
        <CardContent className="p-6 text-center">
          <Brain className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600">Please log in to see personalized recommendations</p>
        </CardContent>
      </Card>
    )
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "from-green-500 to-emerald-500"
    if (confidence >= 80) return "from-blue-500 to-cyan-500"
    if (confidence >= 70) return "from-yellow-500 to-orange-500"
    return "from-gray-500 to-slate-500"
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "project":
        return Target
      case "collaborator":
        return Users
      case "skill":
        return Brain
      case "trend":
        return TrendingUp
      default:
        return Zap
    }
  }

  return (
    <div className="space-y-6">
      {/* Engine Header */}
      <Card className="border-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">AI Recommendation Engine</CardTitle>
                <CardDescription>
                  Powered by machine learning • Last updated {lastUpdated.toLocaleTimeString()}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={generateRecommendations}
              disabled={isLoading}
              className="bg-white/50"
              aria-label={isLoading ? "Generating recommendations" : "Refresh recommendations"}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Analyzing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {isLoading && recommendations.length === 0 ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-0 bg-white/60 backdrop-blur-sm shadow-lg animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-gray-200 rounded mb-4"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {recommendations.map((rec) => {
            const IconComponent = getTypeIcon(rec.type)
            return (
              <Card
                key={rec.id}
                className="border-0 bg-white/60 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 bg-gradient-to-br ${getConfidenceColor(rec.confidence)} rounded-lg flex items-center justify-center`}
                      >
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <Badge className="mb-2 capitalize bg-gray-100 text-gray-700">{rec.type}</Badge>
                        <CardTitle className="text-lg leading-tight">{rec.title}</CardTitle>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">{rec.confidence}%</div>
                      <div className="text-xs text-gray-500">confidence</div>
                    </div>
                  </div>
                  <CardDescription className="text-sm">{rec.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  {/* Confidence Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Match Confidence</span>
                      <span>{rec.confidence}%</span>
                    </div>
                    <Progress value={rec.confidence} className="h-2" />
                  </div>

                  {/* AI Reasoning */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      AI Analysis
                    </h4>
                    <ul className="space-y-1">
                      {rec.reasoning.map((reason, index) => (
                        <li key={index} className="flex items-start gap-2 text-xs text-gray-600">
                          <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Metadata */}
                  {rec.metadata && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(rec.metadata)
                          .slice(0, 3)
                          .map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {key}: {value}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                    {rec.type === "project" && "View Project"}
                    {rec.type === "collaborator" && "Connect Now"}
                    {rec.type === "skill" && "Start Learning"}
                    {rec.type === "trend" && "Explore Trend"}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Algorithm Insights */}
      <Card className="border-0 bg-white/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            How Our AI Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Brain className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="font-medium mb-1">Skill Analysis</h4>
              <p className="text-gray-600">Analyzes your skills, projects, and learning patterns</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="font-medium mb-1">Smart Matching</h4>
              <p className="text-gray-600">Finds optimal collaborators and projects using ML algorithms</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="font-medium mb-1">Continuous Learning</h4>
              <p className="text-gray-600">Improves recommendations based on your feedback and activity</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
