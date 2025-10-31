-- Admin and Staff User Management Schema for DirectoryBolt
-- This extends the existing schema with proper admin/staff authentication

-- Create admin_users table for admin authentication
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    permissions JSONB DEFAULT '{}'::jsonb,
    api_key VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create staff_users table for staff authentication
CREATE TABLE IF NOT EXISTS staff_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'staff' CHECK (role IN ('staff', 'senior_staff', 'manager')),
    permissions JSONB DEFAULT '{}'::jsonb,
    api_key VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create user_sessions table for persistent session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('admin', 'staff')),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_api_key ON admin_users(api_key);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON admin_users(is_active);

CREATE INDEX IF NOT EXISTS idx_staff_users_username ON staff_users(username);
CREATE INDEX IF NOT EXISTS idx_staff_users_email ON staff_users(email);
CREATE INDEX IF NOT EXISTS idx_staff_users_api_key ON staff_users(api_key);
CREATE INDEX IF NOT EXISTS idx_staff_users_is_active ON staff_users(is_active);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_admin_users_updated_at 
    BEFORE UPDATE ON admin_users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_users_updated_at 
    BEFORE UPDATE ON staff_users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for security
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Service role can do everything" ON admin_users
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do everything" ON staff_users
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do everything" ON user_sessions
    FOR ALL USING (auth.role() = 'service_role');

-- Create function to hash passwords
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Using bcrypt with cost factor 12
    RETURN crypt(password, gen_salt('bf', 12));
END;
$$ LANGUAGE plpgsql;

-- Create function to verify passwords
CREATE OR REPLACE FUNCTION verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN hash = crypt(password, hash);
END;
$$ LANGUAGE plpgsql;

-- Create function to generate API keys
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
BEGIN
    RETURN 'DB-' || encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Create function to generate session tokens
CREATE OR REPLACE FUNCTION generate_session_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() OR is_active = FALSE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON admin_users TO service_role;
GRANT ALL ON staff_users TO service_role;
GRANT ALL ON user_sessions TO service_role;

-- Insert BEN STONE as CEO/Admin
INSERT INTO admin_users (
    username,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    api_key,
    permissions,
    is_active
) VALUES (
    'admin',
    'ben.stone@directorybolt.com',
    hash_password('DirectoryBolt2025!'),
    'BEN',
    'STONE',
    'super_admin',
    'DirectoryBolt-Admin-2025-SecureKey',
    '{"system": true, "users": true, "analytics": true, "billing": true, "support": true}'::jsonb,
    TRUE
) ON CONFLICT (username) DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    api_key = EXCLUDED.api_key,
    permissions = EXCLUDED.permissions,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Insert BEN STONE as Staff (for staff dashboard access)
INSERT INTO staff_users (
    username,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    api_key,
    permissions,
    is_active
) VALUES (
    'staff',
    'ben.stone@directorybolt.com',
    hash_password('DirectoryBoltStaff2025!'),
    'BEN',
    'STONE',
    'manager',
    'DirectoryBolt-Staff-2025-SecureKey',
    '{"queue": true, "processing": true, "analytics": true, "support": true}'::jsonb,
    TRUE
) ON CONFLICT (username) DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    api_key = EXCLUDED.api_key,
    permissions = EXCLUDED.permissions,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Add comments
COMMENT ON TABLE admin_users IS 'Admin user accounts for system administration';
COMMENT ON TABLE staff_users IS 'Staff user accounts for customer support and operations';
COMMENT ON TABLE user_sessions IS 'Persistent session management for admin and staff users';
COMMENT ON FUNCTION hash_password(TEXT) IS 'Hashes passwords using bcrypt';
COMMENT ON FUNCTION verify_password(TEXT, TEXT) IS 'Verifies passwords against bcrypt hashes';
COMMENT ON FUNCTION generate_api_key() IS 'Generates secure API keys for admin/staff users';
COMMENT ON FUNCTION generate_session_token() IS 'Generates secure session tokens';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Removes expired and inactive sessions';
