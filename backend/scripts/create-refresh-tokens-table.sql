/**
 * Migration: Create Refresh Tokens Table
 * Stores JWT refresh tokens for multi-device support
 * Run this migration before deploying JWT authentication
 */

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  token_id TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_id ON refresh_tokens(token_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_refresh_tokens_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_refresh_tokens_timestamp ON refresh_tokens;
CREATE TRIGGER trg_update_refresh_tokens_timestamp
  BEFORE UPDATE ON refresh_tokens
  FOR EACH ROW
  EXECUTE PROCEDURE update_refresh_tokens_timestamp();

-- Add comment to table
COMMENT ON TABLE refresh_tokens IS 'Stores JWT refresh tokens for authentication. Supports multiple devices per user.';
COMMENT ON COLUMN refresh_tokens.token_id IS 'Unique identifier embedded in JWT for token validation';
COMMENT ON COLUMN refresh_tokens.is_revoked IS 'Set to TRUE when user logs out or token is invalidated';

-- Cleanup: Remove expired tokens (optional, can be run periodically)
-- DELETE FROM refresh_tokens WHERE expires_at < NOW() AND is_revoked = FALSE;

-- Cleanup: Remove old revoked tokens (optional, can be run periodically)
-- DELETE FROM refresh_tokens WHERE is_revoked = TRUE AND revoked_at < NOW() - INTERVAL '30 days';
