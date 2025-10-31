-- Supabase database schema for DirectoryBolt customer management
-- This replaces the Google Sheets data structure with a proper relational database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create customers table (replaces Google Sheets)
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id VARCHAR(50) UNIQUE NOT NULL, -- DIR-YYYYMMDD-XXXXXX format
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    business_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    website VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',
    package_type VARCHAR(50) DEFAULT 'starter' CHECK (package_type IN ('starter', 'growth', 'professional', 'pro', 'enterprise')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'in-progress', 'completed', 'failed', 'paused', 'cancelled')),
    
    -- Queue and processing fields
    directories_submitted INTEGER DEFAULT 0,
    failed_directories INTEGER DEFAULT 0,
    processing_metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_package_type ON customers(package_type);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_business_name ON customers(business_name);

-- Create a trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create queue_history table for tracking processing history
CREATE TABLE IF NOT EXISTS queue_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE CASCADE,
    status_from VARCHAR(50),
    status_to VARCHAR(50) NOT NULL,
    directories_processed INTEGER DEFAULT 0,
    directories_failed INTEGER DEFAULT 0,
    processing_time_seconds INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_history_customer_id ON queue_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_queue_history_created_at ON queue_history(created_at);
CREATE INDEX IF NOT EXISTS idx_queue_history_status_to ON queue_history(status_to);

-- Create customer_notifications table for real-time notifications
CREATE TABLE IF NOT EXISTS customer_notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('success', 'warning', 'info', 'error')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(500),
    action_text VARCHAR(100),
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer_id ON customer_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_read ON customer_notifications(read);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_created_at ON customer_notifications(created_at);

-- Create directory_submissions table for tracking individual directory submissions
CREATE TABLE IF NOT EXISTS directory_submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE CASCADE,
    directory_name VARCHAR(200) NOT NULL,
    directory_url VARCHAR(500),
    submission_status VARCHAR(50) DEFAULT 'pending' CHECK (submission_status IN ('pending', 'submitted', 'approved', 'rejected', 'processing')),
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    listing_url VARCHAR(500),
    rejection_reason TEXT,
    domain_authority INTEGER,
    estimated_traffic INTEGER,
    category VARCHAR(100),
    tier VARCHAR(50) DEFAULT 'standard' CHECK (tier IN ('standard', 'premium', 'enterprise')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_directory_submissions_customer_id ON directory_submissions(customer_id);
CREATE INDEX IF NOT EXISTS idx_directory_submissions_status ON directory_submissions(submission_status);
CREATE INDEX IF NOT EXISTS idx_directory_submissions_directory_name ON directory_submissions(directory_name);
CREATE INDEX IF NOT EXISTS idx_directory_submissions_submitted_at ON directory_submissions(submitted_at);

-- Create trigger for directory_submissions updated_at
CREATE TRIGGER update_directory_submissions_updated_at 
    BEFORE UPDATE ON directory_submissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create analytics_events table for tracking customer actions and events
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_name VARCHAR(200) NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_customer_id ON analytics_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- Create batch_operations table for tracking bulk operations
CREATE TABLE IF NOT EXISTS batch_operations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('process', 'retry', 'cancel', 'pause', 'resume')),
    customer_ids JSONB NOT NULL, -- Array of customer IDs
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'failed', 'cancelled')),
    total_customers INTEGER NOT NULL,
    processed_customers INTEGER DEFAULT 0,
    successful_operations INTEGER DEFAULT 0,
    failed_operations INTEGER DEFAULT 0,
    error_message TEXT,
    created_by VARCHAR(100), -- User or system that initiated the batch
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_operations_status ON batch_operations(status);
CREATE INDEX IF NOT EXISTS idx_batch_operations_operation_type ON batch_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_batch_operations_created_at ON batch_operations(created_at);

-- Create RLS (Row Level Security) policies for security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_operations ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your authentication system)
-- For now, allow service role full access
CREATE POLICY "Service role can do everything" ON customers
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do everything" ON queue_history
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do everything" ON customer_notifications
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do everything" ON directory_submissions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do everything" ON analytics_events
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do everything" ON batch_operations
    FOR ALL USING (auth.role() = 'service_role');

-- Create views for common queries
CREATE OR REPLACE VIEW customer_stats AS
SELECT 
    COUNT(*) as total_customers,
    COUNT(*) FILTER (WHERE status = 'active') as active_customers,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_customers,
    COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress_customers,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_customers,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_customers,
    COUNT(*) FILTER (WHERE status = 'paused') as paused_customers,
    COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as todays_registrations,
    COUNT(*) FILTER (WHERE package_type != 'starter') as premium_customers,
    ROUND(AVG(directories_submitted), 2) as avg_directories_per_customer,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'completed') * 100.0) / 
        NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'failed')), 0), 
        2
    ) as success_rate_percentage
FROM customers;

-- Create a function to generate customer IDs
CREATE OR REPLACE FUNCTION generate_customer_id()
RETURNS VARCHAR(50) AS $$
DECLARE
    new_id VARCHAR(50);
    id_exists BOOLEAN;
BEGIN
    LOOP
        new_id := 'DIR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        
        SELECT EXISTS(SELECT 1 FROM customers WHERE customer_id = new_id) INTO id_exists;
        
        IF NOT id_exists THEN
            RETURN new_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update queue history when customer status changes
CREATE OR REPLACE FUNCTION log_customer_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status actually changed
    IF OLD.status != NEW.status THEN
        INSERT INTO queue_history (
            customer_id, 
            status_from, 
            status_to, 
            directories_processed, 
            directories_failed,
            metadata
        ) VALUES (
            NEW.customer_id, 
            OLD.status, 
            NEW.status,
            NEW.directories_submitted - COALESCE(OLD.directories_submitted, 0),
            NEW.failed_directories - COALESCE(OLD.failed_directories, 0),
            jsonb_build_object(
                'package_type', NEW.package_type,
                'business_name', NEW.business_name
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically log status changes
CREATE TRIGGER log_customer_status_changes
    AFTER UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION log_customer_status_change();

-- Grant necessary permissions to authenticated and anon roles (adjust as needed)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Allow authenticated users to read customer stats
GRANT SELECT ON customer_stats TO authenticated;

COMMENT ON TABLE customers IS 'Main customer table replacing Google Sheets data';
COMMENT ON TABLE queue_history IS 'Tracks all status changes and processing history';
COMMENT ON TABLE customer_notifications IS 'Real-time notifications for customers';
COMMENT ON TABLE directory_submissions IS 'Individual directory submission tracking';
COMMENT ON TABLE analytics_events IS 'Customer behavior and system event tracking';
COMMENT ON TABLE batch_operations IS 'Bulk operation management and tracking';
COMMENT ON VIEW customer_stats IS 'Real-time customer statistics for dashboard';
COMMENT ON FUNCTION generate_customer_id() IS 'Generates unique customer IDs in DIR-YYYYMMDD-XXXXXX format';