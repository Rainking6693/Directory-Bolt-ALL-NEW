-- DirectoryBolt AutoBolt Queue Migration
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
    customer_id VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),

    -- Package & Processing Details
    package_type VARCHAR(50) NOT NULL CHECK (package_type IN ('starter','growth','professional','enterprise')),
    directory_limit INTEGER NOT NULL DEFAULT 50,
    priority_level INTEGER NOT NULL DEFAULT 4,

    -- Job Status & Lifecycle
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending','in_progress','completed','failed','paused','cancelled')
    ),

    -- Job Metrics
    directories_to_process INTEGER NOT NULL DEFAULT 0,
    directories_completed INTEGER NOT NULL DEFAULT 0,
    directories_failed INTEGER NOT NULL DEFAULT 0,

    -- Business Data for AutoBolt Processing
    business_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Processing Details
    assigned_to VARCHAR(100),
    estimated_completion TIMESTAMP WITH TIME ZONE,
    progress_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,

    -- Error Handling
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,

    -- Metadata for extensibility
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

DROP TABLE IF EXISTS job_results_migrated CASCADE;
CREATE TABLE job_results_migrated (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_id UUID NOT NULL,
    customer_id VARCHAR(50) NOT NULL,

    directory_name VARCHAR(255) NOT NULL,
    directory_url VARCHAR(500),
    directory_category VARCHAR(100),
    directory_tier VARCHAR(50) NOT NULL DEFAULT 'standard' CHECK (directory_tier IN ('standard','premium','enterprise')),

    submission_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
      submission_status IN ('pending','processing','submitted','approved','rejected','failed','skipped')
    ),

    listing_url VARCHAR(500),
    submission_result TEXT,
    rejection_reason TEXT,
    domain_authority INTEGER,
    estimated_traffic INTEGER,
    submission_score DECIMAL(3,1),
    processing_time_seconds INTEGER,

    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT fk_job_results_job_id FOREIGN KEY (job_id)
      REFERENCES jobs_migrated(id) ON DELETE CASCADE,
    CONSTRAINT uniq_job_directory UNIQUE (job_id, directory_name)
);

-- ---------------------------------------------------------------------------
-- 2. Migrate legacy data when legacy tables exist
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  legacy_jobs regclass := to_regclass('public.autobolt_processing_queue');
  legacy_results regclass := to_regclass('public.directory_submissions');
BEGIN
  IF legacy_jobs IS NOT NULL THEN
    RAISE NOTICE 'Migrating data from autobolt_processing_queue into jobs_migrated';

    WITH result_counts AS (
      SELECT
        queue_id,
        COUNT(*) FILTER (WHERE submission_status IN ('submitted','approved')) AS completed_count,
        COUNT(*) FILTER (WHERE submission_status = 'failed') AS failed_count,
        COUNT(*) AS total_count
      FROM directory_submissions
      GROUP BY queue_id
    ),
    customer_data AS (
      SELECT
        id::text AS customer_id_text,
        id AS customer_uuid,
        business_name AS customer_name,
        email AS customer_email,
        business_data
      FROM customers
    )
    INSERT INTO jobs_migrated (
      id,
      customer_id,
      customer_name,
      customer_email,
      package_type,
      directory_limit,
      priority_level,
      status,
      directories_to_process,
      directories_completed,
      directories_failed,
      business_data,
      created_at,
      updated_at,
      started_at,
      completed_at,
      assigned_to,
      estimated_completion,
      progress_percentage,
      error_message,
      retry_count,
      max_retries,
      metadata
    )
    SELECT
      apq.id,
      apq.customer_id,
      COALESCE(cd.customer_name, apq.business_name) AS customer_name,
      COALESCE(cd.customer_email, apq.email) AS customer_email,
      CASE
        WHEN apq.package_type IN ('starter','growth','professional','enterprise') THEN apq.package_type
        WHEN apq.package_type IN ('basic','trial') THEN 'starter'
        ELSE 'growth'
      END AS package_type,
      COALESCE(apq.directory_limit, rc.total_count, 0) AS directory_limit,
      COALESCE(apq.priority_level, 4) AS priority_level,
      CASE
        WHEN apq.status = 'queued' THEN 'pending'
        WHEN apq.status = 'processing' THEN 'in_progress'
        WHEN apq.status = 'completed' THEN 'completed'
        WHEN apq.status = 'failed' THEN 'failed'
        WHEN apq.status = 'cancelled' THEN 'cancelled'
        ELSE 'pending'
      END AS status,
      COALESCE(apq.directory_limit, rc.total_count, 0) AS directories_to_process,
      COALESCE(rc.completed_count, 0) AS directories_completed,
      COALESCE(rc.failed_count, 0) AS directories_failed,
      jsonb_strip_nulls(
        COALESCE(cd.business_data, '{}'::jsonb) ||
        jsonb_build_object(
          'legacyBusinessName', apq.business_name,
          'legacyEmail', apq.email
        ) ||
        COALESCE(apq.metadata, '{}'::jsonb)
      ) AS business_data,
      apq.created_at,
      apq.updated_at,
      apq.started_at,
      apq.completed_at,
      apq.processed_by AS assigned_to,
      CASE
        WHEN apq.completed_at IS NOT NULL THEN apq.completed_at
        WHEN apq.started_at IS NOT NULL AND COALESCE(apq.directory_limit, rc.total_count, 0) > 0
          THEN apq.started_at + INTERVAL '1 minute' * GREATEST(CEIL((COALESCE(apq.directory_limit, rc.total_count, 0) - COALESCE(rc.completed_count, 0))::numeric), 0)
        ELSE NULL
      END AS estimated_completion,
      CASE
        WHEN COALESCE(apq.directory_limit, rc.total_count, 0) > 0
          THEN ROUND((COALESCE(rc.completed_count, 0)::numeric / COALESCE(apq.directory_limit, rc.total_count, 0)::numeric) * 100, 2)
        ELSE 0
      END AS progress_percentage,
      apq.error_message,
      0 AS retry_count,
      3 AS max_retries,
      jsonb_strip_nulls(COALESCE(apq.metadata, '{}'::jsonb) || jsonb_build_object('legacy_action', apq.action)) AS metadata
    FROM autobolt_processing_queue apq
    LEFT JOIN result_counts rc ON rc.queue_id = apq.id
    LEFT JOIN customer_data cd ON cd.customer_id_text = apq.customer_id;
  END IF;

  IF legacy_results IS NOT NULL THEN
    RAISE NOTICE 'Migrating data from directory_submissions into job_results_migrated';

    INSERT INTO job_results_migrated (
      id,
      job_id,
      customer_id,
      directory_name,
      directory_url,
      directory_category,
      directory_tier,
      submission_status,
      listing_url,
      submission_result,
      rejection_reason,
      domain_authority,
      estimated_traffic,
      submission_score,
      processing_time_seconds,
      submitted_at,
      approved_at,
      failed_at,
      created_at,
      updated_at,
      error_message,
      retry_count,
      metadata
    )
    SELECT
      CASE
        WHEN ds.id IS NULL THEN gen_random_uuid()
        ELSE ds.id
      END,
      ds.queue_id,
      ds.customer_id,
      ds.directory_name,
      ds.directory_url,
      ds.directory_category,
      CASE
        WHEN ds.directory_tier IN ('standard','premium','enterprise') THEN ds.directory_tier
        ELSE 'standard'
      END,
      CASE
        WHEN ds.submission_status IN ('submitted','approved','processing','pending','rejected','failed','skipped') THEN ds.submission_status
        WHEN ds.submission_status = 'retry' THEN 'pending'
        WHEN ds.submission_status = 'error' THEN 'failed'
        ELSE 'pending'
      END,
      ds.listing_url,
      NULL,
      ds.rejection_reason,
      ds.domain_authority,
      ds.estimated_traffic,
      NULL,
      ds.processing_time_seconds,
      CASE WHEN ds.submission_status IN ('submitted','approved') THEN COALESCE(ds.submitted_at, ds.updated_at) ELSE ds.submitted_at END,
      CASE WHEN ds.submission_status = 'approved' THEN COALESCE(ds.approved_at, ds.updated_at) ELSE ds.approved_at END,
      CASE WHEN ds.submission_status = 'failed' THEN COALESCE(ds.updated_at, NOW()) ELSE NULL END,
      COALESCE(ds.created_at, NOW()),
      COALESCE(ds.updated_at, ds.created_at, NOW()),
      ds.error_message,
      0,
      jsonb_strip_nulls(COALESCE(ds.metadata, '{}'::jsonb))
    FROM directory_submissions ds
    WHERE ds.queue_id IS NOT NULL;
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 3. Replace existing jobs/job_results tables with migrated tables
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS jobs_old CASCADE;
ALTER TABLE IF EXISTS jobs RENAME TO jobs_old;

DROP TABLE IF EXISTS job_results_old CASCADE;
ALTER TABLE IF EXISTS job_results RENAME TO job_results_old;

ALTER TABLE jobs_migrated RENAME TO jobs;
ALTER TABLE job_results_migrated RENAME TO job_results;

ALTER TABLE jobs
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE job_results
  ADD CONSTRAINT fk_job_results_job_id FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- Preserve legacy tables for audit but rename them clearly
ALTER TABLE IF EXISTS autobolt_processing_queue RENAME TO autobolt_processing_queue_legacy;
ALTER TABLE IF EXISTS directory_submissions RENAME TO directory_submissions_legacy;

-- ---------------------------------------------------------------------------
-- 4. Indexes, triggers, and policies for canonical tables
-- ---------------------------------------------------------------------------

-- Drop any residual indexes that may have been re-created via rename
DROP INDEX IF EXISTS idx_autobolt_queue_customer_id;
DROP INDEX IF EXISTS idx_autobolt_queue_status;
DROP INDEX IF EXISTS idx_autobolt_queue_priority;
DROP INDEX IF EXISTS idx_directory_submissions_customer_id;
DROP INDEX IF EXISTS idx_directory_submissions_queue_id;
DROP INDEX IF EXISTS idx_directory_submissions_status;

CREATE INDEX idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_package_type ON jobs(package_type);
CREATE INDEX idx_jobs_priority_level ON jobs(priority_level);
CREATE INDEX idx_jobs_created_at ON jobs(created_at);
CREATE INDEX idx_jobs_assigned_to ON jobs(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_jobs_queue_order ON jobs(status, priority_level, created_at) WHERE status = 'pending';
CREATE INDEX idx_jobs_business_data_gin ON jobs USING GIN (business_data);
CREATE INDEX idx_jobs_metadata_gin ON jobs USING GIN (metadata);

CREATE INDEX idx_job_results_job_id ON job_results(job_id);
CREATE INDEX idx_job_results_customer_id ON job_results(customer_id);
CREATE INDEX idx_job_results_submission_status ON job_results(submission_status);
CREATE INDEX idx_job_results_directory_name ON job_results(directory_name);
CREATE INDEX idx_job_results_created_at ON job_results(created_at);
CREATE INDEX idx_job_results_job_status ON job_results(job_id, submission_status);
CREATE INDEX idx_job_results_metadata_gin ON job_results USING GIN (metadata);

-- Ensure trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_results_updated_at ON job_results;
CREATE TRIGGER update_job_results_updated_at
  BEFORE UPDATE ON job_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS and create service role policies
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can access all jobs" ON jobs;
DROP POLICY IF EXISTS "Service role can access all job results" ON job_results;

CREATE POLICY "Service role can access all jobs"
  ON jobs FOR ALL
  USING (true);

CREATE POLICY "Service role can access all job results"
  ON job_results FOR ALL
  USING (true);

-- ---------------------------------------------------------------------------
-- 5. Re-create canonical utility functions & RPC endpoints
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS calculate_job_progress(UUID);
CREATE OR REPLACE FUNCTION calculate_job_progress(job_id_param UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  total_directories INTEGER;
  completed_directories INTEGER;
  failed_directories INTEGER;
  progress DECIMAL(5,2);
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE submission_status IN ('submitted','approved')),
    COUNT(*) FILTER (WHERE submission_status = 'failed')
  INTO total_directories, completed_directories, failed_directories
  FROM job_results
  WHERE job_id = job_id_param;

  IF total_directories = 0 THEN
    progress := 0.00;
  ELSE
    progress := ROUND((completed_directories::numeric / total_directories::numeric) * 100, 2);
  END IF;

  UPDATE jobs
  SET
    directories_completed = completed_directories,
    directories_failed = failed_directories,
    progress_percentage = progress,
    updated_at = NOW()
  WHERE id = job_id_param;

  RETURN progress;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_next_job_in_queue();
CREATE OR REPLACE FUNCTION get_next_job_in_queue()
RETURNS TABLE (
  job_id UUID,
  customer_id VARCHAR,
  customer_name VARCHAR,
  customer_email VARCHAR,
  package_type VARCHAR,
  directory_limit INTEGER,
  business_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  selected_job jobs%ROWTYPE;
BEGIN
  SELECT *
  INTO selected_job
  FROM jobs
  WHERE status = 'pending'
  ORDER BY priority_level ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE jobs
  SET status = 'in_progress',
      started_at = COALESCE(selected_job.started_at, NOW()),
      updated_at = NOW()
  WHERE id = selected_job.id;

  RETURN QUERY SELECT
    selected_job.id,
    selected_job.customer_id,
    selected_job.customer_name,
    selected_job.customer_email,
    selected_job.package_type,
    selected_job.directory_limit,
    selected_job.business_data,
    selected_job.created_at;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS mark_job_in_progress(UUID, VARCHAR);
CREATE OR REPLACE FUNCTION mark_job_in_progress(job_id_param UUID, extension_id VARCHAR DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE jobs
  SET status = 'in_progress',
      started_at = COALESCE(started_at, NOW()),
      assigned_to = extension_id,
      updated_at = NOW()
  WHERE id = job_id_param AND status = 'pending';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS update_job_progress(UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, JSONB);
CREATE OR REPLACE FUNCTION update_job_progress(
  job_id_param UUID,
  directory_name_param VARCHAR,
  submission_status_param VARCHAR,
  listing_url_param VARCHAR DEFAULT NULL,
  rejection_reason_param TEXT DEFAULT NULL,
  metadata_param JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  job_customer_id VARCHAR(50);
  normalized_status VARCHAR(50);
  affected BOOLEAN := FALSE;
BEGIN
  SELECT customer_id INTO job_customer_id FROM jobs WHERE id = job_id_param;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  normalized_status := CASE
    WHEN submission_status_param IS NULL THEN 'pending'
    WHEN submission_status_param IN ('submitted','approved','processing','pending','rejected','failed','skipped') THEN submission_status_param
    WHEN submission_status_param = 'retry' THEN 'pending'
    WHEN submission_status_param = 'error' THEN 'failed'
    ELSE 'pending'
  END;

  INSERT INTO job_results (
    job_id,
    customer_id,
    directory_name,
    directory_url,
    submission_status,
    listing_url,
    rejection_reason,
    metadata,
    submitted_at,
    approved_at,
    failed_at,
    updated_at
  ) VALUES (
    job_id_param,
    job_customer_id,
    directory_name_param,
    COALESCE(metadata_param->>'directory_url', metadata_param->>'url'),
    normalized_status,
    listing_url_param,
    rejection_reason_param,
    jsonb_strip_nulls(COALESCE(metadata_param, '{}'::jsonb)),
    CASE WHEN normalized_status IN ('submitted','approved') THEN NOW() ELSE NULL END,
    CASE WHEN normalized_status = 'approved' THEN NOW() ELSE NULL END,
    CASE WHEN normalized_status = 'failed' THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (job_id, directory_name) DO UPDATE SET
    submission_status = EXCLUDED.submission_status,
    listing_url = COALESCE(EXCLUDED.listing_url, job_results.listing_url),
    rejection_reason = COALESCE(EXCLUDED.rejection_reason, job_results.rejection_reason),
    metadata = jsonb_strip_nulls(job_results.metadata || EXCLUDED.metadata),
    submitted_at = CASE
      WHEN EXCLUDED.submission_status IN ('submitted','approved') THEN COALESCE(job_results.submitted_at, NOW())
      ELSE job_results.submitted_at
    END,
    approved_at = CASE
      WHEN EXCLUDED.submission_status = 'approved' THEN COALESCE(job_results.approved_at, NOW())
      ELSE job_results.approved_at
    END,
    failed_at = CASE
      WHEN EXCLUDED.submission_status = 'failed' THEN COALESCE(job_results.failed_at, NOW())
      ELSE job_results.failed_at
    END,
    updated_at = NOW();

  GET DIAGNOSTICS affected = ROW_COUNT;

  PERFORM calculate_job_progress(job_id_param);

  RETURN affected;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS complete_autobolt_job(UUID, VARCHAR, TEXT);
CREATE OR REPLACE FUNCTION complete_autobolt_job(
  job_id_param UUID,
  final_status_param VARCHAR DEFAULT 'completed',
  error_message_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE jobs
  SET status = CASE
        WHEN final_status_param IN ('completed','failed','cancelled') THEN final_status_param
        ELSE 'completed'
      END,
      completed_at = NOW(),
      updated_at = NOW(),
      error_message = error_message_param
  WHERE id = job_id_param AND status IN ('in_progress','pending');

  GET DIAGNOSTICS affected = ROW_COUNT;

  IF affected > 0 THEN
    PERFORM calculate_job_progress(job_id_param);
  END IF;

  RETURN affected > 0;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_job_progress_for_staff();
CREATE OR REPLACE FUNCTION get_job_progress_for_staff()
RETURNS TABLE (
  job_id UUID,
  customer_id VARCHAR,
  customer_name VARCHAR,
  status VARCHAR,
  priority_level INTEGER,
  total_directories INTEGER,
  completed_directories INTEGER,
  failed_directories INTEGER,
  progress_percentage DECIMAL,
  estimated_completion TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id,
    j.customer_id,
    j.customer_name,
    j.status,
    j.priority_level,
    j.directories_to_process,
    j.directories_completed,
    j.directories_failed,
    j.progress_percentage,
    j.estimated_completion,
    j.created_at,
    j.updated_at
  FROM jobs j
  ORDER BY j.priority_level ASC, j.created_at ASC;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_job_queue_stats();
CREATE OR REPLACE FUNCTION get_job_queue_stats()
RETURNS TABLE (
  total_pending INTEGER,
  total_in_progress INTEGER,
  total_completed INTEGER,
  total_failed INTEGER,
  avg_processing_time_minutes DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    ROUND(
      AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60)
      FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL),
      2
    )
  FROM jobs;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 6. Verification queries to confirm migration success
-- ---------------------------------------------------------------------------

RAISE NOTICE 'Job records migrated: %', (SELECT COUNT(*) FROM jobs);
RAISE NOTICE 'Job result records migrated: %', (SELECT COUNT(*) FROM job_results);
RAISE NOTICE 'Legacy tables preserved as *_legacy (if originals existed).';

COMMIT;

