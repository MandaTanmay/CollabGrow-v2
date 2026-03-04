/**
 * Users Routes (Refactored)
 * Handles all user-related operations with proper authorization
 * SECURITY: Input validation, self-update restrictions, rate limiting applied
 */

const express = require('express');
const router = express.Router();
const { query } = require('../services/db');
const { requireAuth } = require('../middleware/authorization');
const { authenticateUser } = require('../middleware/jwtAuth');
const { success, error, forbidden, notFound } = require('../utils/responseFormatter');
const { userSchemas, validateRequest } = require('../utils/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const { enrichUserWithAvatar, enrichUsersWithAvatars } = require('../utils/avatarGenerator');
const logger = require('../utils/logger');
const socketManager = require('../services/socketManager');
const { createNotificationAndEmit } = require('../services/notificationService');

/**
 * POST /users
 * Register a new user (Firebase authenticated)
 * Public endpoint
 */
router.post('/', validateRequest(userSchemas.register), asyncHandler(async (req, res) => {
    const { firebaseUid, email, fullName, username, university, major, bio, skills } = req.body;

    // Check if firebase_uid or email already exists
    const existing = await query(
        'SELECT id FROM users WHERE firebase_uid = $1 OR email = $2',
        [firebaseUid, email]
    );
    if (existing.rows.length > 0) {
        return error(res, 'User already exists', 409);
    }

    // Generate username from email if not provided
    const finalUsername = username || email.split('@')[0];

    // Insert user
    const result = await query(
        `INSERT INTO users (firebase_uid, email, full_name, username, university, major, bio, skills, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW()) 
         RETURNING id, firebase_uid, email, full_name, username, university, major, bio, skills, created_at`,
        [firebaseUid, email, fullName, finalUsername, university, major, bio, skills]
    );

    logger.info('User registered', { userId: result.rows[0].id, firebaseUid });

    return success(res, { user: result.rows[0] }, 'User registered successfully');
}));

/**
 * GET /users
 * List all users with pagination and optional search
 * Public endpoint (no auth required)
 */
router.get('/', asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0, search, skills } = req.query;

    let queryText = `
        SELECT 
            id, username, full_name, bio, profile_image_url, 
            university, major, location, created_at
        FROM users
        WHERE is_active = TRUE
    `;

    const params = [];
    let paramIndex = 1;

    if (search) {
        queryText += ` AND (
            full_name ILIKE $${paramIndex} OR 
            username ILIKE $${paramIndex} OR 
            bio ILIKE $${paramIndex}
        )`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    if (skills) {
        // Skills filter (array stored as JSONB or text array)
        queryText += ` AND skills @> $${paramIndex}`;
        params.push(JSON.stringify([skills]));
        paramIndex++;
    }

    queryText += ` 
        ORDER BY created_at DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    // Enrich users with avatars
    const users = enrichUsersWithAvatars(result.rows);

    return success(res, {
        users,
        total: users.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
    }, 'Users retrieved successfully');
}));

/**
 * GET /users/:id
 * Get user profile by ID
 * Public endpoint (shows more details if viewing own profile)
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const requesterId = req.user?.userId;

    const result = await query(
        `SELECT 
            id, username, full_name, bio, profile_image_url,
            university, major, location, skills, 
            github_username, linkedin_url, portfolio_url,
            created_at, updated_at
            ${requesterId === id ? ', email' : ''}
        FROM users
        WHERE id = $1 AND is_active = TRUE`,
        [id]
    );

    if (!result.rows.length) {
        return notFound(res, 'User');
    }

    let user = result.rows[0];

    // Enrich with avatar
    user = enrichUserWithAvatar(user);

    // Get user statistics
    const statsQueries = await Promise.all([
        query(
            'SELECT COUNT(*) as count FROM projects WHERE creator_id = $1 AND status IN ($2, $3)',
            [id, 'recruiting', 'active']
        ),
        query(
            'SELECT COUNT(*) as count FROM projects WHERE creator_id = $1 AND status = $2',
            [id, 'completed']
        ),
        query(
            'SELECT COUNT(*) as count FROM project_collaborators WHERE user_id = $1 AND status = $2',
            [id, 'Active']
        ),
    ]);

    const stats = {
        active_projects: parseInt(statsQueries[0].rows[0].count),
        completed_projects: parseInt(statsQueries[1].rows[0].count),
        collaborations: parseInt(statsQueries[2].rows[0].count),
    };

    // Get recent projects if public
    const recentProjects = await query(
        `SELECT id, title, description, status, created_at
         FROM projects
         WHERE creator_id = $1 AND is_public = TRUE
         ORDER BY created_at DESC
         LIMIT 5`,
        [id]
    );

    return success(res, {
        user: {
            ...user,
            stats,
            recent_projects: recentProjects.rows
        }
    }, 'User profile retrieved');
}));

/**
 * GET /users/:id/details
 * Alias for GET /users/:id for frontend compatibility
 * Public endpoint
 */
router.get('/:id/details', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const requesterId = req.user?.userId;

    const result = await query(
        `SELECT 
            id, username, full_name, bio, profile_image_url,
            university, major, location, skills,
            github_username, linkedin_url, portfolio_url,
            created_at, updated_at
            ${requesterId === id ? ', email' : ''}
        FROM users
        WHERE id = $1 AND is_active = TRUE`,
        [id]
    );

    if (!result.rows.length) {
        return notFound(res, 'User');
    }

    let user = result.rows[0];

    // Enrich with avatar
    user = enrichUserWithAvatar(user);

    // Get user statistics
    const statsQueries = await Promise.all([
        query(
            'SELECT COUNT(*) as count FROM projects WHERE creator_id = $1 AND status = $2',
            [id, 'completed']
        ),
        query(
            'SELECT COUNT(*) as count FROM projects WHERE creator_id = $1',
            [id]
        ),
        query(
            'SELECT COUNT(*) as count FROM projects WHERE creator_id = $1 AND status IN ($2, $3)',
            [id, 'active', 'in_progress']
        ),
    ]);

    // Format response for sender profile dialog
    const responseData = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        bio: user.bio,
        profile_image_url: user.profile_image_url,
        university: user.university,
        major: user.major,
        location: user.location,
        skills: user.skills,
        github_username: user.github_username,
        linkedin_url: user.linkedin_url,
        portfolio_url: user.portfolio_url,
        projectsCompleted: parseInt(statsQueries[0].rows[0].count),
        projectsTotal: parseInt(statsQueries[1].rows[0].count),
        activeProjects: parseInt(statsQueries[2].rows[0].count),
        joinDate: user.created_at
    };

    // Include email only if user is viewing their own profile
    if (requesterId === id && user.email) {
        responseData.email = user.email;
    }

    return success(res, responseData, 'User details retrieved');
}));

/**
 * PATCH /users/:id
 * Update user profile
 * REQUIRES: Self (user can only update own profile)
 */
router.patch('/:id', authenticateUser, validateRequest(userSchemas.update), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const requesterId = req.user.userId;

    // Users can only update their own profile
    if (id !== requesterId) {
        return forbidden(res, 'You can only update your own profile');
    }

    const {
        full_name, bio, university, major, location, skills,
        github_username, linkedin_url, portfolio_url
    } = req.body;

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (full_name !== undefined) {
        updates.push(`full_name = $${paramIndex}`);
        params.push(full_name);
        paramIndex++;
    }
    if (bio !== undefined) {
        updates.push(`bio = $${paramIndex}`);
        params.push(bio);
        paramIndex++;
    }
    if (university !== undefined) {
        updates.push(`university = $${paramIndex}`);
        params.push(university);
        paramIndex++;
    }
    if (major !== undefined) {
        updates.push(`major = $${paramIndex}`);
        params.push(major);
        paramIndex++;
    }
    if (location !== undefined) {
        updates.push(`location = $${paramIndex}`);
        params.push(location);
        paramIndex++;
    }
    if (skills !== undefined) {
        updates.push(`skills = $${paramIndex}`);
        params.push(JSON.stringify(skills));
        paramIndex++;
    }
    if (github_username !== undefined) {
        updates.push(`github_username = $${paramIndex}`);
        params.push(github_username);
        paramIndex++;
    }
    if (linkedin_url !== undefined) {
        updates.push(`linkedin_url = $${paramIndex}`);
        params.push(linkedin_url);
        paramIndex++;
    }
    if (portfolio_url !== undefined) {
        updates.push(`portfolio_url = $${paramIndex}`);
        params.push(portfolio_url);
        paramIndex++;
    }

    if (updates.length === 0) {
        return error(res, 'No fields to update', 400);
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const result = await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
    );

    // Enrich with avatar
    const user = enrichUserWithAvatar(result.rows[0]);

    logger.info('User profile updated', {
        userId: id,
        updates: Object.keys(req.body)
    });

    return success(res, { user }, 'Profile updated successfully');
}));

/**
 * POST /users/:id/upload-avatar
 * Upload or update profile avatar
 * REQUIRES: Self (user can only update own avatar)
 */
router.post('/:id/upload-avatar', authenticateUser, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const requesterId = req.user.userId;

    // Users can only update their own avatar
    if (id !== requesterId) {
        return forbidden(res, 'You can only update your own avatar');
    }

    const { profile_image_url } = req.body;

    if (!profile_image_url) {
        return error(res, 'profile_image_url is required', 400);
    }

    const result = await query(
        'UPDATE users SET profile_image_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [profile_image_url, id]
    );

    // Enrich with avatar
    const user = enrichUserWithAvatar(result.rows[0]);

    logger.info('User avatar updated', { userId: id });

    return success(res, { user }, 'Avatar updated successfully');
}));

/**
 * DELETE /users/:id
 * Deactivate user account (soft delete)
 * REQUIRES: Self (user can only deactivate own account)
 */
router.delete('/:id', authenticateUser, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const requesterId = req.user.userId;

    // Users can only deactivate their own account
    if (id !== requesterId) {
        return forbidden(res, 'You can only deactivate your own account');
    }

    // Soft delete by setting is_active to false
    await query(
        'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
        [id]
    );

    // Note: JWT tokens will expire naturally (access: 15min, refresh: 7days)
    // To force immediate logout, user should call /auth/logout-all

    logger.info('User account deactivated', { userId: id });

    return success(res, null, 'Account deactivated successfully');
}));

/**
 * GET /users/:id/projects
 * Get all projects created by user
 * Public endpoint (only shows public projects unless viewing own)
 */
router.get('/:id/projects', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const requesterId = req.user?.userId;
    const isOwner = id === requesterId;

    const result = await query(
        `SELECT 
            p.id, p.title, p.description, p.status, p.difficulty_level,
            p.created_at, p.views_count,
            COUNT(DISTINCT pc.id) as collaborator_count
        FROM projects p
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.status = 'Active'
        WHERE p.creator_id = $1 ${isOwner ? '' : 'AND p.is_public = TRUE'}
        GROUP BY p.id
        ORDER BY p.created_at DESC`,
        [id]
    );

    return success(res, { projects: result.rows }, 'User projects retrieved');
}));

/**
 * GET /users/:id/collaborations
 * Get all projects user is collaborating on
 * Public endpoint
 */
router.get('/:id/collaborations', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
        `SELECT 
            p.id, p.title, p.description, p.status, p.creator_id,
            u.full_name as creator_name,
            pc.role, pc.joined_at
        FROM project_collaborators pc
        JOIN projects p ON pc.project_id = p.id
        LEFT JOIN users u ON p.creator_id = u.id
        WHERE pc.user_id = $1 AND pc.status = 'Active' AND p.is_public = TRUE
        ORDER BY pc.joined_at DESC`,
        [id]
    );

    return success(res, { collaborations: result.rows }, 'User collaborations retrieved');
}));

/**
 * POST /users/:id/connect
 * Send connection request to a user
 * REQUIRES: Authentication
 */
router.post('/:id/connect', authenticateUser, asyncHandler(async (req, res) => {
    const { id: recipientId } = req.params;
    const senderId = req.user.userId;
    const { message } = req.body;

    // Can't connect with yourself
    if (senderId === recipientId) {
        return error(res, 'You cannot connect with yourself', 400);
    }

    // Check if recipient exists
    const recipientCheck = await query(
        'SELECT id, full_name, email FROM users WHERE id = $1 AND is_active = TRUE',
        [recipientId]
    );

    if (!recipientCheck.rows.length) {
        return notFound(res, 'User');
    }

    const recipient = recipientCheck.rows[0];

    // Check if connection already exists
    const existingConnection = await query(
        'SELECT id, status FROM user_connections WHERE follower_id = $1 AND following_id = $2',
        [senderId, recipientId]
    );

    if (existingConnection.rows.length > 0) {
        return error(res, 'Connection request already exists', 400);
    }

    // Create connection request
    const result = await query(
        `INSERT INTO user_connections (follower_id, following_id, status, created_at, updated_at)
         VALUES ($1, $2, 'pending', NOW(), NOW())
         RETURNING id`,
        [senderId, recipientId]
    );

    const connectionId = result.rows[0].id;

    // Get sender details for notification
    const senderResult = await query(
        'SELECT full_name, username FROM users WHERE id = $1',
        [senderId]
    );

    const sender = senderResult.rows[0];
    const senderName = sender.full_name || sender.username;

    // Get Socket.IO instance for real-time notifications
    const io = socketManager.isInitialized() ? socketManager.getIO() : null;

    // Create notification via Socket.IO and database
    const notificationData = {
        recipient_id: recipientId,
        sender_id: senderId,
        type: 'connection_request',
        title: 'New Connection Request',
        message: `${senderName} wants to connect with you`,
        related_entity_id: connectionId,
        priority: 'medium'
    };

    // Send via Socket.IO for real-time delivery
    if (io) {
        await createNotificationAndEmit(io, notificationData);
    } else {
        // Fallback to database-only if Socket.IO not initialized
        const { supabase } = require('../database');
        await supabase
            .from('notifications')
            .insert({
                ...notificationData,
                is_read: false,
                created_at: new Date().toISOString()
            });
    }

    logger.info('Connection request sent', {
        connectionId,
        senderId,
        recipientId,
    });

    return success(res, { connectionId }, 'Connection request sent successfully', 201);
}));

/**
 * PATCH /users/connections/:connectionId
 * Accept or reject a connection request
 * REQUIRES: Authentication
 */
router.patch('/connections/:connectionId', authenticateUser, asyncHandler(async (req, res) => {
    const { connectionId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'
    const userId = req.user.userId;

    if (!['accept', 'reject'].includes(action)) {
        return error(res, 'Action must be "accept" or "reject"', 400);
    }

    // Get connection details
    const connResult = await query(
        'SELECT id, follower_id, following_id, status FROM user_connections WHERE id = $1',
        [connectionId]
    );

    if (!connResult.rows.length) {
        return notFound(res, 'Connection request');
    }

    const connection = connResult.rows[0];

    // Only the recipient can accept/reject
    if (connection.following_id !== userId) {
        return forbidden(res, 'You can only respond to connection requests sent to you');
    }

    if (connection.status !== 'pending') {
        return error(res, 'Connection request has already been processed', 400);
    }

    const newStatus = action === 'accept' ? 'active' : 'rejected';

    // Update connection status
    await query(
        'UPDATE user_connections SET status = $1, updated_at = NOW() WHERE id = $2',
        [newStatus, connectionId]
    );

    // Get Socket.IO instance for real-time notifications
    const io = socketManager.isInitialized() ? socketManager.getIO() : null;

    // Create notification for sender with Socket.IO
    const notificationMessage = action === 'accept'
        ? 'Your connection request was accepted!'
        : 'Your connection request was declined.';

    const notificationData = {
        recipient_id: connection.follower_id,
        sender_id: userId,
        type: 'connection_response',
        title: action === 'accept' ? 'Connection Accepted' : 'Connection Declined',
        message: notificationMessage,
        priority: 'medium'
    };

    // Send via Socket.IO for real-time delivery
    if (io) {
        await createNotificationAndEmit(io, notificationData);
    } else {
        // Fallback to database-only if Socket.IO not initialized
        const { supabase } = require('../database');
        await supabase
            .from('notifications')
            .insert({
                ...notificationData,
                is_read: false,
                created_at: new Date().toISOString()
            });
    }

    // Mark the original connection request notification as read
    const { supabase } = require('../database');
    await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('related_entity_id', connectionId)
        .eq('type', 'connection_request')
        .eq('recipient_id', userId);

    logger.info('Connection request processed', {
        connectionId,
        action,
        userId,
    });

    return success(res, null, `Connection request ${action}ed successfully`);
}));

/**
 * GET /users/:id/connections
 * Get user's connections
 * Public endpoint
 */
router.get('/:id/connections', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status = 'active' } = req.query;

    const result = await query(
        `SELECT 
            uc.id, uc.status, uc.created_at,
            u.id as user_id, u.full_name, u.username, u.profile_image_url,
            u.bio, u.university, u.major
        FROM user_connections uc
        JOIN users u ON (
            CASE 
                WHEN uc.follower_id = $1 THEN uc.following_id = u.id
                ELSE uc.follower_id = u.id
            END
        )
        WHERE (uc.follower_id = $1 OR uc.following_id = $1)
        ${status ? 'AND uc.status = $2' : ''}
        ORDER BY uc.created_at DESC`,
        status ? [id, status] : [id]
    );

    return success(res, { connections: result.rows }, 'Connections retrieved successfully');
}));

module.exports = router;
