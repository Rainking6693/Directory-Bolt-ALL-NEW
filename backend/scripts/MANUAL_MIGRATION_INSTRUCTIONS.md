# Manual Database Migration Instructions

Since Supabase CLI requires database credentials, here's the simplest way to run the migrations:

## Method: Supabase SQL Editor (No credentials needed)

### Step 1: Open SQL Editor

Go to: https://supabase.com/dashboard/project/kolgqfjgncdwddziqloz/sql/new

### Step 2: Run Migration 004

Copy **ALL** SQL content from this file and paste into the SQL Editor:
```
backend/db/migrations/004_rate_limit_requests.sql
```

Or copy the full content from the file and paste.

Click "Run" button.

### Step 3: Run Migration 005

Copy **ALL** SQL content from this file and paste into the SQL Editor:
```
backend/db/migrations/005_find_stale_jobs_function.sql
```

Or copy the full content from the file and paste.

Click "Run" button.

### Step 4: Verify

Run this in SQL Editor to verify:

```sql
-- Verify table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'rate_limit_requests';

-- Verify function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'find_stale_jobs';

-- Verify view exists
SELECT table_name FROM information_schema.views 
WHERE table_name = 'stale_jobs_view';
```

You should see:
- `rate_limit_requests` in the first query
- `find_stale_jobs` in the second query
- `stale_jobs_view` in the third query

## Done!

Migrations are now applied. You can continue with the next steps in the deployment guide.

