"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MonogramLogo } from "@/components/MonogramLogo"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Users,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Send,
  ImageIcon,
  Code,
  Calendar,
  MoreVertical,
  Trash2,
  Edit,
  X,
} from "lucide-react"
import Link from "next/link"
import { NotificationSystem } from "@/components/notification-system"
import {
  getAllPosts,
  createPost,
  updatePost,
  deletePost,
  likePost,
  createComment,
  getPostComments,
  deleteComment,
  savePost,
  getUserByFirebaseUid,
  getUserLikedPosts,
} from "@/lib/supabase-queries"
import { toast } from "sonner"

import { supabase } from "@/lib/database"

export default function FeedPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [newPost, setNewPost] = useState("")
  const [postType, setPostType] = useState("general")
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [likedPostIds, setLikedPostIds] = useState<string[]>([])
  const [savedPostIds, setSavedPostIds] = useState<string[]>([])

  // Comment states
  const [showComments, setShowComments] = useState<Record<string, boolean>>({})
  const [comments, setComments] = useState<Record<string, any[]>>({})
  const [newComment, setNewComment] = useState<Record<string, string>>({})
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({})

  // Edit/Delete states
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [postToDelete, setPostToDelete] = useState<string | null>(null)
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null)

  // Real-time timestamp update
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every minute for real-time timestamps
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every 60 seconds

    return () => clearInterval(interval)
  }, [])

  // REAL-TIME SUBSCRIPTION FOR POSTS
  useEffect(() => {
    if (!currentUser) return;

    // Initial fetch
    getAllPosts(30).then((initialPosts) => {
      setPosts(initialPosts || []);
      setLoading(false);
    });

    const channel = supabase
      .channel('public:posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
        console.log('Real-time post received:', payload);

        // Fetch author details to display properly
        const { data: author } = await supabase
          .from('users')
          .select('*')
          .eq('id', payload.new.user_id)
          .single();

        const newPostObj: any = {
          ...payload.new,
          user: author || { full_name: 'Unknown User', username: 'user', profile_image_url: null },
          likes_count: 0,
          comments_count: 0,
          has_liked: false,
          has_saved: false
        };

        setPosts((currentPosts) => {
          // Prevent duplicates
          if (currentPosts.some(p => p.id === newPostObj.id)) return currentPosts;
          return [newPostObj, ...currentPosts];
        });

        // Show toast notification
        toast("New post from " + (author?.full_name || "a user"));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
        setPosts(currentPosts => currentPosts.filter(p => p.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  useEffect(() => {
    async function loadData() {
      if (!user) {
        console.log("⚠️ No user authenticated, redirecting to login")
        router.push("/auth/login")
        return
      }

      try {
        console.log("🔄 Loading feed data for user:", user.uid)
        if (!user.uid) {
          console.error("❌ User has no Firebase UID")
          toast.error("Invalid user session. Please log in again.")
          router.push("/auth/login")
          return
        }
        const dbUser = await getUserByFirebaseUid(user.uid)

        if (!dbUser) {
          console.error("❌ User not found in database")
          toast.error("User profile not found. Please log in again.")
          router.push("/auth/login")
          return
        }

        setCurrentUser(dbUser)
        console.log("✅ Current user loaded:", { id: dbUser?.id, name: dbUser?.full_name, university: dbUser?.university })

        const [postsData, likedIds] = await Promise.all([
          getAllPosts(30),
          getUserLikedPosts(dbUser.id),
        ])

        console.log("✅ Loaded posts from database:", postsData?.length || 0, "posts")
        console.log("📊 Posts data:", postsData)
        console.log("✅ User liked posts:", likedIds?.length || 0, "likes")

        if (postsData && postsData.length > 0) {
          console.log("📝 First post sample:", postsData[0])
        } else {
          console.warn("⚠️ No posts returned from API")
        }

        setPosts(postsData || [])
        setLikedPostIds(likedIds)
        setSavedPostIds(dbUser?.saved_posts || [])
      } catch (error) {
        console.error("❌ Error loading feed data:", error)
        toast.error("Failed to load feed")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, router])

  const handleCreatePost = async () => {
    if (!newPost.trim() || !currentUser) return

    try {
      console.log("📝 Creating post...", { user_id: currentUser.id, content: newPost, post_type: postType })
      const post = await createPost({
        user_id: currentUser.id,
        content: newPost,
        post_type: postType,
      })
      console.log("✅ Post created in database:", post)

      // Add post to feed with user info
      setPosts([{ ...post, user: currentUser }, ...posts])
      setNewPost("")
      setPostType("general") // Reset to general after posting
      toast.success("Post created successfully!")
    } catch (error) {
      console.error("❌ Error creating post:", error)
      toast.error("Failed to create post")
    }
  }

  const handleLike = async (postId: string) => {
    if (!currentUser) return

    try {
      console.log("❤️ Toggling like for post:", postId, "User:", currentUser.id)
      const result = await likePost(postId, currentUser.id)
      console.log("✅ Like operation result:", result.liked ? "Liked" : "Unliked")

      if (result.liked) {
        setLikedPostIds([...likedPostIds, postId])
        setPosts(posts.map(p => p.id === postId ? { ...p, likes_count: (p.likes_count || 0) + 1 } : p))
      } else {
        setLikedPostIds(likedPostIds.filter(id => id !== postId))
        setPosts(posts.map(p => p.id === postId ? { ...p, likes_count: Math.max(0, (p.likes_count || 1) - 1) } : p))
      }
    } catch (error) {
      console.error("❌ Error liking post:", error)
      toast.error("Failed to like post")
    }
  }

  const handleSavePost = async (postId: string) => {
    if (!currentUser) return

    try {
      console.log("🔖 Toggling save for post:", postId)
      const result = await savePost(postId, currentUser.id)
      console.log("✅ Save operation result:", result.saved ? "Saved" : "Unsaved")

      if (result.saved) {
        setSavedPostIds([...savedPostIds, postId])
        toast.success("Post saved!")
      } else {
        setSavedPostIds(savedPostIds.filter(id => id !== postId))
        toast.success("Post unsaved!")
      }
    } catch (error) {
      console.error("❌ Error saving post:", error)
      toast.error("Failed to save post")
    }
  }

  const handleShowComments = async (postId: string) => {
    if (showComments[postId]) {
      setShowComments({ ...showComments, [postId]: false })
      return
    }

    setLoadingComments({ ...loadingComments, [postId]: true })
    try {
      const postComments = await getPostComments(postId)
      setComments({ ...comments, [postId]: postComments })
      setShowComments({ ...showComments, [postId]: true })
    } catch (error) {
      console.error("Error loading comments:", error)
      toast.error("Failed to load comments")
    } finally {
      setLoadingComments({ ...loadingComments, [postId]: false })
    }
  }

  const handleAddComment = async (postId: string) => {
    if (!newComment[postId]?.trim() || !currentUser) return

    try {
      console.log("💬 Adding comment to post:", postId, "Content:", newComment[postId])
      const comment = await createComment({
        post_id: postId,
        user_id: currentUser.id,
        content: newComment[postId],
      })
      console.log("✅ Comment created in database:", comment)

      setComments({
        ...comments,
        [postId]: [...(comments[postId] || []), comment],
      })
      setNewComment({ ...newComment, [postId]: "" })
      setPosts(posts.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p))
      toast.success("Comment added!")
    } catch (error) {
      console.error("❌ Error adding comment:", error)
      toast.error("Failed to add comment")
    }
  }

  const handleDeleteComment = async (commentId: string, postId: string) => {
    try {
      await deleteComment(commentId, postId)
      setComments({
        ...comments,
        [postId]: comments[postId].filter(c => c.id !== commentId),
      })
      setPosts(posts.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, (p.comments_count || 1) - 1) } : p))
      toast.success("Comment deleted!")
    } catch (error) {
      console.error("Error deleting comment:", error)
      toast.error("Failed to delete comment")
    }
  }

  const handleEditPost = (post: any) => {
    setEditingPostId(post.id)
    setEditContent(post.content)
    setShowMenuFor(null)
  }

  const handleSaveEdit = async (postId: string) => {
    if (!editContent.trim()) return

    try {
      console.log("📝 Updating post:", postId, "New content:", editContent)
      const updatedPost = await updatePost(postId, { content: editContent })
      console.log("✅ Post updated in database:", updatedPost)

      // Update local state
      setPosts(posts.map(p => p.id === postId ? { ...p, content: editContent, updated_at: new Date().toISOString() } : p))
      setEditingPostId(null)
      toast.success("Post updated!")

      // Refresh posts from database to ensure sync
      const refreshedPosts = await getAllPosts(30)
      setPosts(refreshedPosts || [])
    } catch (error: any) {
      console.error("❌ Error updating post:", error)
      toast.error(error?.message || "Failed to update post")
    }
  }

  const handleDeletePost = async () => {
    if (!postToDelete) return

    try {
      console.log("🗑️ Starting delete for post:", postToDelete)

      // Delete from database first
      await deletePost(postToDelete)
      console.log("✅ Post deleted from database successfully")

      // Update local state immediately
      setPosts(prevPosts => {
        const filtered = prevPosts.filter(p => p.id !== postToDelete)
        console.log("📊 Posts after filter:", filtered.length, "posts remaining")
        return filtered
      })

      // Close dialog and reset
      setDeleteDialogOpen(false)
      const deletedId = postToDelete
      setPostToDelete(null)

      toast.success("Post deleted!")

      // Wait a moment then refresh from database to ensure consistency
      setTimeout(async () => {
        try {
          const refreshedPosts = await getAllPosts(30)
          console.log("🔄 Refreshed posts from database:", refreshedPosts?.length || 0, "posts")
          setPosts(refreshedPosts || [])
        } catch (err) {
          console.error("Error refreshing posts:", err)
        }
      }, 1000)

    } catch (error: any) {
      console.error("❌ Error in handleDeletePost:", error)
      toast.error(error?.message || "Failed to delete post")
      setDeleteDialogOpen(false)
      setPostToDelete(null)
    }
  }

  const handleShare = (post: any) => {
    const url = `${window.location.origin}/feed?post=${post.id}`

    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url)
        toast.success("Link copied to clipboard!")
      } else {
        // Fallback for browsers that don't support Clipboard API
        const textArea = document.createElement("textarea")
        textArea.value = url
        textArea.style.position = "fixed"
        textArea.style.left = "-999999px"
        textArea.style.top = "-999999px"
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()

        const successful = document.execCommand('copy')
        textArea.remove()

        if (successful) {
          toast.success("Link copied to clipboard!")
        } else {
          toast.error("Failed to copy link. Please copy manually.")
        }
      }
    } catch (err) {
      console.error('Copy to clipboard error:', err)
      toast.error("Failed to copy link. Please copy manually.")
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 0) return "Just now" // Handle future dates
    if (diff < 60) return "Just now"
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
    return date.toLocaleDateString()
  }

  const getPostIcon = (type: string) => {
    switch (type) {
      case "project_launch":
        return <Code className="w-3 h-3" />
      case "collaboration_request":
        return <Users className="w-3 h-3" />
      case "achievement":
        return <Heart className="w-3 h-3" />
      case "event":
        return <Calendar className="w-3 h-3" />
      default:
        return <MessageCircle className="w-3 h-3" />
    }
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
            <Link href="/feed" className="text-blue-600 font-medium">
              Feed
            </Link>
            <Link href="/collaborators" className="text-gray-600 hover:text-blue-600 transition-colors">
              Find People
            </Link>
            <Link href="/profile" className="text-gray-600 hover:text-blue-600 transition-colors">
              Profile
            </Link>
          </nav>

          <div className="relative flex items-center gap-4">
            <NotificationSystem />
            <Link href="/profile">
              <Avatar className="cursor-pointer">
                <AvatarImage src={currentUser?.profile_image_url} />
                <AvatarFallback>{currentUser?.full_name?.split(" ").map((n: string) => n[0]).join("") || "U"}</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Create Post */}
        <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Share with the community</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 mb-4">
              {[
                { value: "general", label: "General", icon: MessageCircle },
                { value: "project_launch", label: "Project", icon: Code },
                { value: "collaboration_request", label: "Collaborate", icon: Users },
                { value: "event", label: "Event", icon: Calendar },
              ].map((type) => (
                <Button
                  key={type.value}
                  variant={postType === type.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPostType(type.value)}
                  className="flex items-center gap-1"
                >
                  <type.icon className="w-3 h-3" />
                  {type.label}
                </Button>
              ))}
            </div>
            <Textarea
              placeholder="What's on your mind? Share your projects, ideas, or ask for collaboration..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              className="min-h-[100px] bg-white/50"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="bg-transparent">
                  <ImageIcon className="w-4 h-4 mr-1" />
                  Photo
                </Button>
                <Button variant="outline" size="sm" className="bg-transparent">
                  <Code className="w-4 h-4 mr-1" />
                  Project
                </Button>
              </div>
              <Button
                onClick={handleCreatePost}
                disabled={!newPost.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4 mr-2 text-white" />
                Post
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Feed Posts */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : posts.length === 0 ? (
          <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
            <CardContent className="p-12 text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">No posts yet</h3>
              <p className="text-gray-600 mb-4">Be the first to share something with the community!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <Card key={post.id} className="border-0 bg-white/70 backdrop-blur-md shadow-xl transition-transform hover:scale-[1.015] hover:shadow-2xl">
                <CardContent className="p-7">
                  {/* Post Header */}
                  <div className="flex items-start gap-4 mb-5">
                    <Avatar>
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
                        <h3 className="font-semibold text-gray-900 text-base lg:text-lg">{post.user?.full_name || "Anonymous"}</h3>
                        <Badge className="text-xs bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 flex items-center gap-1 border-0">
                          {getPostIcon(post.post_type || "general")}
                          <span className="capitalize">{post.post_type?.replace("_", " ") || "Post"}</span>
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        {post.user?.university || post.user?.location || "Student"} • {formatTimestamp(post.created_at)}
                      </p>
                    </div>

                    {/* Edit/Delete Menu (only for post owner) */}
                    {currentUser?.id === post.user_id && (
                      <div className="relative">
                        <button
                          onClick={() => setShowMenuFor(showMenuFor === post.id ? null : post.id)}
                          className="p-2 hover:bg-blue-100 rounded-full transition-colors"
                          title="Post options"
                          aria-label="Post options menu"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>

                        {showMenuFor === post.id && (
                          <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-100 z-10">
                            <button
                              onClick={() => handleEditPost(post)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2 rounded-md"
                            >
                              <Edit className="w-4 h-4" />
                              Edit Post
                            </button>
                            <button
                              onClick={() => {
                                setPostToDelete(post.id)
                                setDeleteDialogOpen(true)
                                setShowMenuFor(null)
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-100 flex items-center gap-2 rounded-md"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Post
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Post Content (Edit Mode or View Mode) */}
                  {editingPostId === post.id ? (
                    <div className="mb-4 space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[100px]"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveEdit(post.id)}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingPostId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <p className="text-gray-800 whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => handleLike(post.id)}
                        className={`flex items-center gap-2 text-sm font-medium transition-colors ${likedPostIds.includes(post.id) ? "text-red-500" : "text-gray-500 hover:text-red-500"}`}
                        title={likedPostIds.includes(post.id) ? "Unlike" : "Like"}
                      >
                        <Heart className={`w-4 h-4 ${likedPostIds.includes(post.id) ? "fill-current" : ""}`} />
                        {post.likes_count || 0}
                      </button>
                      <button
                        onClick={() => handleShowComments(post.id)}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-500 transition-colors"
                        title="Show comments"
                      >
                        <MessageCircle className="w-4 h-4" />
                        {post.comments_count || 0}
                      </button>
                      <button
                        onClick={() => handleShare(post)}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-500 transition-colors"
                        title="Share post"
                      >
                        <Share2 className="w-4 h-4" />
                        Share
                      </button>
                    </div>
                    <button
                      onClick={() => handleSavePost(post.id)}
                      className={`p-2 rounded-lg transition-colors ${savedPostIds.includes(post.id)
                        ? "text-blue-600 bg-blue-50"
                        : "text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                        }`}
                      title={savedPostIds.includes(post.id) ? "Unsave post" : "Save post"}
                      aria-label={savedPostIds.includes(post.id) ? "Unsave post" : "Save post"}
                    >
                      <Bookmark className={`w-4 h-4 ${savedPostIds.includes(post.id) ? "fill-current" : ""}`} />
                    </button>
                  </div>

                  {/* Comments Section */}
                  {showComments[post.id] && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      {loadingComments[post.id] ? (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Comment Input */}
                          <div className="flex gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={currentUser?.profile_image_url} />
                              <AvatarFallback>
                                <MonogramLogo 
                                  name={currentUser?.full_name}
                                  variant="vibrant"
                                  size="xs"
                                />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 flex gap-2">
                              <Input
                                placeholder="Write a comment..."
                                value={newComment[post.id] || ""}
                                onChange={(e) => setNewComment({ ...newComment, [post.id]: e.target.value })}
                                onKeyPress={(e) => e.key === "Enter" && handleAddComment(post.id)}
                                className="flex-1 bg-white/80"
                              />
                              <Button size="sm" onClick={() => handleAddComment(post.id)} className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                                <Send className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Comments List */}
                          <div className="space-y-3">
                            {(comments[post.id] || []).map((comment: any) => (
                              <div key={comment.id} className="flex gap-2 group">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={comment.user?.profile_image_url} />
                                  <AvatarFallback>
                                    <MonogramLogo 
                                      name={comment.user?.full_name}
                                      variant="vibrant"
                                      size="xs"
                                    />
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-semibold text-gray-900">{comment.user?.full_name}</p>
                                      {currentUser?.id === comment.user_id && (
                                        <button
                                          onClick={() => handleDeleteComment(comment.id, post.id)}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                                          title="Delete comment"
                                          aria-label="Delete comment"
                                        >
                                          <X className="w-3 h-3 text-red-600" />
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-800">{comment.content}</p>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1 ml-3">{formatTimestamp(comment.created_at)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your post and all its comments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePost} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
