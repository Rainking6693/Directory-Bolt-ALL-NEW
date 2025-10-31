-- CRITICAL FIX: Add missing columns to AutoBolt tables
-- Execute this SQL in your Supabase SQL Editor to fix the missing database schema

-- =========================================
-- FIX 1: Add missing columns to directory_submissions table
-- =========================================

-- Add directory_category column
ALTER TABLE directory_submissions 
ADD COLUMN IF NOT EXISTS directory_category VARCHAR(100);

-- Add directory_tier column with constraint
ALTER TABLE directory_submissions 
ADD COLUMN IF NOT EXISTS directory_tier VARCHAR(50) DEFAULT 'standard';

-- Add the tier constraint if it doesn't exist
ALTER TABLE directory_submissions 
DROP CONSTRAINT IF EXISTS directory_submissions_directory_tier_check;

ALTER TABLE directory_submissions 
ADD CONSTRAINT directory_submissions_directory_tier_check 
CHECK (directory_tier IN ('standard', 'premium', 'enterprise'));

-- Add processing_time_seconds column
ALTER TABLE directory_submissions 
ADD COLUMN IF NOT EXISTS processing_time_seconds INTEGER;

-- Add error_message column if it doesn't exist
ALTER TABLE directory_submissions 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- =========================================
-- FIX 2: Add missing columns to autobolt_processing_queue table
-- =========================================

-- Add error_message column
ALTER TABLE autobolt_processing_queue 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add started_at timestamp
ALTER TABLE autobolt_processing_queue 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- Add completed_at timestamp
ALTER TABLE autobolt_processing_queue 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add processed_by column
ALTER TABLE autobolt_processing_queue 
ADD COLUMN IF NOT EXISTS processed_by VARCHAR(100);

-- =========================================
-- FIX 3: Ensure the updated_at trigger function exists
-- =========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure trigger exists on directory_submissions
DROP TRIGGER IF EXISTS update_directory_submissions_updated_at ON directory_submissions;
CREATE TRIGGER update_directory_submissions_updated_at 
    BEFORE UPDATE ON directory_submissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Ensure trigger exists on autobolt_processing_queue
DROP TRIGGER IF EXISTS update_autobolt_queue_updated_at ON autobolt_processing_queue;
CREATE TRIGGER update_autobolt_queue_updated_at 
    BEFORE UPDATE ON autobolt_processing_queue 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- FIX 4: Add indexes for the new columns
-- =========================================

CREATE INDEX IF NOT EXISTS idx_directory_submissions_category 
ON directory_submissions(directory_category);

CREATE INDEX IF NOT EXISTS idx_directory_submissions_tier 
ON directory_submissions(directory_tier);

CREATE INDEX IF NOT EXISTS idx_autobolt_queue_started_at 
ON autobolt_processing_queue(started_at);

CREATE INDEX IF NOT EXISTS idx_autobolt_queue_completed_at 
ON autobolt_processing_queue(completed_at);