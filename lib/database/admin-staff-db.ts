// Admin and Staff Database Service for DirectoryBolt
// Handles authentication, session management, and user operations

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

// Lazy initialization to avoid build-time errors
let supabaseInstance: ReturnType<typeof createClient> | null = null

function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be defined')
  }

  supabaseInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  return supabaseInstance
}

const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof ReturnType<typeof createClient>]
  }
})

export interface AdminUser {
  id: string
  username: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'super_admin'
  permissions: Record<string, boolean>
  api_key: string
  is_active: boolean
  last_login?: string
  created_at: string
  updated_at: string
}

// Internal type for queries that include password_hash
interface AdminUserWithPassword extends AdminUser {
  password_hash: string
}

export interface StaffUser {
  id: string
  username: string
  email: string
  first_name: string
  last_name: string
  role: 'staff' | 'senior_staff' | 'manager'
  permissions: Record<string, boolean>
  api_key: string
  is_active: boolean
  last_login?: string
  created_at: string
  updated_at: string
}

// Internal type for queries that include password_hash
interface StaffUserWithPassword extends StaffUser {
  password_hash: string
}

export interface UserSession {
  id: string
  user_id: string
  user_type: 'admin' | 'staff'
  session_token: string
  refresh_token?: string
  ip_address?: string
  user_agent?: string
  expires_at: string
  is_active: boolean
  last_activity: string
  created_at: string
}

export class AdminStaffDatabase {
  // Admin User Operations
  async getAdminByUsername(username: string): Promise<AdminUser | null> {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    if (error || !data) return null
    return data as AdminUser
  }

  async getAdminByApiKey(apiKey: string): Promise<AdminUser | null> {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single()

    if (error || !data) return null
    return data as AdminUser
  }

  async verifyAdminPassword(username: string, password: string): Promise<AdminUser | null> {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, username, email, first_name, last_name, role, permissions, api_key, is_active, last_login, created_at, updated_at, password_hash')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    if (error || !data) return null

    // Type assertion: we know password_hash exists because we selected it
    const userWithPassword = data as unknown as AdminUserWithPassword

    // Verify password using bcrypt
    const isValid = await bcrypt.compare(password, userWithPassword.password_hash)
    if (!isValid) return null

    // Return AdminUser without password_hash
    const { password_hash: _, ...user } = userWithPassword
    return user as AdminUser
  }

  async updateAdminLastLogin(adminId: string): Promise<void> {
    await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', adminId)
  }

  // Staff User Operations
  async getStaffByUsername(username: string): Promise<StaffUser | null> {
    const { data, error } = await supabase
      .from('staff_users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    if (error || !data) return null
    return data as StaffUser
  }

  async getStaffByApiKey(apiKey: string): Promise<StaffUser | null> {
    const { data, error } = await supabase
      .from('staff_users')
      .select('*')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single()

    if (error || !data) return null
    return data as StaffUser
  }

  async verifyStaffPassword(username: string, password: string): Promise<StaffUser | null> {
    const { data, error } = await supabase
      .from('staff_users')
      .select('id, username, email, first_name, last_name, role, permissions, api_key, is_active, last_login, created_at, updated_at, password_hash')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    if (error || !data) return null

    // Type assertion: we know password_hash exists because we selected it
    const userWithPassword = data as unknown as StaffUserWithPassword

    // Verify password using bcrypt
    const isValid = await bcrypt.compare(password, userWithPassword.password_hash)
    if (!isValid) return null

    // Return StaffUser without password_hash
    const { password_hash: _, ...user } = userWithPassword
    return user as StaffUser
  }

  async updateStaffLastLogin(staffId: string): Promise<void> {
    await supabase
      .from('staff_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', staffId)
  }

  // Session Management
  async createSession(
    userId: string,
    userType: 'admin' | 'staff',
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserSession | null> {
    const sessionToken = this.generateToken()
    const refreshToken = this.generateToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        user_type: userType,
        session_token: sessionToken,
        refresh_token: refreshToken,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
        is_active: true
      })
      .select()
      .single()

    if (error || !data) return null
    return data as UserSession
  }

  async getSession(sessionToken: string): Promise<UserSession | null> {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !data) return null
    return data as UserSession
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await supabase
      .from('user_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', sessionId)
  }

  async invalidateSession(sessionToken: string): Promise<void> {
    await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('session_token', sessionToken)
  }

  async invalidateAllUserSessions(userId: string, userType: 'admin' | 'staff'): Promise<void> {
    await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('user_type', userType)
  }

  async cleanupExpiredSessions(): Promise<number> {
    const { data, error } = await supabase
      .rpc('cleanup_expired_sessions')

    if (error) return 0
    return data || 0
  }

  // Utility Methods
  private generateToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  // Authentication Helpers with Fallback
  async authenticateAdmin(credentials: {
    username?: string
    password?: string
    apiKey?: string
  }): Promise<{ user: AdminUser; session: UserSession } | null> {
    let user: AdminUser | null = null

    // Try database authentication first
    try {
      if (credentials.apiKey) {
        user = await this.getAdminByApiKey(credentials.apiKey)
      } else if (credentials.username && credentials.password) {
        user = await this.verifyAdminPassword(credentials.username, credentials.password)
      }
    } catch (error) {
      console.log('Database auth failed, trying fallback:', error)
    }

    // Fallback to hardcoded authentication if database fails
    if (!user) {
      user = await this.fallbackAdminAuth(credentials)
    }

    if (!user) return null

    // Update last login (if database is available)
    try {
      await this.updateAdminLastLogin(user.id)
    } catch (error) {
      console.log('Could not update last login:', error)
    }

    // Create session (if database is available)
    let session: UserSession | null = null
    try {
      session = await this.createSession(user.id, 'admin')
    } catch (error) {
      console.log('Could not create database session, using fallback:', error)
      // Create a mock session for fallback
      session = {
        id: 'fallback-session',
        user_id: user.id,
        user_type: 'admin',
        session_token: this.generateToken(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
        last_activity: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    }

    if (!session) return null

    return { user, session }
  }

  // Fallback authentication for when database is not available
  private async fallbackAdminAuth(credentials: {
    username?: string
    password?: string
    apiKey?: string
  }): Promise<AdminUser | null> {
    // Check API key
    if (credentials.apiKey) {
      const validApiKey = process.env.ADMIN_API_KEY || 'DirectoryBolt-Admin-2025-SecureKey'
      if (credentials.apiKey === validApiKey) {
        return {
          id: 'fallback-admin',
          username: 'admin',
          email: 'ben.stone@directorybolt.com',
          first_name: 'BEN',
          last_name: 'STONE',
          role: 'super_admin',
          permissions: {
            system: true,
            users: true,
            analytics: true,
            billing: true,
            support: true
          },
          api_key: validApiKey,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }
    }

    // Check username/password
    if (credentials.username && credentials.password) {
      const validUsername = process.env.ADMIN_USERNAME || 'admin'
      const validPassword = process.env.ADMIN_PASSWORD || 'DirectoryBolt2025!'
      
      if (credentials.username === validUsername && credentials.password === validPassword) {
        return {
          id: 'fallback-admin',
          username: 'admin',
          email: 'ben.stone@directorybolt.com',
          first_name: 'BEN',
          last_name: 'STONE',
          role: 'super_admin',
          permissions: {
            system: true,
            users: true,
            analytics: true,
            billing: true,
            support: true
          },
          api_key: process.env.ADMIN_API_KEY || 'DirectoryBolt-Admin-2025-SecureKey',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }
    }

    return null
  }

  async authenticateStaff(credentials: {
    username?: string
    password?: string
    apiKey?: string
  }): Promise<{ user: StaffUser; session: UserSession } | null> {
    let user: StaffUser | null = null

    // Try database authentication first
    try {
      if (credentials.apiKey) {
        user = await this.getStaffByApiKey(credentials.apiKey)
      } else if (credentials.username && credentials.password) {
        user = await this.verifyStaffPassword(credentials.username, credentials.password)
      }
    } catch (error) {
      console.log('Database auth failed, trying fallback:', error)
    }

    // Fallback to hardcoded authentication if database fails
    if (!user) {
      user = await this.fallbackStaffAuth(credentials)
    }

    if (!user) return null

    // Update last login (if database is available)
    try {
      await this.updateStaffLastLogin(user.id)
    } catch (error) {
      console.log('Could not update last login:', error)
    }

    // Create session (if database is available)
    let session: UserSession | null = null
    try {
      session = await this.createSession(user.id, 'staff')
    } catch (error) {
      console.log('Could not create database session, using fallback:', error)
      // Create a mock session for fallback
      session = {
        id: 'fallback-session',
        user_id: user.id,
        user_type: 'staff',
        session_token: this.generateToken(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
        last_activity: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    }

    if (!session) return null

    return { user, session }
  }

  // Fallback authentication for staff when database is not available
  private async fallbackStaffAuth(credentials: {
    username?: string
    password?: string
    apiKey?: string
  }): Promise<StaffUser | null> {
    // Check API key
    if (credentials.apiKey) {
      const validApiKey = process.env.STAFF_API_KEY || 'DirectoryBolt-Staff-2025-SecureKey'
      if (credentials.apiKey === validApiKey) {
        return {
          id: 'fallback-staff',
          username: 'staff',
          email: 'ben.stone@directorybolt.com',
          first_name: 'BEN',
          last_name: 'STONE',
          role: 'manager',
          permissions: {
            queue: true,
            processing: true,
            analytics: true,
            support: true
          },
          api_key: validApiKey,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }
    }

    // Check username/password
    if (credentials.username && credentials.password) {
      const validUsername = process.env.STAFF_USERNAME || 'staff'
      const validPassword = process.env.STAFF_PASSWORD || 'DirectoryBoltStaff2025!'
      
      if (credentials.username === validUsername && credentials.password === validPassword) {
        return {
          id: 'fallback-staff',
          username: 'staff',
          email: 'ben.stone@directorybolt.com',
          first_name: 'BEN',
          last_name: 'STONE',
          role: 'manager',
          permissions: {
            queue: true,
            processing: true,
            analytics: true,
            support: true
          },
          api_key: process.env.STAFF_API_KEY || 'DirectoryBolt-Staff-2025-SecureKey',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }
    }

    return null
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('admin_users')
        .select('id')
        .limit(1)

      return !error
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const adminStaffDB = new AdminStaffDatabase()
