"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { MonogramLogo } from "@/components/MonogramLogo"
import { Zap, Users, Star, MessageCircle, UserPlus, Target, TrendingUp, Brain } from "lucide-react"

interface UserProfile {
  id: string
  name: string
  skills: string[]
  interests: string[]
  projectHistory: string[]
  availability: string
  university: string
}

interface MatchResult {
  user: UserProfile
  matchScore: number
  skillOverlap: string[]
  complementarySkills: string[]
  projectCompatibility: number
  reasoning: string[]
}

// Mock current user profile
const CURRENT_USER: UserProfile = {
  id: "current-user",
  name: "John Doe",
  skills: ["React", "TypeScript", "Node.js", "Python"],
  interests: ["Web Development", "AI", "Mobile Apps"],
  projectHistory: ["E-commerce", "Social Media", "Data Analysis"],
  availability: "Part-time",
  university: "Your University",
}

// Mock user database
const USER_DATABASE: UserProfile[] = [
  {
    id: "1",
    name: "Emma Thompson",
    skills: ["React", "UI/UX Design", "Figma", "JavaScript"],
    interests: ["Web Development", "Design Systems", "User Research"],
    projectHistory: ["E-commerce", "Portfolio Sites", "Design Systems"],
    availability: "Available",
    university: "MIT",
  },
  {
    id: "2",
    name: "David Park",
    skills: ["Python", "Machine Learning", "TensorFlow", "Data Science"],
    interests: ["AI", "Data Analysis", "Research"],
    projectHistory: ["ML Models", "Data Analysis", "Research Papers"],
    availability: "Available",
    university: "Stanford",
  },
  {
    id: "3",
    name: "Lisa Wang",
    skills: ["Swift", "Kotlin", "React Native", "Mobile UI"],
    interests: ["Mobile Apps", "iOS Development", "User Experience"],
    projectHistory: ["Mobile Apps", "iOS Games", "Cross-platform"],
    availability: "Busy",
    university: "UC Berkeley",
  },
  {
    id: "4",
    name: "Carlos Rodriguez",
    skills: ["Blockchain", "Solidity", "Web3", "Smart Contracts"],
    interests: ["Cryptocurrency", "DeFi", "Blockchain"],
    projectHistory: ["DeFi Apps", "NFT Platforms", "Crypto Trading"],
    availability: "Available",
    university: "Carnegie Mellon",
  },
  {
    id: "5",
    name: "Priya Patel",
    skills: ["UI/UX Design", "Figma", "User Research", "Prototyping"],
    interests: ["Design Systems", "User Experience", "Accessibility"],
    projectHistory: ["Design Systems", "Mobile Apps", "Web Platforms"],
    availability: "Available",
    university: "University of Washington",
  },
]

export function SkillMatchingEngine({ currentUser = CURRENT_USER }: { currentUser?: UserProfile }) {
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const calculateSkillMatch = (user1: UserProfile, user2: UserProfile): MatchResult => {
    // Calculate skill overlap
    const skillOverlap = user1.skills.filter((skill) =>
      user2.skills.some((otherSkill) => skill.toLowerCase() === otherSkill.toLowerCase()),
    )

    // Calculate complementary skills (skills that work well together)
    const complementaryPairs = [
      { skills: ["React", "Node.js"], weight: 0.9 },
      { skills: ["UI/UX Design", "React"], weight: 0.8 },
      { skills: ["Python", "Machine Learning"], weight: 0.9 },
      { skills: ["TypeScript", "React"], weight: 0.8 },
      { skills: ["Mobile", "UI/UX Design"], weight: 0.7 },
      { skills: ["Blockchain", "Web3"], weight: 0.9 },
      { skills: ["Data Science", "Python"], weight: 0.8 },
    ]

    let complementaryScore = 0
    const complementarySkills: string[] = []

    complementaryPairs.forEach((pair) => {
      const user1HasFirst = user1.skills.some((skill) => skill.toLowerCase().includes(pair.skills[0].toLowerCase()))
      const user2HasSecond = user2.skills.some((skill) => skill.toLowerCase().includes(pair.skills[1].toLowerCase()))
      const user1HasSecond = user1.skills.some((skill) => skill.toLowerCase().includes(pair.skills[1].toLowerCase()))
      const user2HasFirst = user2.skills.some((skill) => skill.toLowerCase().includes(pair.skills[0].toLowerCase()))

      if ((user1HasFirst && user2HasSecond) || (user1HasSecond && user2HasFirst)) {
        complementaryScore += pair.weight
        complementarySkills.push(...pair.skills)
      }
    })

    // Calculate interest alignment
    const interestOverlap = user1.interests.filter((interest) =>
      user2.interests.some((otherInterest) => interest.toLowerCase() === otherInterest.toLowerCase()),
    )

    // Calculate project compatibility
    const projectOverlap = user1.projectHistory.filter((project) =>
      user2.projectHistory.some(
        (otherProject) =>
          project.toLowerCase().includes(otherProject.toLowerCase()) ||
          otherProject.toLowerCase().includes(project.toLowerCase()),
      ),
    )

    // Calculate availability compatibility
    const availabilityScore = user2.availability === "Available" ? 1.0 : user2.availability === "Part-time" ? 0.7 : 0.3

    // Calculate university diversity bonus
    const universityDiversityBonus = user1.university !== user2.university ? 0.1 : 0

    // Calculate final match score
    const skillOverlapScore = (skillOverlap.length / Math.max(user1.skills.length, user2.skills.length)) * 0.3
    const complementarySkillScore = Math.min(complementaryScore, 1.0) * 0.25
    const interestScore = (interestOverlap.length / Math.max(user1.interests.length, user2.interests.length)) * 0.2
    const projectScore =
      (projectOverlap.length / Math.max(user1.projectHistory.length, user2.projectHistory.length)) * 0.15

    const matchScore =
      Math.min(
        (skillOverlapScore +
          complementarySkillScore +
          interestScore +
          projectScore +
          universityDiversityBonus) *
          availabilityScore,
        1.0,
      ) * 100

    // Generate reasoning
    const reasoning: string[] = []
    if (skillOverlap.length > 0) {
      reasoning.push(
        `Shares ${skillOverlap.length} common skill${skillOverlap.length > 1 ? "s" : ""}: ${skillOverlap.join(", ")}`,
      )
    }
    if (complementarySkills.length > 0) {
      reasoning.push(`Complementary skills for strong collaboration`)
    }
    if (interestOverlap.length > 0) {
      reasoning.push(
        `${interestOverlap.length} shared interest${interestOverlap.length > 1 ? "s" : ""}: ${interestOverlap.join(", ")}`,
      )
    }
    if (projectOverlap.length > 0) {
      reasoning.push(`Experience in similar projects: ${projectOverlap.join(", ")}`)
    }
    if (user1.university !== user2.university) {
      reasoning.push(`Cross-university collaboration opportunity`)
    }

    return {
      user: user2,
      matchScore: Math.round(matchScore),
      skillOverlap,
      complementarySkills: [...new Set(complementarySkills)],
      projectCompatibility: Math.round(projectScore * 100),
      reasoning,
    }
  }

  useEffect(() => {
    setIsAnalyzing(true)

    // Simulate AI processing time
    setTimeout(() => {
      const matchResults = USER_DATABASE.map((user) => calculateSkillMatch(currentUser, user))
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 5) // Top 5 matches

      setMatches(matchResults)
      setIsAnalyzing(false)
    }, 2000)
  }, [currentUser])

  const getMatchColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-100"
    if (score >= 60) return "text-blue-600 bg-blue-100"
    if (score >= 40) return "text-yellow-600 bg-yellow-100"
    return "text-red-600 bg-red-100"
  }

  const getMatchLabel = (score: number) => {
    if (score >= 80) return "Excellent Match"
    if (score >= 60) return "Good Match"
    if (score >= 40) return "Fair Match"
    return "Low Match"
  }

  if (isAnalyzing) {
    return (
      <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600 animate-pulse" />
            AI Skill Matching Engine
          </CardTitle>
          <CardDescription>Analyzing compatibility with potential collaborators...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <Zap className="w-4 h-4 text-purple-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Processing skill compatibility...</p>
              <Progress value={33} className="mt-2" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Target className="w-4 h-4 text-blue-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Analyzing project compatibility...</p>
              <Progress value={66} className="mt-2" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Calculating match scores...</p>
              <Progress value={90} className="mt-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            AI Skill Matching Results
          </CardTitle>
          <CardDescription>
            Advanced algorithm analyzing {USER_DATABASE.length} potential collaborators based on skills, interests, and
            project history
          </CardDescription>
        </CardHeader>
      </Card>

      {matches.map((match, index) => (
        <Card
          key={match.user.id}
          className="border-0 bg-white/60 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {match.user.profileImage ? (
                <Avatar className="w-16 h-16">
                  <AvatarImage src={match.user.profileImage} />
                  <AvatarFallback>
                    <MonogramLogo 
                      name={match.user.name}
                      variant="vibrant"
                      size="lg"
                    />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <MonogramLogo 
                  name={match.user.name}
                  variant="vibrant"
                  size="lg"
                />
              )}

              <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{match.user.name}</h3>
                    <p className="text-sm text-gray-600">{match.user.university}</p>
                    <div className="flex items-center gap-2 mt-1">

                      <Badge className={`text-xs ${getMatchColor(match.matchScore)}`}>
                        {match.matchScore}% • {getMatchLabel(match.matchScore)}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-600">#{index + 1}</div>
                    <p className="text-xs text-gray-500">Match Rank</p>
                  </div>
                </div>

                {/* Match Analysis */}
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Shared Skills</h4>
                    <div className="flex flex-wrap gap-1">
                      {match.skillOverlap.length > 0 ? (
                        match.skillOverlap.map((skill) => (
                          <Badge key={skill} className="bg-green-100 text-green-700 text-xs">
                            {skill}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">No direct overlap</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Complementary Skills</h4>
                    <div className="flex flex-wrap gap-1">
                      {match.complementarySkills.length > 0 ? (
                        match.complementarySkills.slice(0, 3).map((skill) => (
                          <Badge key={skill} className="bg-blue-100 text-blue-700 text-xs">
                            {skill}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">Limited synergy</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* All Skills */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">All Skills</h4>
                  <div className="flex flex-wrap gap-1">
                    {match.user.skills.map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* AI Reasoning */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1">
                    <Brain className="w-4 h-4" />
                    AI Analysis
                  </h4>
                  <ul className="space-y-1">
                    {match.reasoning.map((reason, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                    <MessageCircle className="w-4 h-4" />
                    Message
                  </Button>
                  <Button className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600">
                    <UserPlus className="w-4 h-4" />
                    Connect
                  </Button>
                  <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                    <Users className="w-4 h-4" />
                    View Profile
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
