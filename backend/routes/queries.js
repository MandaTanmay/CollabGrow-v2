/*
    Clean, CommonJS implementation of the queries router.
    Provides minimal endpoints used by the frontend and returns 501 for others.
*/
const express = require('express');
const router = express.Router();
const { query } = require('../services/db');
const { supabase } = require('../database.js');
const logger = require('../utils/logger');
const { authenticateUser } = require('../middleware/jwtAuth');
// Alias for backward compatibility
const requireAuth = authenticateUser;
const getClient = () => supabase;

// GET /api/queries/platform/stats
router.get('/platform/stats', async (req, res) => {
    try {
        const usersRes = await query("SELECT COUNT(*)::int AS count FROM users WHERE is_active = TRUE");
        const projectsRes = await query("SELECT COUNT(*)::int AS count FROM projects WHERE status = 'completed'");
        const totalProjectsRes = await query("SELECT COUNT(*)::int AS count FROM projects");

        return res.json({
            activeUsers: usersRes.rows[0]?.count || 0,
            completedProjects: projectsRes.rows[0]?.count || 0,
            totalProjects: totalProjectsRes.rows[0]?.count || 0,
        });
    } catch (err) {
        logger.error('Error fetching platform stats:', err);
        return res.status(500).json({ error: 'Failed to fetch platform stats' });
    }
});

// GET /api/queries/user/:id/stats
router.get('/user/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;

        // Get all projects where user is a collaborator (active status)
        const collabRes = await query(
            "SELECT project_id FROM project_collaborators WHERE user_id = $1 AND status = 'Active'",
            [id]
        );
        
        const collabProjectIds = collabRes.rows?.map(r => r.project_id) || [];
        let projectFilter = "creator_id = $1";
        let params = [id];
        
        // If user has collaborations, include those projects too
        if (collabProjectIds.length > 0) {
            projectFilter = `(creator_id = $1 OR id = ANY($2::uuid[]))`;
            params = [id, collabProjectIds];
        }

        // Count active projects (user is creator OR collaborator, and status <> 'completed')
        const activeRes = await query(
            `SELECT COUNT(*)::int AS count FROM projects WHERE ${projectFilter} AND status <> 'completed'`,
            params
        );

        // Count completed projects (user is creator OR collaborator, and status = 'completed')
        const completedRes = await query(
            `SELECT COUNT(*)::int AS count FROM projects WHERE ${projectFilter} AND status = 'completed'`,
            params
        );

        // Count total projects (user is creator OR collaborator)
        const totalRes = await query(
            `SELECT COUNT(*)::int AS count FROM projects WHERE ${projectFilter}`,
            params
        );

        // Count distinct collaborators on user's CREATED projects only
        const collabCountRes = await query(
            "SELECT COUNT(DISTINCT user_id)::int AS count FROM project_collaborators WHERE project_id IN (SELECT id FROM projects WHERE creator_id = $1) AND status = 'Active'",
            [id]
        );
        
        // Get actual follower/following counts and other stats from the users table
        const userStatsRes = await query(
            "SELECT followers_count, following_count, reputation_points, profile_views FROM users WHERE id = $1",
            [id]
        );
        const userStats = userStatsRes.rows[0] || {};

        return res.json({
            active_projects: activeRes.rows[0]?.count || 0,
            completed_projects: completedRes.rows[0]?.count || 0,
            total_projects: totalRes.rows[0]?.count || 0,
            collaborators_count: collabCountRes.rows[0]?.count || 0,
            followers_count: userStats.followers_count || 0,
            following_count: userStats.following_count || 0,
            reputation_points: userStats.reputation_points || 0,
            profile_views: userStats.profile_views || 0,
        });
    } catch (err) {
        logger.error('Error fetching user stats:', err);
        return res.status(500).json({ error: 'Failed to fetch user stats' });
    }
});

// GET /api/queries/user/firebase/:uid
router.get('/user/firebase/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        const result = await query('SELECT * FROM users WHERE firebase_uid = $1 LIMIT 1', [uid]);
        const user = result.rows[0] || null;
        if (!user) return res.status(404).json({ error: 'User not found' });
        // Return user data with snake_case field names as expected by frontend
        const mapped = {
            id: user.id,
            email: user.email,
            firebase_uid: user.firebase_uid,
            full_name: user.full_name,
            username: user.username,
            profile_image_url: user.profile_image_url,
            bio: user.bio,
            university: user.university,
            major: user.major,
            location: user.location,
            github_username: user.github_username,
            linkedin_url: user.linkedin_url,
            portfolio_url: user.portfolio_url,
            skills: user.skills,
            created_at: user.created_at,
        };
        return res.json(mapped);
    } catch (err) {
        logger.error('Error fetching user by firebase uid:', err);
        return res.status(500).json({ error: 'Failed to fetch user' });
    }
});


// GET posts feed
router.get('/posts', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 30;
        const client = getClient();
        const { data, error } = await client
            .from('posts')
            .select(`
                *,
                user:users!user_id (
                    id,
                    username,
                    full_name,
                    profile_image_url
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return res.json(data || []);
    } catch (error) {
        logger.error('Error fetching posts:', error);
        return res.status(500).json({ error: error.message || 'Failed to fetch posts' });
    }
});

// POST create post
router.post('/posts', requireAuth, async (req, res) => {
    try {
        const { content, post_type, project_id } = req.body;
        // Use authenticated user ID from JWT token instead of request body
        const user_id = req.user.userId;
        if (!user_id || !content) {
            return res.status(400).json({ error: 'Missing required fields: content' });
        }
        const client = getClient();
        const { data, error } = await client
            .from('posts')
            .insert({
                user_id,
                content,
                post_type: post_type || 'general',
                related_project_id: project_id || null,
                visibility: 'public'
            })
            .select(`
                *,
                user:users!user_id (
                    id,
                    username,
                    full_name,
                    profile_image_url
                )
            `)
            .single();
        if (error) throw error;
        return res.json(data);
    } catch (error) {
        logger.error('Error creating post:', error);
        return res.status(500).json({ error: error.message || 'Failed to create post' });
    }
});

// POST like post
router.post('/posts/:id/like', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        // Use authenticated user ID from JWT token instead of request body
        const user_id = req.user.userId;
        const client = supabase;

        // Check if already liked
        const { data: existing } = await client
            .from("post_likes")
            .select("id")
            .eq("post_id", id)
            .eq("user_id", user_id)
            .maybeSingle();

        if (existing) {
            // Unlike
            await client
                .from("post_likes")
                .delete()
                .eq("post_id", id)
                .eq("user_id", user_id);
            return res.json({ liked: false });
        } else {
            // Like
            await client
                .from("post_likes")
                .insert({ post_id: id, user_id });
            return res.json({ liked: true });
        }
    } catch (error) {
        logger.error("Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// GET user liked posts
router.get('/user/:id/liked-posts', async (req, res) => {
    try {
        const { id } = req.params;
        const client = getClient();
        const { data, error } = await client
            .from("post_likes")
            .select("post_id")
            .eq("user_id", id);

        if (error) throw error;
        return res.json(data?.map(l => l.post_id) || []);
    } catch (error) {
        logger.error("Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// POST save post
router.post('/posts/:id/save', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        // Use authenticated user ID from JWT token instead of request body
        const user_id = req.user.userId;
        const client = getClient();

        // Get user's saved posts
        const { data: user } = await client
            .from("users")
            .select("saved_posts")
            .eq("id", user_id)
            .single();

        const savedPosts = user?.saved_posts || [];
        const isSaved = savedPosts.includes(id);

        if (isSaved) {
            // Remove from saved
            const updated = savedPosts.filter(p => p !== id);
            await client
                .from("users")
                .update({ saved_posts: updated })
                .eq("id", user_id);
            return res.json({ saved: false });
        } else {
            // Add to saved
            const updated = [...savedPosts, id];
            await client
                .from("users")
                .update({ saved_posts: updated })
                .eq("id", user_id);
            return res.json({ saved: true });
        }
    } catch (error) {
        logger.error("Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// DELETE post
router.delete('/posts/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        
        // First, verify the post belongs to the authenticated user
        const postResult = await query(
            'SELECT user_id FROM posts WHERE id = $1',
            [id]
        );

        if (postResult.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Authorization: Users can only delete their own posts
        if (postResult.rows[0].user_id.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'Access denied: You can only delete your own posts' });
        }

        // Delete post (cascade will delete comments and likes)
        await query('DELETE FROM posts WHERE id = $1', [id]);

        logger.info('Post deleted', {
            postId: id,
            userId: userId
        });

        return res.json({ 
            success: true, 
            message: 'Post deleted successfully' 
        });
    } catch (error) {
        logger.error('Error deleting post:', error);
        return res.status(500).json({ error: error.message });
    }
});

// GET post comments
router.get('/posts/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const client = getClient();
        const { data, error } = await client
            .from("post_comments")
            .select(`
                *,
                user:users!user_id (
                    id,
                    username,
                    full_name,
                    profile_image_url
                )
            `)
            .eq("post_id", id)
            .order("created_at", { ascending: true });

        if (error) throw error;
        return res.json(data || []);
    } catch (error) {
        logger.error("Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// POST create comment
router.post('/posts/:id/comments', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        // Use authenticated user ID from JWT token instead of request body
        const user_id = req.user.userId;
        const client = getClient();
        const { data, error } = await client
            .from("post_comments")
            .insert({
                post_id: id,
                user_id,
                content,
            })
            .select()
            .single();

        if (error) throw error;
        return res.json(data);
    } catch (error) {
        logger.error("Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// DELETE comment
router.delete('/comments/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const client = getClient();
        
        // First, verify the comment belongs to the authenticated user
        const { data: comment, error: fetchError } = await client
            .from("post_comments")
            .select("user_id")
            .eq("id", id)
            .single();

        if (fetchError || !comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Authorization: Users can only delete their own comments
        if (comment.user_id.toString() !== req.user.userId.toString()) {
            return res.status(403).json({ error: 'Access denied: You can only delete your own comments' });
        }
        
        const { error } = await client
            .from("post_comments")
            .delete()
            .eq("id", id);

        if (error) throw error;
        return res.json({ success: true });
    } catch (error) {
        logger.error("Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// GET all projects
router.get('/projects', async (req, res) => {
    try {
        const { status, difficulty, limit, involvedUser } = req.query;
        const client = getClient();
        
        let query = client.from("projects").select(`
            *,
            creator:users!projects_creator_id_fkey (
                id,
                username,
                full_name,
                profile_image_url
            ),
            project_skills (
                skill:skills (
                    id,
                    name,
                    category
                )
            ),
            project_collaborators (
                user_id,
                status,
                users (
                    full_name,
                    profile_image_url
                )
            )
        `);

        if (status) query = query.eq("status", status);
        if (difficulty) query = query.eq("difficulty_level", difficulty);

        if (involvedUser) {
            // 1. Get projects where user is a collaborator
            const { data: collaborations, error: collabError } = await client
                .from('project_collaborators')
                .select('project_id')
                .eq('user_id', involvedUser)
                .eq('status', 'Active');

            if (collabError) throw collabError;

            const collabProjectIds = (collaborations || []).map(c => c.project_id).filter(Boolean);

            // 2. Build filter: Created by user OR is an active collaborator
            // Get projects created by user
            const createdQuery = client.from("projects")
                .select(`
                    *,
                    creator:users!projects_creator_id_fkey (
                        id,
                        username,
                        full_name,
                        profile_image_url
                    ),
                    project_skills (
                        skill:skills (
                            id,
                            name,
                            category
                        )
                    ),
                    project_collaborators (
                        user_id,
                        status,
                        users (
                            full_name,
                            profile_image_url
                        )
                    )
                `)
                .eq('creator_id', involvedUser);

            // Get projects where user is a collaborator
            let collabQuery = null;
            if (collabProjectIds.length > 0) {
                collabQuery = client.from("projects")
                    .select(`
                        *,
                        creator:users!projects_creator_id_fkey (
                            id,
                            username,
                            full_name,
                            profile_image_url
                        ),
                        project_skills (
                            skill:skills (
                                id,
                                name,
                                category
                            )
                        ),
                        project_collaborators (
                            user_id,
                            status,
                            users (
                                full_name,
                                profile_image_url
                            )
                        )
                    `)
                    .in('id', collabProjectIds);
            }

            if (status) {
                createdQuery.eq('status', status);
                if (collabQuery) collabQuery.eq('status', status);
            }
            if (difficulty) {
                createdQuery.eq('difficulty_level', difficulty);
                if (collabQuery) collabQuery.eq('difficulty_level', difficulty);
            }

            // Execute both queries
            const { data: createdData, error: createdError } = await createdQuery;
            if (createdError) throw createdError;

            let collabData = [];
            if (collabQuery) {
                const { data: collabRes, error: collabQueryError } = await collabQuery;
                if (collabQueryError) throw collabQueryError;
                collabData = collabRes || [];
            }

            // Combine results and remove duplicates
            const projectMap = new Map();
            
            (createdData || []).forEach(p => projectMap.set(p.id, p));
            (collabData || []).forEach(p => projectMap.set(p.id, p));

            let allProjects = Array.from(projectMap.values());

            // Sort by creation date
            allProjects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // Apply limit
            if (limit) allProjects = allProjects.slice(0, parseInt(limit));

            return res.json(allProjects);
        }

        if (limit) query = query.limit(parseInt(limit));
        query = query.order("created_at", { ascending: false });

        const { data, error } = await query;
        if (error) throw error;
        return res.json(data || []);
    } catch (error) {
        logger.error("Error fetching projects:", error);
        return res.status(500).json({ error: error.message });
    }
});

// GET user collaborators (recommendations)
router.get('/user/:id/collaborators', async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 5;
        const client = getClient();

        const { data, error } = await client
            .from('users')
            .select('id, full_name, username, bio, university, major, skills, profile_image_url')
            .neq('id', id)
            .eq('is_active', true)
            .limit(limit);

        if (error) throw error;
        return res.json(data || []);
    } catch (error) {
        logger.error('Error fetching collaborators:', error);
        return res.status(500).json({ error: error.message || 'Failed to fetch collaborators' });
    }
});

// GET user notifications
router.get('/user/:id/notifications', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        
        // Authorization: Users can only access their own notifications
        if (req.user.userId.toString() !== id.toString()) {
            return res.status(403).json({ error: 'Access denied: You can only view your own notifications' });
        }
        
        // Use direct SQL to avoid Supabase RLS/service-role configuration issues
        const result = await query(
            `SELECT
                n.id,
                n.recipient_id,
                n.sender_id,
                n.type,
                n.title,
                n.message,
                n.related_project_id,
                n.related_entity_id,
                n.priority,
                n.is_read,
                n.created_at,
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'full_name', u.full_name,
                    'profile_image_url', u.profile_image_url
                ) as sender
             FROM notifications n
             LEFT JOIN users u ON u.id = n.sender_id
             WHERE n.recipient_id = $1
             ORDER BY n.created_at DESC
             LIMIT $2`,
            [id, limit]
        );

        return res.json(result.rows || []);
    } catch (error) {
        logger.error("Error fetching notifications:", error);
        return res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
    }
});

// PATCH mark notification as read
router.patch('/notifications/:id/mark-read', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const ownerCheck = await query('SELECT recipient_id FROM notifications WHERE id = $1', [id]);
        if (!ownerCheck.rows.length) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        if (ownerCheck.rows[0].recipient_id.toString() !== req.user.userId.toString()) {
            return res.status(403).json({ error: 'Access denied: You can only modify your own notifications' });
        }

        const updated = await query(
            'UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *',
            [id]
        );

        return res.json({ success: true, data: updated.rows[0] });
    } catch (error) {
        logger.error("Error marking notification as read:", error);
        return res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
    }
});

// DELETE notification
router.delete('/notifications/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const ownerCheck = await query('SELECT recipient_id FROM notifications WHERE id = $1', [id]);
        if (!ownerCheck.rows.length) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        if (ownerCheck.rows[0].recipient_id.toString() !== req.user.userId.toString()) {
            return res.status(403).json({ error: 'Access denied: You can only delete your own notifications' });
        }

        const deleted = await query('DELETE FROM notifications WHERE id = $1 RETURNING *', [id]);
        return res.json({ success: true, data: deleted.rows[0] });
    } catch (error) {
        logger.error("Error deleting notification:", error);
        return res.status(500).json({ error: error.message || 'Failed to delete notification' });
    }
});

// GET user saved posts
router.get('/user/:id/saved-posts', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Authorization: Users can only access their own saved posts
        if (req.user.userId.toString() !== id.toString()) {
            return res.status(403).json({ error: 'Access denied: You can only view your own saved posts' });
        }
        
        const client = getClient();
        const { data: user, error: userError } = await client
            .from("users")
            .select("saved_posts")
            .eq("id", id)
            .single();

        if (userError) throw userError;

        const savedPostIds = user?.saved_posts || [];
        if (savedPostIds.length === 0) {
            return res.json([]);
        }

        const { data: posts, error: postsError } = await client
            .from("posts")
            .select(`
                *,
                user:users!user_id (
                    id,
                    username,
                    full_name,
                    profile_image_url,
                    profile_image_url
                )
            `)
            .in("id", savedPostIds)
            .order("created_at", { ascending: false });

        if (postsError) throw postsError;
        return res.json(posts || []);
    } catch (error) {
        logger.error("Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// GET platform stats
router.get('/platform/stats', async (req, res) => {
    try {
        const client = getClient();
        const [usersResult, projectsResult, universitiesResult] = await Promise.all([
            client
                .from("users")
                .select("*", { count: "exact", head: true })
                .eq("is_active", true),
            client
                .from("projects")
                .select("*", { count: "exact", head: true })
                .eq("status", "completed"),
            client
                .from("users")
                .select("university", { count: "exact" })
                .not("university", "is", null)
        ]);

        // Get unique universities count
        const { data: universities } = await client
            .from("users")
            .select("university")
            .not("university", "is", null);

        const uniqueUniversities = new Set(universities?.map(u => u.university).filter(Boolean)).size;

        return res.json({
            activeUsers: usersResult.count || 0,
            completedProjects: projectsResult.count || 0,
            universities: uniqueUniversities,
        });
    } catch (error) {
        logger.error("Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// GET project likes with user status (single project)
router.get('/projects/:id/likes', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.query.userId;
        const client = getClient();

        const { data: likes, error } = await client
            .from("project_likes")
            .select(`
                *,
                user:users!user_id (
                    id,
                    username,
                    full_name,
                    profile_image_url
                )
            `)
            .eq("project_id", id);

        if (error) throw error;

        const userLiked = userId ? likes?.some(l => l.user_id === userId) : false;

        return res.json({
            likes: likes || [],
            count: likes?.length || 0,
            userLiked,
        });
    } catch (error) {
        logger.error("Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// GET project likes for multiple projects
router.post('/projects/likes/batch', async (req, res) => {
    try {
        const { projectIds, userId } = req.body;
        if (!projectIds || !Array.isArray(projectIds)) {
            return res.status(400).json({ error: "projectIds array is required" });
        }

        const client = getClient();
        const { data: likes, error } = await client
            .from("project_likes")
            .select("project_id, user_id")
            .in("project_id", projectIds);

        if (error) throw error;

        // Group likes by project_id
        const likesByProject = {};
        likes?.forEach(like => {
            if (!likesByProject[like.project_id]) {
                likesByProject[like.project_id] = [];
            }
            likesByProject[like.project_id].push(like);
        });

        // Format response
        const result = projectIds.map(projectId => ({
            projectId,
            likes: likesByProject[projectId]?.length || 0,
            isLikedByUser: userId ? likesByProject[projectId]?.some(l => l.user_id === userId) : false,
        }));

        return res.json(result);
    } catch (error) {
        logger.error("Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// POST toggle project like
router.post('/projects/:id/like', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        // Use authenticated user ID from JWT token instead of request body
        const user_id = req.user.userId;
        const client = getClient();

        // Check if already liked
        const { data: existing } = await client
            .from("project_likes")
            .select("id")
            .eq("project_id", id)
            .eq("user_id", user_id)
            .maybeSingle();

        if (existing) {
            // Unlike
            await client
                .from("project_likes")
                .delete()
                .eq("project_id", id)
                .eq("user_id", user_id);
            return res.json({ liked: false });
        } else {
            // Like
            await client
                .from("project_likes")
                .insert({ project_id: id, user_id });
            return res.json({ liked: true });
        }
    } catch (error) {
        logger.error("Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// GET all tasks for a project
router.get('/project/:projectId/tasks', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await query(
            'SELECT * FROM project_tasks WHERE project_id = $1 ORDER BY due_date ASC, created_at ASC',
            [projectId]
        );
        return res.json(result.rows || []);
    } catch (err) {
        logger.error('Error fetching project tasks:', err);
        return res.status(500).json({ error: 'Failed to fetch project tasks' });
    }
});

// GET all chat messages for a project
router.get('/project/:projectId/chat', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await query(
            'SELECT id, project_id as "roomId", user_id as "userId", user_name as "userName", user_logo as "userLogo", content, timestamp, is_system as "isSystem" FROM project_chat_messages WHERE project_id = $1 ORDER BY timestamp ASC',
            [projectId]
        );
        return res.json(result.rows || []);
    } catch (err) {
        logger.error('Error fetching project chat messages:', err);
        return res.status(500).json({ error: 'Failed to fetch project chat messages' });
    }
});

// GET all resources for a project
router.get('/project/:projectId/resources', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await query(
            `SELECT pr.*, u.full_name as uploader_name, u.profile_image_url as uploader_image 
             FROM project_resources pr 
             LEFT JOIN users u ON pr.uploader_id = u.id 
             WHERE pr.project_id = $1 
             ORDER BY pr.created_at DESC`,
            [projectId]
        );
        
        // Transform to match frontend expected format
        const resources = result.rows.map(r => {
            let file_path = null;
            let size_bytes = null;
            let mime_type = null;
            
            // Parse file metadata from description if it exists
            if (r.description) {
                try {
                    const metadata = JSON.parse(r.description);
                    file_path = metadata.file_path;
                    size_bytes = metadata.size_bytes;
                    mime_type = metadata.mime_type;
                } catch (e) {
                    // Description might not be JSON, ignore
                }
            }
            
            return {
                ...r,
                title: r.resource_name,
                url: r.resource_url,
                type: r.resource_type,
                file_path,
                size_bytes,
                mime_type
            };
        });
        
        return res.json(resources);
    } catch (err) {
        logger.error('Error fetching project resources:', err);
        return res.status(500).json({ error: 'Failed to fetch project resources' });
    }
});

// POST add resource to a project
router.post('/project/:projectId/resources', requireAuth, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { title, url, type, file_path, size_bytes, mime_type } = req.body;
        const uploaderId = req.user.userId;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Title is required' });
        }

        if (!url || !url.trim()) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Detect resource type from URL if not provided
        let resourceType = type || 'link';
        if (!type) {
            if (url.includes('github.com')) resourceType = 'github';
            else if (url.includes('figma.com')) resourceType = 'figma';
            else if (url.includes('docs.google.com')) resourceType = 'docs';
            else if (url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) resourceType = 'image';
            else if (url.match(/\.pdf$/i)) resourceType = 'pdf';
        }

        // Build description with file metadata
        let description = null;
        if (file_path) {
            description = JSON.stringify({
                file_path,
                size_bytes,
                mime_type
            });
        }

        const result = await query(
            `INSERT INTO project_resources (project_id, resource_name, resource_url, resource_type, uploader_id, description) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *, 
             (SELECT full_name FROM users WHERE id = $5) as uploader_name,
             (SELECT profile_image_url FROM users WHERE id = $5) as uploader_image`,
            [projectId, title.trim(), url.trim(), resourceType, uploaderId, description]
        );

        // Transform to match frontend expected format (using 'title' instead of 'resource_name')
        const resource = result.rows[0];
        const responseData = {
            ...resource,
            title: resource.resource_name,
            url: resource.resource_url,
            type: resource.resource_type,
            file_path: file_path || null,
            size_bytes: size_bytes || null,
            mime_type: mime_type || null
        };

        return res.json(responseData);
    } catch (err) {
        logger.error('Error adding project resource:', err);
        return res.status(500).json({ error: 'Failed to add project resource' });
    }
});

// DELETE a resource from a project
router.delete('/project/:projectId/resources/:resourceId', requireAuth, async (req, res) => {
    try {
        const { projectId, resourceId } = req.params;
        const userId = req.user.userId;

        // Check if user is the uploader or project owner
        const checkResult = await query(
            `SELECT pr.uploader_id, pr.description, p.creator_id 
             FROM project_resources pr 
             JOIN projects p ON p.id = pr.project_id 
             WHERE pr.id = $1 AND pr.project_id = $2`,
            [resourceId, projectId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Resource not found' });
        }

        const resource = checkResult.rows[0];
        const isOwner = resource.creator_id === userId;
        const isUploader = resource.uploader_id === userId;

        if (!isOwner && !isUploader) {
            return res.status(403).json({ error: 'Access denied: Only the uploader or project owner can delete this resource' });
        }

        // Check if resource has a file in storage
        let filePath = null;
        if (resource.description) {
            try {
                const metadata = JSON.parse(resource.description);
                filePath = metadata.file_path;
            } catch (e) {
                // Description might not be JSON, ignore
            }
        }

        // Delete from database first
        await query('DELETE FROM project_resources WHERE id = $1', [resourceId]);

        // If there's a file in storage, delete it
        if (filePath) {
            try {
                const { supabase } = require('../database');
                const { error: storageError } = await supabase.storage
                    .from('project-resources')
                    .remove([filePath]);
                
                if (storageError) {
                    logger.warn('Failed to delete file from storage:', storageError);
                    // Don't fail the request, file is already deleted from DB
                }
            } catch (storageErr) {
                logger.warn('Storage deletion error:', storageErr);
                // Don't fail the request
            }
        }

        return res.json({ success: true, message: 'Resource deleted successfully' });
    } catch (err) {
        logger.error('Error deleting project resource:', err);
        return res.status(500).json({ error: 'Failed to delete project resource' });
    }
});

// GET all collaborators for a project
router.get('/project/:projectId/collaborators', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await query(
            `SELECT pc.id, pc.role, pc.status, pc.joined_at, pc.contribution_description,
                    u.id as user_id, u.full_name, u.username, u.email, u.profile_image_url, 
                    u.bio, u.university, u.major, u.skills
             FROM project_collaborators pc 
             JOIN users u ON pc.user_id = u.id 
             WHERE pc.project_id = $1 AND pc.status = 'Active'
             ORDER BY pc.joined_at ASC`,
            [projectId]
        );
        
        // Transform to match frontend expected format
        const collaborators = result.rows.map(row => ({
            id: row.id,
            role: row.role,
            status: row.status,
            joined_at: row.joined_at,
            contribution_description: row.contribution_description,
            user: {
                id: row.user_id,
                full_name: row.full_name,
                username: row.username,
                email: row.email,
                profile_image_url: row.profile_image_url,
                bio: row.bio,
                university: row.university,
                major: row.major,
                skills: row.skills
            }
        }));
        
        return res.json(collaborators);
    } catch (err) {
        logger.error('Error fetching project collaborators:', err);
        return res.status(500).json({ error: 'Failed to fetch project collaborators' });
    }
});

module.exports = router;

