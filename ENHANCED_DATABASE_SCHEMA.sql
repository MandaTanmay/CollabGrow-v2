/*
================================================================================
           COLLABGROW - ENHANCED DATABASE SCHEMA & ANALYSIS
                    Complete Optimization & Best Practices
================================================================================

ANALYSIS SUMMARY:
- ✓ Found 30+ tables with some duplicates and overlapping definitions
- ✓ Identified missing constraints and validations
- ✓ Optimized indexing strategy (50+ indexes needed)
- ✓ Enhanced RLS policies for security
- ✓ Added data integrity checks
- ✓ Consolidated duplicate definitions
- ✓ Added performance optimizations

This file provides the complete, enhanced schema in organized sections.

================================================================================
SECTION 1: CORE TABLES (Users, Projects, Skills)
================================================================================
*/

-- =====================================================
-- 1.1 USERS TABLE - Enhanced with full validation
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    -- Identifiers & Authentication
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    
    -- Profile Information
    full_name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    bio TEXT CHECK (LENGTH(bio) <= 500),
    
    -- Contact & Location
    location TEXT,
    university TEXT,
    major TEXT,
    
    -- Skills & Interests
    skills TEXT[] DEFAULT ARRAY[]::TEXT[],
    interests TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Social Links
    github_username TEXT UNIQUE,
    linkedin_url TEXT,
    portfolio_url TEXT,
    
    -- Profile & Media
    profile_image_url TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    
    -- Gamification & Stats
    followers_count INT DEFAULT 0 CHECK (followers_count >= 0),
    following_count INT DEFAULT 0 CHECK (following_count >= 0),
    reputation_points INT DEFAULT 0 CHECK (reputation_points >= 0),
    profile_views INT DEFAULT 0 CHECK (profile_views >= 0),
    
    -- Performance Metrics
    tasks_completed_count INT DEFAULT 0 CHECK (tasks_completed_count >= 0),
    completed_projects_count INT DEFAULT 0 CHECK (completed_projects_count >= 0),
    projects_joined_count INT DEFAULT 0 CHECK (projects_joined_count >= 0),
    total_contributions INT DEFAULT 0 CHECK (total_contributions >= 0),
    consistency_streak INT DEFAULT 0 CHECK (consistency_streak >= 0),
    
    -- Compatibility Scoring
    experience_level TEXT DEFAULT 'beginner' 
        CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    reliability_score DECIMAL(3,2) DEFAULT 5.00 
        CHECK (reliability_score >= 0 AND reliability_score <= 10.00),
    activity_level TEXT DEFAULT 'moderate' 
        CHECK (activity_level IN ('low', 'moderate', 'high', 'very_high')),
    weekly_availability INT DEFAULT 0 
        CHECK (weekly_availability >= 0 AND weekly_availability <= 168),
    timezone TEXT,
    
    -- Acceptance & Success Rates
    application_acceptance_rate NUMERIC(5,2) DEFAULT 0 
        CHECK (application_acceptance_rate >= 0 AND application_acceptance_rate <= 100),
    collaboration_success_rate NUMERIC(5,2) DEFAULT 0 
        CHECK (collaboration_success_rate >= 0 AND collaboration_success_rate <= 100),
    
    -- Saved Content
    saved_posts UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Status & Access
    is_active BOOLEAN DEFAULT TRUE,
    role TEXT DEFAULT 'member' 
        CHECK (role IN ('admin', 'owner', 'member')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for Users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_experience_level ON users(experience_level);
CREATE INDEX IF NOT EXISTS idx_users_activity_level ON users(activity_level);
CREATE INDEX IF NOT EXISTS idx_users_search ON users USING GIN(
    to_tsvector('english', 
        COALESCE(full_name, '') || ' ' || 
        COALESCE(bio, '') || ' ' || 
        ARRAY_TO_STRING(skills, ' ')
    )
);

-- =====================================================
-- 1.2 SKILLS TABLE - Core skills reference
-- =====================================================
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT CHECK (LENGTH(description) <= 500),
    proficiency_levels TEXT[] DEFAULT ARRAY['beginner', 'intermediate', 'advanced', 'expert'],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_name_lower ON skills(LOWER(name));

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);

-- =====================================================
-- 1.3 USER SKILLS - Many-to-many relationship
-- =====================================================
CREATE TABLE IF NOT EXISTS user_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level TEXT DEFAULT 'intermediate' 
        CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    years_of_experience INT CHECK (years_of_experience >= 0),
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_skill UNIQUE(user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id ON user_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_proficiency ON user_skills(proficiency_level);

/*
================================================================================
SECTION 2: PROJECT MANAGEMENT TABLES
================================================================================
*/

-- =====================================================
-- 2.1 PROJECTS TABLE - Enhanced with comprehensive fields
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
    -- Identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Basic Information
    title TEXT NOT NULL CHECK (LENGTH(title) >= 3 AND LENGTH(title) <= 255),
    description TEXT CHECK (LENGTH(description) <= 1000),
    detailed_description TEXT,
    category TEXT NOT NULL,
    
    -- Project Type & Status
    project_type TEXT DEFAULT 'general',
    status TEXT DEFAULT 'recruiting' 
        CHECK (status IN ('recruiting', 'active', 'paused', 'completed', 'archived')),
    
    -- Requirements
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    estimated_duration TEXT,
    max_collaborators INT CHECK (max_collaborators IS NULL OR max_collaborators > 0),
    
    -- Resources & Links
    repository_url TEXT,
    demo_url TEXT,
    
    -- Metrics
    collaborators_count INT DEFAULT 0 CHECK (collaborators_count >= 0),
    likes_count INT DEFAULT 0 CHECK (likes_count >= 0),
    comments_count INT DEFAULT 0 CHECK (comments_count >= 0),
    views_count INT DEFAULT 0 CHECK (views_count >= 0),
    progress_percentage INT DEFAULT 0 
        CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    -- Location & Remote
    is_remote BOOLEAN DEFAULT TRUE,
    location TEXT,
    
    -- Privacy & Visibility
    is_public BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Comprehensive indexes for Projects
CREATE INDEX IF NOT EXISTS idx_projects_creator_id ON projects(creator_id) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_projects_public_created ON projects(is_public, created_at DESC) 
    WHERE is_deleted = FALSE AND is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(is_featured) 
    WHERE is_featured = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_projects_difficulty ON projects(difficulty_level) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_projects_search ON projects USING GIN(
    to_tsvector('english', 
        COALESCE(title, '') || ' ' || 
        COALESCE(description, '')
    )
) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_projects_composite ON projects(status, difficulty_level, created_at DESC) 
    WHERE is_deleted = FALSE;

-- =====================================================
-- 2.2 PROJECT SKILLS - Many-to-many relationship
-- =====================================================
CREATE TABLE IF NOT EXISTS project_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT FALSE,
    proficiency_level_required TEXT DEFAULT 'intermediate',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_project_skill UNIQUE(project_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_project_skills_project_id ON project_skills(project_id);
CREATE INDEX IF NOT EXISTS idx_project_skills_skill_id ON project_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_project_skills_required ON project_skills(is_required) 
    WHERE is_required = TRUE;

-- =====================================================
-- 2.3 PROJECT COLLABORATORS - Project membership
-- =====================================================
CREATE TABLE IF NOT EXISTS project_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Role & Status
    role TEXT DEFAULT 'contributor' 
        CHECK (role IN ('owner', 'lead', 'contributor', 'reviewer')),
    status TEXT DEFAULT 'Active' 
        CHECK (status IN ('Active', 'Inactive', 'Left', 'Removed')),
    
    -- Contribution Tracking
    contribution_description TEXT,
    hours_contributed DECIMAL(8,2) DEFAULT 0 CHECK (hours_contributed >= 0),
    contribution_count INT DEFAULT 0 CHECK (contribution_count >= 0),
    
    -- Timestamps
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_project_collaborator UNIQUE(project_id, user_id),
    CONSTRAINT valid_dates CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE INDEX IF NOT EXISTS idx_pc_project_id ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_pc_user_id ON project_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_pc_status ON project_collaborators(status);
CREATE INDEX IF NOT EXISTS idx_pc_user_status ON project_collaborators(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pc_active ON project_collaborators(project_id, status) 
    WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_pc_joined_at ON project_collaborators(joined_at DESC);

-- =====================================================
-- 2.4 COLLABORATION REQUESTS - Handling join requests
-- =====================================================
CREATE TABLE IF NOT EXISTS collaboration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Request Details
    message TEXT CHECK (LENGTH(message) <= 1000),
    status TEXT DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'rejected')),
    
    -- Security
    secure_token TEXT UNIQUE,
    token_expires_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_collab_requests_project ON collaboration_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_collab_requests_requester ON collaboration_requests(requester_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_collab_requests_unique_pending ON collaboration_requests(project_id, requester_id)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_collab_requests_status ON collaboration_requests(status);
CREATE INDEX IF NOT EXISTS idx_collab_requests_pending ON collaboration_requests(project_id, status) 
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_collab_requests_token ON collaboration_requests(secure_token);

-- =====================================================
-- 2.5 PROJECT TASKS - Task management
-- =====================================================
CREATE TABLE IF NOT EXISTS project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Task Details
    title TEXT NOT NULL CHECK (LENGTH(title) >= 3 AND LENGTH(title) <= 255),
    description TEXT,
    
    -- Status & Priority
    status TEXT DEFAULT 'todo' 
        CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'blocked')),
    priority TEXT DEFAULT 'medium' 
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    -- Time Tracking
    due_date DATE,
    estimated_hours INT CHECK (estimated_hours IS NULL OR estimated_hours > 0),
    actual_hours DECIMAL(8,2) CHECK (actual_hours IS NULL OR actual_hours >= 0),
    
    -- Completion
    completed_at TIMESTAMPTZ,
    completion_percentage INT DEFAULT 0 
        CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON project_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON project_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON project_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON project_tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status ON project_tasks(assigned_to, status) 
    WHERE status != 'done';

-- =====================================================
-- 2.6 PROJECT MILESTONES - Major checkpoints
-- =====================================================
CREATE TABLE IF NOT EXISTS project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Milestone Details
    title TEXT NOT NULL CHECK (LENGTH(title) >= 3 AND LENGTH(title) <= 255),
    description TEXT,
    
    -- Timeline
    start_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    
    -- Status & Importance
    status TEXT DEFAULT 'pending' 
        CHECK (status IN ('pending', 'in_progress', 'completed', 'at_risk')),
    is_critical BOOLEAN DEFAULT FALSE,
    
    -- Assignment & Ordering
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    order_index INT DEFAULT 0,
    
    -- Tracking
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_milestone_dates CHECK (completed_at IS NULL OR completed_at >= due_date)
);

CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON project_milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_due_date ON project_milestones(due_date);
CREATE INDEX IF NOT EXISTS idx_milestones_assigned ON project_milestones(assigned_to);
CREATE INDEX IF NOT EXISTS idx_milestones_critical ON project_milestones(is_critical) 
    WHERE is_critical = TRUE;

-- =====================================================
-- 2.7 PROJECT RESOURCES - Shared files & documents
-- =====================================================
CREATE TABLE IF NOT EXISTS project_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- File Information
    resource_name TEXT NOT NULL CHECK (LENGTH(resource_name) <= 255),
    resource_type TEXT DEFAULT 'document' 
        CHECK (resource_type IN ('document', 'image', 'video', 'code', 'design', 'other')),
    resource_url TEXT NOT NULL,
    file_size_bytes BIGINT CHECK (file_size_bytes > 0),
    
    -- Description & Tags
    description TEXT CHECK (LENGTH(description) <= 1000),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Access Control
    is_public BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_project_id ON project_resources(project_id);
CREATE INDEX IF NOT EXISTS idx_resources_uploader_id ON project_resources(uploader_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON project_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_created_at ON project_resources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_search ON project_resources USING GIN(
    to_tsvector('english', 
        COALESCE(resource_name, '') || ' ' || 
        COALESCE(description, '')
    )
);

-- =====================================================
-- 2.8 PROJECT FILES - Structured file management
-- =====================================================
CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- File Details
    file_name TEXT NOT NULL CHECK (LENGTH(file_name) >= 1 AND LENGTH(file_name) <= 255),
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    file_type TEXT NOT NULL 
        CHECK (file_type IN ('document', 'image', 'video', 'audio', 'code', 'design', 'archive', 'other')),
    mime_type TEXT,
    
    -- Storage Information
    storage_location TEXT DEFAULT 'supabase' 
        CHECK (storage_location IN ('supabase', 's3', 'local', 'other')),
    storage_bucket TEXT,
    storage_key TEXT,
    
    -- File Metadata
    description TEXT CHECK (LENGTH(description) <= 1000),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    version_number INT DEFAULT 1 CHECK (version_number >= 1),
    is_latest_version BOOLEAN DEFAULT TRUE,
    
    -- Access Control
    is_public BOOLEAN DEFAULT FALSE,
    permissions TEXT DEFAULT 'private' 
        CHECK (permissions IN ('private', 'collaborators_only', 'public')),
    
    -- Soft Delete & Status
    is_deleted BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for project_files
CREATE INDEX IF NOT EXISTS idx_pf_project_id ON project_files(project_id) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_pf_uploader_id ON project_files(uploader_id);
CREATE INDEX IF NOT EXISTS idx_pf_file_type ON project_files(file_type) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_pf_created_at ON project_files(created_at DESC) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_pf_latest_version ON project_files(project_id, is_latest_version, version_number DESC) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_pf_storage_key ON project_files(storage_key) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_pf_search ON project_files USING GIN(
    to_tsvector('english', 
        COALESCE(file_name, '') || ' ' || 
        COALESCE(description, '')
    )
) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_pf_composite ON project_files(project_id, file_type, created_at DESC) 
    WHERE is_deleted = FALSE AND is_latest_version = TRUE;

-- =====================================================
-- 2.9 WORKSPACE FILES - Shared workspace documents
-- =====================================================
CREATE TABLE IF NOT EXISTS workspace_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- File Details
    file_name TEXT NOT NULL CHECK (LENGTH(file_name) >= 1 AND LENGTH(file_name) <= 255),
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    file_type TEXT NOT NULL 
        CHECK (file_type IN ('document', 'image', 'video', 'audio', 'code', 'design', 'archive', 'other')),
    mime_type TEXT,
    
    -- Storage Information
    storage_location TEXT DEFAULT 'supabase' 
        CHECK (storage_location IN ('supabase', 's3', 'local', 'other')),
    storage_bucket TEXT,
    storage_key TEXT,
    
    -- Metadata
    description TEXT CHECK (LENGTH(description) <= 1000),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Access Control
    is_public BOOLEAN DEFAULT FALSE,
    permissions TEXT DEFAULT 'private' 
        CHECK (permissions IN ('private', 'collaborators_only', 'public')),
    
    -- Soft Delete & Status
    is_deleted BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for workspace_files
CREATE INDEX IF NOT EXISTS idx_wf_workspace_id ON workspace_files(workspace_id) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_wf_uploader_id ON workspace_files(uploader_id);
CREATE INDEX IF NOT EXISTS idx_wf_file_type ON workspace_files(file_type) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_wf_created_at ON workspace_files(created_at DESC) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_wf_storage_key ON workspace_files(storage_key) 
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_wf_search ON workspace_files USING GIN(
    to_tsvector('english', 
        COALESCE(file_name, '') || ' ' || 
        COALESCE(description, '')
    )
) WHERE is_deleted = FALSE;

/*
================================================================================
SECTION 3: SOCIAL & ENGAGEMENT TABLES
================================================================================
*/

-- =====================================================
-- 3.1 POSTS TABLE - User content/updates
-- =====================================================
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Content
    content TEXT NOT NULL CHECK (LENGTH(content) <= 5000),
    post_type TEXT DEFAULT 'general' 
        CHECK (post_type IN ('general', 'update', 'announcement', 'question', 'resource')),
    
    -- Media & Metadata
    media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Relationships
    related_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    
    -- Engagement Metrics
    likes_count INT DEFAULT 0 CHECK (likes_count >= 0),
    comments_count INT DEFAULT 0 CHECK (comments_count >= 0),
    shares_count INT DEFAULT 0 CHECK (shares_count >= 0),
    
    -- Visibility
    visibility TEXT DEFAULT 'public' 
        CHECK (visibility IN ('public', 'collaborators_only', 'private')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    pinned_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_project_id ON posts(related_project_id);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(post_type);
CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts(user_id, visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING GIN(
    to_tsvector('english', content)
);

-- =====================================================
-- 3.2 POST LIKES - Like tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_post_like UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);

-- =====================================================
-- 3.3 POST COMMENTS - Comment threading
-- =====================================================
CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Content & Threading
    content TEXT NOT NULL CHECK (LENGTH(content) <= 2000),
    parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
    
    -- Engagement
    likes_count INT DEFAULT 0 CHECK (likes_count >= 0),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON post_comments(created_at DESC);

-- =====================================================
-- 3.4 PROJECT LIKES - Project appreciation
-- =====================================================
CREATE TABLE IF NOT EXISTS project_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_project_like UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_likes_project_id ON project_likes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_likes_user_id ON project_likes(user_id);

/*
================================================================================
SECTION 4: COMMUNICATION TABLES
================================================================================
*/

-- =====================================================
-- 4.1 PROJECT CHAT MESSAGES - Real-time communication
-- =====================================================
CREATE TABLE IF NOT EXISTS project_chat_messages (
    id BIGSERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Message Content
    content TEXT NOT NULL CHECK (LENGTH(content) <= 5000),
    
    -- System Messages
    is_system BOOLEAN DEFAULT FALSE,
    system_action TEXT,
    
    -- Message Status
    is_deleted BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_project ON project_chat_messages(project_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON project_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_system ON project_chat_messages(is_system);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON project_chat_messages(timestamp DESC);

-- =====================================================
-- 4.2 NOTIFICATIONS - User alerts & updates
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification Content
    type TEXT NOT NULL 
        CHECK (type IN ('project_request', 'request_accepted', 'request_rejected', 
                        'member_joined', 'comment', 'mention', 'like', 'task_assigned',
                        'milestone_completed', 'project_update', 'system')),
    title TEXT,
    message TEXT CHECK (LENGTH(message) <= 1000),
    
    -- Metadata
    priority TEXT DEFAULT 'medium' 
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    -- References
    reference_id UUID,
    related_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    related_entity_id UUID,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications(recipient_id, is_read) 
    WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(related_project_id);

-- =====================================================
-- 4.3 USER CONNECTIONS - Following relationships
-- =====================================================
CREATE TABLE IF NOT EXISTS user_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Status
    status TEXT DEFAULT 'active' 
        CHECK (status IN ('pending', 'active', 'blocked', 'rejected')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_connection UNIQUE(follower_id, following_id),
    CONSTRAINT no_self_connection CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_follower ON user_connections(follower_id);
CREATE INDEX IF NOT EXISTS idx_connections_following ON user_connections(following_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON user_connections(status);
CREATE INDEX IF NOT EXISTS idx_connections_active ON user_connections(follower_id, status) 
    WHERE status = 'active';

/*
================================================================================
SECTION 5: TRACKING & ANALYTICS TABLES
================================================================================
*/

-- =====================================================
-- 5.1 PROJECT INTERACTIONS - Activity tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS project_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Interaction Details
    action VARCHAR(50) NOT NULL 
        CHECK (action IN ('view', 'like', 'apply', 'collaboration', 'comment', 'share', 'download')),
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_interaction UNIQUE(user_id, project_id, action)
);

CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON project_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_project_id ON project_interactions(project_id);
CREATE INDEX IF NOT EXISTS idx_interactions_action ON project_interactions(action);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON project_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_composite ON project_interactions(project_id, action, created_at DESC);

-- =====================================================
-- 5.2 USER CONTRIBUTIONS - Performance tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS user_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    
    -- Contribution Details
    contribution_type TEXT NOT NULL 
        CHECK (contribution_type IN ('task_completion', 'code_review', 'design', 'documentation', 
                                     'milestone_complete', 'mentoring', 'testing')),
    description TEXT,
    
    -- Metrics
    hours_spent NUMERIC(5,2) CHECK (hours_spent >= 0),
    impact_score INT CHECK (impact_score BETWEEN 1 AND 10),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    CONSTRAINT unique_contribution UNIQUE(user_id, project_id, contribution_type, created_at)
);

CREATE INDEX IF NOT EXISTS idx_contributions_user ON user_contributions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contributions_project ON user_contributions(project_id);
CREATE INDEX IF NOT EXISTS idx_contributions_type ON user_contributions(contribution_type);

-- =====================================================
-- 5.3 ACTIVITIES - General activity log
-- =====================================================
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Activity Details
    type TEXT NOT NULL,
    details JSONB,
    is_public BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_public ON activities(is_public, created_at DESC) 
    WHERE is_public = TRUE;

-- =====================================================
-- 5.4 PROJECT UPDATES - Structured project changelog
-- =====================================================
CREATE TABLE IF NOT EXISTS project_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Update Content
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    
    -- Engagement
    likes_count INT DEFAULT 0 CHECK (likes_count >= 0),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_updates_project ON project_updates(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_updates_author ON project_updates(author_id);
CREATE INDEX IF NOT EXISTS idx_updates_created_at ON project_updates(created_at DESC);

/*
================================================================================
SECTION 6: AUTHENTICATION & SECURITY TABLES
================================================================================
*/

-- =====================================================
-- 6.1 REFRESH TOKENS - JWT token management
-- =====================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Token Information
    token TEXT NOT NULL,
    token_id TEXT NOT NULL,
    
    -- Status & Expiration
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_token_id UNIQUE(token_id),
    CONSTRAINT valid_revocation CHECK (is_revoked = FALSE OR revoked_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_id ON refresh_tokens(token_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(is_revoked, user_id) 
    WHERE is_revoked = TRUE;

-- =====================================================
-- 6.2 SESSIONS - Session management (if needed)
-- =====================================================
CREATE TABLE IF NOT EXISTS "session" (
    sid VARCHAR NOT NULL PRIMARY KEY COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON "session"(expire);

/*
================================================================================
SECTION 7: USER SETTINGS & PRIVACY TABLES
================================================================================
*/

-- =====================================================
-- 7.1 USER NOTIFICATIONS SETTINGS
-- =====================================================
CREATE TABLE IF NOT EXISTS user_notifications (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification Preferences
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    in_app_notifications BOOLEAN DEFAULT TRUE,
    
    -- Notification Types
    notify_on_project_request BOOLEAN DEFAULT TRUE,
    notify_on_comment BOOLEAN DEFAULT TRUE,
    notify_on_mention BOOLEAN DEFAULT TRUE,
    notify_on_like BOOLEAN DEFAULT TRUE,
    notify_on_task_assign BOOLEAN DEFAULT TRUE,
    notify_on_milestone BOOLEAN DEFAULT TRUE,
    notify_on_project_update BOOLEAN DEFAULT TRUE,
    notify_on_new_follower BOOLEAN DEFAULT TRUE,
    
    -- Frequency Control
    digest_frequency TEXT DEFAULT 'daily' 
        CHECK (digest_frequency IN ('real-time', 'daily', 'weekly', 'never')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7.2 USER PRIVACY SETTINGS
-- =====================================================
CREATE TABLE IF NOT EXISTS user_privacy (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Privacy Controls
    profile_visibility TEXT DEFAULT 'public' 
        CHECK (profile_visibility IN ('public', 'collaborators_only', 'followers_only', 'private')),
    
    -- Activity Sharing
    show_activity_feed BOOLEAN DEFAULT TRUE,
    show_projects BOOLEAN DEFAULT TRUE,
    show_connections BOOLEAN DEFAULT TRUE,
    
    -- Contact Preferences
    show_email BOOLEAN DEFAULT FALSE,
    allow_messages BOOLEAN DEFAULT TRUE,
    searchable BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

/*
================================================================================
SECTION 8: RECOMMENDATION & COMPATIBILITY TABLES
================================================================================
*/

-- =====================================================
-- 8.1 COMPATIBILITY SCORES - Performance metrics
-- =====================================================
CREATE TABLE IF NOT EXISTS compatibility_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Target Information
    target_id UUID NOT NULL,
    target_type TEXT NOT NULL 
        CHECK (target_type IN ('project', 'user')),
    
    -- Score Components
    score DECIMAL(5,2) NOT NULL 
        CHECK (score >= 0 AND score <= 100),
    skill_match_score DECIMAL(5,2),
    experience_match_score DECIMAL(5,2),
    activity_match_score DECIMAL(5,2),
    reputation_match_score DECIMAL(5,2),
    availability_match_score DECIMAL(5,2),
    timezone_match_score DECIMAL(5,2),
    
    -- Analysis
    explanation JSONB,
    
    -- Timestamps
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_compatibility UNIQUE(user_id, target_id, target_type)
);

CREATE INDEX IF NOT EXISTS idx_compatibility_user ON compatibility_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_compatibility_target ON compatibility_scores(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_compatibility_score ON compatibility_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_compatibility_calculated ON compatibility_scores(calculated_at DESC);

/*
================================================================================
SECTION 9: MATERIALIZED VIEWS FOR PERFORMANCE
================================================================================
*/

-- =====================================================
-- 9.1 User Statistics View
-- =====================================================
CREATE OR REPLACE VIEW user_stats_view AS
SELECT 
    u.id,
    u.username,
    u.reputation_points,
    u.followers_count,
    u.following_count,
    (SELECT COUNT(*) FROM projects WHERE creator_id = u.id AND is_deleted = FALSE) as projects_created,
    (SELECT COUNT(*) FROM project_collaborators WHERE user_id = u.id AND status = 'Active') as projects_joined,
    (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_created,
    (SELECT COUNT(*) FROM post_likes WHERE user_id = u.id) as posts_liked,
    u.created_at,
    u.updated_at
FROM users u
WHERE u.is_active = TRUE;

-- =====================================================
-- 9.2 Project Statistics View
-- =====================================================
CREATE OR REPLACE VIEW project_stats_view AS
SELECT 
    p.id,
    p.title,
    p.creator_id,
    p.status,
    p.collaborators_count,
    p.likes_count,
    p.comments_count,
    p.views_count,
    (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status = 'done') as tasks_completed,
    (SELECT COUNT(*) FROM project_milestones WHERE project_id = p.id AND status = 'completed') as milestones_completed,
    p.progress_percentage,
    p.created_at,
    p.updated_at
FROM projects p
WHERE p.is_deleted = FALSE;

/*
================================================================================
SECTION 10: TRIGGERS & FUNCTIONS FOR DATA INTEGRITY
================================================================================
*/

-- =====================================================
-- 10.1 Auto-update timestamps trigger
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_users_timestamp ON users;
CREATE TRIGGER trg_update_users_timestamp
    BEFORE UPDATE ON users FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_projects_timestamp ON projects;
CREATE TRIGGER trg_update_projects_timestamp
    BEFORE UPDATE ON projects FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_posts_timestamp ON posts;
CREATE TRIGGER trg_update_posts_timestamp
    BEFORE UPDATE ON posts FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10.2 Update likes counts
-- =====================================================
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts 
    SET likes_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = COALESCE(NEW.post_id, OLD.post_id))
    WHERE id = COALESCE(NEW.post_id, OLD.post_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_post_likes ON post_likes;
CREATE TRIGGER trg_update_post_likes
    AFTER INSERT OR DELETE ON post_likes FOR EACH ROW
    EXECUTE FUNCTION update_post_likes_count();

CREATE OR REPLACE FUNCTION update_project_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE projects 
    SET likes_count = (SELECT COUNT(*) FROM project_likes WHERE project_id = COALESCE(NEW.project_id, OLD.project_id))
    WHERE id = COALESCE(NEW.project_id, OLD.project_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_project_likes ON project_likes;
CREATE TRIGGER trg_update_project_likes
    AFTER INSERT OR DELETE ON project_likes FOR EACH ROW
    EXECUTE FUNCTION update_project_likes_count();

-- =====================================================
-- 10.3 Update follower/following counts
-- =====================================================
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if status is 'active', otherwise skip
    IF (TG_OP = 'INSERT' AND NEW.status != 'active') OR 
       (TG_OP = 'DELETE' AND OLD.status != 'active') THEN
        RETURN NULL;
    END IF;
    
    UPDATE users 
    SET followers_count = (SELECT COUNT(*) FROM user_connections WHERE following_id = COALESCE(NEW.following_id, OLD.following_id) AND status = 'active')
    WHERE id = COALESCE(NEW.following_id, OLD.following_id);
    
    UPDATE users 
    SET following_count = (SELECT COUNT(*) FROM user_connections WHERE follower_id = COALESCE(NEW.follower_id, OLD.follower_id) AND status = 'active')
    WHERE id = COALESCE(NEW.follower_id, OLD.follower_id);
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_follow_counts ON user_connections;
CREATE TRIGGER trg_update_follow_counts
    AFTER INSERT OR DELETE ON user_connections FOR EACH ROW
    EXECUTE FUNCTION update_follow_counts();

-- =====================================================
-- 10.4 Prevent duplicate pending collaboration requests
-- =====================================================
CREATE OR REPLACE FUNCTION validate_collaboration_request()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM collaboration_requests 
        WHERE project_id = NEW.project_id 
        AND requester_id = NEW.requester_id 
        AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'A pending collaboration request already exists for this user and project';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM projects 
        WHERE id = NEW.project_id AND creator_id = NEW.requester_id
    ) THEN
        RAISE EXCEPTION 'Cannot request collaboration on your own project';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_collaboration_request ON collaboration_requests;
CREATE TRIGGER trg_validate_collaboration_request
    BEFORE INSERT ON collaboration_requests FOR EACH ROW
    EXECUTE FUNCTION validate_collaboration_request();

-- =====================================================
-- 10.5 Update refresh token timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_refresh_tokens_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_refresh_tokens_timestamp ON refresh_tokens;
CREATE TRIGGER trg_update_refresh_tokens_timestamp
    BEFORE UPDATE ON refresh_tokens FOR EACH ROW
    EXECUTE FUNCTION update_refresh_tokens_timestamp();

-- =====================================================
-- 10.6 Update post comments count
-- =====================================================
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts 
    SET comments_count = (SELECT COUNT(*) FROM post_comments WHERE post_id = COALESCE(NEW.post_id, OLD.post_id) AND parent_comment_id IS NULL)
    WHERE id = COALESCE(NEW.post_id, OLD.post_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_post_comments ON post_comments;
CREATE TRIGGER trg_update_post_comments
    AFTER INSERT OR DELETE ON post_comments FOR EACH ROW
    EXECUTE FUNCTION update_post_comments_count();

-- =====================================================
-- 10.7 Update project collaborators count
-- =====================================================
CREATE OR REPLACE FUNCTION update_project_collaborators_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'Active' THEN
        UPDATE projects SET collaborators_count = (SELECT COUNT(*) FROM project_collaborators WHERE project_id = NEW.project_id AND status = 'Active')
        WHERE id = NEW.project_id;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'Active' THEN
        UPDATE projects SET collaborators_count = (SELECT COUNT(*) FROM project_collaborators WHERE project_id = OLD.project_id AND status = 'Active')
        WHERE id = OLD.project_id;
    ELSIF TG_OP = 'UPDATE' AND (OLD.status != NEW.status) THEN
        UPDATE projects SET collaborators_count = (SELECT COUNT(*) FROM project_collaborators WHERE project_id = NEW.project_id AND status = 'Active')
        WHERE id = NEW.project_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_project_collaborators ON project_collaborators;
CREATE TRIGGER trg_update_project_collaborators
    AFTER INSERT OR UPDATE OR DELETE ON project_collaborators FOR EACH ROW
    EXECUTE FUNCTION update_project_collaborators_count();

-- =====================================================
-- 10.8 Auto-update timestamps for multiple tables
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_tasks()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_tasks_timestamp ON project_tasks;
CREATE TRIGGER trg_update_tasks_timestamp
    BEFORE UPDATE ON project_tasks FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_tasks();

DROP TRIGGER IF EXISTS trg_update_milestones_timestamp ON project_milestones;
CREATE TRIGGER trg_update_milestones_timestamp
    BEFORE UPDATE ON project_milestones FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_resources_timestamp ON project_resources;
CREATE TRIGGER trg_update_resources_timestamp
    BEFORE UPDATE ON project_resources FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_project_files_timestamp ON project_files;
CREATE TRIGGER trg_update_project_files_timestamp
    BEFORE UPDATE ON project_files FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_workspace_files_timestamp ON workspace_files;
CREATE TRIGGER trg_update_workspace_files_timestamp
    BEFORE UPDATE ON workspace_files FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_project_updates_timestamp ON project_updates;
CREATE TRIGGER trg_update_project_updates_timestamp
    BEFORE UPDATE ON project_updates FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_collab_requests_timestamp ON collaboration_requests;
CREATE TRIGGER trg_update_collab_requests_timestamp
    BEFORE UPDATE ON collaboration_requests FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_connections_timestamp ON user_connections;
CREATE TRIGGER trg_update_connections_timestamp
    BEFORE UPDATE ON user_connections FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_user_skills_timestamp ON user_skills;
CREATE TRIGGER trg_update_user_skills_timestamp
    BEFORE UPDATE ON user_skills FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_compatibility_scores_timestamp ON compatibility_scores;
CREATE TRIGGER trg_update_compatibility_scores_timestamp
    BEFORE UPDATE ON compatibility_scores FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10.9 Auto-log post creation to activities
-- =====================================================
CREATE OR REPLACE FUNCTION log_post_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activities (user_id, type, details, is_public)
    VALUES (
        NEW.user_id,
        'post_created',
        jsonb_build_object(
            'post_id', NEW.id,
            'content_preview', SUBSTRING(NEW.content, 1, 100),
            'visibility', NEW.visibility
        ),
        NEW.visibility = 'public'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_post_creation ON posts;
CREATE TRIGGER trg_log_post_creation
    AFTER INSERT ON posts FOR EACH ROW
    EXECUTE FUNCTION log_post_activity();

-- =====================================================
-- 10.10 Auto-log project creation to activities
-- =====================================================
CREATE OR REPLACE FUNCTION log_project_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activities (user_id, type, details, is_public)
    VALUES (
        NEW.creator_id,
        'project_created',
        jsonb_build_object(
            'project_id', NEW.id,
            'title', NEW.title,
            'category', NEW.category,
            'is_public', NEW.is_public
        ),
        NEW.is_public
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_project_creation ON projects;
CREATE TRIGGER trg_log_project_creation
    AFTER INSERT ON projects FOR EACH ROW
    EXECUTE FUNCTION log_project_activity();

-- =====================================================
-- 10.11 Log collaboration request acceptance
-- =====================================================
CREATE OR REPLACE FUNCTION log_collaboration_accepted()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
        INSERT INTO activities (user_id, type, details, is_public)
        VALUES (
            NEW.requester_id,
            'collaboration_accepted',
            jsonb_build_object(
                'project_id', NEW.project_id,
                'accepted_by', NEW.owner_id,
                'created_at', NOW()
            ),
            FALSE
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_collaboration_accepted ON collaboration_requests;
CREATE TRIGGER trg_log_collaboration_accepted
    AFTER UPDATE ON collaboration_requests FOR EACH ROW
    EXECUTE FUNCTION log_collaboration_accepted();

-- =====================================================
-- 10.12 Auto-set completed_at when task is done
-- =====================================================
CREATE OR REPLACE FUNCTION auto_complete_task()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'done' AND OLD.status != 'done' THEN
        NEW.completed_at = NOW();
    ELSIF NEW.status != 'done' THEN
        NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_complete_task ON project_tasks;
CREATE TRIGGER trg_auto_complete_task
    BEFORE UPDATE ON project_tasks FOR EACH ROW
    EXECUTE FUNCTION auto_complete_task();

/*
================================================================================
SECTION 11: STORAGE BUCKETS & POLICIES
================================================================================
*/

-- =====================================================
-- 11.1 Create Storage Buckets
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-resources', 'project-resources', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 11.2 Profile Images Policies
-- =====================================================
DROP POLICY IF EXISTS "Public read profile images" ON storage.objects;
CREATE POLICY "Public read profile images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'profile-images');

DROP POLICY IF EXISTS "Auth upload profile images" ON storage.objects;
CREATE POLICY "Auth upload profile images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-images');

DROP POLICY IF EXISTS "Auth update profile images" ON storage.objects;
CREATE POLICY "Auth update profile images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-images');

DROP POLICY IF EXISTS "Auth delete profile images" ON storage.objects;
CREATE POLICY "Auth delete profile images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-images');

-- =====================================================
-- 11.3 Project Resources Policies
-- =====================================================
DROP POLICY IF EXISTS "Public read resources" ON storage.objects;
CREATE POLICY "Public read resources"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'project-resources');

DROP POLICY IF EXISTS "Auth upload resources" ON storage.objects;
CREATE POLICY "Auth upload resources"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-resources');

DROP POLICY IF EXISTS "Auth update resources" ON storage.objects;
CREATE POLICY "Auth update resources"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'project-resources');

DROP POLICY IF EXISTS "Auth delete resources" ON storage.objects;
CREATE POLICY "Auth delete resources"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-resources');

-- =====================================================
-- 11.4 Post Images Policies
-- =====================================================
DROP POLICY IF EXISTS "Public read post images" ON storage.objects;
CREATE POLICY "Public read post images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'post-images');

DROP POLICY IF EXISTS "Auth upload post images" ON storage.objects;
CREATE POLICY "Auth upload post images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Auth update post images" ON storage.objects;
CREATE POLICY "Auth update post images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Auth delete post images" ON storage.objects;
CREATE POLICY "Auth delete post images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);

/*
================================================================================
SECTION 12: ROW LEVEL SECURITY (RLS) POLICIES
================================================================================
*/

-- =====================================================
-- 12.1 Enable RLS on sensitive tables
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_privacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_files ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 12.2 Users table RLS policies
-- =====================================================
CREATE POLICY "Public user profiles"
ON users FOR SELECT
TO public
USING (is_public = TRUE AND is_active = TRUE);

CREATE POLICY "Users can view own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- =====================================================
-- 12.3 Posts table RLS policies
-- =====================================================
CREATE POLICY "Public posts are readable"
ON posts FOR SELECT
TO public
USING (visibility = 'public');

CREATE POLICY "Authenticated users can read posts"
ON posts FOR SELECT
TO authenticated
USING (visibility IN ('public', 'collaborators_only') OR user_id = auth.uid());

CREATE POLICY "Users can insert own posts"
ON posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
ON posts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 12.4 Projects RLS policies
-- =====================================================
CREATE POLICY "Public projects are readable"
ON projects FOR SELECT
TO public
USING (is_public = TRUE AND is_deleted = FALSE);

CREATE POLICY "Authenticated can read all active projects"
ON projects FOR SELECT
TO authenticated
USING (is_deleted = FALSE);

CREATE POLICY "Users can insert projects"
ON projects FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Project creators can update own projects"
ON projects FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Project creators can delete own projects"
ON projects FOR DELETE
TO authenticated
USING (auth.uid() = creator_id);

-- =====================================================
-- 12.5 User Connections RLS policies
-- =====================================================
CREATE POLICY "Users can view own connections"
ON user_connections FOR SELECT
TO authenticated
USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "Users can create connections"
ON user_connections FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can update own connections"
ON user_connections FOR UPDATE
TO authenticated
USING (auth.uid() = follower_id)
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete own connections"
ON user_connections FOR DELETE
TO authenticated
USING (auth.uid() = follower_id);

-- =====================================================
-- 12.6 Project Files RLS policies
-- =====================================================
CREATE POLICY "Users can read own project files"
ON project_files FOR SELECT
TO authenticated
USING (uploader_id = auth.uid() OR is_public = TRUE OR 
    EXISTS (
        SELECT 1 FROM project_collaborators 
        WHERE project_collaborators.project_id = project_files.project_id 
        AND project_collaborators.user_id = auth.uid()
    ));

CREATE POLICY "Users can upload project files"
ON project_files FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploader_id AND 
    EXISTS (
        SELECT 1 FROM project_collaborators 
        WHERE project_collaborators.project_id = project_files.project_id 
        AND project_collaborators.user_id = auth.uid()
    ));

CREATE POLICY "Users can update own project files"
ON project_files FOR UPDATE
TO authenticated
USING (auth.uid() = uploader_id AND 
    EXISTS (
        SELECT 1 FROM project_collaborators 
        WHERE project_collaborators.project_id = project_files.project_id 
        AND project_collaborators.user_id = auth.uid()
    ))
WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "Users can delete own project files"
ON project_files FOR DELETE
TO authenticated
USING (auth.uid() = uploader_id AND 
    EXISTS (
        SELECT 1 FROM project_collaborators 
        WHERE project_collaborators.project_id = project_files.project_id 
        AND project_collaborators.user_id = auth.uid()
    ));

-- =====================================================
-- 12.7 Workspace Files RLS policies
-- =====================================================
CREATE POLICY "Users can read workspace files"
ON workspace_files FOR SELECT
TO authenticated
USING (is_public = TRUE OR uploader_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM project_collaborators 
        WHERE project_collaborators.project_id = workspace_files.workspace_id 
        AND project_collaborators.user_id = auth.uid()
    ));

CREATE POLICY "Users can upload workspace files"
ON workspace_files FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "Users can update own workspace files"
ON workspace_files FOR UPDATE
TO authenticated
USING (auth.uid() = uploader_id)
WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "Users can delete own workspace files"
ON workspace_files FOR DELETE
TO authenticated
USING (auth.uid() = uploader_id);

-- =====================================================
-- 12.8 Refresh tokens RLS
-- =====================================================
CREATE POLICY "Users can access own tokens"
ON refresh_tokens FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- 12.9 Settings tables RLS
-- =====================================================
CREATE POLICY "Users can access own notification settings"
ON user_notifications FOR ALL
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can access own privacy settings"
ON user_privacy FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- 12.10 Notifications RLS policies
-- =====================================================
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
TO authenticated
USING (auth.uid() = recipient_id);

CREATE POLICY "System can create notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (TRUE);

CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

-- =====================================================
-- 12.11 Activities RLS policies
-- =====================================================
CREATE POLICY "Users can view own activities"
ON activities FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Public activities are readable"
ON activities FOR SELECT
TO public
USING (is_public = TRUE);

CREATE POLICY "Users can create own activities"
ON activities FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 12.12 Collaboration Requests RLS policies
-- =====================================================
CREATE POLICY "Requesters can view own requests"
ON collaboration_requests FOR SELECT
TO authenticated
USING (auth.uid() = requester_id);

CREATE POLICY "Project creators can view requests"
ON collaboration_requests FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = collaboration_requests.project_id 
    AND projects.creator_id = auth.uid()
));

CREATE POLICY "Authenticated users can create requests"
ON collaboration_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Project creators can update requests"
ON collaboration_requests FOR UPDATE
TO authenticated
USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = collaboration_requests.project_id 
    AND projects.creator_id = auth.uid()
))
WITH CHECK (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = collaboration_requests.project_id 
    AND projects.creator_id = auth.uid()
));

/*
================================================================================
SECTION 13: MAINTENANCE & OPTIMIZATION FUNCTIONS
================================================================================
*/

-- =====================================================
-- 13.1 Cleanup expired refresh tokens
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS TABLE(deleted_count INT) AS $$
DECLARE
    deleted INT;
BEGIN
    DELETE FROM refresh_tokens 
    WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN QUERY SELECT deleted;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 13.2 Cleanup old notifications  
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_notifications(days_old INT DEFAULT 90)
RETURNS TABLE(deleted_count INT) AS $$
DECLARE
    deleted INT;
BEGIN
    DELETE FROM notifications 
    WHERE is_read = TRUE AND created_at < NOW() - INTERVAL '1 day' * days_old;
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN QUERY SELECT deleted;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 13.3 Cleanup old activities
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_activities(days_old INT DEFAULT 365)
RETURNS TABLE(deleted_count INT) AS $$
DECLARE
    deleted INT;
BEGIN
    DELETE FROM activities 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_old;
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN QUERY SELECT deleted;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 13.4 Recalculate user statistics
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_user_stats(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE users SET
        followers_count = (
            SELECT COUNT(*) FROM user_connections 
            WHERE following_id = target_user_id AND status = 'active'
        ),
        following_count = (
            SELECT COUNT(*) FROM user_connections 
            WHERE follower_id = target_user_id AND status = 'active'
        ),
        reputation_points = COALESCE((
            SELECT SUM(CAST(impact_score AS INT)) FROM user_contributions 
            WHERE user_id = target_user_id
        ), 0)
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql;

/*
================================================================================
SECTION 14: ANALYSIS & VERIFICATION QUERIES
================================================================================
*/

-- Verify all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Count all indexes
SELECT COUNT(*) as total_indexes
FROM pg_indexes 
WHERE schemaname = 'public';

-- List all indexes
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY indexname;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = TRUE 
ORDER BY tablename;

================================================================================
END OF ENHANCED DATABASE SCHEMA
Version: 2.0.0 | Date: 2026-03-20
================================================================================
*/
