"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, TrendingUp, TrendingDown, Award, Target, CheckCircle, Users } from "lucide-react"

interface PerformanceMetrics {
  userId: string
  username: string
  overallScore: number
  scoreRating: string
  projectsCompleted: number
  projectsCancelled: number
  tasksCompleted: number
  collaborationSuccessRate: number
  acceptanceRate: number
  reliabilityScore: number
  activityLevel: string
  totalContributions: number
  verifiedContributions: number
  averageImpactScore: number
  monthlyTrends: Array<{
    month: string
    projects_worked: number
    tasks_completed: number
    contributions_made: number
    avg_impact: number
  }>
  peerComparison?: {
    overallPercentile: number
    projectsPercentile: number
    tasksPercentile: number
    reliabilityPercentile: number
    category: string
  }
}

interface PerformanceDashboardProps {
  userId: string
  showPrivateMetrics?: boolean
}

export function PerformanceDashboard({ userId, showPrivateMetrics = false }: PerformanceDashboardProps) {
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPerformance()
  }, [userId])

  const fetchPerformance = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/performance/${userId}`,
        { credentials: 'include' }
      )

      if (!response.ok) throw new Error('Failed to fetch performance')

      const result = await response.json()
      setPerformance(result.data.performance)

      // Fetch peer comparison if private metrics are shown
      if (showPrivateMetrics) {
        const comparisonResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/performance/${userId}/peer-comparison`,
          { credentials: 'include' }
        )
        if (comparisonResponse.ok) {
          const comparisonResult = await comparisonResponse.json()
          setPerformance(prev => prev ? { ...prev, peerComparison: comparisonResult.data } : null)
        }
      }
    } catch (error) {
      console.error('Error fetching performance:', error)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-blue-600"
    if (score >= 40) return "text-yellow-600"
    return "text-orange-600"
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-green-100"
    if (score >= 60) return "bg-blue-100"
    if (score >= 40) return "bg-yellow-100"
    return "bg-orange-100"
  }

  const getRatingBadgeVariant = (rating: string) => {
    switch (rating) {
      case 'Excellent': return 'default'
      case 'Very Good': return 'secondary'
      case 'Good': return 'outline'
      default: return 'outline'
    }
  }

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 90) return "text-green-600"
    if (percentile >= 75) return "text-blue-600"
    if (percentile >= 50) return "text-yellow-600"
    return "text-gray-600"
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!performance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">No performance data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Performance Overview</span>
            <Badge variant={getRatingBadgeVariant(performance.scoreRating)} className="text-base">
              {performance.scoreRating}
            </Badge>
          </CardTitle>
          <CardDescription>Comprehensive performance metrics for {performance.username}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center mb-6">
            <div className={`relative w-40 h-40 rounded-full flex items-center justify-center ${getScoreBgColor(performance.overallScore)}`}>
              <div className="text-center">
                <div className={`text-5xl font-bold ${getScoreColor(performance.overallScore)}`}>
                  {performance.overallScore}
                </div>
                <div className="text-sm text-muted-foreground">Overall Score</div>
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <Target className="h-6 w-6 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">{performance.projectsCompleted}</div>
              <div className="text-xs text-muted-foreground">Projects Completed</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">{performance.tasksCompleted}</div>
              <div className="text-xs text-muted-foreground">Tasks Completed</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Award className="h-6 w-6 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold">{performance.verifiedContributions}</div>
              <div className="text-xs text-muted-foreground">Verified Contributions</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Users className="h-6 w-6 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-bold">{performance.collaborationSuccessRate}%</div>
              <div className="text-xs text-muted-foreground">Collaboration Success</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          {showPrivateMetrics && <TabsTrigger value="comparison">Peer Comparison</TabsTrigger>}
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Metrics</CardTitle>
              <CardDescription>Breakdown of performance indicators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Acceptance Rate</span>
                  <span className="font-medium">{performance.acceptanceRate}%</span>
                </div>
                <Progress value={performance.acceptanceRate} className="bg-gray-200" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Reliability Score</span>
                  <span className="font-medium">{performance.reliabilityScore}/100</span>
                </div>
                <Progress value={performance.reliabilityScore} className="bg-gray-200" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Collaboration Success Rate</span>
                  <span className="font-medium">{performance.collaborationSuccessRate}%</span>
                </div>
                <Progress value={performance.collaborationSuccessRate} className="bg-gray-200" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Average Impact Score</span>
                  <span className="font-medium">{performance.averageImpactScore.toFixed(1)}/10</span>
                </div>
                <Progress value={performance.averageImpactScore * 10} className="bg-gray-200" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Activity Level</div>
                  <div className="text-lg font-semibold capitalize">{performance.activityLevel}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Contributions</div>
                  <div className="text-lg font-semibold">{performance.totalContributions}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Projects Cancelled</div>
                  <div className="text-lg font-semibold">{performance.projectsCancelled}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Verification Rate</div>
                  <div className="text-lg font-semibold">
                    {performance.totalContributions > 0
                      ? Math.round((performance.verifiedContributions / performance.totalContributions) * 100)
                      : 0}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Activity Trends</CardTitle>
              <CardDescription>Performance trends over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {performance.monthlyTrends && performance.monthlyTrends.length > 0 ? (
                <div className="space-y-6">
                  {performance.monthlyTrends.map((trend, index) => (
                    <div key={index} className="border-b pb-4 last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{trend.month}</h4>
                        <Badge variant="outline">
                          Impact: {trend.avg_impact ? trend.avg_impact.toFixed(1) : 'N/A'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Projects</div>
                          <div className="text-lg font-semibold">{trend.projects_worked || 0}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Tasks</div>
                          <div className="text-lg font-semibold">{trend.tasks_completed || 0}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Contributions</div>
                          <div className="text-lg font-semibold">{trend.contributions_made || 0}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No trend data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {showPrivateMetrics && performance.peerComparison && (
          <TabsContent value="comparison" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Peer Comparison</CardTitle>
                <CardDescription>
                  How you rank among {performance.peerComparison.category} users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                  <div className={`text-5xl font-bold mb-2 ${getPercentileColor(performance.peerComparison.overallPercentile)}`}>
                    Top {100 - performance.peerComparison.overallPercentile}%
                  </div>
                  <p className="text-muted-foreground">Overall Performance Ranking</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Project Completion</div>
                      <div className="text-sm text-muted-foreground">Completed projects metric</div>
                    </div>
                    <div className={`text-2xl font-bold ${getPercentileColor(performance.peerComparison.projectsPercentile)}`}>
                      {performance.peerComparison.projectsPercentile}%
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Task Completion</div>
                      <div className="text-sm text-muted-foreground">Tasks completed metric</div>
                    </div>
                    <div className={`text-2xl font-bold ${getPercentileColor(performance.peerComparison.tasksPercentile)}`}>
                      {performance.peerComparison.tasksPercentile}%
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Reliability</div>
                      <div className="text-sm text-muted-foreground">Reliability score metric</div>
                    </div>
                    <div className={`text-2xl font-bold ${getPercentileColor(performance.peerComparison.reliabilityPercentile)}`}>
                      {performance.peerComparison.reliabilityPercentile}%
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg text-sm">
                  <p className="text-blue-900">
                    {performance.peerComparison.overallPercentile >= 90
                      ? "🎉 Excellent! You're in the top 10% of contributors!"
                      : performance.peerComparison.overallPercentile >= 75
                      ? "👍 Great work! You're performing better than most users."
                      : performance.peerComparison.overallPercentile >= 50
                      ? "Keep it up! You're above average in overall performance."
                      : "There's room for improvement. Stay consistent to climb the ranks!"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
