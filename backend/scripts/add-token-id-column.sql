/**
 * Migration: Add token_id column to refresh_tokens table
 * Fixes: ERROR: 42703: column "token_id" does not exist
 * 
 * This migration adds the missing token_id column to existing refresh_tokens table
 * Run this if you get "column token_id does not exist" error
 */

-- Drop existing index first to avoid conflicts
DROP INDEX IF EXISTS idx_refresh_tokens_token_id;

-- Add token_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'refresh_tokens' AND column_name = 'token_id'
  ) THEN
    ALTER TABLE refresh_tokens ADD COLUMN token_id TEXT;
    
    -- Generate unique token_id for existing rows
    UPDATE refresh_tokens SET token_id = gen_random_uuid()::text WHERE token_id IS NULL;
    
    -- Make it NOT NULL after populating
    ALTER TABLE refresh_tokens ALTER COLUMN token_id SET NOT NULL;
    
    -- Add UNIQUE constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'refresh_tokens_token_id_unique'
    ) THEN
      ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_token_id_unique UNIQUE (token_id);
    END IF;
    
    -- Add comment
    COMMENT ON COLUMN refresh_tokens.token_id IS 'Unique identifier embedded in JWT for token validation';
    
    RAISE NOTICE 'Successfully added token_id column to refresh_tokens table';
  ELSE
    RAISE NOTICE 'token_id column already exists in refresh_tokens table';
  END IF;
END $$;

-- Create index for performance (safe to run even if column already exists)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_id ON refresh_tokens(token_id);
