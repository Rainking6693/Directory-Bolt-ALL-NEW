-- ====================================================
-- VALIDATION SCRIPT FOR MIGRATION 20251018
-- ====================================================
-- Run this script AFTER applying migration to verify success
-- Expected: All checks should return TRUE or expected row counts

-- CHECK 1: Verify all columns exist
SELECT
  CASE WHEN COUNT(*) = 6 THEN 'PASS' ELSE 'FAIL' END AS column_check,
  COUNT(*) AS columns_found,
  6 AS columns_expected
FROM information_schema.columns
WHERE table_name = 'directories'
  AND column_name IN (
    'field_selectors',
    'selectors_updated_at',
    'selector_discovery_log',
    'requires_login',
    'has_captcha',
    'failure_rate'
  );

-- CHECK 2: Verify column types are correct
SELECT
  column_name,
  data_type,
  CASE
    WHEN column_name = 'field_selectors' AND data_type = 'jsonb' THEN 'PASS'
    WHEN column_name = 'selectors_updated_at' AND data_type = 'timestamp with time zone' THEN 'PASS'
    WHEN column_name = 'selector_discovery_log' AND data_type = 'jsonb' THEN 'PASS'
    WHEN column_name = 'requires_login' AND data_type = 'boolean' THEN 'PASS'
    WHEN column_name = 'has_captcha' AND data_type = 'boolean' THEN 'PASS'
    WHEN column_name = 'failure_rate' AND data_type = 'numeric' THEN 'PASS'
    ELSE 'FAIL'
  END AS type_check
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

-- CHECK 3: Verify index exists
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS index_check,
  COUNT(*) AS indexes_found,
  1 AS indexes_expected
FROM pg_indexes
WHERE tablename = 'directories'
  AND indexname = 'idx_directories_selectors_updated';

-- CHECK 4: Verify function exists
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS function_check,
  COUNT(*) AS functions_found,
  1 AS functions_expected
FROM information_schema.routines
WHERE routine_name = 'update_directory_selectors'
  AND routine_type = 'FUNCTION';

-- CHECK 5: Test function works (safe to run multiple times)
DO $$
DECLARE
  test_dir_id UUID;
  test_selectors JSONB;
  test_log JSONB;
BEGIN
  -- Get first directory ID
  SELECT id INTO test_dir_id FROM directories LIMIT 1;

  IF test_dir_id IS NOT NULL THEN
    -- Test update function
    PERFORM update_directory_selectors(
      test_dir_id,
      '{"validation_test": "#validation-selector"}'::jsonb,
      '{"validation_run": true, "timestamp": NOW()}'::jsonb
    );

    -- Verify update worked
    SELECT field_selectors, selector_discovery_log
    INTO test_selectors, test_log
    FROM directories
    WHERE id = test_dir_id;

    IF test_selectors ? 'validation_test' THEN
      RAISE NOTICE 'CHECK 5: PASS - Function test successful for directory %', test_dir_id;
    ELSE
      RAISE WARNING 'CHECK 5: FAIL - Selectors not updated for directory %', test_dir_id;
    END IF;
  ELSE
    RAISE NOTICE 'CHECK 5: SKIP - No directories found to test function';
  END IF;
END $$;

-- CHECK 6: Verify default values
SELECT
  column_name,
  column_default,
  CASE
    WHEN column_name = 'field_selectors' AND column_default = '''{}''::jsonb' THEN 'PASS'
    WHEN column_name = 'selector_discovery_log' AND column_default = '''{}''::jsonb' THEN 'PASS'
    WHEN column_name = 'requires_login' AND column_default = 'false' THEN 'PASS'
    WHEN column_name = 'has_captcha' AND column_default = 'false' THEN 'PASS'
    WHEN column_name = 'failure_rate' AND column_default = '0.00' THEN 'PASS'
    WHEN column_name = 'selectors_updated_at' AND column_default IS NULL THEN 'PASS'
    ELSE 'FAIL'
  END AS default_check
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

-- ====================================================
-- SUMMARY
-- ====================================================
-- If all checks show PASS, migration was successful!
-- Next steps:
-- 1. Update TypeScript types
-- 2. Deploy selector discovery functions
-- 3. Test on sample directory
-- ====================================================
