const express = require('express');
const router = express.Router();
const { query } = require('../services/db');

// GET /api/collaborators - return all users as collaborators (basic version)
router.get('/', async (req, res) => {
    try {
        const result = await query('SELECT id, full_name, username, bio, university, major, skills, profile_image_url FROM users WHERE is_active = TRUE');
        res.json(result.rows);
    } catch (error) {
        console.error('[API] Failed to fetch collaborators:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch collaborators' });
    }
});

module.exports = router;
