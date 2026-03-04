#!/usr/bin/env node

/**
 * Create user_connections table in database
 */

require('dotenv').config();
const { query } = require('../services/db');
const fs = require('fs');
const path = require('path');

async function createUserConnectionsTable() {
  console.log('📋 Creating user_connections table...\n');

  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, 'create-user-connections-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute SQL
    const result = await query(sql);

    console.log('✅ user_connections table created successfully!\n');
    console.log('Table structure:');
    console.log('  - id: UUID (primary key)');
    console.log('  - follower_id: UUID (user who sent request)');
    console.log('  - following_id: UUID (user who received request)');
    console.log('  - status: VARCHAR (pending|active|rejected)');
    console.log('  - created_at: TIMESTAMP');
    console.log('  - updated_at: TIMESTAMP');
    console.log('\nConstraints:');
    console.log('  ✓ Unique connection per pair');
    console.log('  ✓ No self-connections');
    console.log('  ✓ Status validation');
    console.log('\nIndexes created for optimized queries');
    console.log('\n🎉 Database is ready for connection requests!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    if (error.code === '42P07') {
      console.log('ℹ️  Table already exists - skipping creation');
      process.exit(0);
    }
    console.error(error);
    process.exit(1);
  }
}

createUserConnectionsTable();
