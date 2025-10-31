-- Migration: add business fields to jobs table
-- Note: run on development database before production deployment.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS directory_limit integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS package_type text DEFAULT 'starter';

UPDATE public.jobs
SET directory_limit = COALESCE(directory_limit, 50),
    package_type = COALESCE(package_type, 'starter')
WHERE directory_limit IS NULL OR package_type IS NULL;

ALTER TABLE public.jobs
  ALTER COLUMN directory_limit SET NOT NULL,
  ALTER COLUMN package_type SET NOT NULL;
