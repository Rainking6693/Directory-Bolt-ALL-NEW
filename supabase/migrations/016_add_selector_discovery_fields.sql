-- Migration 016: Add Selector Discovery Fields
-- Purpose: Enable automated selector discovery and tracking
-- Created: 2025-01-18

-- Add columns for selector discovery
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

-- Add index for filtering by discovery status
CREATE INDEX IF NOT EXISTS idx_directories_discovery_flags
ON directories(requires_login, has_captcha) WHERE requires_login = true OR has_captcha = true;

-- Add atomic update function to prevent race conditions
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

-- Add function to get stale directories (selectors older than N days)
CREATE OR REPLACE FUNCTION get_stale_selector_directories(days_old INTEGER DEFAULT 30)
RETURNS TABLE (
  id UUID,
  name TEXT,
  submission_url TEXT,
  days_since_update INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.submission_url,
    EXTRACT(DAY FROM NOW() - d.selectors_updated_at)::INTEGER as days_since_update
  FROM directories d
  WHERE d.selectors_updated_at IS NOT NULL
    AND d.selectors_updated_at < NOW() - (days_old || ' days')::INTERVAL
    AND d.submission_url IS NOT NULL
  ORDER BY d.selectors_updated_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON COLUMN directories.field_selectors IS 'Auto-discovered CSS selectors for form fields (JSONB map of field name to selector)';
COMMENT ON COLUMN directories.selectors_updated_at IS 'Last time selectors were discovered/updated';
COMMENT ON COLUMN directories.selector_discovery_log IS 'Metadata about selector discovery runs (confidence scores, errors, etc.)';
COMMENT ON COLUMN directories.requires_login IS 'Directory requires authentication before submission';
COMMENT ON COLUMN directories.has_captcha IS 'Directory has CAPTCHA or bot protection';
COMMENT ON COLUMN directories.failure_rate IS 'Historical failure rate for submissions (0.00-1.00)';
COMMENT ON FUNCTION update_directory_selectors IS 'Atomically update directory selectors to prevent race conditions';
COMMENT ON FUNCTION get_stale_selector_directories IS 'Get directories with selectors older than N days for refresh';

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_directory_selectors TO authenticated;
GRANT EXECUTE ON FUNCTION get_stale_selector_directories TO authenticated;
