# Database Migration Status

## Current Situation

The Supabase CLI migration push is encountering a conflict with an existing migration (`20251025_fix_directories_schema.sql`). 

## Migration Files Ready

✅ **Migration 004** (`rate_limit_requests`):
- File: `backend/db/migrations/004_rate_limit_requests.sql`
- Supabase format: `.supabase/migrations/20251103000000_004_rate_limit_requests.sql`

✅ **Migration 005** (`find_stale_jobs_function`):
- File: `backend/db/migrations/005_find_stale_jobs_function.sql`
- Supabase format: `.supabase/migrations/20251103000001_005_find_stale_jobs_function.sql`

## Recommended Solution

Since the CLI is having conflicts, run the migrations directly in Supabase SQL Editor:

1. **Go to Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/kolgqfjgncdwddziqloz/sql/new
   ```

2. **Run Migration 004:**
   - Copy content from: `backend/db/migrations/004_rate_limit_requests.sql`
   - Paste into SQL Editor
   - Click "Run"

3. **Run Migration 005:**
   - Copy content from: `backend/db/migrations/005_find_stale_jobs_function.sql`
   - Paste into SQL Editor
   - Click "Run"

## Alternative: Fix Migration Conflict

If you want to fix the CLI conflict:

1. Repair the migration status:
   ```powershell
   supabase migration repair 20251025 --status applied --linked --yes
   ```

2. Remove the conflicting file:
   ```powershell
   Remove-Item .supabase\migrations\20251025_fix_directories_schema.sql
   ```

3. Push new migrations:
   ```powershell
   supabase db push --include-all --yes
   ```

