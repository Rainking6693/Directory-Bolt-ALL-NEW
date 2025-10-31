-- DirectoryBolt AutoBolt Job Queue Schema (Cursor 9.23 Architecture)
-- Implements secure three-tier architecture: jobs + job_results tables with supporting functions

-- ============================================================================
-- Table Definitions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
    package_size INTEGER NOT NULL CHECK (package_size IN (50, 100, 300, 500)),
    priority_level INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'complete', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS public.job_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
    directory_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','submitted','failed','retry')),
    response_log JSONB,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    retry_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(job_id, directory_name)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON public.jobs (customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON public.jobs (priority_level);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_results_job_id ON public.job_results (job_id);
CREATE INDEX IF NOT EXISTS idx_job_results_status ON public.job_results (status);

-- ============================================================================
-- Updated-at Trigger Helper
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_job_results_updated_at
  BEFORE UPDATE ON public.job_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Returns queue statistics used by staff dashboard
CREATE OR REPLACE FUNCTION public.get_queue_stats()
RETURNS TABLE (
  total_jobs BIGINT,
  total_queued BIGINT,
  total_processing BIGINT,
  total_completed BIGINT,
  total_failed BIGINT,
  total_directories BIGINT,
  completed_directories BIGINT,
  failed_directories BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH job_counts AS (
    SELECT
      COUNT(*) AS total_jobs,
      COUNT(*) FILTER (WHERE status = 'pending') AS total_queued,
      COUNT(*) FILTER (WHERE status = 'in_progress') AS total_processing,
      COUNT(*) FILTER (WHERE status = 'complete') AS total_completed,
      COUNT(*) FILTER (WHERE status = 'failed') AS total_failed,
      COALESCE(SUM(package_size), 0) AS total_directories
    FROM public.jobs
  ),
  result_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'submitted') AS completed_directories,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed_directories
    FROM public.job_results
  )
  SELECT
    job_counts.total_jobs,
    job_counts.total_queued,
    job_counts.total_processing,
    job_counts.total_completed,
    job_counts.total_failed,
    job_counts.total_directories,
    result_counts.completed_directories,
    result_counts.failed_directories,
    CASE
      WHEN job_counts.total_directories > 0 THEN ROUND((result_counts.completed_directories::NUMERIC / job_counts.total_directories) * 100, 2)
      ELSE 0
    END AS success_rate
  FROM job_counts, result_counts;
END;
$$ LANGUAGE plpgsql;

-- Returns the next pending job and marks it in progress atomically
CREATE OR REPLACE FUNCTION public.get_next_pending_job()
RETURNS TABLE (
  job_id UUID,
  customer_id UUID,
  package_size INTEGER,
  priority_level INTEGER,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ
) AS $$
DECLARE
  pending_job RECORD;
BEGIN
  SELECT * INTO pending_job
  FROM public.jobs
  WHERE status = 'pending'
  ORDER BY priority_level ASC, created_at ASC
  LIMIT 1;

  IF pending_job.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.jobs
  SET status = 'in_progress',
      started_at = NOW(),
      updated_at = NOW()
  WHERE id = pending_job.id AND status = 'pending';

  RETURN QUERY
  SELECT pending_job.id, pending_job.customer_id, pending_job.package_size, pending_job.priority_level, pending_job.created_at, NOW();
END;
$$ LANGUAGE plpgsql;

-- Records job progress for staff dashboard analytics
CREATE OR REPLACE FUNCTION public.log_job_progress(
  job_id_param UUID,
  directory_name_param TEXT,
  status_param TEXT,
  response_log_param JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO public.job_results (
    job_id,
    directory_name,
    status,
    response_log,
    submitted_at,
    retry_count
  ) VALUES (
    job_id_param,
    directory_name_param,
    status_param,
    response_log_param,
    CASE WHEN status_param = 'submitted' THEN NOW() ELSE NULL END,
    CASE WHEN status_param = 'failed' THEN 1 ELSE 0 END
  )
  ON CONFLICT (job_id, directory_name)
  DO UPDATE SET
    status = EXCLUDED.status,
    response_log = EXCLUDED.response_log,
    submitted_at = EXCLUDED.submitted_at,
    retry_count = job_results.retry_count + EXCLUDED.retry_count,
    updated_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Completes a job and returns summary statistics
CREATE OR REPLACE FUNCTION public.complete_job(
  job_id_param UUID,
  final_status_param TEXT,
  error_message_param TEXT DEFAULT NULL
)
RETURNS TABLE (
  job_id UUID,
  final_status TEXT,
  completed_at TIMESTAMPTZ,
  total_directories INTEGER,
  successful_submissions INTEGER,
  failed_submissions INTEGER,
  success_rate NUMERIC
) AS $$
DECLARE
  job_record RECORD;
BEGIN
  UPDATE public.jobs
  SET status = final_status_param,
      completed_at = NOW(),
      updated_at = NOW(),
      error_message = error_message_param
  WHERE id = job_id_param AND status = 'in_progress'
  RETURNING * INTO job_record;

  IF job_record.id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    job_record.id,
    job_record.status,
    job_record.completed_at,
    job_record.package_size,
    COUNT(*) FILTER (WHERE status = 'submitted')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'failed')::INTEGER,
    CASE
      WHEN job_record.package_size > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'submitted')::NUMERIC / job_record.package_size) * 100, 2)
      ELSE 0
    END AS success_rate
  FROM public.job_results
  WHERE job_results.job_id = job_record.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Row-Level Security Policies (service role has full access)
-- ============================================================================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Jobs service role access" ON public.jobs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Job results service role access" ON public.job_results
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Legacy function compatibility (maps to new architecture)
CREATE OR REPLACE FUNCTION public.get_next_job_in_queue()
RETURNS TABLE (
    id UUID,
    customer_id UUID,
    package_size INTEGER,
    priority_level INTEGER,
    status TEXT,
    created_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT job_id, customer_id, package_size, priority_level, 'in_progress'::TEXT, created_at, started_at
  FROM public.get_next_pending_job();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_job_progress(
    job_id_param UUID,
    directory_name_param TEXT,
    submission_status_param TEXT,
    response_log_param JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  PERFORM public.log_job_progress(
    job_id_param,
    directory_name_param,
    CASE
      WHEN submission_status_param IN ('submitted','approved') THEN 'submitted'
      WHEN submission_status_param = 'failed' THEN 'failed'
      ELSE 'pending'
    END,
    response_log_param
  );
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.complete_autobolt_job(
    job_id_param UUID,
    final_status_param TEXT DEFAULT 'complete',
    error_message_param TEXT DEFAULT NULL
)
RETURNS TABLE (
  job_id UUID,
  final_status TEXT,
  completed_at TIMESTAMPTZ,
  total_directories INTEGER,
  successful_submissions INTEGER,
  failed_submissions INTEGER,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.complete_job(job_id_param, final_status_param, error_message_param);
END;
$$ LANGUAGE plpgsql;

