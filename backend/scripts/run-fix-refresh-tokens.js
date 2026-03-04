/**
 * Script to fix refresh_tokens table schema
 * Run: node scripts/run-fix-refresh-tokens.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixRefreshTokensSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting refresh_tokens table schema fix...\n');
    
    // Drop existing indexes to avoid conflicts
    console.log('Dropping existing indexes...');
    await client.query('DROP INDEX IF EXISTS idx_refresh_tokens_token_id');
    await client.query('DROP INDEX IF EXISTS idx_refresh_tokens_user_id');
    await client.query('DROP INDEX IF EXISTS idx_refresh_tokens_expires_at');
    console.log('✓ Indexes dropped\n');
    
    // Add token column if missing
    console.log('Checking and adding missing columns...');
    const columns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'refresh_tokens'
    `);
    
    const existingColumns = columns.rows.map(r => r.column_name);
    console.log('Existing columns:', existingColumns.join(', '));
    
    if (!existingColumns.includes('token')) {
      console.log('  ➜ Adding "token" column...');
      await client.query('ALTER TABLE refresh_tokens ADD COLUMN token TEXT');
      console.log('  ✓ Added "token" column');
    }
    
    if (!existingColumns.includes('token_id')) {
      console.log('  ➜ Adding "token_id" column...');
      await client.query('ALTER TABLE refresh_tokens ADD COLUMN token_id TEXT');
      await client.query('UPDATE refresh_tokens SET token_id = gen_random_uuid()::text WHERE token_id IS NULL');
      await client.query('ALTER TABLE refresh_tokens ALTER COLUMN token_id SET NOT NULL');
      
      // Add unique constraint if not exists
      try {
        await client.query('ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_token_id_unique UNIQUE (token_id)');
      } catch (err) {
        if (!err.message.includes('already exists')) throw err;
      }
      console.log('  ✓ Added "token_id" column');
    }
    
    if (!existingColumns.includes('is_revoked')) {
      console.log('  ➜ Adding "is_revoked" column...');
      await client.query('ALTER TABLE refresh_tokens ADD COLUMN is_revoked BOOLEAN DEFAULT FALSE');
      console.log('  ✓ Added "is_revoked" column');
    }
    
    if (!existingColumns.includes('revoked_at')) {
      console.log('  ➜ Adding "revoked_at" column...');
      await client.query('ALTER TABLE refresh_tokens ADD COLUMN revoked_at TIMESTAMPTZ');
      console.log('  ✓ Added "revoked_at" column');
    }
    
    if (!existingColumns.includes('updated_at')) {
      console.log('  ➜ Adding "updated_at" column...');
      await client.query('ALTER TABLE refresh_tokens ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW()');
      console.log('  ✓ Added "updated_at" column');
    }
    
    console.log('\n✓ All columns verified\n');
    
    // Recreate indexes
    console.log('Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_id ON refresh_tokens(token_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)');
    console.log('✓ Indexes created\n');
    
    // Create trigger
    console.log('Creating trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_refresh_tokens_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query('DROP TRIGGER IF EXISTS trg_update_refresh_tokens_timestamp ON refresh_tokens');
    await client.query(`
      CREATE TRIGGER trg_update_refresh_tokens_timestamp
        BEFORE UPDATE ON refresh_tokens
        FOR EACH ROW
        EXECUTE PROCEDURE update_refresh_tokens_timestamp()
    `);
    console.log('✓ Trigger created\n');
    
    // Verify final schema
    const finalColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'refresh_tokens'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Final schema:');
    finalColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    console.log('\n✅ Refresh tokens table schema fixed successfully!');
    console.log('👉 You can now restart your server and test login again.\n');
    
  } catch (error) {
    console.error('❌ Error fixing schema:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixRefreshTokensSchema();
