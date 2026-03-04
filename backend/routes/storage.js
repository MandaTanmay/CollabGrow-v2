const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const logger = require('../utils/logger');

// GET /api/storage-setup - Check if storage bucket exists and create if needed
router.get('/', async (req, res) => {
    try {
        const bucketName = 'project-resources';
        
        // Check if bucket exists
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
            logger.error('Error listing buckets:', listError);
            return res.status(500).json({ 
                error: 'Failed to check storage buckets',
                details: listError.message 
            });
        }

        const bucketExists = buckets?.some(b => b.name === bucketName);

        if (bucketExists) {
            return res.json({ 
                success: true, 
                message: 'Storage bucket already exists',
                bucket: bucketName 
            });
        }

        // Create the bucket
        const { data: newBucket, error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: ['image/*', 'application/pdf', 'text/*', 'application/*']
        });

        if (createError) {
            logger.error('Error creating bucket:', createError);
            return res.status(500).json({ 
                error: 'Failed to create storage bucket',
                details: createError.message 
            });
        }

        logger.info(`Storage bucket '${bucketName}' created successfully`);
        return res.json({ 
            success: true, 
            message: 'Storage bucket created successfully',
            bucket: bucketName 
        });
    } catch (error) {
        logger.error('Storage setup error:', error);
        return res.status(500).json({ 
            error: 'Storage setup failed',
            details: error.message 
        });
    }
});

module.exports = router;
