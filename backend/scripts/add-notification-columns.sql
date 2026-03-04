-- Add missing columns to notifications table for accept/decline functionality

-- Add title column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='notifications' AND column_name='title'
    ) THEN
        ALTER TABLE notifications ADD COLUMN title TEXT;
    END IF;
END $$;

-- Add priority column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='notifications' AND column_name='priority'
    ) THEN
        ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'medium';
    END IF;
END $$;

-- Add related_project_id column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='notifications' AND column_name='related_project_id'
    ) THEN
        ALTER TABLE notifications ADD COLUMN related_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add related_entity_id column if it doesn't exist (for application_id, etc.)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='notifications' AND column_name='related_entity_id'
    ) THEN
        ALTER TABLE notifications ADD COLUMN related_entity_id UUID;
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_related_project_id ON notifications(related_project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Display the updated schema
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'notifications' 
ORDER BY ordinal_position;
