-- Create user_connections table for connection requests
-- Supports connection/follow functionality between users

CREATE TABLE IF NOT EXISTS user_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate connections
    CONSTRAINT unique_connection UNIQUE (follower_id, following_id),
    
    -- Prevent self-connections
    CONSTRAINT no_self_connection CHECK (follower_id != following_id),
    
    -- Status must be valid
    CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'rejected'))
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_connections_follower ON user_connections(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_following ON user_connections(following_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_status ON user_connections(status);

-- Comment on table
COMMENT ON TABLE user_connections IS 'Stores connection requests and relationships between users';
COMMENT ON COLUMN user_connections.follower_id IS 'User who initiated the connection request';
COMMENT ON COLUMN user_connections.following_id IS 'User who received the connection request';
COMMENT ON COLUMN user_connections.status IS 'Connection status: pending, active, or rejected';
