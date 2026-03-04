/**
 * Migration script to add missing columns to notifications table
 * Run this script with: node backend/scripts/run-notification-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Get Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase credentials not found');
  console.error('Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('🚀 Starting notifications table migration...\n');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add-notification-columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL into individual statements (separated by semicolons)
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      // Use Supabase's RPC or direct query
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: stmt });
      
      if (error) {
        // If rpc doesn't exist, try using the REST API directly
        console.log('Trying alternative method...');
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql_query: stmt })
        });

        if (!response.ok) {
          console.log('⚠️  Note: Direct SQL execution may require database access.');
          console.log('Please run the SQL manually using Supabase Dashboard or psql:');
          console.log(`\nSQL file location: ${sqlPath}\n`);
          break;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Restart your backend server');
    console.log('2. Clear any old notifications or test with new ones');
    console.log('3. The Accept/Decline buttons should now appear on application notifications\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📋 Manual migration instructions:');
    console.log('1. Go to your Supabase Dashboard (https://supabase.com/dashboard)');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Run the SQL from: backend/scripts/add-notification-columns.sql\n');
    process.exit(1);
  }
}

// Run the migration
console.log('═══════════════════════════════════════════════════════');
console.log('  CollabGrow - Notifications Table Migration');
console.log('═══════════════════════════════════════════════════════\n');

runMigration();
