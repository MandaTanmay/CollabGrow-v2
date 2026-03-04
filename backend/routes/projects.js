const express = require('express');
const router = express.Router();
const { query } = require('../services/db');
const { authenticateUser } = require('../middleware/jwtAuth');
const socketManager = require('../services/socketManager');
const { completeProject } = require('../services/projectService');
const { createNotificationAndEmit } = require('../services/notificationService');

const { requireProjectOwner, requireProjectAccess } = require('../middleware/authorization');

const { success, error, forbidden, notFound } = require('../utils/responseFormatter');
const { projectSchemas, validateRequest } = require('../utils/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/** 
 * Project Routes
 * POST /projects/:id/interaction
 * Record a user interaction with a project (like, collaborate, view, apply, comment, bookmark)
 * REQUIRES: Authentication
 * Body: { action: 'like'|'collaborate'|'view'|'apply'|'comment'|'bookmark', message?: string }
 */
router.post('/:id/interaction', authenticateUser, asyncHandler(async (req, res) => {
    const { id: projectId } = req.params;
    const { action, message } = req.body;
    const userId = req.user.userId;
    const validActions = ['like', 'collaborate', 'view', 'apply', 'comment', 'bookmark'];
    if (!validActions.includes(action)) {
        return error(res, 'Invalid interaction action', 400);
    }
    // Insert interaction into project_interactions table
    await query(
        'INSERT INTO project_interactions (user_id, project_id, action, message, created_at) VALUES ($1, $2, $3, $4, NOW())',
        [userId, projectId, action, message || null]
    );
    logger.info('Project interaction recorded', { userId, projectId, action });
    return success(res, null, 'Interaction recorded');
}));

/**
 * GET /projects
 * List all projects with optional filters
 * Public endpoint (no auth required)
 */
router.get('/', asyncHandler(async (req, res) => {
    const { status, difficulty, limit = 20, offset = 0, search } = req.query;

    let queryText = `
        SELECT 
            p.*,
            u.full_name as creator_name,
            u.profile_image_url as creator_image,
            COUNT(DISTINCT pc.id) as collaborator_count,
            COUNT(DISTINCT ps.id) as skill_count
        FROM projects p
        LEFT JOIN users u ON p.creator_id = u.id
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.status = 'Active'
        LEFT JOIN project_skills ps ON p.id = ps.project_id
        WHERE p.is_public = TRUE
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
        queryText += ` AND p.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }

    if (difficulty) {
        queryText += ` AND p.difficulty_level = $${paramIndex}`;
        params.push(difficulty);
        paramIndex++;
    }

    if (search) {
        queryText += ` AND (p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    queryText += ` 
        GROUP BY p.id, u.full_name, u.profile_image_url
        ORDER BY p.created_at DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    return success(res, {
        projects: result.rows,
        total: result.rows.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
    }, 'Projects retrieved successfully');
}));

/**
 * GET /projects/my-applications
 * Get all applications submitted by the current user
 */
router.get('/my-applications', authenticateUser, asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    const result = await query(
        `SELECT project_id, status 
         FROM collaboration_requests 
         WHERE requester_id = $1`,
        [userId]
    );

    return success(res, result.rows, 'User applications retrieved successfully');
}));

/**
 * GET /projects/:id
 * Get single project by ID with full details
 * Public endpoint, but shows more details if user is owner/collaborator
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    const result = await query(
        `SELECT 
            p.*,
            u.id as creator_id,
            u.full_name as creator_name,
            u.username as creator_username,
            u.profile_image_url as creator_image,
            COUNT(DISTINCT pc.id) as collaborator_count
        FROM projects p
        LEFT JOIN users u ON p.creator_id = u.id
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.status = 'Active'
        WHERE p.id = $1
        GROUP BY p.id, u.id, u.full_name, u.username, u.profile_image_url`,
        [id]
    );

    if (!result.rows.length) {
        return notFound(res, 'Project');
    }

    const project = result.rows[0];

    // Check if user has access (owner or collaborator)
    let userRole = null;
    if (userId) {
        if (project.creator_id === userId) {
            userRole = 'owner';
        } else {
            const collabCheck = await query(
                'SELECT role FROM project_collaborators WHERE project_id = $1 AND user_id = $2 AND status = $3',
                [id, userId, 'Active']
            );
            if (collabCheck.rows.length > 0) {
                userRole = collabCheck.rows[0].role || 'collaborator';
            }
        }
    }

    // Get project skills
    const skillsResult = await query(
        `SELECT s.id, s.name, s.category 
         FROM skills s
         JOIN project_skills ps ON s.id = ps.skill_id
         WHERE ps.project_id = $1`,
        [id]
    );

    // Get collaborators (only if user has access or project is public)
    let collaborators = [];
    if (userRole || project.is_public) {
        const collabResult = await query(
            `SELECT 
                u.id, u.full_name, u.username, u.profile_image_url, 
                pc.role, pc.joined_at
             FROM project_collaborators pc
             JOIN users u ON pc.user_id = u.id
             WHERE pc.project_id = $1 AND pc.status = 'Active'
             ORDER BY pc.joined_at ASC`,
            [id]
        );
        collaborators = collabResult.rows;
    }

    return success(res, {
        project: {
            ...project,
            skills: skillsResult.rows,
            collaborators,
            userRole,
        }
    }, 'Project details retrieved');
}));

/**
 * POST /projects
 * Create new project
 * REQUIRES: Authentication
 */
router.post('/', authenticateUser, validateRequest(projectSchemas.create), asyncHandler(async (req, res) => {
    const {
        title, description, detailed_description, category,
        status, difficulty_level, estimated_duration, max_collaborators,
        project_type, repository_url, demo_url, is_featured,
        is_public, is_remote, location, required_skills
    } = req.body;

    const creatorId = req.user.userId;

    // Insert project
    const result = await query(
        `INSERT INTO projects (
            title, description, detailed_description, category, creator_id,
            status, difficulty_level, estimated_duration, max_collaborators,
            project_type, repository_url, demo_url, is_featured, is_public,
            is_remote, location, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
        RETURNING *`,
        [
            title, description, detailed_description, category, creatorId,
            status || 'recruiting', difficulty_level, estimated_duration, max_collaborators || 5,
            project_type || 'web', repository_url, demo_url, is_featured || false,
            is_public !== false, is_remote !== false, location
        ]
    );

    const project = result.rows[0];

    // Add required skills
    if (Array.isArray(required_skills) && required_skills.length > 0) {
        for (const skillName of required_skills) {
            // Find or create skill
            let skillResult = await query('SELECT id FROM skills WHERE LOWER(name) = LOWER($1)', [skillName]);
            let skillId;

            if (skillResult.rows.length > 0) {
                skillId = skillResult.rows[0].id;
            } else {
                const insertSkill = await query(
                    'INSERT INTO skills (name, category) VALUES ($1, $2) RETURNING id',
                    [skillName, 'general']
                );
                skillId = insertSkill.rows[0].id;
            }

            // Link skill to project
            await query(
                'INSERT INTO project_skills (project_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [project.id, skillId]
            );
        }
    }

    logger.info('Project created', {
        projectId: project.id,
        userId: creatorId,
        title,
    });

    return success(res, { project }, 'Project created successfully', 201);
}));

/**
 * PATCH /projects/:id
 * Update project details
 * REQUIRES: Project ownership
 */
router.patch('/:id', authenticateUser, requireProjectOwner, validateRequest(projectSchemas.update), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        title, description, detailed_description, status,
        difficulty_level, estimated_duration, max_collaborators,
        repository_url, demo_url, is_public, is_remote, location
    } = req.body;

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined) {
        updates.push(`title = $${paramIndex}`);
        params.push(title);
        paramIndex++;
    }
    if (description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        params.push(description);
        paramIndex++;
    }
    if (detailed_description !== undefined) {
        updates.push(`detailed_description = $${paramIndex}`);
        params.push(detailed_description);
        paramIndex++;
    }
    if (status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
    }
    if (difficulty_level !== undefined) {
        updates.push(`difficulty_level = $${paramIndex}`);
        params.push(difficulty_level);
        paramIndex++;
    }
    if (estimated_duration !== undefined) {
        updates.push(`estimated_duration = $${paramIndex}`);
        params.push(estimated_duration);
        paramIndex++;
    }
    if (max_collaborators !== undefined) {
        updates.push(`max_collaborators = $${paramIndex}`);
        params.push(max_collaborators);
        paramIndex++;
    }
    if (repository_url !== undefined) {
        updates.push(`repository_url = $${paramIndex}`);
        params.push(repository_url);
        paramIndex++;
    }
    if (demo_url !== undefined) {
        updates.push(`demo_url = $${paramIndex}`);
        params.push(demo_url);
        paramIndex++;
    }
    if (is_public !== undefined) {
        updates.push(`is_public = $${paramIndex}`);
        params.push(is_public);
        paramIndex++;
    }
    if (is_remote !== undefined) {
        updates.push(`is_remote = $${paramIndex}`);
        params.push(is_remote);
        paramIndex++;
    }
    if (location !== undefined) {
        updates.push(`location = $${paramIndex}`);
        params.push(location);
        paramIndex++;
    }

    if (updates.length === 0) {
        return error(res, 'No fields to update', 400);
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const result = await query(
        `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
    );

    logger.info('Project updated', {
        projectId: id,
        userId: req.user.userId,
        updates: Object.keys(req.body),
    });

    return success(res, { project: result.rows[0] }, 'Project updated successfully');
}));

/**
 * DELETE /projects/:id
 * Soft delete project (marks as archived)
 * REQUIRES: Project ownership
 */
router.delete('/:id', authenticateUser, requireProjectOwner, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Soft delete by setting status to 'archived'
    await query(
        `UPDATE projects SET status = 'archived', updated_at = NOW() WHERE id = $1`,
        [id]
    );

    logger.info('Project deleted (soft)', {
        projectId: id,
        userId: req.user.userId,
    });

    return success(res, null, 'Project deleted successfully');
}));

/**
 * POST /projects/:id/apply
 * Apply to join a project
 * REQUIRES: Authentication
 */
router.post('/:id/apply', authenticateUser, validateRequest(projectSchemas.apply), asyncHandler(async (req, res) => {
    const { id: projectId } = req.params;
    const { message } = req.body;
    const userId = req.user.userId;

    logger.info('Project application attempt', {
        projectId,
        userId,
        messageLength: message?.length || 0,
    });

    // Check if project exists and is accepting applications
    const projectCheck = await query(
        'SELECT id, creator_id, status, title FROM projects WHERE id = $1',
        [projectId]
    );

    if (!projectCheck.rows.length) {
        logger.warn('Project not found for application', { projectId });
        return notFound(res, 'Project');
    }

    const project = projectCheck.rows[0];

    // Can't apply to own project
    if (project.creator_id === userId) {
        logger.warn('User attempted to apply to own project', { projectId, userId });
        return error(res, 'You cannot apply to your own project', 400);
    }

    // Can't apply if project is not recruiting
    if (project.status !== 'recruiting') {
        logger.warn('Application attempt to non-recruiting project', {
            projectId,
            userId,
            currentStatus: project.status,
        });
        return error(res, `This project is not currently accepting applications (status: ${project.status})`, 400);
    }

    // Check if already applied
    const existingApp = await query(
        'SELECT id, status FROM collaboration_requests WHERE project_id = $1 AND requester_id = $2',
        [projectId, userId]
    );

    if (existingApp.rows.length > 0) {
        const appStatus = existingApp.rows[0].status;
        logger.info('Existing application found', {
            projectId,
            userId,
            applicationId: existingApp.rows[0].id,
            status: appStatus,
        });

        if (appStatus === 'pending') {
            logger.warn('Duplicate apply attempt while pending', { projectId, userId, applicationId: existingApp.rows[0].id });
            return error(res, 'You have already applied to this project. Please wait for the owner to review your application.', 400);
        } else if (appStatus === 'accepted') {
            logger.warn('Duplicate apply attempt while already accepted', { projectId, userId, applicationId: existingApp.rows[0].id });
            return error(res, 'You are already a collaborator on this project', 400);
        } else {
            // Rejected - allow reapplication by updating existing record
            logger.info('Updating rejected application to pending', {
                projectId,
                userId,
                applicationId: existingApp.rows[0].id,
            });
            await query(
                `UPDATE collaboration_requests 
                 SET status = 'pending', message = $1, updated_at = NOW() 
                 WHERE id = $2`,
                [message, existingApp.rows[0].id]
            );

            // Send notification for re-submitted application
            if (io) {
                await createNotificationAndEmit(io, {
                    recipient_id: project.creator_id,
                    sender_id: userId,
                    type: 'project_application',
                    title: `New Application to ${project.title}`,
                    message: `${applicantName} has resubmitted their application to join your project.`,
                    related_project_id: projectId,
                    related_entity_id: existingApp.rows[0].id,
                    priority: 'high'
                });
            }

            logger.info('Project application re-submitted', {
                projectId,
                userId,
                applicationId: existingApp.rows[0].id,
            });

            return success(res, { applicationId: existingApp.rows[0].id }, 'Application resubmitted successfully');
        }
    }

    // Create new application
    const result = await query(
        `INSERT INTO collaboration_requests (project_id, requester_id, message, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'pending', NOW(), NOW())
         RETURNING id`,
        [projectId, userId, message || null]
    );

    const applicationId = result.rows[0].id;

    // Fetch applicant's name and project owner for notification
    const applicantResult = await query(
        'SELECT full_name, username, email FROM users WHERE id = $1',
        [userId]
    );

    let applicantName = 'Someone';
    if (applicantResult.rows && applicantResult.rows.length > 0) {
        const a = applicantResult.rows[0];
        applicantName = a.full_name || a.username || a.email || 'Someone';
    }

    // Get Socket.IO instance for real-time notifications
    const io = socketManager.isInitialized() ? socketManager.getIO() : null;

    // Send notification to project owner
    if (io) {
        await createNotificationAndEmit(io, {
            recipient_id: project.creator_id,
            sender_id: userId,
            type: 'project_application',
            title: `New Application to ${project.title}`,
            message: `${applicantName} has applied to join your project.`,
            related_project_id: projectId,
            related_entity_id: applicationId,
            priority: 'high'
        });
    }

    logger.info('Project application submitted', {
        projectId,
        userId,
        applicationId,
    });

    return success(res, { applicationId }, 'Application submitted successfully! The project owner will be notified.', 201);
}));

/**
 * GET /projects/:id/applications
 * Get all applications for a project
 * REQUIRES: Project ownership
 */
router.get('/:id/applications', authenticateUser, requireProjectOwner, asyncHandler(async (req, res) => {
    const { id: projectId } = req.params;

    const result = await query(
        `SELECT 
            cr.id, cr.message, cr.status, cr.created_at, cr.updated_at,
            u.id as applicant_id, u.full_name as applicant_name, 
            u.username as applicant_username, u.profile_image_url as applicant_image,
            u.bio as applicant_bio, u.university as applicant_university,
            u.skills as applicant_skills
         FROM collaboration_requests cr
         JOIN users u ON cr.requester_id = u.id
         WHERE cr.project_id = $1
         ORDER BY 
            CASE cr.status 
                WHEN 'pending' THEN 1
                WHEN 'accepted' THEN 2
                WHEN 'rejected' THEN 3
            END,
            cr.created_at DESC`,
        [projectId]
    );

    return success(res, { applications: result.rows }, 'Applications retrieved successfully');
}));

/**
 * PATCH /projects/:id/applications/:applicationId
 * Accept or reject an application
 * REQUIRES: Project ownership
 */
router.patch('/:id/applications/:applicationId', authenticateUser, requireProjectOwner, asyncHandler(async (req, res) => {
    const { id: projectId, applicationId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
        return error(res, 'Action must be "accept" or "reject"', 400);
    }

    // Get application details with project title
    const appResult = await query(
        `SELECT cr.id, cr.project_id, cr.requester_id, cr.status, p.title, p.creator_id 
         FROM collaboration_requests cr 
         JOIN projects p ON p.id = cr.project_id 
         WHERE cr.id = $1 AND cr.project_id = $2`,
        [applicationId, projectId]
    );

    if (!appResult.rows.length) {
        return notFound(res, 'Application');
    }

    const application = appResult.rows[0];

    // Idempotency: if client retries or user double-clicks, don't error
    if (application.status !== 'pending') {
        if (application.status === 'accepted' && action === 'accept') {
            return success(res, null, 'Application already accepted', 200);
        }
        if (application.status === 'rejected' && action === 'reject') {
            return success(res, null, 'Application already rejected', 200);
        }
        return error(res, 'Application has already been processed', 400);
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    // Update application status
    await query(
        'UPDATE collaboration_requests SET status = $1, updated_at = NOW() WHERE id = $2',
        [newStatus, applicationId]
    );

    // Mark the original notification as read for the project owner
    await query(
        `UPDATE notifications SET is_read = TRUE 
         WHERE type = 'project_application' AND related_entity_id = $1 AND recipient_id = $2`,
        [applicationId, req.user.userId]
    );

    // Get Socket.IO instance for real-time notifications
    const io = socketManager.isInitialized() ? socketManager.getIO() : null;

    // If accepted, add user to project collaborators
    if (action === 'accept') {
        // Add user to project_collaborators with 'Active' status
        // This grants them access to:
        // - View and send chat messages
        // - View and create tasks/milestones
        // - View and upload files/resources
        // - All existing workspace content
        // The collaborators_count is automatically updated via database trigger
        await query(
            `INSERT INTO project_collaborators (project_id, user_id, role, status, joined_at)
             VALUES ($1, $2, 'collaborator', 'Active', NOW())
             ON CONFLICT DO NOTHING`,
            [projectId, application.requester_id]
        );

        // Get user details for the join message
        const userResult = await query(
            'SELECT full_name, username, email FROM users WHERE id = $1',
            [application.requester_id]
        );

        if (userResult.rows.length > 0) {
            const newMember = userResult.rows[0];
            const displayName = newMember.full_name || newMember.username || 'New member';

            // Send a system message to the project workspace chat
            const systemMessage = {
                project_id: projectId,
                user_id: null, // System message
                user_name: 'System',
                user_logo: null,
                content: `🎉 ${displayName} has joined the project!`,
                timestamp: new Date().toISOString(),
                is_system: true
            };

            // Save system message to database
            const msgResult = await query(
                `INSERT INTO project_chat_messages 
                 (project_id, user_id, user_name, user_logo, content, timestamp, is_system)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id, project_id as "roomId", user_id as "userId", 
                           user_name as "userName", user_logo as "userLogo", 
                           content, timestamp, is_system as "isSystem"`,
                [systemMessage.project_id, systemMessage.user_id, systemMessage.user_name,
                systemMessage.user_logo, systemMessage.content, systemMessage.timestamp, true]
            );

            // Broadcast to all users in the project workspace via Socket.IO
            if (io) {
                io.to(projectId).emit('chatMessage', msgResult.rows[0]);
            }
        }

        // Send acceptance notification to applicant via Socket.IO
        if (io) {
            await createNotificationAndEmit(io, {
                recipient_id: application.requester_id,
                sender_id: application.creator_id,
                type: 'application_accepted',
                title: `Application Accepted`,
                message: `Your application to ${application.title} has been accepted!`,
                related_project_id: projectId,
                related_entity_id: applicationId,
                priority: 'high'
            });

            // Emit event to increment active_projects count for the new collaborator
            io.to(`user:${application.requester_id}`).emit('userJoinedProject', {
                projectId,
                projectTitle: application.title,
                userId: application.requester_id
            });
        }

        logger.info('Application accepted', {
            projectId,
            applicationId,
            applicantId: application.requester_id,
        });
    } else {
        // Send rejection notification to applicant via Socket.IO
        if (io) {
            await createNotificationAndEmit(io, {
                recipient_id: application.requester_id,
                sender_id: application.creator_id,
                type: 'application_rejected',
                title: `Application Status Update`,
                message: `Your application to ${application.title} was not accepted at this time.`,
                related_project_id: projectId,
                related_entity_id: applicationId,
                priority: 'medium'
            });
        }

        logger.info('Application rejected', {
            projectId,
            applicationId,
            applicantId: application.requester_id,
        });
    }

    return success(res, null, `Application ${action}ed successfully`);
}));

/**
 * POST /projects/:id/view
 * Increment project view count
 * Public endpoint (no auth required)
 */
router.post('/:id/view', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
        'UPDATE projects SET views_count = views_count + 1 WHERE id = $1 RETURNING views_count',
        [id]
    );

    if (!result.rows.length) {
        return notFound(res, 'Project');
    }

    return success(res, { views: result.rows[0].views_count }, 'View count updated');
}));

/**
 * POST /projects/:id/complete
 * Mark a project as complete
 * REQUIRES: Authentication and Project ownership
 * Body: { user_id: string (firebase_uid) }
 */
router.post('/:id/complete', authenticateUser, requireProjectOwner, asyncHandler(async (req, res) => {
    const { id: projectId } = req.params;
    const { user_id } = req.body;
    
    if (!user_id) {
        return error(res, 'user_id is required', 400);
    }

    // Get the database user ID from firebase UID
    const userResult = await query(
        'SELECT id FROM users WHERE firebase_uid = $1',
        [user_id]
    );

    if (!userResult.rows.length) {
        return error(res, 'User not found', 404);
    }

    const dbUserId = userResult.rows[0].id;

    try {
        const completedProject = await completeProject({
            project_id: projectId,
            user_id: dbUserId
        });

        // Get project title for notification
        const projectTitle = completedProject.title || 'Your project';

        // Get all collaborators of the project to notify them
        const collaboratorsResult = await query(
            `SELECT DISTINCT user_id FROM project_collaborators 
             WHERE project_id = $1 AND status = 'Active' AND user_id != $2`,
            [projectId, dbUserId]
        );

        // Get Socket.IO instance for real-time notifications
        const io = socketManager.isInitialized() ? socketManager.getIO() : null;

        // Notify each collaborator about project completion
        if (collaboratorsResult.rows.length > 0 && io) {
            for (const collaborator of collaboratorsResult.rows) {
                // Send notification
                await createNotificationAndEmit(io, {
                    recipient_id: collaborator.user_id,
                    sender_id: dbUserId,
                    type: 'project_completed',
                    title: 'Project Completed',
                    message: `${projectTitle} has been marked as completed by the project owner.`,
                    related_project_id: projectId,
                    priority: 'high'
                });

                // Broadcast projectCompleted event to the user's personal room (for stats update)
                io.to(`user:${collaborator.user_id}`).emit('projectCompleted', {
                    projectId,
                    status: 'completed',
                    completedAt: new Date().toISOString()
                });
            }
        }

        // Broadcast project completion event to all users in the project room (real-time dashboard update)
        if (io) {
            io.to(projectId).emit('projectCompleted', {
                projectId,
                status: 'completed',
                completedAt: new Date().toISOString()
            });
        }

        logger.info('Project completed and members notified', { 
            projectId, 
            userId: dbUserId,
            collaboratorsNotified: collaboratorsResult.rows.length
        });
        
        return success(res, completedProject, 'Project marked as complete and members notified');
    } catch (err) {
        logger.error('Error completing project', { projectId, userId: dbUserId, error: err.message });
        return error(res, err.message, 400);
    }
}));

module.exports = router;
