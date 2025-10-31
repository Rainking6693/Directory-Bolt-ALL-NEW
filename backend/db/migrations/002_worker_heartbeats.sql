-- Migration: Worker heartbeats for monitoring and health checks
-- Purpose: Track active workers, their health, and queue metrics

CREATE TABLE IF NOT EXISTS worker_heartbeats (
    worker_id UUID PRIMARY KEY,
    queue_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('starting', 'idle', 'running', 'paused', 'error')),
    current_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    queue_depth INT DEFAULT 0,
    processing_count INT DEFAULT 0,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Index for finding stale workers (no heartbeat in >2 minutes)
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_stale 
ON worker_heartbeats(last_heartbeat DESC) 
WHERE status IN ('running', 'idle');

-- Index for active workers by queue
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_queue 
ON worker_heartbeats(queue_name, status);

-- RLS: Enable row-level security
ALTER TABLE worker_heartbeats ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY service_role_all ON worker_heartbeats
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Staff users can read all heartbeats
CREATE POLICY staff_read_all ON worker_heartbeats
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM staff_users WHERE user_id = auth.uid()
    )
);

-- Function: Update updated_at on row changes
CREATE OR REPLACE FUNCTION update_worker_heartbeats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at
DROP TRIGGER IF EXISTS trigger_worker_heartbeats_updated_at ON worker_heartbeats;
CREATE TRIGGER trigger_worker_heartbeats_updated_at
BEFORE UPDATE ON worker_heartbeats
FOR EACH ROW
EXECUTE FUNCTION update_worker_heartbeats_updated_at();

-- View: Stale workers (no heartbeat in 2+ minutes)
CREATE OR REPLACE VIEW stale_workers AS
SELECT 
    worker_id,
    queue_name,
    status,
    current_job_id,
    last_heartbeat,
    EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) AS seconds_since_heartbeat
FROM worker_heartbeats
WHERE last_heartbeat < NOW() - INTERVAL '2 minutes'
    AND status IN ('running', 'idle')
ORDER BY last_heartbeat ASC;

-- Comments
COMMENT ON TABLE worker_heartbeats IS 'Tracks worker health and activity for monitoring';
COMMENT ON COLUMN worker_heartbeats.queue_depth IS 'Number of messages in queue (updated periodically)';
COMMENT ON COLUMN worker_heartbeats.processing_count IS 'Number of jobs currently being processed by this worker';
COMMENT ON VIEW stale_workers IS 'Workers that haven''t sent a heartbeat in 2+ minutes';
