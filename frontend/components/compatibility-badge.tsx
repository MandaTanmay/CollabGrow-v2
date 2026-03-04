"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, Sparkles } from "lucide-react"

interface CompatibilityScore {
  score: number
  breakdown: {
    skillMatch: number
    experienceMatch: number
    activityMatch: number
    reputationMatch: number
    availabilityMatch: number
  }
  explanation: {
    skill_match: { score: number; weight: number; details: string }
    experience_match: { score: number; weight: number; details: string }
    activity_level: { score: number; weight: number; details: string }
    reputation: { score: number; weight: number; details: string }
    availability: { score: number; weight: number; details: string }
  }
  rating: string
}

interface CompatibilityBadgeProps {
  projectId?: string
  userId?: string
  type: "project" | "user"
  variant?: "compact" | "detailed"
  onScoreCalculated?: (score: CompatibilityScore) => void
}

export function CompatibilityBadge({ 
  projectId, 
  userId, 
  type,
  variant = "compact",
  onScoreCalculated 
}: CompatibilityBadgeProps) {
  const [compatibility, setCompatibility] = useState<CompatibilityScore | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCompatibility = async () => {
      if (!projectId && !userId) return

      setLoading(true)
      setError(null)

      try {
        const endpoint = type === "project"
          ? `/api/compatibility/project/${projectId}`
          : `/api/compatibility/user/${userId}`

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${endpoint}`, {
          credentials: 'include'
        })

        if (!response.ok) {
          throw new Error('Failed to fetch compatibility score')
        }

        const result = await response.json()
        setCompatibility(result.data)
        onScoreCalculated?.(result.data)
      } catch (err) {
        console.error('Error fetching compatibility:', err)
        setError('Unable to calculate compatibility')
      } finally {
        setLoading(false)
      }
    }

    fetchCompatibility()
  }, [projectId, userId, type, onScoreCalculated])

  if (loading) {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Calculating...
      </Badge>
    )
  }

  if (error || !compatibility) {
    return null
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-500 text-white"
    if (score >= 75) return "bg-blue-500 text-white"
    if (score >= 60) return "bg-yellow-500 text-white"
    if (score >= 45) return "bg-orange-500 text-white"
    return "bg-red-500 text-white"
  }

  const getScoreGradient = (score: number) => {
    if (score >= 90) return "from-green-500 to-emerald-600"
    if (score >= 75) return "from-blue-500 to-indigo-600"
    if (score >= 60) return "from-yellow-500 to-amber-600"
    if (score >= 45) return "from-orange-500 to-red-600"
    return "from-red-500 to-rose-600"
  }

  if (variant === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={`${getScoreColor(compatibility.score)} gap-1 cursor-help`}>
              <Sparkles className="h-3 w-3" />
              {compatibility.score}% Match
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-2">
              <p className="font-semibold">{compatibility.rating}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Skills:</span>
                  <span className="font-medium">{compatibility.breakdown.skillMatch.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Experience:</span>
                  <span className="font-medium">{compatibility.breakdown.experienceMatch.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Activity:</span>
                  <span className="font-medium">{compatibility.breakdown.activityMatch.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Reputation:</span>
                  <span className="font-medium">{compatibility.breakdown.reputationMatch.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Availability:</span>
                  <span className="font-medium">{compatibility.breakdown.availabilityMatch.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Detailed variant
  return (
    <div className="space-y-3 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Compatibility Score</h3>
        </div>
        <div className={`text-2xl font-bold bg-gradient-to-r ${getScoreGradient(compatibility.score)} bg-clip-text text-transparent`}>
          {compatibility.score}%
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{compatibility.rating}</p>

      <div className="space-y-2">
        {Object.entries(compatibility.explanation).map(([key, value]) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="capitalize">{key.replace(/_/g, ' ')}</span>
              <span className="font-medium">{value.score.toFixed(0)}% ({value.weight}%)</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className={`h-2 rounded-full bg-gradient-to-r ${getScoreGradient(value.score)}`}
                style={{ width: `${value.score}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{value.details}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
