-- Migration: Add is_system column to project_chat_messages
-- Purpose: Allow system messages (like user joined, milestone completed, etc.)
-- Date: 2026-02-14

-- Add is_system column if it doesn't exist
ALTER TABLE project_chat_messages 
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- Update existing records to mark them as non-system messages
UPDATE project_chat_messages 
SET is_system = FALSE 
WHERE is_system IS NULL;

-- Add index for filtering system vs user messages
CREATE INDEX IF NOT EXISTS idx_project_chat_messages_system 
ON project_chat_messages(is_system);

-- Allow user_id to be NULL for system messages (already nullable in original schema)
