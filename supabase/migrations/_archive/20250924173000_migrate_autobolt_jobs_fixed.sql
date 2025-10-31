-- DirectoryBolt AutoBolt Queue Migration - FIXED VERSION
-- Purpose: migrate legacy autobolt_processing_queue / directory_submissions schema
--          into the canonical jobs / job_results tables, recreate RPC functions,
--          and decommission the legacy tables.
-- Date: 2025-09-24

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Create canonical staging tables (will be renamed to jobs/job_results)
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS jobs_migrated CASCADE;
CREATE TABLE jobs_migrated (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Job Identification
    customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
    package_size INTEGER NOT NULL CHECK (package_size IN (50,100,300,500)),
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'complete', 'failed')) DEFAULT 'pending',
    priority_level INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

DROP TABLE IF EXISTS job_results_migrated CASCADE;
CREATE TABLE job_results_migrated (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs_migrated (id) ON DELETE CASCADE,
    directory_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','submitted','failed','retry')) DEFAULT 'pending',
    response_log JSONB DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- 2. Migrate data from legacy tables to new schema
-- ---------------------------------------------------------------------------

-- Migrate from autobolt_processing_queue to jobs_migrated
INSERT INTO jobs_migrated (
    id, customer_id, package_size, status, priority_level,
    created_at, updated_at, started_at, completed_at, error_message, metadata
)
SELECT
    apq.id,
    c.id AS customer_id,
    CASE
        WHEN apq.package_type = 'starter' THEN 50
        WHEN apq.package_type = 'growth' THEN 100
        WHEN apq.package_type = 'professional' THEN 300
        WHEN apq.package_type = 'enterprise' THEN 500
        ELSE 50
    END AS package_size,
    CASE
        WHEN apq.status = 'queued' THEN 'pending'
        WHEN apq.status = 'processing' THEN 'in_progress'
        WHEN apq.status = 'completed' THEN 'complete'
        WHEN apq.status = 'failed' THEN 'failed'
        WHEN apq.status = 'paused' THEN 'pending'
        ELSE 'pending'
    END AS status,
    COALESCE(apq.priority_level, 3) AS priority_level,
    apq.created_at,
    apq.updated_at,
    apq.started_at,
    apq.completed_at,
    apq.error_message,
    jsonb_build_object(
        'business_name', apq.business_name,
        'email', apq.email,
        'old_package_type', apq.package_type,
        'old_directory_limit', apq.directory_limit,
        'created_by', apq.created_by,
        'processed_by', apq.processed_by
    ) || COALESCE(apq.metadata, '{}'::jsonb) AS metadata
FROM autobolt_processing_queue apq
LEFT JOIN customers c ON apq.customer_id = c.id
WHERE c.id IS NOT NULL;

-- Migrate from directory_submissions to job_results_migrated
INSERT INTO job_results_migrated (
    id, job_id, directory_name, status, response_log, submitted_at, retry_count
)
SELECT
    ds.id,
    ds.queue_id AS job_id,
    ds.directory_name,
    CASE
        WHEN ds.submission_status = 'submitted' THEN 'submitted'
        WHEN ds.submission_status = 'approved' THEN 'submitted'
        WHEN ds.submission_status = 'failed' THEN 'failed'
        WHEN ds.submission_status = 'pending' THEN 'pending'
        WHEN ds.submission_status = 'processing' THEN 'pending'
        WHEN ds.submission_status = 'rejected' THEN 'failed'
        ELSE 'pending'
    END AS status,
    jsonb_build_object(
        'directory_url', ds.directory_url,
        'directory_category', ds.directory_category,
        'directory_tier', ds.directory_tier,
        'listing_url', ds.listing_url,
        'rejection_reason', ds.rejection_reason,
        'domain_authority', ds.domain_authority,
        'estimated_traffic', ds.estimated_traffic,
        'processing_time_seconds', ds.processing_time_seconds
    ) || COALESCE(ds.metadata, '{}'::jsonb) AS response_log,
    ds.submitted_at,
    COALESCE(ds.retry_count, 0) AS retry_count
FROM directory_submissions ds
WHERE ds.queue_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Replace old tables with new ones
-- ---------------------------------------------------------------------------

-- Drop existing jobs and job_results tables if they exist
DROP TABLE IF EXISTS job_results CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;

-- Rename new tables to canonical names
ALTER TABLE jobs_migrated RENAME TO jobs;
ALTER TABLE job_results_migrated RENAME TO job_results;

-- Rename old tables to _legacy for archival
ALTER TABLE autobolt_processing_queue RENAME TO autobolt_processing_queue_legacy;
ALTER TABLE directory_submissions RENAME TO directory_submissions_legacy;

-- ---------------------------------------------------------------------------
-- 4. Create indexes for new tables
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS jobs_customer_id_idx ON jobs (customer_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);
CREATE INDEX IF NOT EXISTS jobs_priority_level_idx ON jobs (priority_level);
CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs (created_at);

CREATE INDEX IF NOT EXISTS job_results_job_id_idx ON job_results (job_id);
CREATE INDEX IF NOT EXISTS job_results_status_idx ON job_results (status);
CREATE INDEX IF NOT EXISTS job_results_directory_name_idx ON job_results (directory_name);

-- ---------------------------------------------------------------------------
-- 5. Create triggers for updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER update_jobs_timestamp
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_results_timestamp
    BEFORE UPDATE ON job_results
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 6. Enable RLS and create policies
-- ---------------------------------------------------------------------------

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can access all jobs data" ON jobs FOR ALL USING (true);
CREATE POLICY "Service role can access all job results" ON job_results FOR ALL USING (true);

-- ---------------------------------------------------------------------------
-- 7. Drop and recreate RPC functions
-- ---------------------------------------------------------------------------

-- Drop existing functions
DROP FUNCTION IF EXISTS get_queue_stats() CASCADE;
DROP FUNCTION IF EXISTS get_next_job_in_queue() CASCADE;
DROP FUNCTION IF EXISTS get_job_progress_for_staff() CASCADE;
DROP FUNCTION IF EXISTS mark_job_in_progress(uuid) CASCADE;
DROP FUNCTION IF EXISTS complete_autobolt_job(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS update_job_progress(uuid, text, text, jsonb, timestamptz) CASCADE;

-- get_job_queue_stats
CREATE OR REPLACE FUNCTION get_job_queue_stats()
RETURNS TABLE (
    total_pending INTEGER,
    total_in_progress INTEGER,
    total_complete INTEGER,
    total_failed INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as total_pending,
        COUNT(*) FILTER (WHERE status = 'in_progress')::INTEGER as total_in_progress,
        COUNT(*) FILTER (WHERE status = 'complete')::INTEGER as total_complete,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as total_failed
    FROM jobs;
END;
$$ LANGUAGE plpgsql;

-- get_next_job_in_queue
CREATE OR REPLACE FUNCTION get_next_job_in_queue()
RETURNS TABLE (
    id UUID,
    customer_id UUID,
    package_size INTEGER,
    status TEXT,
    priority_level INTEGER,
    created_at TIMESTAMPTZ,
    metadata JSONB
) AS $$
DECLARE
    job_record RECORD;
BEGIN
    SELECT * INTO job_record
    FROM jobs
    WHERE status = 'pending'
    ORDER BY priority_level ASC, created_at ASC
    LIMIT 1;

    IF job_record.id IS NOT NULL THEN
        UPDATE jobs
        SET
            status = 'in_progress',
            started_at = NOW(),
            updated_at = NOW()
        WHERE id = job_record.id;

        RETURN QUERY
        SELECT
            job_record.id,
            job_record.customer_id,
            job_record.package_size,
            'in_progress'::TEXT as status,
            job_record.priority_level,
            job_record.created_at,
            job_record.metadata;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- mark_job_in_progress
CREATE OR REPLACE FUNCTION mark_job_in_progress(
    job_id_param UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE jobs
    SET
        status = 'in_progress',
        started_at = NOW(),
        updated_at = NOW()
    WHERE id = job_id_param
    AND status = 'pending';

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- update_job_progress
CREATE OR REPLACE FUNCTION update_job_progress(
    job_id_param UUID,
    directory_name_param TEXT,
    submission_status_param TEXT,
    response_log_param JSONB DEFAULT '{}'::jsonb,
    submitted_at_param TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
DECLARE
    customer_id_val UUID;
BEGIN
    SELECT customer_id INTO customer_id_val FROM jobs WHERE id = job_id_param;

    IF customer_id_val IS NOT NULL THEN
        INSERT INTO job_results (
            job_id, directory_name, status, response_log, submitted_at
        ) VALUES (
            job_id_param, directory_name_param, submission_status_param, response_log_param, submitted_at_param
        )
        ON CONFLICT (job_id, directory_name) DO UPDATE SET
            status = EXCLUDED.status,
            response_log = EXCLUDED.response_log,
            submitted_at = EXCLUDED.submitted_at;

        UPDATE jobs
        SET updated_at = NOW()
        WHERE id = job_id_param;

        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- complete_autobolt_job
CREATE OR REPLACE FUNCTION complete_autobolt_job(
    job_id_param UUID,
    final_status_param TEXT DEFAULT 'complete',
    error_message_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    job_exists BOOLEAN := FALSE;
    job_start_time TIMESTAMPTZ;
    job_customer_id UUID;
    total_dirs INTEGER;
    completed_dirs INTEGER;
    failed_dirs INTEGER;
BEGIN
    -- Update job status
    UPDATE jobs
    SET
        status = final_status_param,
        completed_at = NOW(),
        updated_at = NOW(),
        error_message = error_message_param
    WHERE id = job_id_param
    AND status = 'in_progress'
    RETURNING started_at, customer_id, package_size INTO job_start_time, job_customer_id, total_dirs;

    GET DIAGNOSTICS job_exists = ROW_COUNT;

    IF job_exists > 0 THEN
        -- Calculate final counts from job_results
        SELECT
            COUNT(*) FILTER (WHERE status = 'submitted'),
            COUNT(*) FILTER (WHERE status = 'failed')
        INTO completed_dirs, failed_dirs
        FROM job_results
        WHERE job_id = job_id_param;

        -- Update customer's aggregated stats if columns exist
        BEGIN
            UPDATE customers
            SET
                directories_submitted = COALESCE(directories_submitted, 0) + completed_dirs,
                failed_directories = COALESCE(failed_directories, 0) + failed_dirs,
                updated_at = NOW()
            WHERE id = job_customer_id;
        EXCEPTION
            WHEN undefined_column THEN
                -- Ignore if columns don't exist
                NULL;
        END;

        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- get_job_progress_for_staff
CREATE OR REPLACE FUNCTION get_job_progress_for_staff()
RETURNS TABLE (
    job_id UUID,
    customer_id UUID,
    business_name TEXT,
    status TEXT,
    priority_level INTEGER,
    total_directories INTEGER,
    completed_directories INTEGER,
    failed_directories INTEGER,
    progress_percentage DECIMAL,
    estimated_completion TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        j.id as job_id,
        j.customer_id,
        COALESCE(c.business_name, 'N/A') as business_name,
        j.status,
        j.priority_level,
        j.package_size as total_directories,
        COALESCE(jr_stats.completed_count, 0)::INTEGER as completed_directories,
        COALESCE(jr_stats.failed_count, 0)::INTEGER as failed_directories,
        CASE
            WHEN j.package_size > 0 THEN
                ROUND((COALESCE(jr_stats.completed_count, 0)::DECIMAL / j.package_size) * 100, 2)
            ELSE 0.00
        END as progress_percentage,
        CASE
            WHEN j.status = 'in_progress' AND jr_stats.completed_count > 0 AND j.started_at IS NOT NULL THEN
                j.started_at + ( (NOW() - j.started_at) / jr_stats.completed_count * (j.package_size - jr_stats.completed_count) )
            ELSE NULL
        END as estimated_completion,
        j.created_at,
        j.updated_at
    FROM jobs j
    LEFT JOIN customers c ON j.customer_id = c.id
    LEFT JOIN (
        SELECT
            job_id,
            COUNT(*) FILTER (WHERE status = 'submitted') as completed_count,
            COUNT(*) FILTER (WHERE status = 'failed') as failed_count
        FROM job_results
        GROUP BY job_id
    ) jr_stats ON j.id = jr_stats.job_id
    WHERE j.status IN ('pending', 'in_progress', 'complete', 'failed')
    ORDER BY j.priority_level ASC, j.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 8. Verification queries
-- ---------------------------------------------------------------------------

-- Count records in new tables
DO $$
DECLARE
    jobs_count INTEGER;
    job_results_count INTEGER;
    legacy_queue_count INTEGER;
    legacy_submissions_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO jobs_count FROM jobs;
    SELECT COUNT(*) INTO job_results_count FROM job_results;
    SELECT COUNT(*) INTO legacy_queue_count FROM autobolt_processing_queue_legacy;
    SELECT COUNT(*) INTO legacy_submissions_count FROM directory_submissions_legacy;
    
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Jobs table: % records', jobs_count;
    RAISE NOTICE 'Job results table: % records', job_results_count;
    RAISE NOTICE 'Legacy queue table: % records', legacy_queue_count;
    RAISE NOTICE 'Legacy submissions table: % records', legacy_submissions_count;
END $$;

COMMIT;

SELECT 'Database migration completed successfully!' as status;
