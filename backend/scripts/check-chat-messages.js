/**
 * Script to check current state of chat messages
 */

// Load environment variables
require('dotenv').config();

const { query } = require('../services/db');

async function checkChatMessages() {
    console.log('🔍 Checking chat messages...\n');
    
    try {
        // Get all messages with their current user_name
        const result = await query(`
            SELECT 
                id, 
                user_id, 
                user_name, 
                content,
                LEFT(content, 30) as content_preview,
                timestamp
            FROM project_chat_messages 
            WHERE is_system IS NOT TRUE
            ORDER BY timestamp DESC 
            LIMIT 10
        `);
        
        console.log(`Found ${result.rows.length} recent messages:\n`);
        result.rows.forEach((msg, idx) => {
            console.log(`${idx + 1}. ID: ${msg.id}`);
            console.log(`   User ID: ${msg.user_id}`);
            console.log(`   User Name: "${msg.user_name}"`);
            console.log(`   Content: "${msg.content_preview}..."`);
            console.log(`   Timestamp: ${msg.timestamp}\n`);
        });
        
        // Count messages by user_name value
        const countResult = await query(`
            SELECT 
                user_name,
                COUNT(*) as count
            FROM project_chat_messages 
            WHERE is_system IS NOT TRUE
            GROUP BY user_name
            ORDER BY count DESC
        `);
        
        console.log('\nMessage count by user_name:');
        countResult.rows.forEach(row => {
            console.log(`  "${row.user_name}": ${row.count} messages`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkChatMessages();
