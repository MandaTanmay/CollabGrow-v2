/**
 * Script to check database schemas and tables
 * Run: node scripts/check-database-schemas.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchemas() {
  const client = await pool.connect();
  
  try {
    console.log('📊 Checking database schemas and tables...\n');
    
    // Check all schemas
    const schemas = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);
    
    console.log('Available schemas:');
    schemas.rows.forEach(s => console.log(`  - ${s.schema_name}`));
    console.log('');
    
    // Check for refresh_tokens in different schemas
    const tables = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%refresh%token%'
      ORDER BY table_schema, table_name
    `);
    
    console.log('Tables with "refresh" and "token" in name:');
    tables.rows.forEach(t => console.log(`  - ${t.table_schema}.${t.table_name}`));
    console.log('');
    
    // Check columns in public.refresh_tokens
    const publicColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'refresh_tokens'
      ORDER BY ordinal_position
    `);
    
    if (publicColumns.rows.length > 0) {
      console.log('Columns in public.refresh_tokens:');
      publicColumns.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    } else {
      console.log('⚠️  No public.refresh_tokens table found');
    }
    console.log('');
    
    // Check columns in auth.refresh_tokens (if exists)
    const authColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'auth' AND table_name = 'refresh_tokens'
      ORDER BY ordinal_position
    `);
    
    if (authColumns.rows.length > 0) {
      console.log('Columns in auth.refresh_tokens (Supabase built-in):');
      authColumns.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    } else {
      console.log('No auth.refresh_tokens table found');
    }
    console.log('');
    
    // Check current search_path
    const searchPath = await client.query('SHOW search_path');
    console.log(`Current search_path: ${searchPath.rows[0].search_path}`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchemas();
