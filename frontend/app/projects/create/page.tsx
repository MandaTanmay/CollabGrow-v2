"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Users, Plus, X, Save, Eye, Target, Code, Lightbulb, Clock, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/database"
import { getUserByFirebaseUid } from "@/lib/supabase-queries"
import { useToast } from "@/components/ui/use-toast"

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const CATEGORIES = [
  "Web Development",
  "Mobile Development",
  "Artificial Intelligence",
  "Data Science",
  "Blockchain",
  "Game Development",
  "UI/UX Design",
  "DevOps",
  "Cybersecurity",
  "IoT",
]

const POPULAR_SKILLS = [
  "React",
  "Python",
  "JavaScript",
  "Node.js",
  "TypeScript",
  "UI/UX Design",
  "Machine Learning",
  "Mobile Development",
  "Data Science",
  "DevOps",
  "Blockchain",
  "Game Development",
  "Cybersecurity",
  "Cloud Computing",
  "Database Design",
]

const DIFFICULTY_LEVELS = [
  { value: "beginner", label: "Beginner", description: "Perfect for those new to the technology" },
  { value: "intermediate", label: "Intermediate", description: "Some experience required" },
  { value: "advanced", label: "Advanced", description: "Extensive experience needed" },
]

const DURATION_OPTIONS = ["1-2 weeks", "3-4 weeks", "1-2 months", "3-4 months", "5-6 months", "6+ months"]

export default function CreateProjectPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    difficulty: "",
    duration: "",
    maxMembers: 4,
    isRemote: true,
    location: "",
    goals: "",
    requirements: "",
    timeline: "",
  })
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [customSkill, setCustomSkill] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const addSkill = (skill: string) => {
    if (!selectedSkills.includes(skill) && selectedSkills.length < 10) {
      setSelectedSkills((prev) => [...prev, skill])
    }
  }

  const removeSkill = (skill: string) => {
    setSelectedSkills((prev) => prev.filter((s) => s !== skill))
  }

  const addCustomSkill = () => {
    if (customSkill.trim() && !selectedSkills.includes(customSkill.trim())) {
      addSkill(customSkill.trim())
      setCustomSkill("")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "You must be logged in to create a project",
        variant: "destructive"
      });
      router.push("/auth/login");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("🚀 Creating project...");

      // Get current user from database
      if (!user?.uid) {
        toast({
          title: "Session expired. Please log in again.",
          variant: "destructive"
        });
        router.push("/auth/login");
        return;
      }

      const dbUser = await getUserByFirebaseUid(user.uid);
      if (!dbUser) {
        toast({
          title: "User not found. Please try logging in again.",
          variant: "destructive"
        });
        router.push("/auth/login");
        return;
      }

      console.log("User data:", dbUser);

      // Call backend API to create project
      const response = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // 🔑 IMPORTANT: Send authentication cookies
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          detailed_description: `${formData.goals}\n\nRequirements:\n${formData.requirements}\n\nTimeline:\n${formData.timeline}`,
          category: formData.category,
          difficulty_level: formData.difficulty,
          estimated_duration: formData.duration,
          max_collaborators: formData.maxMembers,
          is_remote: formData.isRemote,
          location: formData.location || null,
          required_skills: selectedSkills,
          creator_id: dbUser.id,
          status: "recruiting",
          is_public: true,
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ Project creation error:", errorData);
        console.error("❌ Response status:", response.status);
        console.error("❌ Response status text:", response.statusText);
        
        // Handle authentication error specifically
        if (response.status === 401) {
          toast({
            title: "Authentication required",
            description: "Please log in again to create a project",
            variant: "destructive"
          });
          router.push("/auth/login");
          return;
        }
        
        throw new Error(errorData.error || errorData.message || 'Failed to create project');
      }

      const newProject = await response.json();
      console.log("✅ Project created:", newProject);

      // Optionally, create a feed post via backend if needed

      toast({
        title: "🎉 Project created successfully!",
      });
      router.push("/projects");
    } catch (error: any) {
      console.error("❌ Error creating project:", error);
      toast({
        title: "Failed to create project",
        description: error?.message || 'Unknown error. Check console for details.',
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  } 

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return formData.title && formData.description && formData.category
      case 2:
        return selectedSkills.length > 0 && formData.difficulty && formData.duration
      case 3:
        return formData.goals && formData.requirements
      default:
        return false
    }
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

          <div className="flex items-center gap-4">
            <Link href="/projects">
              <Button variant="outline" className="bg-transparent">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Projects
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Project</h1>
          <p className="text-gray-600">Share your project idea and find the perfect collaborators</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            {[
              { step: 1, title: "Project Details", icon: Lightbulb },
              { step: 2, title: "Skills & Requirements", icon: Code },
              { step: 3, title: "Goals & Timeline", icon: Target },
            ].map(({ step, title, icon: Icon }) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${currentStep >= step
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                    : "bg-gray-200 text-gray-500"
                    }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`ml-2 text-sm font-medium ${currentStep >= step ? "text-blue-600" : "text-gray-500"}`}>
                  {title}
                </span>
                {step < 3 && <div className="w-16 h-px bg-gray-300 ml-4" />}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-w-2xl mx-auto">
            {/* Step 1: Project Details */}
            {currentStep === 1 && (
              <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-blue-600" />
                    Project Details
                  </CardTitle>
                  <CardDescription>Tell us about your project idea and what you want to build</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Project Title *</Label>
                    <Input
                      id="title"
                      name="title"
                      placeholder="e.g., AI-Powered Study Assistant"
                      value={formData.title}
                      onChange={handleInputChange}
                      required
                      className="bg-white/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Project Description *</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Describe your project idea, what problem it solves, and what you want to build..."
                      value={formData.description}
                      onChange={handleInputChange}
                      required
                      className="bg-white/50 min-h-[120px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger className="bg-white/50">
                        <SelectValue placeholder="Select project category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxMembers">Team Size</Label>
                      <Select
                        value={formData.maxMembers.toString()}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, maxMembers: Number.parseInt(value) }))
                        }
                      >
                        <SelectTrigger className="bg-white/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2, 3, 4, 5, 6, 7, 8].map((size) => (
                            <SelectItem key={size} value={size.toString()}>
                              {size} members
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Work Style</Label>
                      <RadioGroup
                        value={formData.isRemote ? "remote" : "in-person"}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, isRemote: value === "remote" }))}
                        className="flex gap-6"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="remote" id="remote" />
                          <Label htmlFor="remote" className="text-sm">
                            Remote
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="in-person" id="in-person" />
                          <Label htmlFor="in-person" className="text-sm">
                            In-person
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>

                  {!formData.isRemote && (
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        name="location"
                        placeholder="e.g., Stanford University, Palo Alto, CA"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="bg-white/50"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 2: Skills & Requirements */}
            {currentStep === 2 && (
              <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-blue-600" />
                    Skills & Requirements
                  </CardTitle>
                  <CardDescription>Specify the skills needed and project difficulty</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Required Skills */}
                  <div className="space-y-4">
                    <Label>Required Skills *</Label>

                    {/* Selected Skills */}
                    {selectedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedSkills.map((skill) => (
                          <Badge key={skill} className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                            {skill}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="ml-1 h-auto p-0 text-white hover:bg-white/20"
                              onClick={() => removeSkill(skill)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Popular Skills */}
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">Popular skills:</p>
                      <div className="flex flex-wrap gap-2">
                        {POPULAR_SKILLS.filter((skill) => !selectedSkills.includes(skill)).map((skill) => (
                          <Badge
                            key={skill}
                            variant="outline"
                            className="cursor-pointer hover:bg-blue-50"
                            onClick={() => addSkill(skill)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Custom Skill Input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add custom skill..."
                        value={customSkill}
                        onChange={(e) => setCustomSkill(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSkill())}
                        className="bg-white/50"
                      />
                      <Button type="button" variant="outline" onClick={addCustomSkill}>
                        Add
                      </Button>
                    </div>
                  </div>

                  {/* Difficulty Level */}
                  <div className="space-y-4">
                    <Label>Difficulty Level *</Label>
                    <RadioGroup
                      value={formData.difficulty}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, difficulty: value }))}
                      className="space-y-3"
                    >
                      {DIFFICULTY_LEVELS.map((level) => (
                        <div
                          key={level.value}
                          className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 bg-white/30"
                        >
                          <RadioGroupItem value={level.value} id={level.value} className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor={level.value} className="font-medium cursor-pointer">
                              {level.label}
                            </Label>
                            <p className="text-sm text-gray-600 mt-1">{level.description}</p>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Duration */}
                  <div className="space-y-2">
                    <Label htmlFor="duration">Expected Duration *</Label>
                    <Select
                      value={formData.duration}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, duration: value }))}
                    >
                      <SelectTrigger className="bg-white/50">
                        <SelectValue placeholder="How long will this project take?" />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((duration) => (
                          <SelectItem key={duration} value={duration}>
                            {duration}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Goals & Timeline */}
            {currentStep === 3 && (
              <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    Goals & Timeline
                  </CardTitle>
                  <CardDescription>Define your project goals and what you expect from collaborators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="goals">Project Goals *</Label>
                    <Textarea
                      id="goals"
                      name="goals"
                      placeholder="What do you want to achieve with this project? What are the key deliverables?"
                      value={formData.goals}
                      onChange={handleInputChange}
                      required
                      className="bg-white/50 min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="requirements">Collaborator Requirements *</Label>
                    <Textarea
                      id="requirements"
                      name="requirements"
                      placeholder="What are you looking for in collaborators? Any specific experience or commitment level required?"
                      value={formData.requirements}
                      onChange={handleInputChange}
                      required
                      className="bg-white/50 min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeline">Timeline & Milestones</Label>
                    <Textarea
                      id="timeline"
                      name="timeline"
                      placeholder="Outline key milestones and deadlines (optional)"
                      value={formData.timeline}
                      onChange={handleInputChange}
                      className="bg-white/50 min-h-[80px]"
                    />
                  </div>

                  {/* Project Preview */}
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Project Preview</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p>
                        <strong>Title:</strong> {formData.title || "Your project title"}
                      </p>
                      <p>
                        <strong>Category:</strong> {formData.category || "Not selected"}
                      </p>
                      <p>
                        <strong>Skills:</strong> {selectedSkills.join(", ") || "No skills selected"}
                      </p>
                      <p>
                        <strong>Team Size:</strong> {formData.maxMembers} members
                      </p>
                      <p>
                        <strong>Duration:</strong> {formData.duration || "Not specified"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="bg-transparent"
              >
                Previous
              </Button>

              <div className="flex gap-3">
                {currentStep < 3 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={!isStepValid(currentStep)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    Next Step
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={!isStepValid(currentStep) || isSubmitting}
                    className="bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    {isSubmitting ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Creating Project...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Create Project
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
