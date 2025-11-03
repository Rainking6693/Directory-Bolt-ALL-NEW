-- Schedule cleanup job for rate_limit_requests table
-- This runs daily at 2 AM UTC to clean up old rate limit records
-- Requires pg_cron extension to be enabled in Supabase

SELECT cron.schedule(
    'cleanup-rate-limit-records',
    '0 2 * * *', -- Daily at 2 AM UTC
    $$SELECT cleanup_rate_limit_records(24);$$
);

-- To verify the schedule was created:
-- SELECT * FROM cron.job WHERE jobname = 'cleanup-rate-limit-records';

-- To remove the schedule later:
-- SELECT cron.unschedule('cleanup-rate-limit-records');

