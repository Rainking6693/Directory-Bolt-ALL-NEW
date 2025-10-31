-- CRITICAL SCHEMA FIX: Address missing columns and foreign key relationships
-- This fixes the 500 errors in AutoBolt API endpoints

-- =========================================
-- FIX 1: Add missing business_data column to customers table
-- =========================================
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS business_data JSONB DEFAULT '{}'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN customers.business_data IS 'JSONB column storing business information like phone, address, social media links, etc.';

-- =========================================  
-- FIX 2: Ensure autobolt_processing_queue table exists with proper structure
-- =========================================
CREATE TABLE IF NOT EXISTS autobolt_processing_queue (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(255) NOT NULL,
    directory_limit INTEGER NOT NULL DEFAULT 50,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    priority_level INTEGER DEFAULT 5,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    processed_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add status constraint
ALTER TABLE autobolt_processing_queue 
DROP CONSTRAINT IF EXISTS autobolt_processing_queue_status_check;

ALTER TABLE autobolt_processing_queue 
ADD CONSTRAINT autobolt_processing_queue_status_check 
CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'));

-- =========================================
-- FIX 3: Create foreign key relationship (but make it flexible)
-- Note: Using a loose relationship to handle test customers (TEST-xxx format)
-- =========================================

-- Add index on customer_id for performance
CREATE INDEX IF NOT EXISTS idx_autobolt_queue_customer_id 
ON autobolt_processing_queue(customer_id);

-- Add index on status for performance
CREATE INDEX IF NOT EXISTS idx_autobolt_queue_status 
ON autobolt_processing_queue(status);

-- =========================================
-- FIX 4: Create autobolt_test_logs table for test tracking
-- =========================================
CREATE TABLE IF NOT EXISTS autobolt_test_logs (
    id SERIAL PRIMARY KEY,
    test_job_id INTEGER,
    test_customer_id VARCHAR(255) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    test_type VARCHAR(50) DEFAULT 'basic',
    directory_count INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add status constraint for test logs
ALTER TABLE autobolt_test_logs 
DROP CONSTRAINT IF EXISTS autobolt_test_logs_status_check;

ALTER TABLE autobolt_test_logs 
ADD CONSTRAINT autobolt_test_logs_status_check 
CHECK (status IN ('queued', 'processing', 'completed', 'failed'));

-- Add index for test logs
CREATE INDEX IF NOT EXISTS idx_autobolt_test_logs_customer_id 
ON autobolt_test_logs(test_customer_id);

-- =========================================
-- FIX 5: Ensure job_results table exists for progress tracking
-- =========================================
CREATE TABLE IF NOT EXISTS job_results (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL,
    directory_name VARCHAR(255),
    directory_url VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    submission_url VARCHAR(500),
    error_message TEXT,
    processing_time_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add status constraint for job results
ALTER TABLE job_results 
DROP CONSTRAINT IF EXISTS job_results_status_check;

ALTER TABLE job_results 
ADD CONSTRAINT job_results_status_check 
CHECK (status IN ('pending', 'processing', 'submitted', 'approved', 'failed', 'rejected'));

-- Add indexes for job results
CREATE INDEX IF NOT EXISTS idx_job_results_job_id 
ON job_results(job_id);

CREATE INDEX IF NOT EXISTS idx_job_results_status 
ON job_results(status);

-- =========================================
-- FIX 6: Update triggers for updated_at columns
-- =========================================

-- Ensure update trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_autobolt_queue_updated_at ON autobolt_processing_queue;
CREATE TRIGGER update_autobolt_queue_updated_at 
    BEFORE UPDATE ON autobolt_processing_queue 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_results_updated_at ON job_results;
CREATE TRIGGER update_job_results_updated_at 
    BEFORE UPDATE ON job_results 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- FIX 7: Grant proper permissions
-- =========================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON autobolt_processing_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE ON autobolt_test_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON job_results TO authenticated;

-- Grant sequence permissions (only if sequences exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'autobolt_processing_queue_id_seq') THEN
        GRANT USAGE ON SEQUENCE autobolt_processing_queue_id_seq TO authenticated;
        GRANT ALL ON SEQUENCE autobolt_processing_queue_id_seq TO service_role;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'autobolt_test_logs_id_seq') THEN
        GRANT USAGE ON SEQUENCE autobolt_test_logs_id_seq TO authenticated;
        GRANT ALL ON SEQUENCE autobolt_test_logs_id_seq TO service_role;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'job_results_id_seq') THEN
        GRANT USAGE ON SEQUENCE job_results_id_seq TO authenticated;
        GRANT ALL ON SEQUENCE job_results_id_seq TO service_role;
    END IF;
END $$;

-- Grant permissions to service role (for API calls)
GRANT ALL ON autobolt_processing_queue TO service_role;
GRANT ALL ON autobolt_test_logs TO service_role;
GRANT ALL ON job_results TO service_role;
GRANT ALL ON customers TO service_role;