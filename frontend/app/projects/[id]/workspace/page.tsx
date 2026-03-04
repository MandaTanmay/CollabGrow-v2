"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useProjectChatSocket } from "@/lib/chat-socket"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/database"
import api from "@/lib/api"
import { ActivityTimeline } from "@/components/activity-timeline"
import { MonogramLogo } from "@/components/MonogramLogo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label" // Add Label
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// Added more icons
import { MessageCircle, FileText, Clock, Send, Users, ArrowLeft, Settings, Star, Calendar, Github, Link as LinkIcon, Plus, ExternalLink, Trash2, Upload, Paperclip, Image as ImageIcon, File, MoreVertical, Pencil, X, Check, ShieldAlert, CheckCircle, Circle } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

export default function ProjectWorkspacePage() {
    const { id: projectId } = useParams()
    const { toast } = useToast()
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()
    const [project, setProject] = useState<any>(null)
    const [accessDenied, setAccessDenied] = useState(false)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("chat")
    const [showCalendar, setShowCalendar] = useState(false)
    const [chatMessages, setChatMessages] = useState<any[]>([])
    const [newMessage, setNewMessage] = useState("")
    // Collaborators state (declare only once at the top!)
    const [collaborators, setCollaborators] = useState<any[]>([])
    // Project status logic
    const maxMembers = project?.max_members || 5; // fallback to 5 if not set
    
    // Build allMembers from creator + collaborators (not from project.members which may be outdated)
    const allMembers = useMemo(() => {
        if (!project?.creator) return [];
        
        const creator = {
            ...project.creator,
            role: 'Project Lead'
        };
        
        const collabUsers = collaborators.map(c => ({
            ...c.user,
            role: c.role || 'Collaborator',
            joined_at: c.joined_at
        }));
        
        return [creator, ...collabUsers];
    }, [project?.creator, collaborators]);
    
    const memberCount = allMembers.length;
    let projectStatus = project?.status || "recruiting";
    if (projectStatus !== "completed") {
        if (memberCount >= maxMembers) projectStatus = "active";
        else projectStatus = "recruiting";
    }
    const isMember = user && allMembers.some((m:any) => m?.firebase_uid === user?.uid || m?.id === user?.uid);

    // Debug: Log members when they change
    useEffect(() => {
        console.log('📋 All Members Updated:', allMembers.length, allMembers);
    }, [allMembers]);

    // Real-time chat via Socket.IO
    const handleSocketMessage = useCallback((msg: any) => {
        console.log('💬 Received new chat message:', msg)
        setChatMessages((prev) => [...prev, msg])
    }, [])
    
    // Handle chat history (only set if we don't already have messages loaded)
    const handleChatHistory = useCallback((messages: any[]) => {
        console.log('📜 Received chat history from socket:', messages.length, 'messages')
        // Only use socket history if we don't have messages already (REST API failed)
        setChatMessages(prev => {
            if (prev.length === 0) {
                console.log('✅ Using socket chat history (no REST messages)')
                return messages
            } else {
                console.log('⏭️  Ignoring socket history (already have', prev.length, 'messages from REST)')
                return prev
            }
        })
    }, [])
    
    // Use destructuring for socket correctly (if useProjectChatSocket returns an object with socket)
    const chatSocket = useProjectChatSocket(
        projectId ? String(projectId) : "", 
        handleSocketMessage,
        handleChatHistory
    )
    const sendMessage = chatSocket.sendMessage;
    const socket = chatSocket.socket;
    
    // Listen for socket errors
    useEffect(() => {
        if (!socket) return;
        
        const handleError = (error: any) => {
            console.error('❌ Socket error:', error)
            toast({
                title: "Connection Error",
                description: error.message || "Failed to connect to chat server",
                variant: "destructive"
            })
        }
        
        socket.on('error', handleError);
        
        return () => {
            socket.off('error', handleError);
        }
    }, [socket, toast]);
        // Real-time project completion listener
        useEffect(() => {
            if (!socket) return;
            const onProjectCompleted = () => {
                setProject((prev: any) => prev ? { ...prev, status: 'completed' } : prev)
                toast({
                    title: "Project Completed",
                    description: "This project has been marked as complete."
                })
            };
            socket.on("projectCompleted", onProjectCompleted);
            return () => {
                socket.off("projectCompleted", onProjectCompleted);
            };
        }, [socket, toast]);

        // Real-time listener for new user joining the project
        useEffect(() => {
            if (!socket) return;
            const onUserJoinedProject = async (event: any) => {
                const { projectId: joinedProjectId, userId: newCollaboratorId } = event;
                
                // Only update if this is for the current project
                if (joinedProjectId === projectId) {
                    // Reload collaborators to include the new member
                    try {
                        const { data: collabData } = await supabase
                            .from('project_collaborators')
                            .select(`
                                id, 
                                user_id, 
                                role, 
                                status, 
                                joined_at,
                                user:user_id (
                                    id,
                                    full_name,
                                    username,
                                    profile_image_url,
                                    firebase_uid
                                )
                            `)
                            .eq('project_id', projectId)
                            .eq('status', 'Active');
                        
                        if (collabData) {
                            setCollaborators(collabData);
                            toast({
                                title: "Team Updated",
                                description: "A new member has joined the project!"
                            });
                        }
                    } catch (error) {
                        console.error("Error updating collaborators:", error);
                    }
                }
            };
            
            socket.on("userJoinedProject", onUserJoinedProject);
            return () => {
                socket.off("userJoinedProject", onUserJoinedProject);
            };
        }, [socket, projectId, toast]);
    // (Removed duplicate declaration of collaborators)
    // Resources State
    const [resources, setResources] = useState<any[]>([])
    const [newResourceTitle, setNewResourceTitle] = useState("")
    const [newResourceUrl, setNewResourceUrl] = useState("")
    const [addingResource, setAddingResource] = useState(false)
    // New State for File Upload
    const [resourceType, setResourceType] = useState<'link' | 'file'>('link')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    // Chat Editing State
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState("")

    // Tasks State
    const [tasks, setTasks] = useState<any[]>([])
    const [newTaskTitle, setNewTaskTitle] = useState("")
    const [addingTask, setAddingTask] = useState(false)
    const [newTaskAssignee, setNewTaskAssignee] = useState("")
    const [newTaskDueDate, setNewTaskDueDate] = useState("")

    // Team Member Edit State
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
    const [editingMemberRole, setEditingMemberRole] = useState("")  

    // Project Edit/Delete State
    const [showEditProjectDialog, setShowEditProjectDialog] = useState(false)
    const [editProjectTitle, setEditProjectTitle] = useState("")
    const [editProjectDescription, setEditProjectDescription] = useState("")
    const [savingProject, setSavingProject] = useState(false)

    // Derived State
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.status === 'done').length
    const progressPercentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

    function timeAgo(dateString: string) {
        const date = new Date(dateString)
        const now = new Date()
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

        if (seconds < 60) return "just now"
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
        const days = Math.floor(hours / 24)
        if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
        return date.toLocaleDateString()
    }

    useEffect(() => {
        async function loadWorkspace() {
            // Don't try to load if auth is still loading
            if (authLoading) {
                console.log('⏳ Waiting for authentication...');
                return;
            }
            
            if (!user || !projectId) {
                console.log('⚠️ User not authenticated or project ID missing');
                if (!user && !authLoading) {
                    // Only redirect if auth is done loading and user is still null
                    router.push('/auth/login');
                }
                return;
            }

            console.log('✅ User and Project ID:', { user, projectId });

            console.log('🔍 Debugging loadWorkspace:', { user, projectId });
            console.log('🔍 Fetching updates for project:', projectId);

            try {
                setLoading(true)
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

                // Get current user from database
                const userRes = await fetch(`${API_URL}/api/queries/user/firebase/${user.uid}`)
                if (!userRes.ok) {
                    router.push("/auth/login")
                    return
                }
                const dbUser = await userRes.json()
                if (!dbUser) {
                    router.push("/auth/login")
                    return
                }

                // Fetch project data from backend
                const projectRes = await fetch(`${API_URL}/api/queries/projects`)
                if (!projectRes.ok) throw new Error('Failed to fetch projects')
                const projects = await projectRes.json()
                const projectData = projects.find((p: any) => p.id === projectId)
                
                console.log('📊 All projects:', projects.length)
                console.log('🎯 Found project:', projectData)
                console.log('👤 Project creator:', projectData?.creator)
                
                if (!projectData) {
                    console.error('❌ Project not found with ID:', projectId)
                    setAccessDenied(true)
                    setLoading(false)
                    return
                }

                // Fetch collaborators from backend
                const collabRes = await fetch(`${API_URL}/api/queries/project/${projectId}/collaborators`)
                const collabData = collabRes.ok ? await collabRes.json() : []
                console.log('👥 Loaded collaborators:', collabData.length, collabData)
                setCollaborators(collabData)

                // Fetch resources from backend
                const resourcesRes = await fetch(`${API_URL}/api/queries/project/${projectId}/resources`)
                const resourcesData = resourcesRes.ok ? await resourcesRes.json() : []
                setResources(resourcesData)

                // Fetch tasks from DB
                const tasksRes = await fetch(`${API_URL}/api/queries/project/${projectId}/tasks`)
                const tasksData = tasksRes.ok ? await tasksRes.json() : []
                setTasks(tasksData)

                // Fetch chat messages from DB (initial load)
                const chatRes = await fetch(`${API_URL}/api/queries/project/${projectId}/chat`)
                const chatData = chatRes.ok ? await chatRes.json() : []
                console.log('💬 Loaded chat messages from REST:', chatData.length, chatData[0])
                setChatMessages(chatData)

                setProject(projectData)
            } catch (error: any) {
                console.error("Error loading workspace:", error)
                setProject(null)
                setCollaborators([])
                setResources([])
                setChatMessages([])
                setTasks([])
            } finally {
                setLoading(false)
            }
        }
        loadWorkspace()
    }, [user, projectId, router, authLoading])

    // Remove old supabase chat subscription logic

    const handleEditMessage = (msg: any) => {
        setEditingMessageId(msg.id);
        setEditContent(msg.content);
    }

    // Socket listeners for message update/delete
    useEffect(() => {
        if (!socket) return;
        socket.on("chatMessageUpdated", (msg: any) => {
            setChatMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content } : m));
        });
        socket.on("chatMessageDeleted", (msg: any) => {
            setChatMessages(prev => prev.filter(m => m.id !== msg.id));
        });
        return () => {
            socket.off("chatMessageUpdated");
            socket.off("chatMessageDeleted");
        };
    }, [socket]);

    const handleCancelEdit = () => {
        setEditingMessageId(null)
        setEditContent("")
    }

    const handleSaveEdit = async () => {
        if (!editContent.trim() || !editingMessageId) return;
        try {
            await api.posts.update(editingMessageId, editContent);
            setChatMessages(prev => prev.map(msg => msg.id === editingMessageId ? { ...msg, content: editContent } : msg));
            setEditingMessageId(null);
            setEditContent("");
            if (socket) socket.emit("chatMessageUpdated", { id: editingMessageId, content: editContent });
        } catch (error) {
            console.error("Error updating message:", error);
        }
    }

    const handleDeleteMessage = async (msgId: string) => {
        if (!window.confirm("Delete this message?")) return;
        try {
            await api.posts.delete(msgId);
            setChatMessages((prev) => prev.filter(msg => msg.id !== msgId));
            if (socket) socket.emit("chatMessageDeleted", { id: msgId });
            toast({
                title: "Success",
                description: "Message deleted successfully"
            });
        } catch (error) {
            console.error("Error deleting message:", error);
            toast({
                title: "Failed to delete message",
                description: String(error),
                variant: "destructive"
            });
        }
    }

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !user) {
            console.log('⚠️ Cannot send message:', { hasMessage: !!newMessage.trim(), hasUser: !!user })
            return
        }
        
        // Backend will fetch the real userName and userLogo from database
        // We only need to send userId and content
        const msg = {
            roomId: projectId,
            userId: user.uid,
            content: newMessage,
            timestamp: new Date().toISOString(),
        }
        
        try {
            setNewMessage("")
            console.log('🚀 Sending message:', msg)
            sendMessage(msg)
            console.log('✅ Message sent successfully')
        } catch (error) {
            console.error('❌ Error sending message:', error)
            toast({
                title: "Failed to send message",
                description: "Please try again",
                variant: "destructive"
            })
        }
    }

    const handleCompleteProject = async () => {
        if (!user || !project) return;
        if (!window.confirm("Are you sure you want to mark this project as complete? This will update stats for all members.")) return
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/projects/${projectId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ user_id: user.uid }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to complete project');
            }

            setProject((prev: any) => ({ ...prev, status: 'completed' }))
            toast({
                title: "Success",
                description: "Project marked as complete!"
            })
        } catch (error: any) {
            console.error("Error completing project:", error)
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            })
        }
    }

    // Task Handlers
    const handleAddTask = async () => {
        if (!newTaskTitle.trim() || !user || !projectId || !newTaskAssignee || !newTaskDueDate) return
        try {
            setAddingTask(true)
            const { data: dbUser } = await supabase.from("users").select("id").eq("firebase_uid", user.uid).single()
            if (!dbUser) return

            const { data, error } = await supabase.from("project_tasks").insert({
                project_id: projectId,
                title: newTaskTitle,
                assigned_to: newTaskAssignee,
                due_date: newTaskDueDate,
                status: 'todo'
            }).select().single()

            if (error) throw error

            setTasks([data, ...tasks])
            setNewTaskTitle("")
            setNewTaskAssignee("")
            setNewTaskDueDate("")
        } catch (error: any) {
            console.error("Error adding task", error)
            toast({
                title: "Failed to add task",
                description: error.message,
                variant: "destructive"
            })
        } finally {
            setAddingTask(false)
        }
    }

    const handleToggleTask = async (taskId: string, currentStatus: string, assignedTo?: string) => {
        // Permission check: Only assigned user can toggle task
        if (assignedTo && user) {
            // Convert user.uid to database user ID
            const { data: dbUser } = await supabase.from("users").select("id").eq("firebase_uid", user.uid).single()
            if (!dbUser || dbUser.id !== assignedTo) {
                toast({
                    title: "Permission Denied",
                    description: "Only the assigned user can mark this task as complete.",
                    variant: "destructive"
                })
                return
            }
        }

        const newStatus = currentStatus === 'done' ? 'todo' : 'done'
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

        try {
            const { error } = await supabase.from("project_tasks").update({ status: newStatus }).eq("id", taskId)
            if (error) throw error
            
            toast({
                title: "Success",
                description: `Task marked as ${newStatus === 'done' ? 'complete' : 'incomplete'}`
            })
        } catch (error) {
            console.error("Error updating task", error)
            // Rollback
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: currentStatus } : t))
            toast({
                title: "Error",
                description: "Failed to update task status",
                variant: "destructive"
            })
        }
    }

    const handleDeleteTask = async (taskId: string) => {
        if (!window.confirm("Delete this task?")) return
        const previousTasks = [...tasks]
        setTasks(prev => prev.filter(t => t.id !== taskId))
        try {
            const { error } = await supabase.from("project_tasks").delete().eq("id", taskId)
            if (error) throw error
        } catch (error) {
            console.error("Error deleting task", error)
            setTasks(previousTasks)
        }
    }

    // Team Member Handlers
    const handleEditMemberRole = async (collaboratorId: string, newRole: string) => {
        try {
            const { error } = await supabase
                .from("project_collaborators")
                .update({ role: newRole })
                .eq("id", collaboratorId)
            
            if (error) throw error

            // Update local state
            setCollaborators(prev => prev.map(c => 
                c.id === collaboratorId ? { ...c, role: newRole } : c
            ))

            setEditingMemberId(null)
            setEditingMemberRole("")

            toast({
                title: "Success",
                description: "Member role updated successfully"
            })
        } catch (error) {
            console.error("Error updating member role:", error)
            toast({
                title: "Error",
                description: "Failed to update member role",
                variant: "destructive"
            })
        }
    }

    const handleRemoveMember = async (collaboratorId: string, memberName: string) => {
        if (!window.confirm(`Remove ${memberName} from the project?`)) return

        try {
            const { error } = await supabase
                .from("project_collaborators")
                .delete()
                .eq("id", collaboratorId)
            
            if (error) throw error

            // Update local state
            setCollaborators(prev => prev.filter(c => c.id !== collaboratorId))

            toast({
                title: "Success",
                description: `${memberName} removed from project`
            })
        } catch (error) {
            console.error("Error removing member:", error)
            toast({
                title: "Error",
                description: "Failed to remove member",
                variant: "destructive"
            })
        }
    }

    // Resource Handlers
    const handleAddResource = async () => {
        if (!newResourceTitle.trim()) {
            toast({
                title: "Error",
                description: "Please enter a resource title",
                variant: "destructive"
            })
            return
        }

        // Validate based on resource type
        if (resourceType === 'link') {
            if (!newResourceUrl.trim()) {
                toast({
                    title: "Error",
                    description: "Please enter a resource URL",
                    variant: "destructive"
                })
                return
            }

            // Auto-fix URL if missing protocol
            let finalUrl = newResourceUrl.trim()
            if (!finalUrl.match(/^https?:\/\//i)) {
                finalUrl = 'https://' + finalUrl
            }

            // Validate URL format
            try {
                new URL(finalUrl)
            } catch {
                toast({
                    title: "Invalid URL",
                    description: "Please enter a valid URL. Example: github.com/user/repo",
                    variant: "destructive"
                })
                return
            }

            try {
                setAddingResource(true)
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
                
                console.log('Adding link resource:', { title: newResourceTitle, url: finalUrl, projectId })

                const response = await fetch(`${API_URL}/api/queries/project/${projectId}/resources`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        title: newResourceTitle,
                        url: finalUrl,
                        type: 'link'
                    })
                })

                console.log('Response status:', response.status)

                if (!response.ok) {
                    const err = await response.json()
                    console.error('Backend error:', err)
                    throw new Error(err.error || 'Failed to add resource')
                }

                const newResource = await response.json()
                console.log('Resource added:', newResource)
                
                setResources(prev => [newResource, ...prev])
                setNewResourceTitle("")
                setNewResourceUrl("")

                toast({
                    title: "Success",
                    description: "Resource added successfully"
                })
            } catch (error: any) {
                console.error("Error adding resource:", error)
                toast({
                    title: "Error",
                    description: error.message || "Failed to add resource",
                    variant: "destructive"
                })
            } finally {
                setAddingResource(false)
            }
        } else if (resourceType === 'file') {
            // File upload
            if (!selectedFile) {
                toast({
                    title: "Error",
                    description: "Please select a file to upload",
                    variant: "destructive"
                })
                return
            }

            // Check file size (50MB limit)
            const maxSize = 50 * 1024 * 1024 // 50MB
            if (selectedFile.size > maxSize) {
                toast({
                    title: "File Too Large",
                    description: "File size must be less than 50MB",
                    variant: "destructive"
                })
                return
            }

            try {
                setAddingResource(true)
                console.log('Uploading file:', selectedFile.name, selectedFile.type, selectedFile.size)

                // 1. Upload to Supabase Storage
                const fileExt = selectedFile.name.split('.').pop()
                const fileName = `${projectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('project-resources')
                    .upload(fileName, selectedFile, {
                        cacheControl: '3600',
                        upsert: false
                    })

                if (uploadError) {
                    console.error("Storage upload error:", uploadError);
                    
                    // Check if bucket doesn't exist
                    if (uploadError.message.includes("Bucket not found") || uploadError.message.includes("bucket")) {
                        // Try to create the bucket
                        console.log('Bucket not found, attempting to create...')
                        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
                        const setupRes = await fetch(`${API_URL}/api/storage-setup`, {
                            credentials: 'include'
                        })
                        const setupData = await setupRes.json()
                        
                        if (setupRes.ok) {
                            toast({
                                title: "Storage Setup Complete",
                                description: "Please try uploading again",
                            })
                        } else {
                            throw new Error("Storage bucket creation failed. Please contact administrator.")
                        }
                        return
                    }
                    
                    throw new Error(uploadError.message || "Upload failed")
                }

                console.log('File uploaded to storage:', uploadData)

                // 2. Get public URL with error handling
                let publicUrl: string
                try {
                    const { data: { publicUrl: url } } = supabase.storage
                        .from('project-resources')
                        .getPublicUrl(fileName)
                    publicUrl = url
                } catch (err) {
                    console.error('Error getting public URL:', err)
                    toast({
                        title: "Error",
                        description: "File uploaded but failed to get URL. Please refresh.",
                        variant: "destructive"
                    })
                    setUploading(false)
                    return
                }

                console.log('Public URL:', publicUrl)

                // 3. Save to database via API
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
                
                // Determine file type
                let fileType = 'file'
                if (selectedFile.type.startsWith('image/')) fileType = 'image'
                else if (selectedFile.type.includes('pdf')) fileType = 'pdf'
                
                const response = await fetch(`${API_URL}/api/queries/project/${projectId}/resources`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        title: newResourceTitle,
                        url: publicUrl,
                        type: fileType,
                        file_path: fileName,
                        size_bytes: selectedFile.size,
                        mime_type: selectedFile.type
                    })
                })

                if (!response.ok) {
                    // If DB save fails, delete the uploaded file
                    try {
                        await supabase.storage.from('project-resources').remove([fileName])
                    } catch (removeErr) {
                        console.warn('Failed to cleanup uploaded file:', removeErr)
                    }
                    const err = await response.json()
                    throw new Error(err.error || 'Failed to save resource')
                }

                const newResource = await response.json()
                console.log('File resource saved:', newResource)
                
                setResources(prev => [newResource, ...prev])
                setNewResourceTitle("")
                setSelectedFile(null)
                
                // Reset file input
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
                if (fileInput) fileInput.value = ''

                toast({
                    title: "Success",
                    description: `File "${selectedFile.name}" uploaded successfully`
                })
            } catch (error: any) {
                console.error("Error uploading file:", error)
                toast({
                    title: "Upload Failed",
                    description: error.message || "Failed to upload file",
                    variant: "destructive"
                })
            } finally {
                setAddingResource(false)
            }
        }
    }

    const handleDeleteResource = async (resourceId: string, filePath?: string) => {
        if (!window.confirm("Delete this resource?")) return

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

            const response = await fetch(`${API_URL}/api/queries/project/${projectId}/resources/${resourceId}`, {
                method: 'DELETE',
                credentials: 'include'
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || 'Failed to delete resource')
            }

            // Update local state
            setResources(prev => prev.filter(r => r.id !== resourceId))

            toast({
                title: "Success",
                description: "Resource deleted successfully"
            })
        } catch (error: any) {
            console.error("Error deleting resource:", error)
            toast({
                title: "Error",
                description: error.message || "Failed to delete resource",
                variant: "destructive"
            })
        }
    }

    // Project Edit/Delete Handlers
    const handleEditProject = async () => {
        if (!editProjectTitle.trim() || !editProjectDescription.trim()) {
            toast({
                title: "Error",
                description: "Please fill in all fields",
                variant: "destructive"
            })
            return
        }

        try {
            setSavingProject(true)
            const { error } = await supabase
                .from("projects")
                .update({ 
                    title: editProjectTitle,
                    description: editProjectDescription,
                    updated_at: new Date().toISOString()
                })
                .eq("id", projectId)
            
            if (error) throw error

            setProject((prev: any) => ({ 
                ...prev, 
                title: editProjectTitle,
                description: editProjectDescription 
            }))

            setShowEditProjectDialog(false)
            setEditProjectTitle("")
            setEditProjectDescription("")

            toast({
                title: "Success",
                description: "Project updated successfully"
            })
        } catch (error) {
            console.error("Error updating project:", error)
            toast({
                title: "Error",
                description: "Failed to update project",
                variant: "destructive"
            })
        } finally {
            setSavingProject(false)
        }
    }

    const handleDeleteProject = async () => {
        if (!window.confirm("Are you sure you want to delete this project? This action cannot be undone!")) return

        try {
            const { error } = await supabase.from("projects").delete().eq("id", projectId)
            if (error) throw error

            toast({
                title: "Success",
                description: "Project deleted successfully"
            })

            // Redirect to dashboard
            setTimeout(() => {
                router.push("/dashboard")
            }, 1000)
        } catch (error) {
            console.error("Error deleting project:", error)
            toast({
                title: "Error",
                description: "Failed to delete project",
                variant: "destructive"
            })
        }
    }

    if (loading) return <div className="flex h-screen items-center justify-center">Loading Workspace...</div>

    if (accessDenied) {
        let message = "You must be a member of this project to access the workspace.";
        if (projectStatus === "active") message = "This project is full. Only members can access the workspace.";
        if (projectStatus === "completed") message = "This project is completed. Only members can view the workspace.";
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
                    <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                    <p className="text-gray-600 mb-6">{message}</p>
                    <Link href={`/projects/${projectId}`}>
                        <Button className="w-full">Return to Project Details</Button>
                    </Link>
                </div>
            </div>
        )
    }

    if (!project) return <div>Project not found</div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            {/* Header */}
            <header className="border-b border-white/20 backdrop-blur-md bg-white/10 sticky top-0 z-50">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Button variant="ghost" className="p-0 hover:bg-transparent" onClick={() => router.push("/")}>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                                    <Users className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hidden sm:inline">
                                    CollabGrow
                                </span>
                            </div>
                        </Button>

                    </div>

                    <div className="flex items-center gap-4">
                        <Avatar className="w-9 h-9 cursor-pointer">
                            <AvatarImage src={user?.profileImage || "/placeholder.svg"} />
                            <AvatarFallback>{user?.fullName?.[0] || "U"}</AvatarFallback>
                        </Avatar>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-8">
                {/* Project Header */}
                <div className="mb-6 flex items-center justify-between">
                    <Button variant="outline" className="bg-transparent" onClick={() => router.push(`/dashboard`)}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Go to Dashboard
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" className="bg-transparent">
                            Invite Member
                        </Button>
                    </div>
                </div>

                <div className="mb-8">
                    <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-xl">
                        <CardContent className="p-8">
                            <div className="flex flex-col lg:flex-row gap-8">
                                {/* Left Column: Project Info */}
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between lg:justify-start lg:gap-4 mb-2">
                                                <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
                                                {/* Mobile settings dropdown - only for project owner */}
                                                {project?.creator?.firebase_uid === user?.uid && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" size="sm" className="lg:hidden">
                                                                <Settings className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem 
                                                                onClick={() => {
                                                                    setEditProjectTitle(project.title)
                                                                    setEditProjectDescription(project.description)
                                                                    setShowEditProjectDialog(true)
                                                                }}
                                                            >
                                                                <Pencil className="w-4 h-4 mr-2" />
                                                                Edit Project
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem 
                                                                className="text-red-600"
                                                                onClick={handleDeleteProject}
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-2" />
                                                                Delete Project
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                                {projectStatus === "recruiting" && (
                                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0 flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                        recruiting
                                                    </Badge>
                                                )}
                                                {projectStatus === "active" && (
                                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0 flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                        active
                                                    </Badge>
                                                )}
                                                {projectStatus === "completed" && (
                                                    <Badge className="bg-gray-200 text-gray-700 border-0 flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                                                        completed
                                                    </Badge>
                                                )}
                                                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0">
                                                    {project.difficulty_level || "Intermediate"}
                                                </Badge>
                                                <Badge variant="outline" className="text-gray-600 bg-gray-50/50">
                                                    {project.category || "General"}
                                                </Badge>
                                            </div>
                                            {/* Show full message if project is full and user is not a member */}
                                            {projectStatus === "active" && !isMember && (
                                                <div className="text-red-500 font-semibold mb-2">This project is full. You cannot join.</div>
                                            )}
                                            {/* Show completed message if project is completed and user is not a member */}
                                            {projectStatus === "completed" && !isMember && (
                                                <div className="text-gray-500 font-semibold mb-2">This project is completed. Only members can view details.</div>
                                            )}
                                        </div>
                                        {/* Project Settings Dropdown - Only for project owner */}
                                        {project?.creator?.firebase_uid === user?.uid && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="icon" className="hidden lg:flex shrink-0 ml-4">
                                                        <Settings className="w-4 h-4 text-gray-600" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem 
                                                        onClick={() => {
                                                            setEditProjectTitle(project.title)
                                                            setEditProjectDescription(project.description)
                                                            setShowEditProjectDialog(true)
                                                        }}
                                                    >
                                                        <Pencil className="w-4 h-4 mr-2" />
                                                        Edit Project
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        className="text-red-600"
                                                        onClick={handleDeleteProject}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Delete Project
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>

                                    <p className="text-gray-600 leading-relaxed mb-8 max-w-3xl">
                                        {project.description}
                                    </p>

                                    {/* Skills Section */}
                                    <div className="mb-8">
                                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Required Skills</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {project.project_skills && project.project_skills.length > 0 ? (
                                                project.project_skills.map((item: any, idx: number) => (
                                                    <Badge key={idx} className="bg-gradient-to-r from-blue-500 to-purple-500 text-white relative">
                                                        {item.skill?.name}
                                                    </Badge>
                                                ))
                                            ) : (project.required_skills || []).map((skill: string, idx: number) => (
                                                <Badge key={idx} className="bg-gradient-to-r from-blue-500 to-purple-500 text-white relative">
                                                    {skill}
                                                </Badge>
                                            ))}
                                            {(!project.project_skills?.length && !project.required_skills?.length) && (
                                                <span className="text-sm text-gray-500">No specific skills listed</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Members List (show only members if full/active or completed) */}
                                    <div className="flex flex-col gap-4 mt-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold text-gray-900">Project Members</h3>
                                            <Badge variant="outline">Members</Badge>
                                        </div>
                                        {(!allMembers || allMembers.length === 0) ? (
                                            <p className="text-sm text-gray-500 italic">No members yet</p>
                                        ) : (
                                            allMembers.map((member: any, idx: number) => (
                                                <div key={member?.id || member?.firebase_uid || idx} className="flex items-center gap-3">
                                                    {member?.profile_image_url ? (
                                                        <Avatar className="w-12 h-12 bg-gray-100 ring-2 ring-white shadow-sm">
                                                            <AvatarImage src={member?.profile_image_url} />
                                                            <AvatarFallback>
                                                                <MonogramLogo 
                                                                    name={member?.full_name || member?.displayName}
                                                                    variant="vibrant"
                                                                    size="md"
                                                                />
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    ) : (
                                                        <MonogramLogo 
                                                            name={member?.full_name || member?.displayName}
                                                            variant="vibrant"
                                                            size="md"
                                                        />
                                                    )}
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900">{member?.full_name || member?.displayName || 'Member'}</h4>
                                                        {member?.university && <p className="text-xs text-gray-500 mb-1">{member.university}</p>}
                                                        <Badge
                                                            className={`text-xs ${
                                                                idx === 0 
                                                                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                                                    : 'bg-gray-50 text-gray-600 border-gray-200'
                                                            }`}
                                                        >
                                                            {member.role || (idx === 0 ? 'Project Lead' : 'Collaborator')}
                                                        </Badge>
                                                        {projectStatus === 'completed' && (
                                                            <Badge className="bg-green-100 text-green-700 border-green-200">Completed</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Right Column: Stats & Actions */}
                                <div className="lg:w-[340px] shrink-0">
                                    <div className="flex items-center justify-between mb-8 px-4">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-blue-600 mb-1">{collaborators.length + 1}</div>
                                            <div className="text-sm text-gray-500 font-medium">Members</div>
                                        </div>
                                        <div className="w-px h-12 bg-gray-200" />
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-purple-600 mb-1">{progressPercentage}%</div>
                                            <div className="text-sm text-gray-500 font-medium">Complete</div>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mb-8">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-gray-900">Project Progress</span>
                                            <span className="text-sm text-gray-500">{progressPercentage}%</span>
                                        </div>
                                        <Progress value={progressPercentage} className="h-2 bg-gray-100 [&>div]:bg-gradient-to-r [&>div]:from-blue-600 [&>div]:to-purple-600" />
                                        <p className="text-xs text-gray-500 mt-2">{completedTasks} of {totalTasks} tasks completed</p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="space-y-3">
                                        <div className="flex gap-2">
                                            {project?.creator?.firebase_uid === user?.uid ? (
                                                <Button
                                                    className={`flex-1 py-6 text-white shadow-md ${project.status === 'completed' ? 'bg-green-600 hover:bg-green-700' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'}`}
                                                    onClick={project.status === 'completed' ? undefined : handleCompleteProject}
                                                    disabled={project.status === 'completed'}
                                                >
                                                    <CheckCircle className="w-5 h-5 mr-2" />
                                                    {project.status === 'completed' ? "Project Completed" : "Mark as Complete"}
                                                </Button>
                                            ) : (
                                                <Button
                                                    className={`flex-1 py-6 text-white shadow-md ${project.status === 'completed' ? 'bg-green-600 hover:bg-green-700' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'}`}
                                                    onClick={async () => {
                                                        if (project.status === 'completed' || !user) return;
                                                        try {
                                                            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/projects/${projectId}/complete`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                credentials: 'include',
                                                                body: JSON.stringify({ user_id: user.uid }),
                                                            });
                                                            if (!response.ok) {
                                                                const err = await response.json();
                                                                throw new Error(err.error || 'Failed to complete project');
                                                            }
                                                            setProject((prev: any) => ({ ...prev, status: 'completed' }))
                                                            if (socket) {
                                                                socket.emit("projectCompleted", { projectId });
                                                            }
                                                            toast({
                                                                title: "Success",
                                                                description: "Project marked as complete!"
                                                            })
                                                        } catch (error: any) {
                                                            console.error("Error completing project:", error)
                                                            toast({
                                                                title: "Error",
                                                                description: error.message,
                                                                variant: "destructive"
                                                            })
                                                        }
                                                    }}
                                                    disabled={project.status === 'completed'}
                                                >
                                                    <CheckCircle className="w-5 h-5 mr-2" />
                                                    {project.status === 'completed' ? "Project Completed" : "Mark Complete"}
                                                </Button>
                                            )}
                                            
                                            {/* Desktop Project Settings - only for project owner */}
                                            {project?.creator?.firebase_uid === user?.uid && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button 
                                                            variant="outline" 
                                                            size="icon"
                                                            className="h-[56px] w-[56px] bg-white hover:bg-gray-50 border-gray-200 hidden lg:flex"
                                                            title="Project Settings"
                                                        >
                                                            <Settings className="w-5 h-5 text-gray-700" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem 
                                                            onClick={() => {
                                                                setEditProjectTitle(project.title)
                                                                setEditProjectDescription(project.description)
                                                                setShowEditProjectDialog(true)
                                                            }}
                                                        >
                                                            <Pencil className="w-4 h-4 mr-2" />
                                                            Edit Project
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem 
                                                            className="text-red-600"
                                                            onClick={handleDeleteProject}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Delete Project
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                        <Button variant="outline" className="w-full bg-white hover:bg-gray-50 border-gray-200 text-gray-700 py-6" onClick={() => setShowCalendar(true)}>
                                            <Calendar className="w-5 h-5 mr-2" />
                                            View Calendar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4 bg-white/60 backdrop-blur-sm border-0 shadow-md">
                        <TabsTrigger value="chat">Chat</TabsTrigger>
                        <TabsTrigger value="tasks">Tasks & Milestones</TabsTrigger>
                        <TabsTrigger value="team">Team</TabsTrigger>
                        <TabsTrigger value="resources">Resources</TabsTrigger>
                    </TabsList>

                    {/* Chat Tab */}
                    <TabsContent value="chat">
                        <Card className="mt-4 border-0 bg-white/60 backdrop-blur-sm shadow-xl h-[480px] flex flex-col">
                            <CardHeader className="border-b border-gray-100/50 pb-4">
                                <CardTitle className="flex items-center gap-2">
                                    <MessageCircle className="w-5 h-5 text-blue-600" />
                                    Team Chat
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col overflow-hidden pt-4">
                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 bg-gradient-to-b from-blue-50/30 to-purple-50/30 rounded-lg p-4 -mx-2">
                                    {chatMessages.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                                            <MessageCircle className="w-12 h-12 mb-2 opacity-20" />
                                            <p>No messages yet. Start the conversation!</p>
                                        </div>
                                    )}
                                    {chatMessages.map((msg, idx) => {
                                        // Check if this is a system message (handle both camelCase and lowercase)
                                        const isSystemMessage = msg.isSystem || msg.is_system || msg.issystem || 
                                                              msg.userName === 'System' || msg.username === 'System';
                                        
                                        if (isSystemMessage) {
                                            // Render system message (centered, styled)
                                            return (
                                                <div key={`sys-${msg.id || msg.timestamp || 'unknown'}-${idx}`} className="flex justify-center my-3">
                                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 px-5 py-2.5 rounded-full text-sm font-medium border border-blue-200 shadow-sm max-w-md text-center">
                                                        <span className="inline-block">{msg.content}</span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        
                                        // Regular user message
                                        const isOwn = msg.user?.firebase_uid === user?.uid || msg.userId === user?.uid;
                                        // Use index suffix to ensure uniqueness even if IDs collide or messages are duplicated
                                        const key = msg.id ? `msg-${msg.id}-${idx}` : msg._id ? `msg-${msg._id}-${idx}` : msg.timestamp ? `msg-${msg.timestamp}-${idx}` : `msg-fallback-${idx}`;
                                        
                        // Debug: Log message structure
                        if (idx === 0) {
                            console.log('📨 First message structure:', msg);
                        }
                        
                        // Messages from REST API and Socket.io have flat structure
                        // Handle both camelCase (userName) and lowercase (username) from PostgreSQL
                        const avatarUrl = msg.userLogo || msg.userlogo || null;
                        const username = msg.userName || msg.username || "User";
                        
                        // Generate initials from username
                        let userInitials = "U";
                        const nameParts = username.trim().split(/\s+/);
                        if (nameParts.length >= 2) {
                            userInitials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
                        } else if (nameParts[0]) {
                            userInitials = nameParts[0][0].toUpperCase();
                        }
                        
                        // Generate consistent color for avatar background
                        const stringToColor = (str: string): string => {
                            const colors = ["#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F59E0B", 
                                          "#10B981", "#14B8A6", "#6366F1", "#F97316", "#84CC16"];
                            let hash = 0;
                            for (let i = 0; i < str.length; i++) {
                                hash = str.charCodeAt(i) + ((hash << 5) - hash);
                            }
                            return colors[Math.abs(hash) % colors.length];
                        };
                        const avatarBgColor = stringToColor(username);
                        
                        // Real-time time display
                        const rawTime = msg.created_at || msg.timestamp;
                        const date = rawTime ? new Date(rawTime) : null;
                        const now = new Date();
                        let timeString = "";
                        if (date && !isNaN(date.getTime())) {
                            // Show HH:mm, update every minute
                            const hours = date.getHours().toString().padStart(2, '0');
                            const minutes = date.getMinutes().toString().padStart(2, '0');
                            timeString = `${hours}:${minutes}`;
                            // If message is older, show updated time
                            if (now.getDate() !== date.getDate() || now.getMonth() !== date.getMonth() || now.getFullYear() !== date.getFullYear()) {
                                timeString = `${date.toLocaleDateString()} ${hours}:${minutes}`;
                            }
                        }
                        
                        return (
                            <div key={key} className={`flex gap-2 mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                {/* Avatar - only show for others' messages */}
                                {!isOwn && (
                                    avatarUrl ? (
                                        <Avatar className="w-8 h-8 mt-1 flex-shrink-0">
                                            <AvatarImage src={avatarUrl} alt={username} />
                                            <AvatarFallback>
                                                <MonogramLogo 
                                                    initials={userInitials}
                                                    name={username}
                                                    variant="vibrant"
                                                    size="xs"
                                                />
                                            </AvatarFallback>
                                        </Avatar>
                                    ) : (
                                        <div className="mt-1 flex-shrink-0">
                                            <MonogramLogo 
                                                initials={userInitials}
                                                name={username}
                                                variant="vibrant"
                                                size="xs"
                                            />
                                        </div>
                                    )
                                )}
                                                
                                                <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                                                    {/* Username - only show for others' messages */}
                                                    {!isOwn && (
                                                        <span className="text-xs font-semibold text-gray-700 mb-1 px-1">{username}</span>
                                                    )}
                                                    
                                                    <div className="relative group">
                                                        {editingMessageId === msg.id ? (
                                                            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-md">
                                                                <Input
                                                                    value={editContent}
                                                                    onChange={(e) => setEditContent(e.target.value)}
                                                                    className="min-w-[200px] bg-white"
                                                                />
                                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={handleSaveEdit}>
                                                                    <Check className="w-4 h-4" />
                                                                </Button>
                                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-50" onClick={handleCancelEdit}>
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed relative ${
                                                                    isOwn
                                                                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-tr-sm shadow-md"
                                                                        : "bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100"
                                                                }`}
                                                            >
                                                                <div className="mb-1">{msg.content}</div>
                                                                {/* Timestamp below the message */}
                                                                <div className={`text-[10px] leading-tight ${
                                                                    isOwn ? 'text-white/70 text-right' : 'text-gray-400 text-left'
                                                                }`}>
                                                                    {timeString}
                                                                </div>
                                                                
                                                                {/* Edit/Delete buttons - inside message bubble for own messages */}
                                                                {isOwn && !editingMessageId && (
                                                                    <div className="mt-2 pt-2 border-t border-white/20 flex gap-1 justify-end opacity-80 group-hover:opacity-100 transition-opacity">
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="sm" 
                                                                            className="h-7 px-2 rounded-md hover:bg-white/20 text-white text-xs" 
                                                                            onClick={(e) => { 
                                                                                e.stopPropagation(); 
                                                                                setEditingMessageId(msg.id); 
                                                                                setEditContent(msg.content); 
                                                                            }}
                                                                            title="Edit message"
                                                                        >
                                                                            <Pencil className="w-3 h-3 mr-1" />
                                                                            Edit
                                                                        </Button>
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="sm" 
                                                                            className="h-7 px-2 rounded-md hover:bg-white/20 text-white text-xs" 
                                                                            onClick={async (e) => { 
                                                                                e.stopPropagation(); 
                                                                                await handleDeleteMessage(msg.id); 
                                                                            }}
                                                                            title="Delete message"
                                                                        >
                                                                            <Trash2 className="w-3 h-3 mr-1" />
                                                                            Delete
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                {/* Chat Input - Available for all team members */}
                                <div className="mt-4 pt-4 border-t border-gray-200/50">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Type a message..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                                            className="bg-white border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-full px-5"
                                        />
                                        <Button 
                                            onClick={handleSendMessage} 
                                            disabled={!newMessage.trim()}
                                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md rounded-full w-11 h-11 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Send className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="tasks">
                        <Card className="mt-4 border-0 bg-white/60 backdrop-blur-sm shadow-xl min-h-[380px]">
                            <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-gray-100 mb-4">
                                <div>
                                    <CardTitle className="text-xl font-bold text-gray-900">Milestones</CardTitle>
                                    <p className="text-sm text-gray-500 mt-1">Track the project&apos;s progress through key milestones.</p>
                                </div>
                                <Button size="sm" onClick={() => setAddingTask(!addingTask)} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm hover:shadow-md transition-all">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Milestone
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {addingTask && (
                                    <div className="mb-6 p-4 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                                        <Input
                                            placeholder="What is the next milestone?"
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            className="mb-3 bg-white border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                            autoFocus
                                        />
                                        <div className="flex gap-2">
                                            <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                                                <SelectTrigger className="flex-1 bg-white border-gray-300 hover:border-gray-400 transition-colors">
                                                    <SelectValue placeholder="Assign to..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={project.creator?.id || "unassigned"}>
                                                        {project.creator?.full_name || "Project Lead"}
                                                    </SelectItem>
                                                    {collaborators.map((collab: any) => (
                                                        <SelectItem key={collab.user?.id} value={collab.user?.id}>
                                                            {collab.user?.full_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                type="date"
                                                className="flex-1 bg-white border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                                value={newTaskDueDate}
                                                onChange={e => setNewTaskDueDate(e.target.value)}
                                            />
                                            <Button 
                                                onClick={handleAddTask}
                                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 shadow-md hover:shadow-lg transition-all"
                                            >
                                                Add
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-8">
                                    {tasks.length === 0 ? (
                                        <div className="text-center py-12 text-gray-400">
                                            <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                            <p className="text-lg">No milestones yet</p>
                                        </div>
                                    ) : (
                                        tasks.map((task, idx) => {
                                            const isDone = task.status === 'done';
                                            // Format date or use placeholder
                                            const dateStr = task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : "2024-03-15";
                                            // Ensure unique key: combine id with idx if needed
                                            const key = task.id ? `task-${task.id}` : `task-fallback-${idx}`;
                                            
                                            // Get assigned user name
                                            const assignedUserName = task.assigned_to ? (() => {
                                                if (task.assigned_to === project.creator?.id) return project.creator?.full_name || "Project Lead";
                                                const found = collaborators.find((c: any) => c.user?.id === task.assigned_to);
                                                return found?.user?.full_name || "User";
                                            })() : null;
                                            
                                            return (
                                                <div key={key} className="flex items-center justify-between group">
                                                    <div className="flex items-start gap-4">
                                                        <div
                                                            className="mt-0.5 cursor-pointer transition-colors"
                                                            onClick={() => handleToggleTask(task.id, task.status, task.assigned_to)}
                                                            title={task.assigned_to ? `Assigned to ${assignedUserName}` : 'Click to toggle'}
                                                        >
                                                            {isDone ? (
                                                                <CheckCircle className="w-6 h-6 text-green-500 fill-green-50" />
                                                            ) : (
                                                                <Circle className="w-6 h-6 text-gray-300 hover:text-blue-400" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h4 className={`text-base font-semibold ${isDone ? "text-gray-400 line-through" : "text-gray-800"}`}>
                                                                {task.title}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                <div className="flex items-center gap-1">
                                                                    <Clock className="w-3 h-3 text-gray-400" />
                                                                    <span className="text-xs text-gray-500">Due: {dateStr}</span>
                                                                </div>
                                                                {task.assigned_to && (
                                                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                                        👤 {assignedUserName}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        <Badge variant="outline" className={`px-3 py-1 font-medium rounded-full ${isDone ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                            {isDone ? 'Completed' : 'In Progress'}
                                                        </Badge>

                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 opacity-60 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500" 
                                                            onClick={() => handleDeleteTask(task.id)}
                                                            title="Delete task"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Team Tab */}
                    <TabsContent value="team">
                        <Card className="mt-4 border-0 bg-white/60 backdrop-blur-sm shadow-xl">
                            <CardHeader>
                                <CardTitle>Project Team</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Owner */}
                                {project?.creator ? (
                                    <Card className="bg-white/50 border-blue-100 border">
                                        <CardContent className="p-4 flex flex-col items-center text-center">
                                            {project.creator?.profile_image_url ? (
                                                <Avatar className="w-16 h-16 mb-3 border-2 border-blue-500">
                                                    <AvatarImage src={project.creator?.profile_image_url} />
                                                    <AvatarFallback>
                                                        <MonogramLogo 
                                                            name={project.creator?.full_name}
                                                            variant="vibrant"
                                                            size="lg"
                                                        />
                                                    </AvatarFallback>
                                                </Avatar>
                                            ) : (
                                                <div className="mb-3">
                                                    <MonogramLogo 
                                                        name={project.creator?.full_name}
                                                        variant="vibrant"
                                                        size="lg"
                                                    />
                                                </div>
                                            )}
                                            <p className="font-semibold text-gray-900">{project.creator?.full_name || project.creator?.username || 'Project Owner'}</p>
                                            <p className="text-sm text-blue-600 font-medium mb-2">Project Lead</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Card className="bg-white/50 border-blue-100 border">
                                        <CardContent className="p-4 flex flex-col items-center text-center">
                                            <div className="mb-3">
                                                <MonogramLogo 
                                                    initials="?"
                                                    variant="neutral"
                                                    size="lg"
                                                />
                                            </div>
                                            <p className="font-semibold text-gray-900">Loading...</p>
                                            <p className="text-sm text-blue-600 font-medium mb-2">Project Lead</p>
                                        </CardContent>
                                    </Card>
                                )}
                                {/* Collaborators */}
                                {collaborators.map((collab, idx) => (
                                    <Card key={collab.id ? `collab-${collab.id}` : `collab-fallback-${idx}`} className="bg-white/50 group relative">
                                        <CardContent className="p-4 flex flex-col items-center text-center">
                                            {/* Settings menu for project owner */}
                                            {project?.creator?.firebase_uid === user?.uid && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 absolute top-2 right-2 opacity-70 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white"
                                                            title="Manage member"
                                                        >
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem 
                                                            onClick={() => {
                                                                setEditingMemberId(collab.id)
                                                                setEditingMemberRole(collab.role || "Collaborator")
                                                            }}
                                                        >
                                                            <Pencil className="w-4 h-4 mr-2" />
                                                            Edit Role
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem 
                                                            className="text-red-600"
                                                            onClick={() => handleRemoveMember(collab.id, collab.user?.full_name)}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Remove Member
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}

                                            <Avatar className="w-16 h-16 mb-3">
                                                <AvatarImage src={collab.user?.profile_image_url} />
                                                <AvatarFallback>
                                                    <MonogramLogo 
                                                        name={collab.user?.full_name}
                                                        variant="vibrant"
                                                        size="lg"
                                                    />
                                                </AvatarFallback>
                                            </Avatar>
                                            <p className="font-semibold text-gray-900">{collab.user?.full_name}</p>
                                            
                                            {/* Edit role inline */}
                                            {editingMemberId === collab.id ? (
                                                <div className="flex items-center gap-2 mt-2 w-full">
                                                    <Input 
                                                        value={editingMemberRole}
                                                        onChange={(e) => setEditingMemberRole(e.target.value)}
                                                        className="text-sm h-8"
                                                        placeholder="Role"
                                                    />
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 text-green-600"
                                                        onClick={() => handleEditMemberRole(collab.id, editingMemberRole)}
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </Button>
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-8 w-8"
                                                        onClick={() => {
                                                            setEditingMemberId(null)
                                                            setEditingMemberRole("")
                                                        }}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-600 font-medium mb-2 w-full truncate">{collab.role || "Collaborator"}</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="resources">
                        <Card className="mt-4 border-0 bg-white/60 backdrop-blur-sm shadow-xl">
                            <CardHeader>
                                <CardTitle>Project Resources</CardTitle>
                                <p className="text-sm text-gray-500">Important links and documents for the project</p>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {resources.length === 0 && (
                                        <p className="text-center text-gray-500 py-8 italic">No resources added yet.</p>
                                    )}

                                    {resources.map((resource, idx) => (
                                        <div key={resource.id ? `resource-${resource.id}` : `resource-fallback-${idx}`} className="flex items-center gap-4 p-4 rounded-lg bg-white/80 border border-gray-100 hover:shadow-sm transition-all group">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${resource.type === 'github' ? 'bg-gray-100 text-gray-900' :
                                                resource.type === 'figma' ? 'bg-purple-100 text-purple-600' :
                                                    resource.type === 'docs' ? 'bg-blue-100 text-blue-600' :
                                                        resource.type === 'image' ? 'bg-pink-100 text-pink-600' :
                                                            resource.type === 'pdf' ? 'bg-red-100 text-red-600' :
                                                                resource.type === 'file' ? 'bg-orange-100 text-orange-600' :
                                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                {resource.type === "github" ? <Github className="w-5 h-5" /> :
                                                    resource.type === "figma" ? <FileText className="w-5 h-5" /> :
                                                        resource.type === "docs" ? <FileText className="w-5 h-5" /> :
                                                            resource.type === "image" ? <ImageIcon className="w-5 h-5" /> :
                                                                resource.type === "pdf" ? <FileText className="w-5 h-5" /> :
                                                                    resource.type === "file" ? <File className="w-5 h-5" /> :
                                                                        <LinkIcon className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-gray-900 truncate">{resource.title}</h3>
                                                {/* Show different meta info based on type */}
                                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 truncate max-w-[300px] block">
                                                        {resource.type === 'link' || resource.type === 'github' ? resource.url : 'Download File'}
                                                    </a>
                                                    {resource.size_bytes && (
                                                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                                            {(resource.size_bytes / 1024 / 1024).toFixed(2)} MB
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <a href={resource.url} target="_blank" rel="noopener noreferrer">
                                                    <Button variant="outline" size="sm" className="bg-transparent hover:bg-gray-50">
                                                        {resource.type === 'link' || resource.type === 'github' ? <ExternalLink className="w-4 h-4" /> : <Upload className="w-4 h-4 rotate-180" />}
                                                    </Button>
                                                </a>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 opacity-60 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleDeleteResource(resource.id, resource.file_path)}
                                                    title="Delete resource"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add Resource Form */}
                                    <div className="mt-8 pt-6 border-t border-dashed border-gray-200">

                                        {/* Toggle Type */}
                                        <div className="flex items-center gap-4 mb-4">
                                            <button
                                                onClick={() => setResourceType('link')}
                                                className={`text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${resourceType === 'link' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                            >
                                                <LinkIcon className="w-3 h-3 inline-block mr-1" /> Add Link
                                            </button>
                                            <button
                                                onClick={() => setResourceType('file')}
                                                className={`text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${resourceType === 'file' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                            >
                                                <Paperclip className="w-3 h-3 inline-block mr-1" /> Upload File
                                            </button>
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-3">
                                            <Input
                                                placeholder={resourceType === 'link' ? "Resource title (e.g., GitHub Repo)" : "File title (e.g., Design Brief)"}
                                                className="bg-white/50 flex-[2]"
                                                value={newResourceTitle}
                                                onChange={e => setNewResourceTitle(e.target.value)}
                                            />

                                            {resourceType === 'link' ? (
                                                <Input
                                                    placeholder="URL (e.g., github.com/user/repo)"
                                                    className="bg-white/50 flex-[3]"
                                                    value={newResourceUrl}
                                                    onChange={e => setNewResourceUrl(e.target.value)}
                                                />
                                            ) : (
                                                <div className="flex-[3] relative">
                                                    <Input
                                                        type="file"
                                                        className="bg-white/50 cursor-pointer pt-1.5"
                                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                                    />
                                                </div>
                                            )}

                                            <Button
                                                onClick={handleAddResource}
                                                disabled={addingResource}
                                                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shrink-0"
                                            >
                                                {addingResource ? "Adding..." : <><Plus className="w-4 h-4 mr-2" /> Add</>}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Calendar Dialog */}
                <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
                    <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Project Schedule</DialogTitle>
                            <DialogDescription>Upcoming milestones and deadlines.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            {tasks.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No milestones set for this project.</p>
                                </div>
                            ) : (
                                tasks
                                    .sort((a, b) => new Date(a.due_date || '2099-12-31').getTime() - new Date(b.due_date || '2099-12-31').getTime())
                                    .map((task, idx) => (
                                        <div key={task.id ? `calendar-task-${task.id}` : `calendar-task-fallback-${idx}`} className="flex gap-4 items-center p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                                            <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg shrink-0 ${task.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                                <span className="text-[10px] font-bold uppercase">{task.due_date ? new Date(task.due_date).toLocaleString('default', { month: 'short' }) : 'TBD'}</span>
                                                <span className="text-xl font-bold leading-none">{task.due_date ? new Date(task.due_date).getDate() : '-'}</span>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className={`font-semibold ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className={`text-xs ${task.status === 'done' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                        {task.status === 'done' ? 'Completed' : 'In Progress'}
                                                    </Badge>
                                                    {task.due_date && <span className="text-xs text-gray-500">{new Date(task.due_date).getFullYear()}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Edit Project Dialog */}
                <Dialog open={showEditProjectDialog} onOpenChange={setShowEditProjectDialog}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>Edit Project</DialogTitle>
                            <DialogDescription>Update your project details. Changes will be reflected across the platform.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div>
                                <Label htmlFor="edit-title">Project Title</Label>
                                <Input
                                    id="edit-title"
                                    value={editProjectTitle}
                                    onChange={(e) => setEditProjectTitle(e.target.value)}
                                    placeholder="Enter project title"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="edit-description">Project Description</Label>
                                <textarea
                                    id="edit-description"
                                    value={editProjectDescription}
                                    onChange={(e) => setEditProjectDescription(e.target.value)}
                                    placeholder="Describe your project goals and requirements"
                                    className="w-full px-3 py-2 mt-1 bg-white border border-gray-200 rounded-md min-h-[150px] resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button 
                                    variant="outline"
                                    onClick={() => {
                                        setShowEditProjectDialog(false)
                                        setEditProjectTitle("")
                                        setEditProjectDescription("")
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    onClick={handleEditProject}
                                    disabled={savingProject || !editProjectTitle.trim() || !editProjectDescription.trim()}
                                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                                >
                                    {savingProject ? "Saving..." : "Save Changes"}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
