/**
 * Script to recreate refresh_tokens table from scratch
 * WARNING: This will delete all existing refresh tokens
 * Run: node scripts/recreate-refresh-tokens-table.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function recreateRefreshTokensTable() {
  const client = await pool.connect();
  
  try {
    console.log('⚠️  WARNING: This will drop and recreate the refresh_tokens table');
    console.log('⚠️  All existing refresh tokens will be deleted\n');
    
    // Drop the existing table
    console.log('Dropping existing refresh_tokens table...');
    await client.query('DROP TABLE IF EXISTS refresh_tokens CASCADE');
    console.log('✓ Table dropped\n');
    
    // Create the table with correct schema
    console.log('Creating refresh_tokens table with correct schema...');
    await client.query(`
      CREATE TABLE refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        token_id TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        is_revoked BOOLEAN DEFAULT FALSE,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✓ Table created\n');
    
    // Create indexes
    console.log('Creating indexes...');
    await client.query('CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id)');
    await client.query('CREATE INDEX idx_refresh_tokens_token_id ON refresh_tokens(token_id)');
    await client.query('CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)');
    console.log('✓ Indexes created\n');
    
    // Create trigger
    console.log('Creating trigger for updated_at...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_refresh_tokens_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    await client.query(`
      CREATE TRIGGER trg_update_refresh_tokens_timestamp
        BEFORE UPDATE ON refresh_tokens
        FOR EACH ROW
        EXECUTE PROCEDURE update_refresh_tokens_timestamp()
    `);
    console.log('✓ Trigger created\n');
    
    // Add comments
    await client.query(`COMMENT ON TABLE refresh_tokens IS 'Stores JWT refresh tokens for authentication. Supports multiple devices per user.'`);
    await client.query(`COMMENT ON COLUMN refresh_tokens.token_id IS 'Unique identifier embedded in JWT for token validation'`);
    await client.query(`COMMENT ON COLUMN refresh_tokens.is_revoked IS 'Set to TRUE when user logs out or token is invalidated'`);
    
    // Verify schema
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'refresh_tokens'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Final schema:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    console.log('\n✅ refresh_tokens table recreated successfully!');
    console.log('👉 Restart your server and try login again.\n');
    
  } catch (error) {
    console.error('❌ Error recreating table:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

recreateRefreshTokensTable();
