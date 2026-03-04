#!/usr/bin/env node

/**
 * Create user_connections table using PostgreSQL connection
 * This uses the same connection that the backend uses
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTable() {
  console.log('📋 Creating user_connections table...\n');

  const sql = `
    -- Create user_connections table for connection requests
    CREATE TABLE IF NOT EXISTS user_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        
        -- Prevent duplicate connections
        CONSTRAINT unique_connection UNIQUE (follower_id, following_id),
        
        -- Prevent self-connections
        CONSTRAINT no_self_connection CHECK (follower_id != following_id),
        
        -- Status must be valid
        CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'rejected'))
    );

    -- Create indexes for faster queries
    CREATE INDEX IF NOT EXISTS idx_user_connections_follower ON user_connections(follower_id);
    CREATE INDEX IF NOT EXISTS idx_user_connections_following ON user_connections(following_id);
    CREATE INDEX IF NOT EXISTS idx_user_connections_status ON user_connections(status);
  `;

  const client = await pool.connect();
  
  try {
    await client.query(sql);
    
    console.log('✅ user_connections table created successfully!\n');
    console.log('Table structure:');
    console.log('  - id: UUID (primary key)');
    console.log('  - follower_id: UUID (user who sent request)');
    console.log('  - following_id: UUID (user who received request)');
    console.log('  - status: VARCHAR (pending|active|rejected)');
    console.log('  - created_at: TIMESTAMP');
    console.log('  - updated_at: TIMESTAMP\n');
    console.log('Constraints:');
    console.log('  ✓ Unique connection per pair');
    console.log('  ✓ No self-connections');
    console.log('  ✓ Status validation\n');
    console.log('Indexes:');
    console.log('  ✓ idx_user_connections_follower');
    console.log('  ✓ idx_user_connections_following');
    console.log('  ✓ idx_user_connections_status\n');
    console.log('🎉 Database is ready for connection requests!\n');
    
    // Verify the table was created
    const verifyResult = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_connections' 
      ORDER BY ordinal_position
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Table verified in database\n');
      console.log('Next steps:');
      console.log('  1. Test connection requests: bash test-connection-requests.sh');
      console.log('  2. Visit a profile page and click "Connect"');
      console.log('  3. Check notifications in the app\n');
    }
    
  } catch (error) {
    if (error.code === '42P07') {
      console.log('ℹ️  Table already exists - skipping creation\n');
      console.log('✅ Connection requests are ready to use!\n');
    } else {
      console.error('❌ Error creating table:', error.message);
      console.error('Error code:', error.code);
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

createTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Failed to create table');
    console.error(error);
    process.exit(1);
  });
