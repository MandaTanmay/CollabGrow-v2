/**
 * Storage Error Alert Component
 * Displays a helpful message when storage buckets are not configured
 */

"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

interface StorageErrorAlertProps {
  bucketName?: string
  className?: string
}

export function StorageErrorAlert({ bucketName, className }: StorageErrorAlertProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Storage Not Configured</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>
          The Supabase storage bucket <strong>{bucketName || "required bucket"}</strong> has not been created yet.
        </p>
        <p className="text-sm">
          To fix this:
        </p>
        <ol className="text-sm list-decimal list-inside space-y-1 ml-2">
          <li>Go to your Supabase Dashboard</li>
          <li>Navigate to Storage</li>
          <li>Create a public bucket named <code className="bg-destructive/10 px-1 py-0.5 rounded">{bucketName || "profile-images"}</code></li>
          <li>Enable public access for the bucket</li>
        </ol>
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/SUPABASE_STORAGE_SETUP.md', '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Setup Guide
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
