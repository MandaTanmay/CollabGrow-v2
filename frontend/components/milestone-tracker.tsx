"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { CalendarIcon, CheckCircle2, Circle, AlertCircle, Loader2, Plus, Trash2, Edit } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface Milestone {
  id: string
  title: string
  description?: string
  due_date?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  is_critical: boolean
  assigned_to?: string
  assigned_to_name?: string
  urgency_status?: 'overdue' | 'due_soon' | 'on_track'
}

interface ProjectProgress {
  progressPercentage: number
  totalMilestones: number
  completedMilestones: number
  overdueMilestones: number
  progressStatus: string
  milestones: Milestone[]
}

interface MilestoneTrackerProps {
  projectId: string
  isOwner: boolean
  isCollaborator: boolean
}

export function MilestoneTracker({ projectId, isOwner, isCollaborator }: MilestoneTrackerProps) {
  const [progress, setProgress] = useState<ProjectProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)
  const { toast } = useToast()

  const [newMilestone, setNewMilestone] = useState({
    title: "",
    description: "",
    dueDate: undefined as Date | undefined,
    isCritical: false
  })

  useEffect(() => {
    fetchProgress()
  }, [projectId])

  const fetchProgress = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/milestones/progress/${projectId}`,
        { credentials: 'include' }
      )

      if (!response.ok) throw new Error('Failed to fetch progress')

      const result = await response.json()
      setProgress(result.data.progress)
    } catch (error) {
      console.error('Error fetching progress:', error)
      toast({
        title: "Error",
        description: "Failed to load milestone progress",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const createMilestone = async () => {
    if (!newMilestone.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Milestone title is required",
        variant: "destructive"
      })
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          title: newMilestone.title,
          description: newMilestone.description,
          dueDate: newMilestone.dueDate?.toISOString(),
          isCritical: newMilestone.isCritical
        })
      })

      if (!response.ok) throw new Error('Failed to create milestone')

      toast({
        title: "Success",
        description: "Milestone created successfully"
      })

      setNewMilestone({ title: "", description: "", dueDate: undefined, isCritical: false })
      fetchProgress()
    } catch (error) {
      console.error('Error creating milestone:', error)
      toast({
        title: "Error",
        description: "Failed to create milestone",
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const updateMilestoneStatus = async (milestoneId: string, status: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      })

      if (!response.ok) throw new Error('Failed to update milestone')

      toast({
        title: "Success",
        description: "Milestone status updated"
      })

      fetchProgress()
    } catch (error) {
      console.error('Error updating milestone:', error)
      toast({
        title: "Error",
        description: "Failed to update milestone",
        variant: "destructive"
      })
    }
  }

  const deleteMilestone = async (milestoneId: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/milestones/${milestoneId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to delete milestone')

      toast({
        title: "Success",
        description: "Milestone deleted successfully"
      })

      fetchProgress()
    } catch (error) {
      console.error('Error deleting milestone:', error)
      toast({
        title: "Error",
        description: "Failed to delete milestone",
        variant: "destructive"
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'in_progress': return <Circle className="h-5 w-5 text-blue-500 fill-blue-200" />
      case 'cancelled': return <Circle className="h-5 w-5 text-gray-400" />
      default: return <Circle className="h-5 w-5 text-gray-300" />
    }
  }

  const getUrgencyBadge = (milestone: Milestone) => {
    if (milestone.status === 'completed') return null

    if (milestone.urgency_status === 'overdue') {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Overdue</Badge>
    }
    if (milestone.urgency_status === 'due_soon') {
      return <Badge variant="default" className="gap-1 bg-yellow-500">Due Soon</Badge>
    }
    return null
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 75) return "bg-green-500"
    if (percentage >= 50) return "bg-blue-500"
    if (percentage >= 25) return "bg-yellow-500"
    return "bg-orange-500"
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!progress) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Project Milestones</CardTitle>
            <CardDescription>
              {progress.completedMilestones} of {progress.totalMilestones} milestones completed
            </CardDescription>
          </div>
          {isOwner && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Milestone
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Milestone</DialogTitle>
                  <DialogDescription>Add a milestone to track project progress</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={newMilestone.title}
                      onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                      placeholder="e.g., Complete UI Design"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newMilestone.description}
                      onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                      placeholder="Detailed description of this milestone"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !newMilestone.dueDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newMilestone.dueDate ? format(newMilestone.dueDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newMilestone.dueDate}
                          onSelect={(date) => setNewMilestone({ ...newMilestone, dueDate: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="critical"
                      checked={newMilestone.isCritical}
                      onCheckedChange={(checked) => setNewMilestone({ ...newMilestone, isCritical: checked as boolean })}
                    />
                    <Label htmlFor="critical" className="cursor-pointer">Mark as critical milestone</Label>
                  </div>
                  <Button onClick={createMilestone} disabled={isCreating} className="w-full">
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Milestone"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">{progress.progressPercentage}%</span>
          </div>
          <Progress value={progress.progressPercentage} className={getProgressColor(progress.progressPercentage)} />
          {progress.overdueMilestones > 0 && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {progress.overdueMilestones} overdue milestone{progress.overdueMilestones > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Milestones List */}
        <div className="space-y-3">
          {progress.milestones && progress.milestones.length > 0 ? (
            progress.milestones.map((milestone) => (
              <div
                key={milestone.id}
                className={cn(
                  "p-4 border rounded-lg space-y-2 transition-colors",
                  milestone.status === 'completed' && "bg-green-50 border-green-200",
                  milestone.urgency_status === 'overdue' && milestone.status !== 'completed' && "bg-red-50 border-red-200"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(milestone.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{milestone.title}</h4>
                        {milestone.is_critical && (
                          <Badge variant="destructive" className="text-xs">Critical</Badge>
                        )}
                        {getUrgencyBadge(milestone)}
                      </div>
                      {milestone.description && (
                        <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {milestone.due_date && (
                          <span>Due: {format(new Date(milestone.due_date), "MMM d, yyyy")}</span>
                        )}
                        {milestone.assigned_to_name && (
                          <span>Assigned: {milestone.assigned_to_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(isOwner || isCollaborator) && milestone.status !== 'completed' && (
                      <Select
                        value={milestone.status}
                        onValueChange={(value) => updateMilestoneStatus(milestone.id, value)}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          {isOwner && <SelectItem value="cancelled">Cancelled</SelectItem>}
                        </SelectContent>
                      </Select>
                    )}
                    {milestone.status === 'completed' && (
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                        Completed
                      </Badge>
                    )}
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteMilestone(milestone.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No milestones yet. {isOwner && "Create one to start tracking progress!"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
