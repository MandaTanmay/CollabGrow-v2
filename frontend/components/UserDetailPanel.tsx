"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MonogramLogo } from "@/components/MonogramLogo"
import { Calendar, Mail, MapPin, GraduationCap, Code, MessageSquare } from "lucide-react"

interface UserDetailPanelProps {
  user: any | null
  open: boolean
  onClose: () => void
}

export function UserDetailPanel({ user, open, onClose }: UserDetailPanelProps) {
  if (!user) return null

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'U'
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Applicant Profile</SheetTitle>
          <SheetDescription>
            Review applicant information and background
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Profile Header */}
          <div className="flex flex-col items-center text-center space-y-4">
            {user.profile_image_url ? (
              <Avatar className="w-24 h-24 border-4 border-gray-100">
                <AvatarImage src={user.profile_image_url} alt={user.full_name} />
                <AvatarFallback>
                  <MonogramLogo 
                    name={user.full_name}
                    variant="vibrant"
                    size="2xl"
                  />
                </AvatarFallback>
              </Avatar>
            ) : (
              <MonogramLogo 
                name={user.full_name}
                variant="vibrant"
                size="2xl"
              />
            )}
            
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-gray-900">{user.full_name}</h2>
              {user.username && (
                <p className="text-sm text-gray-500">@{user.username}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Contact Information
            </h3>
            
            {user.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">{user.email}</span>
              </div>
            )}

            {user.university && (
              <div className="flex items-center gap-3 text-sm">
                <GraduationCap className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">{user.university}</span>
              </div>
            )}

            {user.major && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">{user.major}</span>
              </div>
            )}

            {user.created_at && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">
                  Joined {new Date(user.created_at).toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* Bio */}
          {user.bio && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  About
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">{user.bio}</p>
              </div>
              <Separator />
            </>
          )}

          {/* Skills */}
          {user.skills && user.skills.length > 0 && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill: string, index: number) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-0"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Application Message */}
          {user.application_message && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Application Message
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {user.application_message}
                </p>
              </div>
              {user.applied_at && (
                <p className="text-xs text-gray-500">
                  Submitted on {new Date(user.applied_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{user.reputation_points || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Reputation</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{user.followers_count || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Followers</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{user.profile_views || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Views</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
