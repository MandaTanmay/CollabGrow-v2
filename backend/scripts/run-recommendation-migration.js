/**
 * Run recommendation features migration
 * Adds interests column and compatibility_scores table
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { query } = require('../services/db');
const logger = require('../utils/logger');

async function runMigration() {
  try {
    console.log('Starting recommendation features migration...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add-recommendation-features.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the migration
    await query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('- Added interests column to users table');
    console.log('- Added compatibility-related columns to users and projects');
    console.log('- Created compatibility_scores table');
    console.log('- Created necessary indexes');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    logger.error('Migration error', error);
    process.exit(1);
  }
}

runMigration();
