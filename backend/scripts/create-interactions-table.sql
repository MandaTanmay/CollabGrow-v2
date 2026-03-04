-- Create project_interactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'view', 'like', 'apply', 'collaboration', 'comment'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, project_id, action)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_project_interactions_user_id ON project_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_project_interactions_project_id ON project_interactions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_interactions_created_at ON project_interactions(created_at);
