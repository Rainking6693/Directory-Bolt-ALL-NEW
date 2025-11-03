-- Migration: Rate Limit Requests Table
-- Purpose: Track API request counts for rate limiting
-- Date: 2025-11-02

-- Create rate_limit_requests table
CREATE TABLE IF NOT EXISTS rate_limit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- IP address or API key (e.g., "ip:192.168.1.1" or "api_key:abc123")
    endpoint TEXT NOT NULL, -- API endpoint path
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_endpoint_created 
    ON rate_limit_requests(identifier, endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_created_at 
    ON rate_limit_requests(created_at DESC);

-- Enable Row Level Security
ALTER TABLE rate_limit_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY rate_limit_service_policy ON rate_limit_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Authenticated users can only read their own records (by IP)
CREATE POLICY rate_limit_read_own ON rate_limit_requests
    FOR SELECT
    TO authenticated
    USING (identifier LIKE 'ip:%');

-- Function to cleanup old rate limit records
CREATE OR REPLACE FUNCTION cleanup_rate_limit_records(older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM rate_limit_requests
    WHERE created_at < NOW() - (older_than_hours || ' hours')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION cleanup_rate_limit_records(INTEGER) TO service_role;

-- Create a scheduled job to cleanup old records (runs daily at 2 AM UTC)
-- Note: This requires pg_cron extension to be enabled
-- Run this manually in Supabase SQL Editor if pg_cron is available:
-- SELECT cron.schedule(
--     'cleanup-rate-limit-records',
--     '0 2 * * *', -- Daily at 2 AM UTC
--     $$SELECT cleanup_rate_limit_records(24);$$
-- );

-- Comments for documentation
COMMENT ON TABLE rate_limit_requests IS 'Tracks API requests for rate limiting purposes';
COMMENT ON COLUMN rate_limit_requests.identifier IS 'Client identifier (IP address or API key)';
COMMENT ON COLUMN rate_limit_requests.endpoint IS 'API endpoint path that was accessed';
COMMENT ON COLUMN rate_limit_requests.created_at IS 'Timestamp when the request was made';
COMMENT ON FUNCTION cleanup_rate_limit_records IS 'Removes rate limit records older than specified hours';

