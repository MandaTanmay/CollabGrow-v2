/**
 * Project Updates Routes
 * Handles CRUD operations for project updates/announcements
 */

const express = require('express');
const router = express.Router();
const { query } = require('../services/db');
const { authenticateToken } = require('../middleware/sessionAuth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * GET /api/queries/project/:projectId/updates
 * Get all updates for a project
 */
router.get('/project/:projectId/updates', authenticateToken, asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Verify user is a member of the project
    const memberCheck = await query(
        `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2
         UNION
         SELECT 1 FROM projects WHERE id = $1 AND creator_id = $2`,
        [projectId, userId]
    );

    if (memberCheck.rows.length === 0) {
        return res.status(403).json({ 
            success: false, 
            error: 'You must be a project member to view updates' 
        });
    }

    // Get all updates for the project with author information
    const result = await query(
        `SELECT 
            pu.id,
            pu.project_id,
            pu.title,
            pu.content,
            pu.created_at,
            pu.updated_at,
            u.id as author_id,
            u.full_name as author_name,
            u.profile_image as author_image
         FROM project_updates pu
         JOIN users u ON pu.author_id = u.id
         WHERE pu.project_id = $1
         ORDER BY pu.created_at DESC`,
        [projectId]
    );

    res.json({
        success: true,
        updates: result.rows
    });
}));

/**
 * POST /api/queries/project/:projectId/updates
 * Create a new update
 */
router.post('/project/:projectId/updates', authenticateToken, asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!title || !content) {
        return res.status(400).json({ 
            success: false, 
            error: 'Title and content are required' 
        });
    }

    if (title.length > 255) {
        return res.status(400).json({ 
            success: false, 
            error: 'Title must be 255 characters or less' 
        });
    }

    // Verify user is a member of the project
    const memberCheck = await query(
        `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2
         UNION
         SELECT 1 FROM projects WHERE id = $1 AND creator_id = $2`,
        [projectId, userId]
    );

    if (memberCheck.rows.length === 0) {
        return res.status(403).json({ 
            success: false, 
            error: 'You must be a project member to post updates' 
        });
    }

    // Create the update
    const result = await query(
        `INSERT INTO project_updates (project_id, author_id, title, content)
         VALUES ($1, $2, $3, $4)
         RETURNING id, project_id, author_id, title, content, created_at, updated_at`,
        [projectId, userId, title, content]
    );

    // Get author information
    const userResult = await query(
        'SELECT id, full_name, profile_image FROM users WHERE id = $1',
        [userId]
    );

    const update = {
        ...result.rows[0],
        author_name: userResult.rows[0].full_name,
        author_image: userResult.rows[0].profile_image
    };

    res.status(201).json({
        success: true,
        update
    });
}));

/**
 * PUT /api/queries/project/:projectId/updates/:updateId
 * Update an existing update (author only)
 */
router.put('/project/:projectId/updates/:updateId', authenticateToken, asyncHandler(async (req, res) => {
    const { projectId, updateId } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!title || !content) {
        return res.status(400).json({ 
            success: false, 
            error: 'Title and content are required' 
        });
    }

    if (title.length > 255) {
        return res.status(400).json({ 
            success: false, 
            error: 'Title must be 255 characters or less' 
        });
    }

    // Verify user is the author of the update
    const updateCheck = await query(
        'SELECT author_id FROM project_updates WHERE id = $1 AND project_id = $2',
        [updateId, projectId]
    );

    if (updateCheck.rows.length === 0) {
        return res.status(404).json({ 
            success: false, 
            error: 'Update not found' 
        });
    }

    if (updateCheck.rows[0].author_id !== userId) {
        return res.status(403).json({ 
            success: false, 
            error: 'You can only edit your own updates' 
        });
    }

    // Update the update
    const result = await query(
        `UPDATE project_updates 
         SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND project_id = $4
         RETURNING id, project_id, author_id, title, content, created_at, updated_at`,
        [title, content, updateId, projectId]
    );

    // Get author information
    const userResult = await query(
        'SELECT id, full_name, profile_image FROM users WHERE id = $1',
        [userId]
    );

    const update = {
        ...result.rows[0],
        author_name: userResult.rows[0].full_name,
        author_image: userResult.rows[0].profile_image
    };

    res.json({
        success: true,
        update
    });
}));

/**
 * DELETE /api/queries/project/:projectId/updates/:updateId
 * Delete an update (author only)
 */
router.delete('/project/:projectId/updates/:updateId', authenticateToken, asyncHandler(async (req, res) => {
    const { projectId, updateId } = req.params;
    const userId = req.user.id;

    // Verify user is the author of the update
    const updateCheck = await query(
        'SELECT author_id FROM project_updates WHERE id = $1 AND project_id = $2',
        [updateId, projectId]
    );

    if (updateCheck.rows.length === 0) {
        return res.status(404).json({ 
            success: false, 
            error: 'Update not found' 
        });
    }

    if (updateCheck.rows[0].author_id !== userId) {
        return res.status(403).json({ 
            success: false, 
            error: 'You can only delete your own updates' 
        });
    }

    // Delete the update
    await query(
        'DELETE FROM project_updates WHERE id = $1 AND project_id = $2',
        [updateId, projectId]
    );

    res.json({
        success: true,
        message: 'Update deleted successfully'
    });
}));

module.exports = router;
