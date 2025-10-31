-- Migration: Add Selector Discovery System Fields
-- Date: 2025-10-18
-- Purpose: Add support for automated selector discovery, form intelligence, and directory classification

-- Add columns for selector discovery and form intelligence
ALTER TABLE directories
ADD COLUMN IF NOT EXISTS field_selectors JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS selectors_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS selector_discovery_log JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS requires_login BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_captcha BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS failure_rate DECIMAL(3,2) DEFAULT 0.00;

-- Add index for performance on selector freshness queries
CREATE INDEX IF NOT EXISTS idx_directories_selectors_updated
ON directories(selectors_updated_at DESC);

-- Add atomic update function to prevent race conditions during selector updates
CREATE OR REPLACE FUNCTION update_directory_selectors(
  dir_id UUID,
  new_selectors JSONB,
  discovery_log JSONB
)
RETURNS void AS $$
BEGIN
  UPDATE directories
  SET
    field_selectors = field_selectors || new_selectors,
    selectors_updated_at = NOW(),
    selector_discovery_log = discovery_log
  WHERE id = dir_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON COLUMN directories.field_selectors IS 'Auto-discovered CSS selectors for form fields (e.g., {"businessName": "#company-name", "email": "input[type=email]"})';
COMMENT ON COLUMN directories.selectors_updated_at IS 'Last time selectors were discovered/updated via automated discovery';
COMMENT ON COLUMN directories.selector_discovery_log IS 'Metadata about selector discovery runs (success/failure, confidence scores, timestamp)';
COMMENT ON COLUMN directories.requires_login IS 'Whether directory requires authentication before submission';
COMMENT ON COLUMN directories.has_captcha IS 'Whether directory has CAPTCHA protection detected';
COMMENT ON COLUMN directories.failure_rate IS 'Historical failure rate (0.00-1.00) for submission success tracking';
COMMENT ON FUNCTION update_directory_selectors IS 'Atomically update directory selectors to prevent race conditions during concurrent discovery';

-- Verify migration applied successfully
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251018_add_selector_discovery_fields applied successfully';
END $$;
