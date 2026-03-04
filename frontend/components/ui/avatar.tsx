"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex w-8 h-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  // Normalize src: strip query params from static placeholder paths so Next/static serves correctly
  const incomingSrc = (props as any).src
  const normalizedSrc = typeof incomingSrc === "string" ? incomingSrc.split("?")[0] : incomingSrc

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square w-full h-full object-cover", className)}
      {...props}
      src={normalizedSrc}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex w-full h-full items-center justify-center rounded-full text-sm font-medium text-white",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
