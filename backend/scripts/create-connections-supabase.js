#!/usr/bin/env node

/**
 * Create user_connections table in Supabase database
 * Run this script to set up the connection request functionality
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createUserConnectionsTable() {
  console.log('📋 Creating user_connections table in Supabase...\n');

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

  try {
    // Execute SQL using Supabase RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      // If exec_sql doesn't exist, try direct query
      console.log('ℹ️  exec_sql RPC not found, trying direct SQL execution...\n');
      
      // Split into individual statements and execute
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        const { error: stmtError } = await supabase.from('_sql').insert({ query: statement });
        if (stmtError && !stmtError.message?.includes('already exists')) {
          throw stmtError;
        }
      }
    }

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
    console.log('\nNext steps:');
    console.log('  1. Test connection requests: bash test-connection-requests.sh');
    console.log('  2. Try connecting with a profile in the UI');
    console.log('  3. Check notifications in Supabase dashboard\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    
    if (error.code === '42P07') {
      console.log('\n✅ Table already exists - connection requests are ready to use!');
      process.exit(0);
    }

    console.error('\n⚠️  Manual setup required:');
    console.error('1. Go to https://supabase.com/dashboard');
    console.error('2. Open your project');
    console.error('3. Click SQL Editor');
    console.error('4. Copy and paste the SQL from: backend/scripts/create-user-connections-table.sql');
    console.error('5. Click RUN\n');
    
    process.exit(1);
  }
}

// Verify connection first
async function verifyConnection() {
  console.log('🔍 Verifying Supabase connection...\n');
  
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Connected to Supabase successfully!\n');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Supabase:', error.message);
    console.error('\nPlease check your .env file:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL=' + supabaseUrl);
    console.error('  SUPABASE_SERVICE_ROLE_KEY=<hidden>\n');
    return false;
  }
}

async function main() {
  const connected = await verifyConnection();
  if (connected) {
    await createUserConnectionsTable();
  } else {
    process.exit(1);
  }
}

main();
