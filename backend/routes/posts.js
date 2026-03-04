/**
 * Posts Routes (Refactored)
 * Handles all post-related operations with proper authorization
 * SECURITY: Input validation, ownership checks, rate limiting applied
 */

const express = require('express');
const router = express.Router();
const { query } = require('../services/db');
const { supabase } = require('../database');
const { authenticateUser } = require('../middleware/jwtAuth');
const { createOwnershipCheck } = require('../middleware/authorization');
const { success, error, forbidden, notFound } = require('../utils/responseFormatter');
const { postSchemas, validateRequest } = require('../utils/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const { enrichUserWithAvatar, enrichUsersWithAvatars } = require('../utils/avatarGenerator');
const logger = require('../utils/logger');
const socketManager = require('../services/socketManager');
const { createNotificationAndEmit } = require('../services/notificationService');

// Ownership check middleware for posts
const requirePostOwner = createOwnershipCheck('posts', 'id', 'user_id');

/**
 * GET /posts
 * List all public posts with pagination and filters
 * Public endpoint (no auth required)
 */
router.get('/', asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0, post_type, user_id } = req.query;

    let queryText = `
        SELECT 
            p.*,
            u.id as author_id,
            u.full_name as author_name,
            u.username as author_username,
            u.profile_image_url as author_image
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.visibility = 'public'
    `;

    const params = [];
    let paramIndex = 1;

    if (post_type) {
        queryText += ` AND p.post_type = $${paramIndex}`;
        params.push(post_type);
        paramIndex++;
    }

    if (user_id) {
        queryText += ` AND p.user_id = $${paramIndex}`;
        params.push(user_id);
        paramIndex++;
    }

    queryText += ` 
        ORDER BY p.is_pinned DESC, p.created_at DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    // Enrich posts with author avatars
    const posts = result.rows.map(post => {
        const authorData = enrichUserWithAvatar({
            id: post.author_id,
            full_name: post.author_name,
            profile_image_url: post.author_image
        });

        return {
            ...post,
            author: {
                id: post.author_id,
                name: post.author_name,
                username: post.author_username,
                avatar: authorData.avatar
            }
        };
    });

    return success(res, {
        posts,
        total: posts.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
    }, 'Posts retrieved successfully');
}));

/**
 * GET /posts/:id
 * Get single post by ID with full details
 * Public endpoint
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
        `SELECT 
            p.*,
            u.id as author_id,
            u.full_name as author_name,
            u.username as author_username,
            u.profile_image_url as author_image,
            u.bio as author_bio
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = $1`,
        [id]
    );

    if (!result.rows.length) {
        return notFound(res, 'Post');
    }

    const post = result.rows[0];

    // Enrich author with avatar
    const authorData = enrichUserWithAvatar({
        id: post.author_id,
        full_name: post.author_name,
        profile_image_url: post.author_image
    });

    // Get comments for the post
    const commentsResult = await query(
        `SELECT 
            c.id, c.content, c.created_at,
            u.id as commenter_id,
            u.full_name as commenter_name,
            u.username as commenter_username,
            u.profile_image_url as commenter_image
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC`,
        [id]
    );

    // Enrich comments with avatars
    const comments = commentsResult.rows.map(comment => {
        const commenterData = enrichUserWithAvatar({
            id: comment.commenter_id,
            full_name: comment.commenter_name,
            profile_image_url: comment.commenter_image
        });

        return {
            id: comment.id,
            content: comment.content,
            created_at: comment.created_at,
            commenter: {
                id: comment.commenter_id,
                name: comment.commenter_name,
                username: comment.commenter_username,
                avatar: commenterData.avatar
            }
        };
    });

    return success(res, {
        post: {
            ...post,
            author: {
                id: post.author_id,
                name: post.author_name,
                username: post.author_username,
                bio: post.author_bio,
                avatar: authorData.avatar
            },
            comments
        }
    }, 'Post details retrieved');
}));

/**
 * POST /posts
 * Create new post
 * REQUIRES: Authentication
 */
router.post('/', authenticateUser, validateRequest(postSchemas.create), asyncHandler(async (req, res) => {
    const {
        content, post_type, project_id, media_urls, tags, is_pinned, visibility
    } = req.body;

    const userId = req.user.userId;

    const result = await query(
        `INSERT INTO posts (
            user_id, content, post_type, project_id, media_urls, tags, 
            is_pinned, visibility, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *`,
        [
            userId,
            content,
            post_type || 'general',
            project_id || null,
            media_urls || null,
            tags || null,
            is_pinned || false,
            visibility || 'public'
        ]
    );

    const post = result.rows[0];

    logger.info('Post created', {
        postId: post.id,
        userId,
        postType: post_type
    });

    return success(res, { post }, 'Post created successfully', 201);
}));

/**
 * PATCH /posts/:id
 * Update post content
 * REQUIRES: Post ownership
 */
router.patch('/:id', authenticateUser, requirePostOwner, validateRequest(postSchemas.update), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;

    const result = await query(
        `UPDATE posts SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [content, id]
    );

    logger.info('Post updated', {
        postId: id,
        userId: req.user.userId
    });

    return success(res, { post: result.rows[0] }, 'Post updated successfully');
}));

/**
 * DELETE /posts/:id
 * Delete post
 * REQUIRES: Post ownership
 */
router.delete('/:id', authenticateUser, requirePostOwner, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Delete post (cascade will delete comments and likes)
    await query('DELETE FROM posts WHERE id = $1', [id]);

    logger.info('Post deleted', {
        postId: id,
        userId: req.user.userId
    });

    return success(res, null, 'Post deleted successfully');
}));

/**
 * POST /posts/:id/like
 * Like or unlike a post
 * REQUIRES: Authentication
 */
router.post('/:id/like', authenticateUser, asyncHandler(async (req, res) => {
    const { id: postId } = req.params;
    const userId = req.user.userId;

    // Check if post exists
    const postCheck = await query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (!postCheck.rows.length) {
        return notFound(res, 'Post');
    }

    // Check if already liked
    const likeCheck = await query(
        'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
        [postId, userId]
    );

    if (likeCheck.rows.length > 0) {
        // Unlike - remove like
        await query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
        await query('UPDATE posts SET likes_count = likes_count - 1 WHERE id = $1', [postId]);

        logger.info('Post unliked', { postId, userId });
        return success(res, { liked: false }, 'Post unliked');
    } else {
        // Like - add like
        await query(
            'INSERT INTO post_likes (post_id, user_id, created_at) VALUES ($1, $2, NOW())',
            [postId, userId]
        );
        await query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1', [postId]);

        logger.info('Post liked', { postId, userId });
        return success(res, { liked: true }, 'Post liked');
    }
}));

/**
 * POST /posts/:id/comment
 * Add comment to a post
 * REQUIRES: Authentication
 */
router.post('/:id/comment', authenticateUser, validateRequest(postSchemas.comment), asyncHandler(async (req, res) => {
    const { id: postId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    // Check if post exists
    const postCheck = await query('SELECT id, user_id FROM posts WHERE id = $1', [postId]);
    if (!postCheck.rows.length) {
        return notFound(res, 'Post');
    }

    const post = postCheck.rows[0];

    // Create comment
    const result = await query(
        `INSERT INTO comments (post_id, user_id, content, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING *`,
        [postId, userId, content]
    );

    const comment = result.rows[0];

    // Increment comment count
    await query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1', [postId]);

    // Create notification for post author (if not commenting on own post) via Socket.IO
    if (post.user_id !== userId) {
        // Get Socket.IO instance for real-time notifications
        const io = socketManager.isInitialized() ? socketManager.getIO() : null;

        const notificationData = {
            recipient_id: post.user_id,
            sender_id: userId,
            type: 'post_comment',
            title: 'New Comment on Your Post',
            message: 'Someone commented on your post',
            related_entity_id: postId,
            priority: 'medium'
        };

        // Send via Socket.IO for real-time delivery
        if (io) {
            await createNotificationAndEmit(io, notificationData);
        } else {
            // Fallback to database-only if Socket.IO not initialized
            await supabase
                .from('notifications')
                .insert({
                    ...notificationData,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
        }
    }

    logger.info('Comment added', {
        commentId: comment.id,
        postId,
        userId
    });

    return success(res, { comment }, 'Comment added successfully', 201);
}));

module.exports = router;
