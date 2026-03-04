/**
 * Safe Avatar component that handles storage errors gracefully
 */

"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState } from "react"

interface SafeAvatarProps {
  src?: string | null
  fallbackSrc?: string
  fallbackText?: string
  className?: string
}

export function SafeAvatar({ 
  src, 
  fallbackSrc = "/placeholder.svg", 
  fallbackText = "U",
  className 
}: SafeAvatarProps) {
  const [hasError, setHasError] = useState(false)
  const [imageUrl, setImageUrl] = useState(src)

  // Use fallback if src is null, undefined, or errored
  const displaySrc = (hasError || !imageUrl) ? fallbackSrc : imageUrl

  return (
    <Avatar className={className}>
      <AvatarImage 
        src={displaySrc}
        onError={() => {
          console.warn(`Failed to load avatar image: ${imageUrl}`)
          setHasError(true)
        }}
      />
      <AvatarFallback>{fallbackText}</AvatarFallback>
    </Avatar>
  )
}
