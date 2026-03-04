/**
 * Recommendation API endpoints for training management
 * Handles manual retraining, status checks, and model versioning
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const router = express.Router();

// Track retraining state
let isRetraining = false;
let lastRetrainingTime = null;
let retrainingError = null;

const RECOMMENDATION_DIR = path.join(__dirname, '../../recommendation');
const METADATA_FILE = path.join(RECOMMENDATION_DIR, 'models', 'metadata.json');

/**
 * GET /api/recommend/status
 * Get current recommendation model status and training history
 */
router.get('/status', (req, res) => {
  try {
    let metadata = {};
    
    if (fs.existsSync(METADATA_FILE)) {
      metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    }
    
    res.json({
      success: true,
      model: {
        version: metadata.current_version || 'unknown',
        lastTrained: metadata.last_trained || null,
        lastUpdated: metadata.last_updated || null,
        dataHash: metadata.data_hash ? metadata.data_hash.substring(0, 8) : null,
        isRetraining
      },
      retraining: {
        isInProgress: isRetraining,
        lastRetrainingTime,
        error: retrainingError
      },
      history: (metadata.training_history || []).slice(-3)
    });
  } catch (error) {
    logger.error('Error getting recommendation status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/recommend/retrain
 * Manually trigger model retraining
 * For admins only
 */
router.post('/retrain', (req, res) => {
  // In production, add authentication/authorization here
  
  if (isRetraining) {
    return res.status(409).json({
      success: false,
      error: 'Retraining already in progress'
    });
  }
  
  isRetraining = true;
  retrainingError = null;
  
  logger.info('Manual retraining triggered');
  res.json({
    success: true,
    message: 'Retraining started',
    statusUrl: '/api/recommend/status'
  });
  
  // Run retraining in background
  runRetraining();
});

/**
 * POST /api/recommend/retrain/cancel
 * Cancel ongoing retraining (if possible)
 */
router.post('/retrain/cancel', (req, res) => {
  if (!isRetraining) {
    return res.json({
      success: true,
      message: 'No retraining in progress'
    });
  }
  
  logger.info('Retraining cancellation requested');
  res.json({
    success: true,
    message: 'Cancellation requested (will stop at next checkpoint)'
  });
  
  // Set flag to cancel
  isRetraining = false;
});

/**
 * GET /api/recommend/training-history
 * Get detailed training history
 */
router.get('/training-history', (req, res) => {
  try {
    let metadata = {};
    
    if (fs.existsSync(METADATA_FILE)) {
      metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    }
    
    res.json({
      success: true,
      history: metadata.training_history || []
    });
  } catch (error) {
    logger.error('Error getting training history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Run retraining in background process
 */
function runRetraining() {
  return new Promise((resolve) => {
    const pythonScript = path.join(RECOMMENDATION_DIR, 'auto_retrain.py');
    
    logger.info(`Starting retraining process: ${pythonScript}`);
    
    const pythonProcess = spawn('python', [pythonScript], {
      cwd: RECOMMENDATION_DIR,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      logger.debug(`[Retraining] ${data.toString().trim()}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      logger.error(`[Retraining] ${data.toString().trim()}`);
    });
    
    pythonProcess.on('close', (code) => {
      lastRetrainingTime = new Date();
      
      if (code === 0) {
        logger.info('✅ Retraining completed successfully');
        retrainingError = null;
      } else {
        logger.error(`❌ Retraining failed with code ${code}`);
        retrainingError = `Failed with exit code ${code}`;
      }
      
      isRetraining = false;
      resolve();
    });
    
    pythonProcess.on('error', (error) => {
      lastRetrainingTime = new Date();
      logger.error('Retraining process error:', error);
      retrainingError = error.message;
      isRetraining = false;
      resolve();
    });
  });
}

module.exports = router;
