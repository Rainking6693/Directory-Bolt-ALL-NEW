# Migration 016 - Selector Discovery System

## Quick Start

### 1. Apply Migration (Choose One Method)

**Method A: Supabase Dashboard** (Recommended - 2 minutes)
1. Open https://app.supabase.com → Your Project → SQL Editor
2. Copy/paste contents of `20251018_add_selector_discovery_fields.sql`
3. Click "Run"
4. See success message ✅

**Method B: Supabase CLI** (5 minutes)
```bash
npx supabase db push
```

### 2. Validate Migration

Copy/paste `VALIDATE_MIGRATION_016.sql` into SQL Editor and run.

**Expected Output**: All checks show "PASS"

### 3. Next Steps

- [ ] Update TypeScript types (`types/supabase.ts`)
- [ ] Deploy selector discovery functions
- [ ] Test on sample directory
- [ ] Schedule automated discovery

---

## What This Migration Does

Adds 6 new columns to `directories` table for automated form detection:

| Column | Type | Purpose |
|--------|------|---------|
| `field_selectors` | JSONB | CSS selectors for form fields |
| `selectors_updated_at` | TIMESTAMPTZ | Last discovery timestamp |
| `selector_discovery_log` | JSONB | Discovery metadata/logs |
| `requires_login` | BOOLEAN | Auth required flag |
| `has_captcha` | BOOLEAN | CAPTCHA detection flag |
| `failure_rate` | DECIMAL(3,2) | Historical success rate |

**Plus**:
- Index on `selectors_updated_at` for performance
- Atomic update function to prevent race conditions

---

## Files in This Migration

```
supabase/migrations/
├── 20251018_add_selector_discovery_fields.sql     ← Main migration
├── 20251018_add_selector_discovery_fields.md      ← Full documentation
├── VALIDATE_MIGRATION_016.sql                     ← Validation script
└── README_MIGRATION_016.md                        ← This file
```

---

## Common Issues

### ❌ "column already exists"
**Fix**: Migration already applied. Run validation script to confirm.

### ❌ "permission denied"
**Fix**: Use service role key, not anon key.

### ❌ Function errors
**Fix**: Migration uses `CREATE OR REPLACE`, should not error.

---

## Rollback

If needed, rollback commands in `20251018_add_selector_discovery_fields.md`

---

## Support

Full documentation: `20251018_add_selector_discovery_fields.md`
Deployment guide: `backend/functions/selector-discovery/DEPLOYMENT.md`
