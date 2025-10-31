# Migration 20251018: Add Selector Discovery Fields

## Purpose
Add support for automated selector discovery system, form intelligence, and directory classification.

## Changes

### New Columns
- **`field_selectors`** (JSONB): Auto-discovered CSS selectors for form fields
  - Example: `{"businessName": "#company-name", "email": "input[type=email]"}`
  - Default: `{}`

- **`selectors_updated_at`** (TIMESTAMPTZ): Last time selectors were discovered/updated
  - Used to determine selector freshness
  - NULL if never discovered

- **`selector_discovery_log`** (JSONB): Metadata about selector discovery runs
  - Example: `{"lastRun": "2025-10-18T10:00:00Z", "success": true, "confidence": 0.95}`
  - Default: `{}`

- **`requires_login`** (BOOLEAN): Whether directory requires authentication
  - Default: `false`
  - Used for worker routing

- **`has_captcha`** (BOOLEAN): Whether directory has CAPTCHA protection
  - Default: `false`
  - Triggers CAPTCHA solver when `true`

- **`failure_rate`** (DECIMAL(3,2)): Historical failure rate (0.00-1.00)
  - Default: `0.00`
  - Used for priority scoring and retry logic

### New Index
- **`idx_directories_selectors_updated`**: Index on `selectors_updated_at DESC`
  - Improves performance for "stale selector" queries
  - Used by selector discovery job scheduler

### New Function
- **`update_directory_selectors(dir_id, new_selectors, discovery_log)`**
  - Atomically updates selectors to prevent race conditions
  - Merges new selectors with existing ones
  - Updates timestamp and log in single transaction

## Deployment

### Via Supabase Dashboard (Recommended)
1. Open [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **SQL Editor**
3. Create new query
4. Copy contents of `supabase/migrations/20251018_add_selector_discovery_fields.sql`
5. Run migration
6. Verify success message: "Migration 20251018_add_selector_discovery_fields applied successfully"

### Via Supabase CLI
```bash
npx supabase migration up
```

## Verification

Run these queries to verify migration applied correctly:

```sql
-- Check columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'directories'
  AND column_name IN (
    'field_selectors',
    'selectors_updated_at',
    'selector_discovery_log',
    'requires_login',
    'has_captcha',
    'failure_rate'
  )
ORDER BY column_name;

-- Expected: 6 rows

-- Check function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'update_directory_selectors';

-- Expected: 1 row (FUNCTION)

-- Check index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'directories'
  AND indexname = 'idx_directories_selectors_updated';

-- Expected: 1 row

-- Test function works
SELECT update_directory_selectors(
  (SELECT id FROM directories LIMIT 1),
  '{"test": "#test-selector"}'::jsonb,
  '{"testRun": true}'::jsonb
);

-- Check update applied
SELECT id, field_selectors, selectors_updated_at, selector_discovery_log
FROM directories
WHERE field_selectors ? 'test'
LIMIT 1;
```

## Rollback

If migration needs to be rolled back:

```sql
-- Drop function
DROP FUNCTION IF EXISTS update_directory_selectors(UUID, JSONB, JSONB);

-- Drop index
DROP INDEX IF EXISTS idx_directories_selectors_updated;

-- Drop columns
ALTER TABLE directories
DROP COLUMN IF EXISTS field_selectors,
DROP COLUMN IF EXISTS selectors_updated_at,
DROP COLUMN IF EXISTS selector_discovery_log,
DROP COLUMN IF EXISTS requires_login,
DROP COLUMN IF EXISTS has_captcha,
DROP COLUMN IF EXISTS failure_rate;
```

## Troubleshooting

### Issue: "column already exists"
**Solution**: Migration already applied, safe to continue. Run verification queries to confirm.

### Issue: "permission denied"
**Solution**: Ensure using service role key, not anon key. Check Supabase project settings.

### Issue: "function already exists"
**Solution**: Migration uses `CREATE OR REPLACE FUNCTION`, so this should not occur. If it does, manually drop function first.

### Issue: Index creation fails
**Solution**: Index uses `IF NOT EXISTS`, so this should not occur. Verify table name is correct.

## Dependencies

### Required Before
- `directories` table must exist
- Table must have `id` column (UUID primary key)

### Required After
- Update TypeScript types in `types/supabase.ts`
- Update worker logic to use new selector fields
- Deploy selector discovery functions

## Impact

### Performance
- **Positive**: Index on `selectors_updated_at` improves stale selector queries
- **Neutral**: JSONB columns have minimal storage overhead
- **Neutral**: Atomic function adds negligible overhead vs raw UPDATE

### Breaking Changes
- **None**: All columns nullable or have defaults
- **None**: Function is new, no existing code depends on it

### Data Migration
- **Not Required**: All columns have safe defaults
- **Optional**: Existing directories can be backfilled with discovered selectors

## Next Steps

1. ✅ Apply migration to Supabase
2. ⏳ Update TypeScript types
3. ⏳ Deploy selector discovery functions
4. ⏳ Test selector discovery on sample directories
5. ⏳ Schedule backfill job for existing directories
