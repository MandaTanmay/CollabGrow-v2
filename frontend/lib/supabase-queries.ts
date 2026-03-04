import { fetchWithAuth } from './api'

/**
 * Frontend wrapper for supabase-queries
 * This file maintains the same interface as the original supabase-queries
 * but calls the backend API instead of directly querying the database
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Fetch user details for sender profile modal (for notification sender click)
export async function getUserDetails(userId: string) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/users/${userId}/details`)
        if (!response.ok) {
            console.error('Failed to fetch user details, status:', response.status)
            throw new Error('Failed to fetch user details')
        }
        const result = await response.json()
        // Backend wraps response in { success, data, message }
        return result.data || result
    } catch (error) {
        console.error('Error fetching user details:', error)
        return null
    }
}

// =============================================
// USER QUERIES
// =============================================

export async function getUserByFirebaseUid(firebaseUid: string) {
    if (!firebaseUid || typeof firebaseUid !== 'string' || !firebaseUid.trim()) {
        console.error('getUserByFirebaseUid called with empty or invalid UID');
        return null;
    }
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/user/firebase/${firebaseUid}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error('Failed to fetch user');
        }
        return response.json();
    } catch (error) {
        return null;
    }
}

export async function createUser(userData: {
    firebase_uid: string;
    email: string;
    full_name: string;
    username?: string;
    bio?: string;
    university?: string;
    major?: string;
    skills?: string[];
}) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firebaseUid: userData.firebase_uid,
                email: userData.email,
                fullName: userData.full_name,
                username: userData.username || userData.email.split('@')[0],
                bio: userData.bio,
                university: userData.university,
                major: userData.major,
                skills: userData.skills || [],
            }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to create user' }));
            throw new Error(errorData.error || 'Failed to create user');
        }
        return response.json();
    } catch (error: any) {
        console.error("Error creating user:", error);
        throw error;
    }
}

export async function getUserStats(userId: string) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/user/${userId}/stats`);
        if (!response.ok) throw new Error('Failed to fetch user stats');
        return response.json();
    } catch (error) {
        console.error("Error fetching user stats:", error);
        return {
            active_projects: 0,
            completed_projects: 0,
            total_projects: 0,
            collaborators_count: 0,
            followers_count: 0,
            following_count: 0,
            reputation_points: 0,
            profile_views: 0,
        };
    }
}

export async function getRecommendedCollaborators(userId: string, limit = 5) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/user/${userId}/collaborators?limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch collaborators');
        return response.json();
    } catch (error) {
        return [];
    }
}

// =============================================
// POST QUERIES
// =============================================

export async function getAllPosts(limit = 30) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/posts?limit=${limit}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to fetch posts: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`Failed to fetch posts: ${response.status} ${response.statusText}`);
        }
        return response.json();
    } catch (error: any) {
        console.error("Error fetching posts:", error);
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            console.error("Backend server might not be running. Make sure backend is running on", API_URL);
        }
        return [];
    }
}

// All IDs are string (UUID) for unified schema compatibility
export async function createPost(data: { user_id: string; content: string; post_type?: string; project_id?: string }) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create post');
        return response.json();
    } catch (error) {
        console.error("Error creating post:", error);
        throw error;
    }
}

export async function updatePost(postId: string, data: { content: string }) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/posts/${postId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update post');
        return response.json();
    } catch (error) {
        console.error("Error updating post:", error);
        throw error;
    }
}

export async function deletePost(postId: string) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/posts/${postId}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete post');
        return response.json();
    } catch (error) {
        console.error("Error deleting post:", error);
        throw error;
    }
}

export async function likePost(postId: string, userId: string) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
        });
        if (!response.ok) throw new Error('Failed to like post');
        return response.json();
    } catch (error) {
        console.error("Error liking post:", error);
        throw error;
    }
}

export async function getUserLikedPosts(userId: string) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/user/${userId}/liked-posts`);
        if (!response.ok) throw new Error('Failed to fetch liked posts');
        return response.json();
    } catch (error) {
        console.error("Error fetching liked posts:", error);
        return [];
    }
}

export async function savePost(postId: string, userId: string) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/posts/${postId}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
        });
        if (!response.ok) throw new Error('Failed to save post');
        return response.json();
    } catch (error) {
        console.error("Error saving post:", error);
        throw error;
    }
}

export async function getPostComments(postId: string) {
    try {
        const response = await fetch(`${API_URL}/api/queries/posts/${postId}/comments`);
        if (!response.ok) throw new Error('Failed to fetch comments');
        return response.json();
    } catch (error) {
        console.error("Error fetching comments:", error);
        return [];
    }
}

export async function createComment(data: { post_id: string; user_id: string; content: string }) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/posts/${data.post_id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: data.user_id, content: data.content }),
        });
        if (!response.ok) throw new Error('Failed to create comment');
        return response.json();
    } catch (error) {
        console.error("Error creating comment:", error);
        throw error;
    }
}

export async function deleteComment(commentId: string, postId: string) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/comments/${commentId}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete comment');
        return response.json();
    } catch (error) {
        console.error("Error deleting comment:", error);
        throw error;
    }
}

// =============================================
// PROJECT QUERIES
// =============================================

export async function getAllProjects(filters?: { status?: string; difficulty?: string; limit?: number; involvedUser?: string }) {
    try {
        const params = new URLSearchParams();
        if (filters?.status) params.append('status', filters.status);
        if (filters?.difficulty) params.append('difficulty', filters.difficulty);
        if (filters?.limit) params.append('limit', filters.limit.toString());
        if (filters?.involvedUser) params.append('involvedUser', filters.involvedUser);

        const response = await fetchWithAuth(`${API_URL}/api/queries/projects?${params}`);
        if (!response.ok) throw new Error('Failed to fetch projects');
        return response.json();
    } catch (error) {
        console.error("Error fetching projects:", error);
        return [];
    }
}

export async function getProjectLikesWithUserStatus(projectId: string | string[], userId: string | null) {
    try {
        // Handle both single project ID and array of project IDs
        if (Array.isArray(projectId)) {
            // Batch request for multiple projects
            const response = await fetchWithAuth(`${API_URL}/api/queries/projects/likes/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectIds: projectId, userId }),
            });
            if (!response.ok) throw new Error('Failed to fetch project likes');
            return response.json();
        } else {
            // Single project request
            const response = await fetchWithAuth(`${API_URL}/api/queries/projects/${projectId}/likes?userId=${userId || ''}`);
            if (!response.ok) throw new Error('Failed to fetch project likes');
            return response.json();
        }
    } catch (error) {
        console.error("Error fetching project likes:", error);
        if (Array.isArray(projectId)) {
            return projectId.map(id => ({ projectId: id, likes: 0, isLikedByUser: false }));
        }
        return { likes: [], count: 0, userLiked: false };
    }
}

export async function toggleProjectLike(projectId: string, userId: string) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/projects/${projectId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
        });
        if (!response.ok) throw new Error('Failed to toggle like');
        return response.json();
    } catch (error) {
        console.error("Error toggling like:", error);
        throw error;
    }
}

export async function getPlatformStats() {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/platform/stats`);
        if (!response.ok) throw new Error('Failed to fetch platform stats');
        return response.json();
    } catch (error) {
        console.error("Error fetching platform stats:", error);
        return {
            activeUsers: 0,
            completedProjects: 0,
            totalProjects: 0,
        };
    }
}

// Placeholder functions for other queries that might be used
// These can be implemented as needed
export async function getProjectById(projectId: string) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/projects/${projectId}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error('Failed to fetch project');
        }
        return response.json();
    } catch (error) {
        console.error("Error fetching project:", error);
        return null;
    }
}

export async function getUserProjects(userId: string, status?: string) {
    const filters: any = { limit: 1000 };
    if (status) filters.status = status;
    const projects = await getAllProjects(filters);
    return projects.filter((p: any) => p.creator_id === userId);
}

export async function getUserNotifications(userId: string, limit = 10) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/user/${userId}/notifications?limit=${limit}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to fetch notifications: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`Failed to fetch notifications: ${response.status} ${response.statusText}`);
        }
        return response.json();
    } catch (error: any) {
        console.error("Error fetching notifications:", error);
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            console.error("Backend server might not be running. Make sure backend is running on", API_URL);
        }
        return [];
    }
}

export async function markNotificationAsRead(notificationId: string) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/notifications/${notificationId}/mark-read`, {
            method: 'PATCH',
        });
        if (!response.ok) throw new Error('Failed to mark notification as read');
        return response.json();
    } catch (error) {
        console.error("Error marking notification as read:", error);
        throw error;
    }
}

export async function markAllNotificationsAsRead(userId: string) {
    try {
        // This needs a backend endpoint - for now, we'll mark each individually
        // TODO: Create a bulk update endpoint on backend
        const notifications = await getUserNotifications(userId, 100);
        const unreadNotifications = notifications.filter((n: any) => !n.is_read);
        
        await Promise.all(
            unreadNotifications.map((n: any) => markNotificationAsRead(n.id))
        );
        
        return { success: true };
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        throw error;
    }
}

export async function removeNotification(notificationId: string) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/notifications/${notificationId}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete notification');
        return response.json();
    } catch (error) {
        console.error("Error deleting notification:", error);
        throw error;
    }
}

export async function getUserSavedPosts(userId: string) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/queries/user/${userId}/saved-posts`);
        if (!response.ok) throw new Error('Failed to fetch saved posts');
        return response.json();
    } catch (error) {
        console.error("Error fetching saved posts:", error);
        return [];
    }
}

// Add other functions as needed - they can be implemented similarly


export async function incrementProjectView(projectId: string) {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/projects/${projectId}/view`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to increment view');
        return response.json();
    } catch (error) {
        console.error("Error incrementing project views:", error);
        return null;
    }
}
