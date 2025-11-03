# Run Database Migrations

## Status

Migration files are ready but Supabase CLI requires database password authentication.

## Migration Files Ready

✅ **Migration 004** - `backend/db/migrations/004_rate_limit_requests.sql`
✅ **Migration 005** - `backend/db/migrations/005_find_stale_jobs_function.sql`

Also available in Supabase format:
- `.supabase/migrations/20251102_004_rate_limit_requests.sql`
- `.supabase/migrations/20251102_005_find_stale_jobs_function.sql`

## Option 1: Run via Supabase SQL Editor (Recommended)

1. Open Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/kolgqfjgncdwddziqloz/sql/new
   ```

2. Copy and paste SQL from `backend/db/migrations/004_rate_limit_requests.sql`
3. Click "Run"
4. Repeat for `backend/db/migrations/005_find_stale_jobs_function.sql`

## Option 2: Run via Supabase CLI (if you have database password)

```powershell
# Provide password when prompted
cd C:\Users\Ben\OneDrive\Documents\GitHub\Directory-Bolt-ALL-NEW
supabase db push --include-all --yes

# Or with password flag
supabase db push --include-all --yes --password YOUR_DB_PASSWORD
```

## Verify Migrations Applied

Run this in Supabase SQL Editor to verify:

```sql
-- Check if table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'rate_limit_requests';

-- Check if function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'find_stale_jobs';

-- Check if view exists
SELECT table_name FROM information_schema.views 
WHERE table_name = 'stale_jobs_view';
```

Expected results:
- `rate_limit_requests` table should exist
- `find_stale_jobs` function should exist
- `stale_jobs_view` view should exist

