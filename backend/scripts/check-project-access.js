require('dotenv').config();
const { query } = require('../services/db');

async function checkProjectAccess() {
    try {
        const projectId = '3fe21f14-8db1-4b1d-aaaf-ff6de12141d1';
        const userId = 'a0b53f4b-0565-4d93-88d9-69924241bfe0'; // From the logs
        
        console.log('🔍 Checking project access for:');
        console.log(`   Project ID: ${projectId}`);
        console.log(`   User ID: ${userId}\n`);
        
        // Check if user is creator
        const creatorCheck = await query(
            'SELECT creator_id FROM projects WHERE id = $1',
            [projectId]
        );
        
        console.log('👤 Project Creator:', creatorCheck.rows[0]?.creator_id);
        console.log('   Is user creator?', creatorCheck.rows[0]?.creator_id === userId ? '✅ YES' : '❌ NO');
        
        // Check project_collaborators
        const collabsAll = await query(
            'SELECT user_id, role, status FROM project_collaborators WHERE project_id = $1',
            [projectId]
        );
        
        console.log('\n👥 All Collaborators:');
        if (collabsAll.rows.length === 0) {
            console.log('   ⚠️  No collaborators found!');
        } else {
            collabsAll.rows.forEach(c => {
                const isUser = c.user_id === userId;
                console.log(`   ${isUser ? '➡️ ' : '   '}${c.user_id} - ${c.role} - ${c.status} ${isUser ? '(YOU)' : ''}`);
            });
        }
        
        // Check what the current query returns
        const memberCheck = await query(
            `SELECT 1 FROM project_collaborators WHERE project_id = $1 AND user_id = $2
             UNION
             SELECT 1 FROM projects WHERE id = $1 AND creator_id = $2`,
            [projectId, userId]
        );
        
        console.log('\n🔐 Current Backend Check Result:');
        console.log(`   Rows returned: ${memberCheck.rows.length}`);
        console.log(`   Access: ${memberCheck.rows.length > 0 ? '✅ GRANTED' : '❌ DENIED'}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkProjectAccess();
