require('dotenv').config();
const { query } = require('../services/db');

async function verifyTable() {
    try {
        console.log('🔍 Verifying project_updates table...\n');
        
        // Check if table exists and get structure
        const tableInfo = await query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'project_updates'
            ORDER BY ordinal_position
        `);
        
        if (tableInfo.rows.length === 0) {
            console.log('❌ Table does not exist!');
            process.exit(1);
        }
        
        console.log('✅ Table exists with columns:');
        tableInfo.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(required)' : '(optional)'}`);
        });
        
        // Check indexes
        const indexes = await query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'project_updates'
        `);
        
        console.log('\n📊 Indexes:');
        indexes.rows.forEach(idx => {
            console.log(`   - ${idx.indexname}`);
        });
        
        // Check row count
        const count = await query('SELECT COUNT(*) FROM project_updates');
        console.log(`\n📦 Current records: ${count.rows[0].count}`);
        
        console.log('\n✅ Table is ready to use!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

verifyTable();
