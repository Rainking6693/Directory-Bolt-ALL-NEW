# Migration 016: Add Selector Discovery Fields

**Created**: 2025-01-18
**Author**: DirectoryBolt Team
**Status**: Ready for deployment

## Purpose

Add database support for the automated selector discovery system, enabling:
- Storage of auto-discovered CSS selectors
- Tracking of selector freshness
- Atomic updates to prevent race conditions
- Classification of directory difficulty (login required, CAPTCHA, etc.)

## Changes

### New Columns

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `field_selectors` | JSONB | `{}` | Stores discovered selectors as key-value pairs |
| `selectors_updated_at` | TIMESTAMPTZ | NULL | Timestamp of last selector update |
| `selector_discovery_log` | JSONB | `{}` | Metadata about discovery runs |
| `requires_login` | BOOLEAN | false | Directory requires authentication |
| `has_captcha` | BOOLEAN | false | Directory has bot protection |
| `failure_rate` | DECIMAL(3,2) | 0.00 | Historical failure rate (0.00-1.00) |

### New Indexes

1. `idx_directories_selectors_updated` - Performance index for selector freshness queries
2. `idx_directories_discovery_flags` - Index for filtering by login/CAPTCHA requirements

### New Functions

1. **`update_directory_selectors(dir_id, new_selectors, discovery_log)`**
   - Atomically updates selectors using JSONB merge
   - Prevents race conditions from concurrent discoveries
   - Updates timestamp automatically

2. **`get_stale_selector_directories(days_old)`**
   - Returns directories with selectors older than N days
   - Used by scheduled discovery jobs to refresh stale selectors

## Example Data

### field_selectors
```json
{
  "businessName": "#company-name",
  "email": "input[type=\"email\"]",
  "website": "input[name=\"website\"]",
  "phone": "input[name=\"phone\"]",
  "description": "textarea[name=\"description\"]"
}
```

### selector_discovery_log
```json
{
  "last_run": "2025-01-18T14:30:00Z",
  "updates": 5,
  "confidence_scores": {
    "businessName": 0.95,
    "email": 0.85,
    "website": 0.90
  },
  "request_id": "discover_1737211800_abc123"
}
```

## Deployment

### Via Supabase Dashboard (Recommended)

1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select DirectoryBolt project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy contents of `016_add_selector_discovery_fields.sql`
6. Paste into editor
7. Click **Run**
8. Verify success message

### Via Supabase CLI

```bash
# Apply migration
npx supabase migration up

# Or apply specific migration
npx supabase db push
```

## Verification

Run this query to verify migration applied successfully:

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

-- Check functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN ('update_directory_selectors', 'get_stale_selector_directories');

-- Check indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'directories'
  AND indexname LIKE '%selector%';
```

**Expected Results**:
- 6 columns returned
- 2 functions returned
- 2 indexes returned

## Test the Migration

```sql
-- Test 1: Insert test data
INSERT INTO directories (name, submission_url, field_selectors)
VALUES (
  'Test Directory',
  'https://example.com/submit',
  '{"email": "input[type=\"email\"]"}'::jsonb
)
RETURNING id, field_selectors;

-- Test 2: Use atomic update function
SELECT update_directory_selectors(
  '00000000-0000-0000-0000-000000000000'::uuid,
  '{"businessName": "#company-name"}'::jsonb,
  '{"last_run": "2025-01-18T14:30:00Z"}'::jsonb
);

-- Test 3: Get stale directories
SELECT * FROM get_stale_selector_directories(30);

-- Cleanup
DELETE FROM directories WHERE name = 'Test Directory';
```

## Rollback

If you need to rollback this migration:

```sql
-- Remove functions
DROP FUNCTION IF EXISTS update_directory_selectors;
DROP FUNCTION IF EXISTS get_stale_selector_directories;

-- Remove indexes
DROP INDEX IF EXISTS idx_directories_selectors_updated;
DROP INDEX IF EXISTS idx_directories_discovery_flags;

-- Remove columns
ALTER TABLE directories
DROP COLUMN IF EXISTS field_selectors,
DROP COLUMN IF EXISTS selectors_updated_at,
DROP COLUMN IF EXISTS selector_discovery_log,
DROP COLUMN IF EXISTS requires_login,
DROP COLUMN IF EXISTS has_captcha,
DROP COLUMN IF EXISTS failure_rate;
```

## Impact Analysis

### Breaking Changes
- None (all columns have defaults, functions are new)

### Performance Impact
- Minimal: Two new indexes improve query performance
- JSONB columns are efficient for storing selector data
- Atomic function prevents lock contention

### Storage Impact
- Estimated ~1KB per directory for field_selectors
- ~500 bytes per directory for discovery_log
- For 1000 directories: ~1.5MB total

## Dependencies

- Requires PostgreSQL 12+ (for JSONB features)
- No application code changes required yet
- Compatible with existing workers (they ignore new columns)

## Next Steps After Migration

1. ✅ Apply migration to Supabase
2. ⏳ Deploy security fixes to AutoSelectorDiscovery
3. ⏳ Update workers to use discovered selectors
4. ⏳ Run initial discovery on all directories
5. ⏳ Set up scheduled discovery job

## Troubleshooting

### Error: "column already exists"
**Cause**: Migration already applied
**Solution**: Safe to ignore, migration is idempotent

### Error: "permission denied"
**Cause**: Using anon key instead of service role key
**Solution**: Use service_role key or run as postgres user

### Error: "function already exists"
**Cause**: Function already created
**Solution**: Migration uses `CREATE OR REPLACE`, safe to re-run

## Support

For issues with this migration:
1. Check Supabase logs in dashboard
2. Verify PostgreSQL version is 12+
3. Ensure service_role key has proper permissions
4. Contact DevOps team if migration fails

---

**Migration Status**: ⏳ Pending Deployment
**Estimated Deploy Time**: 5 minutes
**Risk Level**: LOW (additive only, no breaking changes)
