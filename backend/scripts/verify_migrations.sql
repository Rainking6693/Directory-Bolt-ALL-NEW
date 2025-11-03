-- Verify all migrations were applied successfully
-- Run these queries in Supabase SQL Editor

-- 1. Check if rate_limit_requests table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'rate_limit_requests';
-- Expected: 1 row with 'rate_limit_requests'

-- 2. Check if find_stale_jobs function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'find_stale_jobs';
-- Expected: 1 row with 'find_stale_jobs'

-- 3. Check if stale_jobs_view exists
SELECT table_name FROM information_schema.views 
WHERE table_name = 'stale_jobs_view';
-- Expected: 1 row with 'stale_jobs_view'

-- 4. Check cleanup_rate_limit_records function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'cleanup_rate_limit_records';
-- Expected: 1 row with 'cleanup_rate_limit_records'

-- All checks passed? ✅ Migrations are successfully applied!

