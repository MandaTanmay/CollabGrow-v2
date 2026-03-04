/**
 * MonogramLogo Component
 * 
 * A modern, minimal, and scalable monogram logo using user initials
 * Features:
 * - Clean, professional design (first initial + last initial)
 * - Bold, contemporary typography
 * - Rich color palette for brand identity
 * - Supports light and dark backgrounds
 * - Fully scalable and reusable across the app
 * 
 * Usage:
 *   <MonogramLogo initials="JD" variant="primary" size="md" />
 *   <MonogramLogo name="John Doe" variant="gradient" size="lg" />
 */

import * as React from "react"
import { cn } from "@/lib/utils"

export type MonogramSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
export type MonogramVariant = 
  | "primary"      // Blue gradient
  | "secondary"    // Purple gradient
  | "accent"       // Pink gradient
  | "success"      // Green gradient
  | "warning"      // Amber gradient
  | "danger"       // Red gradient
  | "neutral"      // Gray neutral
  | "vibrant"      // Dynamic color based on initials
  | "gradient"     // Blue-to-purple gradient

interface MonogramLogoProps {
  /**
   * User initials (e.g., "JD" for John Doe)
   * If not provided, will be extracted from name
   */
  initials?: string
  
  /**
   * Full name - used to extract initials if not provided
   * Format: "FirstName LastName"
   */
  name?: string
  
  /**
   * Color scheme variant
   */
  variant?: MonogramVariant
  
  /**
   * Size of the logo
   */
  size?: MonogramSize
  
  /**
   * Optional CSS class name
   */
  className?: string
  
  /**
   * Whether to show text label next to the logo
   */
  showLabel?: boolean
  
  /**
   * Optional label text (defaults to name if showLabel is true)
   */
  label?: string
  
  /**
   * Optional custom background color (overrides variant)
   */
  backgroundColor?: string
  
  /**
   * Optional custom text color
   */
  textColor?: string
  
  /**
   * Whether this is for a dark background
   */
  forDarkBackground?: boolean
}

/**
 * Get initials from name
 * "John Doe" → "JD"
 * "John" → "J"
 */
function extractInitials(name: string): string {
  if (!name || name.trim() === "") return "?"
  
  const parts = name.trim().split(/\s+/)
  
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  
  return parts[0][0].toUpperCase()
}

/**
 * Get color based on variant or generate from initials
 */
function getColorScheme(
  variant: MonogramVariant | undefined,
  initials?: string,
  isDark?: boolean
): { bg: string; text: string; gradient?: string } {
  const darkBg = isDark ? "bg-gray-800" : "bg-gray-100"
  const darkText = isDark ? "text-gray-100" : "text-gray-900"

  const schemes: Record<MonogramVariant, { bg: string; text: string; gradient?: string }> = {
    primary: {
      bg: "bg-gradient-to-br from-blue-600 to-blue-700",
      text: "text-white",
      gradient: "from-blue-600 to-blue-700"
    },
    secondary: {
      bg: "bg-gradient-to-br from-purple-600 to-purple-700",
      text: "text-white",
      gradient: "from-purple-600 to-purple-700"
    },
    accent: {
      bg: "bg-gradient-to-br from-pink-600 to-pink-700",
      text: "text-white",
      gradient: "from-pink-600 to-pink-700"
    },
    success: {
      bg: "bg-gradient-to-br from-green-600 to-green-700",
      text: "text-white",
      gradient: "from-green-600 to-green-700"
    },
    warning: {
      bg: "bg-gradient-to-br from-amber-500 to-amber-600",
      text: "text-white",
      gradient: "from-amber-500 to-amber-600"
    },
    danger: {
      bg: "bg-gradient-to-br from-red-600 to-red-700",
      text: "text-white",
      gradient: "from-red-600 to-red-700"
    },
    neutral: {
      bg: darkBg,
      text: darkText,
    },
    vibrant: {
      bg: "bg-gradient-to-br from-indigo-600 to-purple-600",
      text: "text-white",
      gradient: "from-indigo-600 to-purple-600"
    },
    gradient: {
      bg: "bg-gradient-to-br from-blue-600 to-purple-600",
      text: "text-white",
      gradient: "from-blue-600 to-purple-600"
    }
  }

  return schemes[variant || "primary"]
}

/**
 * Generate deterministic color from initials
 */
function getColorFromInitials(initials: string): { bg: string; gradient: string } {
  const colorPalette = [
    { bg: "bg-gradient-to-br from-blue-600 to-blue-700", gradient: "from-blue-600 to-blue-700" },
    { bg: "bg-gradient-to-br from-purple-600 to-purple-700", gradient: "from-purple-600 to-purple-700" },
    { bg: "bg-gradient-to-br from-indigo-600 to-indigo-700", gradient: "from-indigo-600 to-indigo-700" },
    { bg: "bg-gradient-to-br from-pink-600 to-pink-700", gradient: "from-pink-600 to-pink-700" },
    { bg: "bg-gradient-to-br from-red-600 to-red-700", gradient: "from-red-600 to-red-700" },
    { bg: "bg-gradient-to-br from-orange-600 to-orange-700", gradient: "from-orange-600 to-orange-700" },
    { bg: "bg-gradient-to-br from-green-600 to-green-700", gradient: "from-green-600 to-green-700" },
    { bg: "bg-gradient-to-br from-teal-600 to-teal-700", gradient: "from-teal-600 to-teal-700" },
    { bg: "bg-gradient-to-br from-cyan-600 to-cyan-700", gradient: "from-cyan-600 to-cyan-700" },
    { bg: "bg-gradient-to-br from-amber-600 to-amber-700", gradient: "from-amber-600 to-amber-700" },
  ]

  let hash = 0
  for (let i = 0; i < initials.length; i++) {
    hash = initials.charCodeAt(i) + ((hash << 5) - hash)
  }

  const index = Math.abs(hash) % colorPalette.length
  return colorPalette[index]
}

const sizeClasses: Record<MonogramSize, { container: string; text: string; font: string }> = {
  xs: {
    container: "w-5 h-5",
    text: "text-[10px]",
    font: "font-bold"
  },
  sm: {
    container: "w-8 h-8",
    text: "text-xs",
    font: "font-bold"
  },
  md: {
    container: "w-12 h-12",
    text: "text-sm",
    font: "font-semibold"
  },
  lg: {
    container: "w-16 h-16",
    text: "text-base",
    font: "font-semibold"
  },
  xl: {
    container: "w-20 h-20",
    text: "text-lg",
    font: "font-semibold"
  },
  "2xl": {
    container: "w-24 h-24",
    text: "text-2xl",
    font: "font-bold"
  }
}

/**
 * MonogramLogo Component
 * 
 * Creates a modern, professional monogram logo from user initials
 * Fully scalable and configurable for use throughout the application
 */
export function MonogramLogo({
  initials: providedInitials,
  name,
  variant,
  size = "md",
  className,
  showLabel = false,
  label,
  backgroundColor,
  textColor,
  forDarkBackground = false,
}: MonogramLogoProps) {
  const initials = providedInitials || (name ? extractInitials(name) : "?")
  const labelText = label || name || "User"
  
  const sizing = sizeClasses[size]
  
  let colorScheme: { bg: string; text: string; gradient?: string }
  
  if (backgroundColor) {
    // Custom color provided
    colorScheme = {
      bg: backgroundColor,
      text: textColor || "text-white",
      gradient: undefined
    }
  } else if (variant === "vibrant") {
    // Generate color from initials
    const initColor = getColorFromInitials(initials)
    colorScheme = {
      bg: initColor.bg,
      text: "text-white"
    }
  } else {
    // Use variant color scheme
    colorScheme = getColorScheme(variant, initials, forDarkBackground)
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full ring-2 ring-white/30",
          sizing.container,
          colorScheme.bg,
          colorScheme.text,
          sizing.font,
          "no-underline tracking-tighter"
        )}
        title={labelText}
      >
        {initials}
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {labelText}
        </span>
      )}
    </div>
  )
}

export default MonogramLogo
