"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Users, Eye, EyeOff, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from "firebase/auth"
import { useAuth } from "@/lib/auth-context"
import { auth, googleProvider } from "@/lib/firebase"
import { toast } from "sonner"
import { createUser } from "@/lib/supabase-queries"

const POPULAR_SKILLS = [
  "React",
  "Python",
  "JavaScript",
  "UI/UX Design",
  "Node.js",
  "Machine Learning",
  "Mobile Development",
  "Data Science",
  "DevOps",
  "Blockchain",
  "Game Development",
  "Cybersecurity",
]

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    bio: "",
    university: "",
    major: "",
  })
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [customSkill, setCustomSkill] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { login } = useAuth()

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Create user with email and password in Firebase
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      )

      // Update user profile with name
      await updateProfile(userCredential.user, {
        displayName: `${formData.firstName} ${formData.lastName}`,
      })

      // Create user record in Supabase database
      await createUser({
        firebase_uid: userCredential.user.uid,
        email: formData.email,
        full_name: `${formData.firstName} ${formData.lastName}`,
        username: formData.email.split("@")[0],
        bio: formData.bio,
        university: formData.university,
        major: formData.major,
        skills: selectedSkills,
      })

      // Authenticate with backend to get JWT tokens
      try {
        await login(userCredential.user.uid, userCredential.user.email || "", userCredential.user.displayName || undefined, undefined, userCredential.user.photoURL || undefined)
      } catch (authErr) {
        console.error("Failed to authenticate after registration:", authErr)
      }

      toast.success("Account created successfully!")
      router.push("/dashboard")
    } catch (error: any) {
      console.error("Registration error:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack,
        error: error
      })
      
      // Handle Firebase auth errors
      if (error.code === "auth/email-already-in-use") {
        toast.error("This email is already registered. Please login instead.")
      } else if (error.code === "auth/weak-password") {
        toast.error("Password should be at least 6 characters.")
      } else if (error.code === "auth/invalid-email") {
        toast.error("Invalid email address.")
      } else if (error.message?.includes("duplicate") || error.code === "23505") {
        toast.error("This email is already registered. Please login instead.")
      } else {
        toast.error(error.message || "Failed to create account.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setIsLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      
      // Try to create user in Supabase (will fail silently if already exists)
      try {
        await createUser({
          firebase_uid: result.user.uid,
          email: result.user.email || "",
          full_name: result.user.displayName || "Google User",
          username: result.user.email?.split("@")[0] || result.user.uid,
          skills: [],
        })
      } catch (dbError: any) {
        // User might already exist, that's okay
        if (!dbError.message?.includes("duplicate")) {
          console.error("Database error:", dbError)
        }
      }
      
      toast.success("Google sign up successful!")
      router.push("/dashboard")
    } catch (error: any) {
      // Ignore popup closed by user error
      if (error.code === "auth/popup-closed-by-user") {
        console.log("Google sign up popup closed by user")
        // Don't show error toast for expected user action
        return
      }
      console.error("Google sign up error:", error)
      toast.error(error.message || "Failed to sign up with Google.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              CollabGrow
            </span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join CollabGrow</h1>
          <p className="text-gray-600">Create your account and start collaborating</p>
        </div>

        {/* Registration Form */}
        <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Create Account</CardTitle>
            <CardDescription className="text-center">Fill in your details to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-6">
              {/* Personal Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="bg-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="bg-white/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="john@university.edu"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="bg-white/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="bg-white/50 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Academic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="university">University</Label>
                  <Input
                    id="university"
                    name="university"
                    placeholder="Your University"
                    value={formData.university}
                    onChange={handleInputChange}
                    className="bg-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="major">Major/Field</Label>
                  <Input
                    id="major"
                    name="major"
                    placeholder="Computer Science"
                    value={formData.major}
                    onChange={handleInputChange}
                    className="bg-white/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  placeholder="Tell us about yourself and your interests..."
                  value={formData.bio}
                  onChange={handleInputChange}
                  className="bg-white/50 min-h-[80px]"
                />
              </div>

              {/* Skills Section */}
              <div className="space-y-4">
                <Label>Skills & Technologies</Label>

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
                    {POPULAR_SKILLS.map((skill) => (
                      <Badge
                        key={skill}
                        variant="outline"
                        className={`cursor-pointer hover:bg-blue-50 ${
                          selectedSkills.includes(skill) ? "bg-blue-100 border-blue-300" : ""
                        }`}
                        onClick={() => addSkill(skill)}
                      >
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

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                disabled={isLoading}
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Google Sign Up */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignUp}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
