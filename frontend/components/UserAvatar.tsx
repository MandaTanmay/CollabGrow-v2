/**
 * UserAvatar Component
 * 
 * Displays user avatars with automatic fallback to modern monogram logos
 * Works with the backend avatar enrichment system
 * 
 * Usage:
 *   <UserAvatar user={user} size="sm" />
 *   <UserAvatar user={user} size="lg" showName />
 */

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MonogramLogo } from "@/components/MonogramLogo"
import { cn } from "@/lib/utils"

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl"

interface User {
  id?: string
  full_name?: string
  username?: string
  profile_image_url?: string
  avatar?: {
    hasImage: boolean
    imageUrl?: string
    initials: string
    backgroundColor: string
    textColor?: string
  }
}

interface UserAvatarProps {
  user: User
  size?: AvatarSize
  showName?: boolean
  className?: string
  fallbackClassName?: string
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-12 h-12 text-base",
  lg: "w-16 h-16 text-lg",
  xl: "w-24 h-24 text-2xl",
}

/**
 * UserAvatar Component
 * 
 * Automatically displays:
 * - Profile image if user has one
 * - Professional monogram logo if no image
 * - Consistent brand identity across the app
 */
export function UserAvatar({
  user,
  size = "md",
  showName = false,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  // Extract avatar data (either from enriched avatar object or fallback to basic props)
  const avatar = user.avatar || {
    hasImage: !!user.profile_image_url,
    imageUrl: user.profile_image_url,
    initials: getInitials(user.full_name || user.username || "?"),
    backgroundColor: stringToColor(user.full_name || user.username || user.id || ""),
    textColor: "#ffffff",
  }

  const imageUrl = avatar.imageUrl || user.profile_image_url
  const userName = user.full_name || user.username || "User"
  const initials = getInitials(userName)

  // Map UserAvatar sizes to MonogramLogo sizes
  const monogramSizeMap: Record<AvatarSize, "xs" | "sm" | "md" | "lg" | "xl" | "2xl"> = {
    xs: "xs",
    sm: "sm",
    md: "md",
    lg: "lg",
    xl: "xl",
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {imageUrl && avatar.hasImage ? (
        <Avatar className={cn(sizeClasses[size], "border border-border")}>
          <AvatarImage 
            src={imageUrl} 
            alt={userName}
            className="object-cover"
          />
          <AvatarFallback className="bg-transparent">
            <MonogramLogo 
              initials={initials} 
              name={userName}
              variant="vibrant"
              size={monogramSizeMap[size]}
              className="w-full h-full"
            />
          </AvatarFallback>
        </Avatar>
      ) : (
        <MonogramLogo 
          initials={initials} 
          name={userName}
          variant="vibrant"
          size={monogramSizeMap[size]}
          fallbackClassName={fallbackClassName}
        />
      )}
      {showName && (
        <span className="text-sm font-medium text-foreground truncate">
          {userName}
        </span>
      )}
    </div>
  )
}

/**
 * Helper: Extract initials from name
 * "John Doe" → "JD"
 * "John" → "J"
 * "" → "?"
 */
function getInitials(name: string): string {
  if (!name || name.trim() === "") return "?"
  
  const parts = name.trim().split(/\s+/)
  
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  
  return parts[0][0].toUpperCase()
}

/**
 * Helper: Generate consistent color from string
 * Uses same algorithm as backend for consistency
 */
function stringToColor(str: string): string {
  const colors = [
    "#3B82F6", // blue
    "#8B5CF6", // purple
    "#EC4899", // pink
    "#EF4444", // red
    "#F59E0B", // amber  
    "#10B981", // green
    "#14B8A6", // teal
    "#6366F1", // indigo
    "#F97316", // orange
    "#84CC16", // lime
    "#06B6D4", // cyan
    "#A855F7", // violet
  ]

  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32-bit integer
  }

  const index = Math.abs(hash) % colors.length
  return colors[index]
}

/**
 * UserAvatarGroup Component
 * 
 * Displays a group of overlapping avatars
 * Useful for showing project collaborators, etc.
 */
interface UserAvatarGroupProps {
  users: User[]
  max?: number
  size?: AvatarSize
  className?: string
}

export function UserAvatarGroup({
  users,
  max = 5,
  size = "sm",
  className,
}: UserAvatarGroupProps) {
  const displayUsers = users.slice(0, max)
  const remainingCount = users.length - max

  return (
    <div className={cn("flex -space-x-2", className)}>
      {displayUsers.map((user, index) => (
        <div
          key={user.id || index}
          className="ring-2 ring-background rounded-full"
          style={{ zIndex: displayUsers.length - index }}
        >
          <UserAvatar user={user} size={size} />
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-muted text-muted-foreground font-medium ring-2 ring-background",
            sizeClasses[size]
          )}
          style={{ zIndex: 0 }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  )
}

export default UserAvatar
