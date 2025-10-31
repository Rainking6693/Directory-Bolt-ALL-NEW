-- Migration: Queue history for audit trail and debugging
-- Purpose: Append-only log of all queue events and state transitions

CREATE TABLE IF NOT EXISTS queue_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    directory_name TEXT,
    event TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    worker_id UUID REFERENCES worker_heartbeats(worker_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by job_id
CREATE INDEX IF NOT EXISTS idx_queue_history_job_id 
ON queue_history(job_id, created_at DESC);

-- Index for querying by event type
CREATE INDEX IF NOT EXISTS idx_queue_history_event 
ON queue_history(event, created_at DESC);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_queue_history_created_at 
ON queue_history(created_at DESC);

-- RLS: Enable row-level security
ALTER TABLE queue_history ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY service_role_all ON queue_history
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Staff users can read all history
CREATE POLICY staff_read_all ON queue_history
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM staff_users WHERE user_id = auth.uid()
    )
);

-- Policy: Customers can read their own job history
CREATE POLICY customer_read_own ON queue_history
FOR SELECT
TO authenticated
USING (
    job_id IN (
        SELECT id FROM jobs WHERE customer_id = auth.uid()
    )
);

-- Function: Prevent updates/deletes (append-only)
CREATE OR REPLACE FUNCTION prevent_queue_history_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'queue_history is append-only; updates and deletes are not allowed';
END;
$$ LANGUAGE plpgsql;

-- Triggers: Enforce append-only
DROP TRIGGER IF EXISTS trigger_prevent_queue_history_update ON queue_history;
CREATE TRIGGER trigger_prevent_queue_history_update
BEFORE UPDATE ON queue_history
FOR EACH ROW
EXECUTE FUNCTION prevent_queue_history_modification();

DROP TRIGGER IF EXISTS trigger_prevent_queue_history_delete ON queue_history;
CREATE TRIGGER trigger_prevent_queue_history_delete
BEFORE DELETE ON queue_history
FOR EACH ROW
EXECUTE FUNCTION prevent_queue_history_modification();

-- Comments
COMMENT ON TABLE queue_history IS 'Append-only audit log of all queue events and state transitions';
COMMENT ON COLUMN queue_history.event IS 'Event type: claimed, submitting, submitted, retry, failed, dlq';
COMMENT ON COLUMN queue_history.details IS 'Additional context: error messages, retry counts, timestamps';
