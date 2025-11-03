-- Migration: Find Stale Jobs Function
-- Purpose: Detect jobs stuck in 'in_progress' with no recent worker heartbeat
-- Date: 2025-11-02

-- Create function to find stale jobs
CREATE OR REPLACE FUNCTION find_stale_jobs(threshold_minutes INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    customer_id UUID,
    status TEXT,
    package_size TEXT,
    priority_level INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.id,
        j.customer_id,
        j.status,
        j.package_size,
        j.priority_level,
        j.created_at,
        j.updated_at,
        wh.last_heartbeat
    FROM jobs j
    LEFT JOIN LATERAL (
        SELECT MAX(last_seen) as last_heartbeat
        FROM worker_heartbeats
        WHERE worker_id::text = j.id::text
    ) wh ON true
    WHERE j.status = 'in_progress'
    AND (
        wh.last_heartbeat IS NULL 
        OR wh.last_heartbeat < NOW() - (threshold_minutes || ' minutes')::INTERVAL
    )
    AND j.updated_at < NOW() - (threshold_minutes || ' minutes')::INTERVAL
    ORDER BY j.updated_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION find_stale_jobs(INTEGER) TO service_role;

-- Create a view for easy monitoring
CREATE OR REPLACE VIEW stale_jobs_view AS
SELECT 
    j.id,
    j.customer_id,
    j.status,
    j.package_size,
    j.priority_level,
    j.created_at,
    j.updated_at,
    wh.last_heartbeat,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(wh.last_heartbeat, j.updated_at))) / 60 AS minutes_stale
FROM jobs j
LEFT JOIN LATERAL (
    SELECT MAX(last_seen) as last_heartbeat
    FROM worker_heartbeats
    WHERE worker_id::text = j.id::text
) wh ON true
WHERE j.status = 'in_progress'
AND (
    wh.last_heartbeat IS NULL 
    OR wh.last_heartbeat < NOW() - INTERVAL '10 minutes'
)
AND j.updated_at < NOW() - INTERVAL '10 minutes'
ORDER BY j.updated_at ASC;

-- Grant select permission on view
GRANT SELECT ON stale_jobs_view TO service_role;
GRANT SELECT ON stale_jobs_view TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION find_stale_jobs IS 'Finds jobs stuck in in_progress status with no recent worker heartbeat';
COMMENT ON VIEW stale_jobs_view IS 'Real-time view of stale jobs for monitoring';

