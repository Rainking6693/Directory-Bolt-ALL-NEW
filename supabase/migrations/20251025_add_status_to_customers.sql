-- Migration: Add status column to customers table
-- Date: 2025-10-25
-- Purpose: Track customer account status (active, inactive, suspended)

-- Add status column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers (status);

-- Update existing customers to have 'active' status
UPDATE customers 
SET status = 'active' 
WHERE status IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN customers.status IS 'Customer account status: active, inactive, or suspended';
