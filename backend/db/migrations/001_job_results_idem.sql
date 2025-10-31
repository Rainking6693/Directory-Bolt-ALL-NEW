-- Migration: Add idempotency support to job_results
-- Purpose: Prevent duplicate submissions via unique idempotency keys

-- Create job_results table if it doesn't exist
CREATE TABLE IF NOT EXISTS job_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    directory_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('submitting', 'submitted', 'failed', 'skipped')),
    idempotency_key TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    response_log JSONB DEFAULT '{}',
    screenshot_url TEXT,
    listing_url TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on idempotency_key to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_results_idempotency 
ON job_results(idempotency_key);

-- Index for querying by job_id
CREATE INDEX IF NOT EXISTS idx_job_results_job_id 
ON job_results(job_id, created_at DESC);

-- Index for querying by status
CREATE INDEX IF NOT EXISTS idx_job_results_status 
ON job_results(status, created_at DESC);

-- RLS: Enable row-level security
ALTER TABLE job_results ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY service_role_all ON job_results
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Authenticated users can read their own job results
CREATE POLICY customer_read_own ON job_results
FOR SELECT
TO authenticated
USING (
    job_id IN (
        SELECT id FROM jobs WHERE customer_id = auth.uid()
    )
);

-- Function: Update updated_at on row changes
CREATE OR REPLACE FUNCTION update_job_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at
DROP TRIGGER IF EXISTS trigger_job_results_updated_at ON job_results;
CREATE TRIGGER trigger_job_results_updated_at
BEFORE UPDATE ON job_results
FOR EACH ROW
EXECUTE FUNCTION update_job_results_updated_at();

-- Comments
COMMENT ON TABLE job_results IS 'Stores results of individual directory submissions with idempotency';
COMMENT ON COLUMN job_results.idempotency_key IS 'SHA256 hash of job_id + directory + business_data for deduplication';
COMMENT ON COLUMN job_results.payload IS 'Request payload sent to directory';
COMMENT ON COLUMN job_results.response_log IS 'Response data, screenshots, and execution logs';
