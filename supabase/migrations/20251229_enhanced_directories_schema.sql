-- Migration: Enhanced Directories Schema for AI-Powered Submission Automation
-- Date: 2025-12-29
-- Purpose: Add missing columns to directories table for complete AI agent automation

-- ============================================================================
-- STEP 1: Enable extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- STEP 2: Add new columns to existing directories table
-- ============================================================================

-- Submission method and requirements
ALTER TABLE directories ADD COLUMN IF NOT EXISTS submission_method TEXT DEFAULT 'web_form'
    CHECK (submission_method IN ('web_form', 'email', 'api', 'google_form', 'typeform', 'airtable', 'notion', 'manual'));

ALTER TABLE directories ADD COLUMN IF NOT EXISTS required_fields JSONB DEFAULT '[]';
-- Example: ["name", "url", "description", "email", "logo", "category"]

ALTER TABLE directories ADD COLUMN IF NOT EXISTS optional_fields JSONB DEFAULT '[]';
-- Example: ["tagline", "screenshots", "social_links", "founding_year", "pricing"]

ALTER TABLE directories ADD COLUMN IF NOT EXISTS field_constraints JSONB DEFAULT '{}';
-- Example: {"description": {"min_length": 100, "max_length": 500}, "tagline": {"max_length": 60}}

ALTER TABLE directories ADD COLUMN IF NOT EXISTS category_options JSONB DEFAULT '[]';
-- Example: ["AI/ML", "Developer Tools", "Productivity", "Marketing"]

-- Barriers and blockers
ALTER TABLE directories ADD COLUMN IF NOT EXISTS requires_email_verification BOOLEAN DEFAULT FALSE;
ALTER TABLE directories ADD COLUMN IF NOT EXISTS captcha_type TEXT;
-- Values: 'recaptcha_v2', 'recaptcha_v3', 'hcaptcha', 'cloudflare', null

ALTER TABLE directories ADD COLUMN IF NOT EXISTS requires_payment BOOLEAN DEFAULT FALSE;
ALTER TABLE directories ADD COLUMN IF NOT EXISTS cost_amount DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE directories ADD COLUMN IF NOT EXISTS cost_currency TEXT DEFAULT 'USD';
ALTER TABLE directories ADD COLUMN IF NOT EXISTS cost_type TEXT DEFAULT 'free'
    CHECK (cost_type IN ('free', 'one_time', 'subscription', 'freemium'));

-- Status and health tracking
ALTER TABLE directories ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'dead', 'paid_only', 'manual_only', 'paused', 'needs_verification'));

ALTER TABLE directories ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
ALTER TABLE directories ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMPTZ;
ALTER TABLE directories ADD COLUMN IF NOT EXISTS health_check_result JSONB DEFAULT '{}';
-- Example: {"status_code": 200, "response_time_ms": 450, "error": null}

ALTER TABLE directories ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;

-- Submission history aggregates
ALTER TABLE directories ADD COLUMN IF NOT EXISTS total_submissions INTEGER DEFAULT 0;
ALTER TABLE directories ADD COLUMN IF NOT EXISTS successful_submissions INTEGER DEFAULT 0;
ALTER TABLE directories ADD COLUMN IF NOT EXISTS failed_submissions INTEGER DEFAULT 0;
ALTER TABLE directories ADD COLUMN IF NOT EXISTS last_successful_submission_at TIMESTAMPTZ;
ALTER TABLE directories ADD COLUMN IF NOT EXISTS last_submission_attempt JSONB DEFAULT '{}';
-- Example: {"date": "2025-01-15", "success": true, "error": null}

-- Special instructions and notes
ALTER TABLE directories ADD COLUMN IF NOT EXISTS submission_instructions TEXT;
-- Example: "Must use domain email", "No AI tools allowed"

ALTER TABLE directories ADD COLUMN IF NOT EXISTS rejection_reasons TEXT[];
-- Example: ["low_quality_description", "no_logo", "suspicious_url"]

ALTER TABLE directories ADD COLUMN IF NOT EXISTS tips_for_approval TEXT;
-- Example: "Add social proof", "Include pricing info"

ALTER TABLE directories ADD COLUMN IF NOT EXISTS automation_notes TEXT;
-- Notes for automation scripts

-- Multi-step forms
ALTER TABLE directories ADD COLUMN IF NOT EXISTS form_steps JSONB DEFAULT '[]';
-- Example: [{"step": 1, "url": "/submit/step1", "fields": ["name", "email"]}]

-- SEO extras
ALTER TABLE directories ADD COLUMN IF NOT EXISTS backlink_type TEXT DEFAULT 'unknown'
    CHECK (backlink_type IN ('dofollow', 'nofollow', 'none', 'unknown'));

ALTER TABLE directories ADD COLUMN IF NOT EXISTS time_to_approval_hours INTEGER;
-- Machine-readable version (24 = 1 day, 72 = 3 days)

-- Targeting
ALTER TABLE directories ADD COLUMN IF NOT EXISTS niche_tags TEXT[] DEFAULT '{}';
ALTER TABLE directories ADD COLUMN IF NOT EXISTS target_audience TEXT[];
-- Example: ['startups', 'saas', 'b2b']

ALTER TABLE directories ADD COLUMN IF NOT EXISTS accepts_international BOOLEAN DEFAULT TRUE;
ALTER TABLE directories ADD COLUMN IF NOT EXISTS geo_restrictions TEXT[];

-- Priority ranking
ALTER TABLE directories ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 50;
-- 0-100 internal priority ranking

-- ============================================================================
-- STEP 3: Add indexes for common query patterns
-- ============================================================================

-- Trigram index for fuzzy name search
CREATE INDEX IF NOT EXISTS idx_directories_name_trgm ON directories USING gin (name gin_trgm_ops);

-- Status and health monitoring
CREATE INDEX IF NOT EXISTS idx_directories_status ON directories (status);
CREATE INDEX IF NOT EXISTS idx_directories_health_check ON directories (last_health_check_at, status);
CREATE INDEX IF NOT EXISTS idx_directories_consecutive_failures ON directories (consecutive_failures) WHERE consecutive_failures > 0;

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_directories_active_category_impact
    ON directories (active, category, impact_level)
    WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_directories_active_difficulty_tier
    ON directories (active, difficulty, tier_required)
    WHERE active = TRUE;

-- Priority and ranking
CREATE INDEX IF NOT EXISTS idx_directories_priority_da
    ON directories (priority_score DESC, domain_authority DESC)
    WHERE active = TRUE;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_directories_required_fields ON directories USING gin (required_fields);
CREATE INDEX IF NOT EXISTS idx_directories_niche_tags ON directories USING gin (niche_tags);

-- Full-text search on description
CREATE INDEX IF NOT EXISTS idx_directories_description_fts
    ON directories USING gin (to_tsvector('english', COALESCE(description, '')));

-- ============================================================================
-- STEP 4: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN directories.required_fields IS 'JSONB array of required field names, e.g., ["name", "url", "description", "email"]';
COMMENT ON COLUMN directories.optional_fields IS 'JSONB array of optional field names';
COMMENT ON COLUMN directories.field_constraints IS 'Field-specific validation rules, e.g., {"description": {"min_length": 100, "max_length": 500}}';
COMMENT ON COLUMN directories.category_options IS 'Available category choices in the form for auto-selection';
COMMENT ON COLUMN directories.submission_instructions IS 'Special instructions/quirks for submission, e.g., "Must use domain email"';
COMMENT ON COLUMN directories.status IS 'Directory status: active, dead, paid_only, manual_only, paused, needs_verification';
COMMENT ON COLUMN directories.form_steps IS 'Multi-step form flow definition for complex submission processes';
COMMENT ON COLUMN directories.cost_amount IS 'Cost in USD (0 = free)';
COMMENT ON COLUMN directories.submission_method IS 'How to submit: web_form, email, api, google_form, typeform, airtable, notion, manual';

-- ============================================================================
-- Migration complete
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 20251229_enhanced_directories_schema applied successfully';
END $$;
