// ...existing code...
/**
 * Frontend API Client
 * Connects Next.js frontend to Express backend
 * 
 * IMPORTANT: All requests include credentials: 'include' to send HTTP-only cookies
 * This enables JWT-based authentication with automatic token refresh
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Track if we're currently refreshing to avoid multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresh the access token using the refresh token
 */
const refreshAccessToken = async (): Promise<boolean> => {
    // If already refreshing, wait for that refresh to complete
    if (isRefreshing && refreshPromise) {
        return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = (async () => {
        try {
            console.log('[Auth] Attempting to refresh access token...');
            const response = await fetch(`${API_URL}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                console.log('[Auth] ✅ Access token refreshed successfully');
                return true;
            } else {
                console.error('[Auth] ❌ Token refresh failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('[Auth] ❌ Token refresh error:', error);
            return false;
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};

/**
 * Helper function for fetch requests with proper error handling
 * Automatically includes credentials for cookie-based auth
 * Automatically refreshes tokens on 401 errors and retries the request
 */
export const fetchWithAuth = async (
    url: string,
    options: RequestInit = {},
    _isRetry: boolean = false
): Promise<Response> => {
    const defaultOptions: RequestInit = {
        credentials: 'include', // Include HTTP-only cookies
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    };

    try {
        const response = await fetch(url, defaultOptions);

        // If 401 Unauthorized and this isn't already a retry, attempt token refresh
        if (response.status === 401 && !_isRetry && !url.includes('/auth/refresh')) {
            console.warn('[API] Unauthorized (401) - Attempting token refresh...');

            const refreshSucceeded = await refreshAccessToken();

            if (refreshSucceeded) {
                console.log('[API] Token refreshed, retrying original request...');
                // Retry the original request with the new access token
                return fetchWithAuth(url, options, true);
            } else {
                console.error('[API] Token refresh failed, redirecting to login...');
                // Clear any stale auth state and redirect to login
                if (typeof window !== 'undefined') {
                    // Redirect to login page
                    window.location.href = '/auth/login';
                }
                // Return the 401 response in case redirect doesn't happen immediately
            }
        }

        return response;
    } catch (error) {
        console.error('[API] Fetch error:', error);
        throw error;
    }
};

/**
 * Parse error response with proper error object
 */
const parseErrorResponse = async (response: Response): Promise<string> => {
    try {
        const errorData = await response.json();
        return errorData.error || errorData.message || `HTTP ${response.status}`;
    } catch {
        return `HTTP ${response.status}: ${response.statusText}`;
    }
};

export const api = {
    posts: {
        getAll: async () => {
            const response = await fetchWithAuth(`${API_URL}/api/posts`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch posts: ${error}`);
            }
            return response.json();
        },

        create: async (data: { content: string; type?: string; author_id: string; project_id?: string }) => {
            const response = await fetchWithAuth(`${API_URL}/api/posts`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to create post: ${error}`);
            }
            return response.json();
        },

        delete: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/api/posts/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to delete post: ${error}`);
            }
            return response.json();
        },

        update: async (id: string, content: string) => {
            const response = await fetchWithAuth(`${API_URL}/api/posts/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ content }),
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to update post: ${error}`);
            }
            return response.json();
        },
    },

    projects: {
        getAll: async () => {
            const response = await fetchWithAuth(`${API_URL}/api/projects`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch projects: ${error}`);
            }
            return response.json();
        },

        create: async (data: any) => {
            const response = await fetchWithAuth(`${API_URL}/api/projects`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to create project: ${error}`);
            }
            return response.json();
        },

        apply: async (projectId: string, data: any) => {
            const response = await fetchWithAuth(`${API_URL}/api/projects/${projectId}/apply`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to apply to project: ${error}`);
            }
            return response.json();
        },
        getMyApplications: async () => {
            const response = await fetchWithAuth(`${API_URL}/api/projects/my-applications`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch my applications: ${error}`);
            }
            return response.json();
        },
        updateApplication: async (data: any) => {
            const response = await fetchWithAuth(`${API_URL}/api/projects/application`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to update application: ${error}`);
            }
            return response.json();
        },
    },

    users: {
        getAll: async () => {
            const response = await fetchWithAuth(`${API_URL}/api/users`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch users: ${error}`);
            }
            return response.json();
        },

        create: async (data: any) => {
            const response = await fetchWithAuth(`${API_URL}/api/users`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to create user: ${error}`);
            }
            return response.json();
        },

        getProfile: async (params: any) => {
            const queryParams = new URLSearchParams();
            if (params.id) queryParams.append('id', params.id);
            if (params.username) queryParams.append('username', params.username);
            if (params.includePrivate) queryParams.append('includePrivate', 'true');

            const response = await fetchWithAuth(`${API_URL}/api/users/profile?${queryParams}`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch user profile: ${error}`);
            }
            return response.json();
        },

        updateProfile: async (userId: string, updates: any) => {
            const response = await fetchWithAuth(`${API_URL}/api/users/profile`, {
                method: 'PATCH',
                body: JSON.stringify({ userId, updates }),
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to update profile: ${error}`);
            }
            return response.json();
        },

        deleteProfile: async (userId: string) => {
            const response = await fetchWithAuth(`${API_URL}/api/users/profile?id=${userId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to delete profile: ${error}`);
            }
            return response.json();
        },

        getPrivacy: async (userId: string) => {
            const response = await fetchWithAuth(`${API_URL}/api/users/privacy?userId=${userId}`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch privacy settings: ${error}`);
            }
            return response.json();
        },

        updatePrivacy: async (userId: string, settings: any) => {
            const response = await fetchWithAuth(`${API_URL}/api/users/privacy`, {
                method: 'PATCH',
                body: JSON.stringify({ userId, settings }),
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to update privacy settings: ${error}`);
            }
            return response.json();
        },
    },

    storage: {
        setup: async () => {
            const response = await fetchWithAuth(`${API_URL}/api/storage-setup`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to setup storage: ${error}`);
            }
            return response.json();
        },
    },

    notifications: {
        getUnreadCount: async (userId: string) => {
            const response = await fetchWithAuth(`${API_URL}/api/notifications/${userId}/unread-count`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch unread count: ${error}`);
            }
            return response.json();
        },

        getUserNotifications: async (userId: string, limit: number = 20) => {
            const response = await fetchWithAuth(`${API_URL}/api/notifications/${userId}?limit=${limit}`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch notifications: ${error}`);
            }
            return response.json();
        },

        markAsRead: async (notificationId: string) => {
            const response = await fetchWithAuth(`${API_URL}/api/notifications/${notificationId}/read`, {
                method: 'PATCH',
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to mark notification as read: ${error}`);
            }
            return response.json();
        },
    },

    requests: {
        applyToProject: async (projectId: string, userId: string, message?: string) => {
            const response = await fetchWithAuth(`${API_URL}/api/requests/apply`, {
                method: 'POST',
                body: JSON.stringify({ projectId, userId, message }),
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to apply to project: ${error}`);
            }
            return response.json();
        },

        update: async (requestId: string, action: 'accepted' | 'rejected') => {
            const response = await fetchWithAuth(`${API_URL}/api/projects/${requestId}/applications/${requestId}`, {
                method: 'PATCH',
                body: JSON.stringify({ action }),
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to update request: ${error}`);
            }
            return response.json();
        },

        acceptRequest: async (requestId: string, userId: string) => {
            const response = await fetchWithAuth(`${API_URL}/api/requests/${requestId}/accept`, {
                method: 'POST',
                body: JSON.stringify({ userId }),
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to accept request: ${error}`);
            }
            return response.json();
        },

        rejectRequest: async (requestId: string) => {
            const response = await fetchWithAuth(`${API_URL}/api/requests/${requestId}/reject`, {
                method: 'POST',
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to reject request: ${error}`);
            }
            return response.json();
        },

        getProjectRequests: async (projectId: string) => {
            const response = await fetchWithAuth(`${API_URL}/api/requests/project/${projectId}`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch project requests: ${error}`);
            }
            return response.json();
        },

        getWorkspaceStatus: async (projectId: string) => {
            const response = await fetchWithAuth(`${API_URL}/api/requests/workspace-status/${projectId}`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch workspace status: ${error}`);
            }
            return response.json();
        },

        getUserRequestStatus: async (projectId: string, userId: string) => {
            const response = await fetchWithAuth(`${API_URL}/api/requests/user-status?projectId=${projectId}&userId=${userId}`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch request status: ${error}`);
            }
            return response.json();
        },
    },

    recommendations: {
        getProjects: async (limit: number = 10) => {
            const response = await fetchWithAuth(`${API_URL}/api/compatibility/recommendations/projects?limit=${limit}`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch recommended projects: ${error}`);
            }
            return response.json();
        },

        getCollaborators: async (limit: number = 10) => {
            const response = await fetchWithAuth(`${API_URL}/api/compatibility/recommendations/collaborators?limit=${limit}`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch recommended collaborators: ${error}`);
            }
            return response.json();
        },

        getSkills: async (limit: number = 5) => {
            const response = await fetchWithAuth(`${API_URL}/api/compatibility/recommendations/skills?limit=${limit}`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch recommended skills: ${error}`);
            }
            return response.json();
        },

        getMlProjects: async (limit: number = 10) => {
            const response = await fetchWithAuth(`${API_URL}/api/recommend/projects?limit=${limit}`);
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to fetch ML recommended projects: ${error}`);
            }
            return response.json();
        },

        getAll: async (limits: { projects?: number; collaborators?: number; skills?: number } = {}) => {
            const { projects = 10, collaborators = 10, skills = 5 } = limits;
            
            const results = {
                projects: [],
                collaborators: [],
                skills: [],
            };

            try {
                // Fetch all in parallel, but handle individual failures gracefully
                const [projectsData, collaboratorsData, skillsData] = await Promise.allSettled([
                    api.recommendations.getProjects(projects),
                    api.recommendations.getCollaborators(collaborators),
                    api.recommendations.getSkills(skills),
                ]);

                if (projectsData.status === 'fulfilled') {
                    results.projects = projectsData.value.data?.projects || [];
                } else {
                    console.warn('Failed to fetch project recommendations:', projectsData.reason?.message);
                }

                if (collaboratorsData.status === 'fulfilled') {
                    results.collaborators = collaboratorsData.value.data?.collaborators || [];
                } else {
                    console.warn('Failed to fetch collaborator recommendations:', collaboratorsData.reason?.message);
                }

                if (skillsData.status === 'fulfilled') {
                    results.skills = skillsData.value.data?.skills || [];
                } else {
                    console.warn('Failed to fetch skill recommendations:', skillsData.reason?.message);
                }

                return results;
            } catch (error) {
                console.error('Error fetching recommendations:', error);
                return results;
            }
        },
    },

    auth: {
        login: async (firebaseUid: string, email: string, fullName?: string, username?: string, profileImage?: string) => {
            const response = await fetchWithAuth(`${API_URL}/api/auth/login`, {
                method: 'POST',
                body: JSON.stringify({ firebaseUid, email, fullName, username, profileImage }),
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to login: ${error}`);
            }
            return response.json();
        },

        logout: async () => {
            const response = await fetchWithAuth(`${API_URL}/api/auth/logout`, {
                method: 'POST',
            });
            if (!response.ok) {
                const error = await parseErrorResponse(response);
                throw new Error(`Failed to logout: ${error}`);
            }
            return response.json();
        },

        getMe: async () => {
            const response = await fetchWithAuth(`${API_URL}/api/auth/me`);
            if (!response.ok) {
                return null;
            }
            return response.json();
        },
    },
};

export const getApiUrl = () => API_URL;

export default api;
