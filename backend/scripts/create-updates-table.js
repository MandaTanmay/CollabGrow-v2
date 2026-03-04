require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../services/db');

async function createProjectUpdatesTable() {
    try {
        console.log('📦 Creating project_updates table...');
        
        const sqlPath = path.join(__dirname, 'create-project-updates-table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Execute the SQL script
        await query(sql);
        
        console.log('✅ Successfully created project_updates table!');
        console.log('   - Table: project_updates');
        console.log('   - Indexes: project_id, author_id, created_at');
        console.log('   - Trigger: auto-update updated_at timestamp');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating table:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

createProjectUpdatesTable();
