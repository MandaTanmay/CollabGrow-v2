/**
 * Application Routes
 * Handles email-based application accept/decline actions
 */

const express = require('express');
const router = express.Router();
const { query } = require('../services/db');
const { supabase } = require('../database');
const { success, error, notFound } = require('../utils/responseFormatter');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * GET /api/applications/:applicationId/accept
 * Accept application via email link (no auth required)
 */
router.get('/:applicationId/accept', asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    const { token } = req.query;

    if (!token) {
        return res.status(400).send('Invalid request: Missing token');
    }

    try {
        // Decode token to verify owner
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [tokenAppId, ownerId] = decoded.split(':');

        if (tokenAppId !== applicationId) {
            return res.status(400).send('Invalid token');
        }

        // Get application details
        const appResult = await query(
            `SELECT cr.id, cr.project_id, cr.requester_id, cr.status, p.creator_id, p.title
             FROM collaboration_requests cr
             JOIN projects p ON p.id = cr.project_id
             WHERE cr.id = $1`,
            [applicationId]
        );

        if (!appResult.rows.length) {
            return res.status(404).send('Application not found');
        }

        const application = appResult.rows[0];

        // Verify the owner
        if (application.creator_id.toString() !== ownerId) {
            return res.status(403).send('Unauthorized: You are not the project owner');
        }

        if (application.status !== 'pending') {
            return res.status(400).send(`Application has already been ${application.status}`);
        }

        // Update application status
        await query(
            'UPDATE collaboration_requests SET status = $1, updated_at = NOW() WHERE id = $2',
            ['accepted', applicationId]
        );

        // Add user to project collaborators
        await query(
            `INSERT INTO project_collaborators (project_id, user_id, role, status, joined_at)
             VALUES ($1, $2, 'collaborator', 'Active', NOW())
             ON CONFLICT DO NOTHING`,
            [application.project_id, application.requester_id]
        );

            // Notification and email logic removed for application acceptance

        logger.info('Application accepted via email link', {
            applicationId,
            projectId: application.project_id,
            ownerId
        });

        // Redirect to project page with success message
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/projects/${application.project_id}?applicationAccepted=true`);

    } catch (err) {
        logger.error('Error accepting application via email', { 
            error: err.message,
            applicationId 
        });
        return res.status(500).send('An error occurred while processing the application');
    }
}));

/**
 * GET /api/applications/:applicationId/decline
 * Decline application via email link (no auth required)
 */
router.get('/:applicationId/decline', asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    const { token } = req.query;

    if (!token) {
        return res.status(400).send('Invalid request: Missing token');
    }

    try {
        // Decode token to verify owner
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [tokenAppId, ownerId] = decoded.split(':');

        if (tokenAppId !== applicationId) {
            return res.status(400).send('Invalid token');
        }

        // Get application details
        const appResult = await query(
            `SELECT cr.id, cr.project_id, cr.requester_id, cr.status, p.creator_id, p.title
             FROM collaboration_requests cr
             JOIN projects p ON p.id = cr.project_id
             WHERE cr.id = $1`,
            [applicationId]
        );

        if (!appResult.rows.length) {
            return res.status(404).send('Application not found');
        }

        const application = appResult.rows[0];

        // Verify the owner
        if (application.creator_id.toString() !== ownerId) {
            return res.status(403).send('Unauthorized: You are not the project owner');
        }

        if (application.status !== 'pending') {
            return res.status(400).send(`Application has already been ${application.status}`);
        }

        // Update application status
        await query(
            'UPDATE collaboration_requests SET status = $1, updated_at = NOW() WHERE id = $2',
            ['rejected', applicationId]
        );

        // Get user details for notification and email
        const userResult = await query(
            'SELECT full_name, username, email FROM users WHERE id = $1',
            [application.requester_id]
        );

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            const displayName = user.full_name || user.username || 'User';

            // Mark the original application notification as read for the project owner
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('related_entity_id', applicationId)
                .eq('type', 'project_application')
                .eq('recipient_id', application.creator_id);

            // Create notification
            await supabase
                .from('notifications')
                .insert({
                    recipient_id: application.requester_id,
                    sender_id: application.creator_id,
                    type: 'application_response',
                    message: 'Your application was not accepted at this time.',
                    related_project_id: application.project_id,
                    is_read: false,
                    created_at: new Date().toISOString()
                });

            // Email sending removed - notifications are sent via the notification system
        }

        logger.info('Application declined via email link', {
            applicationId,
            projectId: application.project_id,
            ownerId
        });

        // Redirect to project page with info message
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/projects/${application.project_id}?applicationDeclined=true`);

    } catch (err) {
        logger.error('Error declining application via email', { 
            error: err.message,
            applicationId 
        });
        return res.status(500).send('An error occurred while processing the application');
    }
}));

module.exports = router;
