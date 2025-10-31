-- Migration: Fix directories table schema for DirectoryBolt

-- Create or update the directories table
CREATE TABLE IF NOT EXISTS directories (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  correct_submission_url text UNIQUE NOT NULL,
  category text,
  domain_authority integer,
  impact_level text,
  tier_level text,
  difficulty integer CHECK (difficulty >= 1 AND difficulty <= 10),
  traffic_estimate integer CHECK (traffic_estimate > 0),
  time_to_approval integer,
  has_captcha boolean
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_directories_name ON directories (name);
CREATE INDEX IF NOT EXISTS idx_directories_url ON directories (submission_url);
CREATE INDEX IF NOT EXISTS idx_directories_category ON directories (category);

-- Note: After running this migration, import ENHANCED-DIRECTORIES.csv using Supabase dashboard or a script.
