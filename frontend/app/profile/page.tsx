"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MonogramLogo } from "@/components/MonogramLogo"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  Edit,
  Save,
  X,
  Plus,
  Star,
  MapPin,
  Calendar,
  Mail,
  Github,
  Linkedin,
  Globe,
  Award,
  Code,
  BookOpen,
  Clock,
  Upload,
} from "lucide-react"
import Link from "next/link"
import { ActivityTimeline } from "@/components/activity-timeline"
import { NotificationSystem } from "@/components/notification-system"
import { StorageErrorAlert } from "@/components/storage-error-alert"
import { getUserByFirebaseUid, getUserStats, getAllProjects, getUserSavedPosts } from "@/lib/supabase-queries"
import { supabase } from "@/lib/database"
import { handleLogout } from "@/lib/logout"
import { useToast } from "@/components/ui/use-toast"

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
]

export default function ProfilePage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<any>(null)
  const [userStats, setUserStats] = useState<any>(null)
  const [completedProjects, setCompletedProjects] = useState<any[]>([])
  const [savedPosts, setSavedPosts] = useState<any[]>([])
  const [formData, setFormData] = useState<any>({})
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [customSkill, setCustomSkill] = useState("")
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadUserData() {
      // Wait for auth status to resolve before deciding to redirect
      if (authLoading) return

      if (!user) {
        router.push("/auth/login")
        return
      }

      try {
        const dbUser = await getUserByFirebaseUid(user.uid)
        if (dbUser) {
          setUserData(dbUser)
          setFormData({
            full_name: dbUser.full_name || "",
            email: dbUser.email || "",
            bio: dbUser.bio || "",
            university: dbUser.university || "",
            major: dbUser.major || "",
            location: dbUser.location || "",
            github_username: dbUser.github_username || "",
            linkedin_url: dbUser.linkedin_url || "",
            portfolio_url: dbUser.portfolio_url || "",
          })
          setSelectedSkills(dbUser.skills || [])

          const stats = await getUserStats(dbUser.id)
          setUserStats(stats)

          // Get user's completed projects
          const projects = await getAllProjects({
            status: "completed"
          })
          // Filter by creator on the client side
          const userProjects = projects?.filter((p: any) => p.creator?.id === dbUser.id) || []
          setCompletedProjects(userProjects)

          // Get user's saved posts
          const posts = await getUserSavedPosts(dbUser.id)
          setSavedPosts(posts || [])
        }
      } catch (error) {
        console.error("Error loading user data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [user, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev: any) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const addSkill = (skill: string) => {
    if (!selectedSkills.includes(skill) && selectedSkills.length < 15) {
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userData) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Please select an image file",
        variant: "destructive"
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Image size should be less than 5MB",
        variant: "destructive"
      })
      return
    }

    setUploadingPhoto(true)

    try {
      // Create a unique file name
      const fileExt = file.name.split(".").pop()
      const fileName = `${userData.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload to Supabase Storage with error handling
      let uploadData, uploadError
      try {
        const result = await supabase.storage
          .from("profile-images")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          })
        uploadData = result.data
        uploadError = result.error
      } catch (err: any) {
        uploadError = err
      }

      if (uploadError) {
        // Handle missing bucket error specifically
        if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("bucket")) {
          setStorageError(true)
          toast({
            title: "Storage bucket not set up yet!",
            description: "Please create a storage bucket named 'profile-images' in your Supabase dashboard with public access.",
            variant: "destructive"
          })
          setUploadingImage(false)
          return
        }
        throw uploadError
      }

      // Get public URL safely
      let publicUrl: string
      try {
        const { data: urlData } = supabase.storage
          .from("profile-images")
          .getPublicUrl(filePath)
        publicUrl = urlData.publicUrl
      } catch (err) {
        console.error("Error getting public URL:", err)
        toast({
          title: "Storage Error",
          description: "Image uploaded but failed to get public URL. Please refresh the page.",
          variant: "destructive"
        })
        setUploadingImage(false)
        return
      }

      // Update user profile in database
      const { error: updateError } = await supabase
        .from("users")
        .update({ profile_image_url: publicUrl })
        .eq("id", userData.id)

      if (updateError) throw updateError

      // Update local state
      setUserData((prev: any) => ({ ...prev, profile_image_url: publicUrl }))
      setFormData((prev: any) => ({ ...prev, profile_image_url: publicUrl }))

      console.log("✅ Profile photo updated successfully")
    } catch (error: any) {
      console.error("❌ Error uploading photo:", error)
      toast({
        title: "Failed to upload photo",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSave = async () => {
    if (!userData) return

    try {
      console.log("💾 Saving profile updates...")
      console.log("User ID:", userData.id)
      console.log("Firebase UID:", userData.firebase_uid)
      console.log("Form Data:", formData)
      console.log("Selected Skills:", selectedSkills)

      // Prepare update data - only include fields with values
      const updateData: any = {
        updated_at: new Date().toISOString(),
      }

      // Only add fields that have actual values (not empty strings)
      if (formData.full_name?.trim()) updateData.full_name = formData.full_name.trim()
      if (formData.bio?.trim()) updateData.bio = formData.bio.trim()
      if (formData.university?.trim()) updateData.university = formData.university.trim()
      if (formData.major?.trim()) updateData.major = formData.major.trim()
      if (formData.location?.trim()) updateData.location = formData.location.trim()
      if (formData.github_username?.trim()) updateData.github_username = formData.github_username.trim()
      if (formData.linkedin_url?.trim()) updateData.linkedin_url = formData.linkedin_url.trim()
      if (formData.portfolio_url?.trim()) updateData.portfolio_url = formData.portfolio_url.trim()
      if (selectedSkills && selectedSkills.length > 0) updateData.skills = selectedSkills

      console.log("Update Data (including skills):", updateData)
      console.log("Skills being sent to DB:", updateData.skills)

      // Try direct update with ID (don't request return data)
      const { error, status, statusText } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", userData.id)

      console.log("Response status:", status, statusText)
      console.log("Response error:", error)

      if (error) {
        console.error("❌ Supabase error details:", {
          message: error.message || "No message",
          details: error.details || "No details",
          hint: error.hint || "No hint",
          code: error.code || "No code",
        })
        throw new Error(error.message || "Failed to update profile")
      }

      // If we got here, the update succeeded (no error thrown by Supabase)
      console.log("✅ Update completed successfully")

      // Update local state with new data
      setUserData((prev: any) => ({
        ...prev,
        ...updateData,
        skills: selectedSkills,
      }))

      setIsEditing(false)
      console.log("✅ Profile updated successfully!")
      toast({
        title: "Profile updated successfully!",
      })
    } catch (error: any) {
      console.error("❌ Error saving profile:", error)
      toast({
        title: "Failed to save profile",
        description: error?.message || 'Unknown error occurred. Check console for details.',
        variant: "destructive"
      })
    }
  }

  const handleCancel = () => {
    if (userData) {
      setFormData({
        full_name: userData.full_name || "",
        email: userData.email || "",
        bio: userData.bio || "",
        university: userData.university || "",
        major: userData.major || "",
        location: userData.location || "",
        github_username: userData.github_username || "",
        linkedin_url: userData.linkedin_url || "",
        portfolio_url: userData.portfolio_url || "",
      })
      setSelectedSkills(userData.skills || [])
    }
    setIsEditing(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-xl p-8">
          <CardContent className="text-center">
            <h2 className="text-2xl font-bold mb-4">User not found</h2>
            <p className="text-gray-600 mb-4">Unable to load profile data</p>
            <Button onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    )
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
            <Link href="/collaborators" className="text-gray-600 hover:text-blue-600 transition-colors">
              Find People
            </Link>
            <Link href="/profile" className="text-blue-600 font-medium">
              Profile
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <NotificationSystem />
            <Button
              variant={isEditing ? "default" : "outline"}
              onClick={() => setIsEditing(!isEditing)}
              className={isEditing ? "bg-gradient-to-r from-blue-600 to-purple-600" : ""}
            >
              {isEditing ? <Save className="w-4 h-4 mr-2" /> : <Edit className="w-4 h-4 mr-2" />}
              {isEditing ? "Save" : "Edit Profile"}
            </Button>
            <div tabIndex={0} className="group relative">
              {userData?.profile_image_url ? (
                <Avatar>
                  <AvatarImage src={userData.profile_image_url} />
                  <AvatarFallback>
                    <MonogramLogo 
                      name={userData?.full_name}
                      variant="vibrant"
                      size="sm"
                    />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <MonogramLogo 
                  name={userData?.full_name}
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
        {/* Storage Error Alert */}
        {storageError && (
          <div className="mb-6">
            <StorageErrorAlert bucketName="profile-images" />
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Header */}
          <div className="lg:col-span-3">
            <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-xl">
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="relative">
                    {userData?.profile_image_url ? (
                      <Avatar className="w-24 h-24">
                        <AvatarImage src={userData.profile_image_url} />
                        <AvatarFallback>
                          <MonogramLogo 
                            name={userData?.full_name}
                            variant="vibrant"
                            size="xl"
                          />
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-24 h-24">
                        <MonogramLogo 
                          name={userData?.full_name}
                          variant="vibrant"
                          size="xl"
                        />
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      accept="image/*"
                      className="hidden"
                      aria-label="Upload profile photo"
                    />
                    {isEditing && (
                      <Button
                        size="sm"
                        className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 p-0"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                      >
                        {uploadingPhoto ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        {isEditing ? (
                          <Input
                            name="full_name"
                            value={formData.full_name}
                            onChange={handleInputChange}
                            className="bg-white/50 mb-2"
                            placeholder="Full Name"
                          />
                        ) : (
                          <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            {userData?.full_name || "Anonymous User"}
                          </h1>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-gray-600 mb-3">
                          <div className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {isEditing ? (
                              <Input
                                name="major"
                                value={formData.major}
                                onChange={handleInputChange}
                                className="bg-white/50 w-40"
                                placeholder="Major"
                              />
                            ) : (
                              <span>{userData?.major || "Not specified"}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {isEditing ? (
                              <Input
                                name="university"
                                value={formData.university}
                                onChange={handleInputChange}
                                className="bg-white/50 w-48"
                                placeholder="University"
                              />
                            ) : (
                              <span>{userData?.university || "Not specified"}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Joined {new Date(userData?.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                          </div>
                        </div>

                        {/* Additional Info Row */}
                        <div className="flex flex-wrap items-center gap-4 text-gray-600 mb-3">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Globe className="w-4 h-4" />
                              <Input
                                name="location"
                                value={formData.location}
                                onChange={handleInputChange}
                                className="bg-white/50 w-40"
                                placeholder="Location"
                              />
                            </div>
                          ) : (
                            <>
                              {userData?.location && (
                                <div className="flex items-center gap-1">
                                  <Globe className="w-4 h-4" />
                                  <span>{userData.location}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Social Links */}
                        {isEditing ? (
                          <div className="flex flex-col gap-2 mt-3">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <Input
                                name="email"
                                type="email"
                                value={formData.email}
                                className="bg-gray-100 flex-1 cursor-not-allowed"
                                placeholder="Email"
                                disabled
                                title="Email cannot be changed"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Github className="w-4 h-4 text-gray-400" />
                              <Input
                                name="github_username"
                                value={formData.github_username}
                                onChange={handleInputChange}
                                className="bg-white/50 flex-1"
                                placeholder="GitHub username"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Linkedin className="w-4 h-4 text-gray-400" />
                              <Input
                                name="linkedin_url"
                                value={formData.linkedin_url}
                                onChange={handleInputChange}
                                className="bg-white/50 flex-1"
                                placeholder="LinkedIn URL"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4 text-gray-400" />
                              <Input
                                name="portfolio_url"
                                value={formData.portfolio_url}
                                onChange={handleInputChange}
                                className="bg-white/50 flex-1"
                                placeholder="Portfolio URL"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 mt-2">
                            <a
                              href={userData?.email ? `mailto:${userData.email}` : "#"}
                              className={userData?.email ? "text-gray-600 hover:text-blue-600 transition-colors" : "text-gray-300 cursor-not-allowed"}
                              title={userData?.email || "Email not added"}
                            >
                              <Mail className="w-5 h-5" />
                            </a>
                            <a
                              href={userData?.github_username ? `https://github.com/${userData.github_username}` : "#"}
                              target={userData?.github_username ? "_blank" : "_self"}
                              rel="noopener noreferrer"
                              className={userData?.github_username ? "text-gray-600 hover:text-blue-600 transition-colors" : "text-gray-300 cursor-not-allowed"}
                              title={userData?.github_username ? `GitHub: ${userData.github_username}` : "GitHub not added"}
                            >
                              <Github className="w-5 h-5" />
                            </a>
                            <a
                              href={userData?.linkedin_url || "#"}
                              target={userData?.linkedin_url ? "_blank" : "_self"}
                              rel="noopener noreferrer"
                              className={userData?.linkedin_url ? "text-gray-600 hover:text-blue-600 transition-colors" : "text-gray-300 cursor-not-allowed"}
                              title={userData?.linkedin_url ? "LinkedIn Profile" : "LinkedIn not added"}
                            >
                              <Linkedin className="w-5 h-5" />
                            </a>
                            <a
                              href={userData?.portfolio_url || "#"}
                              target={userData?.portfolio_url ? "_blank" : "_self"}
                              rel="noopener noreferrer"
                              className={userData?.portfolio_url ? "text-gray-600 hover:text-blue-600 transition-colors" : "text-gray-300 cursor-not-allowed"}
                              title={userData?.portfolio_url ? "Portfolio Website" : "Portfolio not added"}
                            >
                              <Globe className="w-5 h-5" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex gap-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{userStats?.completed_projects || 0}</div>
                          <div className="text-sm text-gray-600">Projects</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">{userStats?.followers_count || 0}</div>
                          <div className="text-sm text-gray-600">Followers</div>
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    <div>
                      {isEditing ? (
                        <Textarea
                          name="bio"
                          value={formData.bio}
                          onChange={handleInputChange}
                          className="bg-white/50 min-h-[80px]"
                          placeholder="Tell us about yourself..."
                        />
                      ) : (
                        <p className="text-gray-700 leading-relaxed">{userData?.bio || "No bio added yet."}</p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {isEditing && (
                      <div className="flex gap-3 mt-4">
                        <Button onClick={handleSave} className="bg-gradient-to-r from-blue-600 to-purple-600">
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={handleCancel}>
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="skills" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 bg-white/60 backdrop-blur-sm">
                <TabsTrigger value="skills">Skills & Expertise</TabsTrigger>
                <TabsTrigger value="projects">Projects</TabsTrigger>
                <TabsTrigger value="saved">Saved Posts</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              {/* Skills Tab */}
              <TabsContent value="skills">
                <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                  <CardHeader>
                    <CardTitle>Skills & Technologies</CardTitle>
                    <CardDescription>
                      {isEditing
                        ? "Add or remove skills to showcase your expertise"
                        : "Technologies and skills I'm proficient in"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Current Skills */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Current Skills</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedSkills.map((skill) => (
                          <Badge
                            key={skill}
                            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white relative"
                          >
                            {skill}
                            {isEditing && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="ml-1 h-auto p-0 text-white hover:bg-white/20"
                                onClick={() => removeSkill(skill)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Add Skills (Edit Mode) */}
                    {isEditing && (
                      <>
                        <div>
                          <Label className="text-sm font-medium mb-3 block">Add Skills</Label>
                          <div className="flex flex-wrap gap-2 mb-4">
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
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Projects Tab */}
              <TabsContent value="projects">
                <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                  <CardHeader>
                    <CardTitle>Completed Projects</CardTitle>
                    <CardDescription>Projects I've successfully collaborated on</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {completedProjects.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Code className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No completed projects yet</p>
                      </div>
                    ) : (
                      completedProjects.map((project) => (
                        <div key={project.id} className="p-4 rounded-lg bg-white/50 border border-white/20">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-gray-900 mb-1">{project.title}</h3>
                              <p className="text-sm text-gray-600 mb-2">{project.description}</p>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>Status: {project.status}</span>
                                {project.estimated_duration && <span>Duration: {project.estimated_duration}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {project.project_skills?.map((skill: any) => (
                              <Badge key={skill.skill?.id} variant="outline" className="text-xs">
                                {skill.skill?.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Saved Posts Tab */}
              <TabsContent value="saved">
                <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
                  <CardHeader>
                    <CardTitle>Saved Posts</CardTitle>
                    <CardDescription>Posts you've bookmarked for later</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {savedPosts.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No saved posts yet</p>
                        <p className="text-sm mt-2">Bookmark posts from the feed to see them here</p>
                      </div>
                    ) : (
                      savedPosts.map((post) => (
                        <div key={post.id} className="p-4 rounded-lg bg-white/50 border border-white/20">
                          <div className="flex items-start gap-3 mb-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={post.user?.profile_image_url} />
                              <AvatarFallback>
                                <MonogramLogo 
                                  name={post.user?.full_name}
                                  variant="vibrant"
                                  size="sm"
                                />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-gray-900 text-sm">{post.user?.full_name || "Anonymous"}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {post.post_type?.replace("_", " ") || "Post"}
                                </Badge>
                              </div>
                              <p className="text-gray-800 text-sm mb-2">{post.content}</p>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>❤️ {post.likes_count || 0}</span>
                                <span>💬 {post.comments_count || 0}</span>
                                <span>{new Date(post.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <Link href="/feed" className="text-xs text-blue-600 hover:underline">
                            View in feed →
                          </Link>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity">
                <ActivityTimeline userId={userData?.id} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* User Stats */}
            <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Projects Completed</span>
                  <Badge variant="secondary" className="text-lg px-3 py-1 bg-green-100 text-green-700">
                    {userStats?.completed_projects || 0}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Active Projects</span>
                  <Badge variant="secondary" className="text-lg px-3 py-1 bg-blue-100 text-blue-700">
                    {userStats?.active_projects || 0}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Projects</span>
                  <Badge variant="secondary" className="text-lg px-3 py-1 bg-purple-100 text-purple-700">
                    {userStats?.total_projects || 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={() => router.push("/projects/create")}
                  className="w-full justify-start bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg transition-shadow"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Project
                </Button>
                <Button 
                  onClick={() => router.push("/collaborators")}
                  variant="outline" 
                  className="w-full justify-start bg-transparent hover:bg-white/50 transition-colors"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Find Collaborators
                </Button>
                <Button 
                  onClick={() => router.push("/projects")}
                  variant="outline" 
                  className="w-full justify-start bg-transparent hover:bg-white/50 transition-colors"
                >
                  <Code className="w-4 h-4 mr-2" />
                  Browse Projects
                </Button>
              </CardContent>
            </Card>

            {/* Recent Activity Preview */}
            <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityTimeline userId={userData?.id} limit={3} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
