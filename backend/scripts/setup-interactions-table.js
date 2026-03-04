#!/usr/bin/env node
/**
 * Create and populate project_interactions table
 * This script creates the interactions table and populates it with data from existing tables
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Simple logger
const logger = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
};

// Create pool for this script
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createInteractionsTable() {
  const client = await pool.connect();
  
  try {
    logger.info('====================================================');
    logger.info('Creating project_interactions table...');
    logger.info('====================================================\n');
    
    // 1. Create table structure
    logger.info('Step 1: Creating table structure...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_interactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          action VARCHAR(50) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, project_id, action)
      )
    `);
    logger.info('  ✓ Table created\n');
    
    // 2. Create indexes
    logger.info('Step 2: Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_project_interactions_user_id ON project_interactions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_project_interactions_project_id ON project_interactions(project_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_project_interactions_created_at ON project_interactions(created_at)');
    logger.info('  ✓ Indexes created\n');
    
    // 3. Populate from activities (views)
    logger.info('Step 3: Populating data from existing tables...');
    
    try {
      const viewsInsert = await client.query(`
        INSERT INTO project_interactions (user_id, project_id, action, created_at)
        SELECT DISTINCT 
            user_id, 
            project_id, 
            'view' as action,
            COALESCE(created_at, NOW())
        FROM activities
        WHERE action_type = 'view' AND project_id IS NOT NULL AND user_id IS NOT NULL
        ON CONFLICT DO NOTHING
      `);
      logger.info(`  ✓ Inserted ${viewsInsert.rowCount} view interactions`);
    } catch (e) {
      logger.info('  - No activities table or no view data');
    }
    
    // 4. Populate from project_likes (likes)
    try {
      const likesInsert = await client.query(`
        INSERT INTO project_interactions (user_id, project_id, action, created_at)
        SELECT DISTINCT 
            user_id, 
            project_id, 
            'like' as action,
            COALESCE(created_at, NOW())
        FROM project_likes
        WHERE user_id IS NOT NULL AND project_id IS NOT NULL
        ON CONFLICT DO NOTHING
      `);
      logger.info(`  ✓ Inserted ${likesInsert.rowCount} like interactions`);
    } catch (e) {
      logger.info('  - No project_likes table or no likes data');
    }
    
    // 5. Populate from project_collaborators (collaboration)
    try {
      const collabInsert = await client.query(`
        INSERT INTO project_interactions (user_id, project_id, action, created_at)
        SELECT DISTINCT 
            user_id, 
            project_id, 
            'collaboration' as action,
            NOW()
        FROM project_collaborators
        WHERE user_id IS NOT NULL AND project_id IS NOT NULL
        ON CONFLICT DO NOTHING
      `);
      logger.info(`  ✓ Inserted ${collabInsert.rowCount} collaboration interactions\n`);
    } catch (e) {
      logger.info('  - No collaboration data\n');
    }
    
    logger.info('✅ project_interactions table created successfully!\n');
    
    // 6. Get summary
    const summary = await client.query(`
      SELECT action, COUNT(*) as count
      FROM project_interactions
      GROUP BY action
      ORDER BY count DESC
    `);
    
    logger.info('Interaction Summary:');
    logger.info('==================');
    summary.rows.forEach(row => {
      logger.info(`  ${row.action.padEnd(15)}: ${row.count}`);
    });
    
    const total = await client.query('SELECT COUNT(*) as total FROM project_interactions');
    logger.info(`\n  TOTAL: ${total.rows[0].total} interactions`);
    
    // 7. Get user and project coverage
    const coverage = await client.query(`
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT project_id) as unique_projects,
        COUNT(*) as total_interactions
      FROM project_interactions
    `);
    
    logger.info('\nCoverage:');
    logger.info('=========');
    logger.info(`  Users with interactions: ${coverage.rows[0].unique_users}`);
    logger.info(`  Projects with interactions: ${coverage.rows[0].unique_projects}`);
    logger.info(`  Total interactions: ${coverage.rows[0].total_interactions}\n`);
    
    logger.info('✨ Setup complete!');
    
  } catch (error) {
    logger.error(`Error creating interactions table: ${error.message}`);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
createInteractionsTable()
  .catch(error => {
    console.error('❌', error);
    process.exit(1);
  });
