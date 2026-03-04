-- =============================================
-- ADD RECOMMENDATION FEATURES
-- Add interests column and compatibility_scores table
-- =============================================

-- Add interests column to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS interests TEXT[];

-- Add compatibility-related columns to users table if not exists
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS experience_level TEXT DEFAULT 'beginner' CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  ADD COLUMN IF NOT EXISTS weekly_availability INTEGER DEFAULT 10 CHECK (weekly_availability >= 0 AND weekly_availability <= 168),
  ADD COLUMN IF NOT EXISTS completed_projects_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reliability_score DECIMAL(3,2) DEFAULT 5.00 CHECK (reliability_score >= 0 AND reliability_score <= 10.00),
  ADD COLUMN IF NOT EXISTS activity_level TEXT DEFAULT 'moderate' CHECK (activity_level IN ('low', 'moderate', 'high', 'very_high')),
  ADD COLUMN IF NOT EXISTS preferred_project_types TEXT[],
  ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Add compatibility-related columns to projects table if not exists
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS required_experience_level TEXT DEFAULT 'beginner' CHECK (required_experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  ADD COLUMN IF NOT EXISTS required_commitment_hours INTEGER DEFAULT 10 CHECK (required_commitment_hours >= 0 AND required_commitment_hours <= 168),
  ADD COLUMN IF NOT EXISTS required_skills TEXT[];

-- Create compatibility_scores cache table for performance optimization
CREATE TABLE IF NOT EXISTS compatibility_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL, -- Can be project_id or another user_id
  target_type TEXT NOT NULL CHECK (target_type IN ('project', 'user')),
  score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  skill_match_score DECIMAL(5,2),
  experience_match_score DECIMAL(5,2),
  activity_match_score DECIMAL(5,2),
  reputation_match_score DECIMAL(5,2),
  availability_match_score DECIMAL(5,2),
  explanation JSONB,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_id, target_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_compatibility_scores_user ON compatibility_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_compatibility_scores_target ON compatibility_scores(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_compatibility_scores_score ON compatibility_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_compatibility_scores_calculated ON compatibility_scores(calculated_at);

-- Add comments
COMMENT ON TABLE compatibility_scores IS 'Cached compatibility scores between users and projects/users for performance optimization';
COMMENT ON COLUMN users.interests IS 'User interests and topics they are passionate about';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON compatibility_scores TO your_app_user;
