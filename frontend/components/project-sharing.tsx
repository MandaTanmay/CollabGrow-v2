"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { MonogramLogo } from "@/components/MonogramLogo"
import { Share2, Copy, Mail, Twitter, Linkedin, Facebook, Download, Check, Users, Star, Clock } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface Project {
  id: string
  title: string
  description: string
  // Support both structures
  owner?: {
    name: string
    avatar: string
    university: string
  }
  creator?: {
    full_name: string
    profile_image_url: string
    university?: string
    username?: string
  }
  skills?: string[]
  required_skills?: string[]
  category: string
  difficulty?: string
  difficulty_level?: string
  duration?: string
  estimated_duration?: string
  members?: number
  current_collaborators?: number
  maxMembers?: number
  max_members?: number
  status: string
  views?: number
  views_count?: number
  applications?: number
  applications_count?: number
}

interface ProjectSharingProps {
  project: Project
  isOpen: boolean
  onClose: () => void
}

export function ProjectSharing({ project, isOpen, onClose }: ProjectSharingProps) {
  const [copied, setCopied] = useState(false)
  const [customMessage, setCustomMessage] = useState("")
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

  if (!isOpen) return null

  // Normalize data access
  const ownerName = project.creator?.full_name || project.owner?.name || "Unknown User"
  const ownerAvatar = project.creator?.profile_image_url || project.owner?.avatar || "/placeholder.svg"
  const ownerUniversity = project.creator?.university || project.owner?.university || "Project Lead"

  const memberCount = project.current_collaborators ?? project.members ?? 0
  const maxMembers = project.max_members ?? project.maxMembers ?? 0
  const viewCount = project.views ?? project.views_count ?? 0
  const duration = project.estimated_duration ?? project.duration ?? "TBD"

  const projectUrl = `${window.location.origin}/projects/${project.id}`
  const shareText = `Check out this amazing project: ${project.title} - ${project.description?.slice(0, 100) || ""}...`

  const copyToClipboard = async () => {
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(projectUrl)
        setCopied(true)
        toast({
          title: "Link copied!",
          description: "Project link has been copied to your clipboard.",
        })
        setTimeout(() => setCopied(false), 2000)
      } else {
        // Fallback for browsers that don't support Clipboard API
        const textArea = document.createElement("textarea")
        textArea.value = projectUrl
        textArea.style.position = "fixed"
        textArea.style.left = "-999999px"
        textArea.style.top = "-999999px"
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()

        const successful = document.execCommand('copy')
        textArea.remove()

        if (successful) {
          setCopied(true)
          toast({
            title: "Link copied!",
            description: "Project link has been copied to your clipboard.",
          })
          setTimeout(() => setCopied(false), 2000)
        } else {
          throw new Error('Copy command failed')
        }
      }
    } catch (err) {
      console.error('Copy to clipboard error:', err)
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually.",
        variant: "destructive",
      })
    }
  }

  const shareOnPlatform = (platform: string) => {
    const encodedText = encodeURIComponent(shareText)
    const encodedUrl = encodeURIComponent(projectUrl)

    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      email: `mailto:?subject=${encodeURIComponent(project.title)}&body=${encodedText}%0A%0A${encodedUrl}`,
    }

    if (shareUrls[platform as keyof typeof shareUrls]) {
      window.open(shareUrls[platform as keyof typeof shareUrls], "_blank")
    }
  }

  const generateQRCode = () => {
    // In a real app, you'd use a QR code library
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(projectUrl)}`
    return qrCodeUrl
  }

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: project.title,
          text: shareText,
          url: projectUrl,
        })
      } catch (err) {
        console.log("Error sharing:", err)
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-0 bg-white/90 backdrop-blur-md shadow-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-600" />
                Share Project
              </CardTitle>
              <CardDescription>Help others discover this amazing project</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Project Preview */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 border border-white/20">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{project.title}</h3>
                <p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {memberCount}/{maxMembers}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {duration}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {ownerAvatar ? (
                <Avatar className="w-8 h-8">
                  <AvatarImage src={ownerAvatar} />
                  <AvatarFallback>
                    <MonogramLogo 
                      name={ownerName}
                      variant="vibrant"
                      size="xs"
                    />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <MonogramLogo 
                  name={ownerName}
                  variant="vibrant"
                  size="xs"
                />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{ownerName}</p>
                <p className="text-xs text-gray-600">{ownerUniversity}</p>
              </div>
            </div>
          </div>

          {/* Quick Share Options */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Quick Share</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-3 bg-white/50"
                onClick={() => shareOnPlatform("twitter")}
              >
                <Twitter className="w-5 h-5 text-blue-500" />
                <span className="text-xs">Twitter</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-3 bg-white/50"
                onClick={() => shareOnPlatform("linkedin")}
              >
                <Linkedin className="w-5 h-5 text-blue-700" />
                <span className="text-xs">LinkedIn</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-3 bg-white/50"
                onClick={() => shareOnPlatform("facebook")}
              >
                <Facebook className="w-5 h-5 text-blue-600" />
                <span className="text-xs">Facebook</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-3 bg-white/50"
                onClick={() => shareOnPlatform("email")}
              >
                <Mail className="w-5 h-5 text-gray-600" />
                <span className="text-xs">Email</span>
              </Button>
            </div>
          </div>

          {/* Copy Link */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Share Link</h4>
            <div className="flex gap-2">
              <Input value={projectUrl} readOnly className="bg-white/50" />
              <Button variant="outline" onClick={copyToClipboard} className="flex items-center gap-2 bg-white/50">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Add Personal Message</h4>
            <Textarea
              placeholder="Add a personal note about why you're sharing this project..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="bg-white/50"
              rows={3}
            />
          </div>

          {/* QR Code */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">QR Code</h4>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 bg-white rounded-lg p-2 border">
                <img
                  src={generateQRCode() || "/placeholder.svg"}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2">
                  Scan this QR code to quickly access the project on mobile devices
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement("a")
                    link.href = generateQRCode()
                    link.download = `${project.title}-qr-code.png`
                    link.click()
                  }}
                  className="bg-white/50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download QR
                </Button>
              </div>
            </div>
          </div>

          {/* Native Share (if available) */}
          {typeof navigator !== 'undefined' && typeof navigator.share !== 'undefined' && (
            <div>
              <Button onClick={nativeShare} className="w-full bg-gradient-to-r from-blue-600 to-purple-600">
                <Share2 className="w-4 h-4 mr-2" />
                Share via Device
              </Button>
            </div>
          )}

          {/* Share Analytics Preview */}
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Share Impact</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-blue-600">+{Math.floor(Math.random() * 50) + 10}</div>
                <div className="text-xs text-gray-600">Expected Views</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">+{Math.floor(Math.random() * 10) + 2}</div>
                <div className="text-xs text-gray-600">Potential Applications</div>
              </div>
              <div>
                <div className="text-lg font-bold text-purple-600">+{Math.floor(Math.random() * 20) + 5}</div>
                <div className="text-xs text-gray-600">Network Reach</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button
              onClick={() => {
                copyToClipboard()
                onClose()
              }}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Project
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
