// 🔒 JORDAN'S ROLE-BASED ACCESS CONTROL - Enterprise security framework
// Comprehensive RBAC system with Customer, Admin, and VA role permissions

import type { User } from '../database/schema'
import type { UserRole } from './jwt'
import { AuthorizationError } from '../utils/errors'
import { logger } from '../utils/logger'

// Export UserRole type locally to avoid import issues
export type { UserRole }

// Permission definitions
export type Permission = 
  // Directory Management
  | 'directories:read'
  | 'directories:write'
  | 'directories:admin'
  
  // Submission Management  
  | 'submissions:create'
  | 'submissions:read'
  | 'submissions:update'
  | 'submissions:delete'
  | 'submissions:admin'
  
  // User Management
  | 'users:read'
  | 'users:write'
  | 'users:admin'
  | 'profile:read'
  | 'profile:write'
  
  // Billing & Subscriptions
  | 'billing:read'
  | 'billing:write'
  | 'billing:admin'
  
  // Analytics & Reports
  | 'analytics:read'
  | 'analytics:admin'
  
  // API Keys
  | 'apikeys:create'
  | 'apikeys:read'
  | 'apikeys:delete'
  | 'apikeys:admin'
  
  // System Administration
  | 'system:admin'
  | 'system:monitor'
  | 'system:configure'

// Resource types for fine-grained access control
export type ResourceType = 
  | 'directory'
  | 'submission' 
  | 'user'
  | 'payment'
  | 'apikey'
  | 'system'

// Action types
export type ActionType = 'create' | 'read' | 'update' | 'delete' | 'admin'

// Context for permission checks
export interface PermissionContext {
  userId: string
  role: UserRole
  subscriptionTier: string
  resourceOwnerId?: string
  resourceId?: string
  ipAddress?: string
}

// Role permission mappings
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  customer: [
    // Directory access
    'directories:read',
    
    // Submission management for own submissions
    'submissions:create',
    'submissions:read',
    'submissions:update',
    
    // Profile management
    'profile:read',
    'profile:write',
    
    // Billing access
    'billing:read',
    'billing:write',
    
    // Basic analytics
    'analytics:read',
    
    // API key management
    'apikeys:create',
    'apikeys:read',
    'apikeys:delete'
  ],
  
  va: [
    // All customer permissions plus enhanced access
    'directories:read',
    'directories:write',
    
    // Enhanced submission management (for multiple clients)
    'submissions:create',
    'submissions:read',
    'submissions:update',
    'submissions:delete',
    
    // Profile management
    'profile:read',
    'profile:write',
    
    // Billing management for clients
    'billing:read',
    'billing:write',
    
    // Enhanced analytics
    'analytics:read',
    
    // API key management
    'apikeys:create',
    'apikeys:read',
    'apikeys:delete',
    
    // Limited user management (for assigned clients only)
    'users:read'
  ],
  
  admin: [
    // Full directory management
    'directories:read',
    'directories:write',
    'directories:admin',
    
    // Full submission management
    'submissions:create',
    'submissions:read',
    'submissions:update',
    'submissions:delete',
    'submissions:admin',
    
    // Full user management
    'users:read',
    'users:write',
    'users:admin',
    'profile:read',
    'profile:write',
    
    // Full billing management
    'billing:read',
    'billing:write',
    'billing:admin',
    
    // Full analytics access
    'analytics:read',
    'analytics:admin',
    
    // Full API key management
    'apikeys:create',
    'apikeys:read',
    'apikeys:delete',
    'apikeys:admin',
    
    // System administration
    'system:admin',
    'system:monitor',
    'system:configure'
  ]
}

// Subscription tier-based permission modifiers
export const TIER_PERMISSION_LIMITS: Record<string, {
  maxApiKeys: number
  maxSubmissionsPerDay: number
  maxDirectories: number
  canAccessAnalytics: boolean
  canManageTeam: boolean
}> = {
  free: {
    maxApiKeys: 1,
    maxSubmissionsPerDay: 10,
    maxDirectories: 5,
    canAccessAnalytics: false,
    canManageTeam: false
  },
  starter: {
    maxApiKeys: 2,
    maxSubmissionsPerDay: 50,
    maxDirectories: 25,
    canAccessAnalytics: true,
    canManageTeam: false
  },
  growth: {
    maxApiKeys: 5,
    maxSubmissionsPerDay: 200,
    maxDirectories: 100,
    canAccessAnalytics: true,
    canManageTeam: true
  },
  professional: {
    maxApiKeys: 10,
    maxSubmissionsPerDay: 500,
    maxDirectories: 500,
    canAccessAnalytics: true,
    canManageTeam: true
  },
  enterprise: {
    maxApiKeys: 50,
    maxSubmissionsPerDay: 2000,
    maxDirectories: 2000,
    canAccessAnalytics: true,
    canManageTeam: true
  }
}

// RBAC Manager Class
export class RBACManager {
  private static instance: RBACManager

  public static getInstance(): RBACManager {
    if (!RBACManager.instance) {
      RBACManager.instance = new RBACManager()
    }
    return RBACManager.instance
  }

  /**
   * Check if user has a specific permission
   */
  public hasPermission(
    context: PermissionContext, 
    permission: Permission
  ): boolean {
    const rolePermissions = ROLE_PERMISSIONS[context.role] || []
    const hasBasePermission = rolePermissions.includes(permission)
    
    if (!hasBasePermission) {
      return false
    }

    // Apply subscription tier limitations
    const tierLimits = TIER_PERMISSION_LIMITS[context.subscriptionTier]
    if (!tierLimits) {
      return false
    }

    // Special tier-based restrictions
    if (permission === 'analytics:read' && !tierLimits.canAccessAnalytics) {
      return false
    }

    if (permission === 'users:read' && !tierLimits.canManageTeam && context.role === 'customer') {
      return false
    }

    return true
  }

  /**
   * Check resource ownership for access control
   */
  public canAccessResource(
    context: PermissionContext,
    resourceType: ResourceType,
    action: ActionType,
    resourceOwnerId?: string
  ): boolean {
    const permission = this.getResourcePermission(resourceType, action)
    
    if (!this.hasPermission(context, permission)) {
      return false
    }

    // Admin has access to everything
    if (context.role === 'admin') {
      return true
    }

    // For non-admin users, check ownership
    if (resourceOwnerId && resourceOwnerId !== context.userId) {
      // VA can access resources of assigned clients
      if (context.role === 'va') {
        return this.canVAAccessResource(context.userId, resourceOwnerId, resourceType)
      }
      
      // Regular customers can only access their own resources
      return false
    }

    return true
  }

  /**
   * Enforce permission with automatic error throwing
   */
  public enforcePermission(
    context: PermissionContext,
    permission: Permission
  ): void {
    if (!this.hasPermission(context, permission)) {
      logger.warn('Permission denied', {
        metadata: {
          userId: context.userId,
          role: context.role,
          permission,
          subscriptionTier: context.subscriptionTier,
          ipAddress: context.ipAddress
        }
      })
      
      throw new AuthorizationError(
        `Permission denied: ${permission}`,
        'PERMISSION_DENIED'
      )
    }
  }

  /**
   * Enforce resource access with automatic error throwing
   */
  public enforceResourceAccess(
    context: PermissionContext,
    resourceType: ResourceType,
    action: ActionType,
    resourceOwnerId?: string
  ): void {
    if (!this.canAccessResource(context, resourceType, action, resourceOwnerId)) {
      logger.warn('Resource access denied', {
        metadata: {
          userId: context.userId,
          role: context.role,
          resourceType,
          action,
          resourceOwnerId,
          subscriptionTier: context.subscriptionTier,
          ipAddress: context.ipAddress
        }
      })
      
      throw new AuthorizationError(
        `Access denied: Cannot ${action} ${resourceType}`,
        'RESOURCE_ACCESS_DENIED'
      )
    }
  }

  /**
   * Get all permissions for a role
   */
  public getRolePermissions(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || []
  }

  /**
   * Get subscription tier limits
   */
  public getTierLimits(tier: string) {
    return TIER_PERMISSION_LIMITS[tier] || TIER_PERMISSION_LIMITS.free
  }

  /**
   * Check if user can perform action based on tier limits
   */
  public canPerformAction(
    context: PermissionContext,
    action: 'create_apikey' | 'submit_directory' | 'access_analytics'
  ): { allowed: boolean; reason?: string; limit?: number } {
    const tierLimits = this.getTierLimits(context.subscriptionTier)

    switch (action) {
      case 'create_apikey':
        // Would need to check current API key count from database
        return { allowed: true, limit: tierLimits.maxApiKeys }
        
      case 'submit_directory':
        // Would need to check submissions today from database
        return { allowed: true, limit: tierLimits.maxSubmissionsPerDay }
        
      case 'access_analytics':
        return { 
          allowed: tierLimits.canAccessAnalytics,
          reason: tierLimits.canAccessAnalytics ? undefined : 'Analytics access requires Starter tier or higher'
        }
        
      default:
        return { allowed: false, reason: 'Unknown action' }
    }
  }

  /**
   * Create permission context from user
   */
  public createContext(
    user: User, 
    role: UserRole,
    resourceOwnerId?: string,
    ipAddress?: string
  ): PermissionContext {
    return {
      userId: user.id,
      role,
      subscriptionTier: user.subscription_tier,
      resourceOwnerId,
      ipAddress
    }
  }

  /**
   * Get permission string from resource and action
   */
  private getResourcePermission(resourceType: ResourceType, action: ActionType): Permission {
    if (action === 'admin') {
      return `${resourceType}s:admin` as Permission
    }
    return `${resourceType}s:${action}` as Permission
  }

  /**
   * Check if VA can access resource of another user
   */
  private canVAAccessResource(
    vaUserId: string,
    resourceOwnerId: string,
    resourceType: ResourceType
  ): boolean {
    // TODO: Implement VA-client relationship check
    // This would check if the VA is assigned to manage this client
    // For now, return false to be restrictive
    
    logger.info('VA resource access check', {
      metadata: { vaUserId, resourceOwnerId, resourceType }
    })
    
    return false
  }
}

// Export singleton instance
export const rbacManager = RBACManager.getInstance()

// Middleware helper functions
export function getUserRole(user: User): UserRole {
  // Admin check - based on email domain
  if (user.email.endsWith('@directorybolt.com')) {
    return 'admin'
  }
  
  // VA check - based on subscription tier and company name
  if (user.subscription_tier === 'enterprise' && 
      user.company_name?.toLowerCase().includes('assistant')) {
    return 'va'
  }
  
  return 'customer'
}

export function hasPermission(
  user: User,
  permission: Permission,
  ipAddress?: string
): boolean {
  const role = getUserRole(user)
  const context = rbacManager.createContext(user, role, undefined, ipAddress)
  return rbacManager.hasPermission(context, permission)
}

export function enforcePermission(
  user: User,
  permission: Permission,
  ipAddress?: string
): void {
  const role = getUserRole(user)
  const context = rbacManager.createContext(user, role, undefined, ipAddress)
  rbacManager.enforcePermission(context, permission)
}

export function canAccessOwnResource(
  user: User,
  resourceType: ResourceType,
  action: ActionType,
  resourceOwnerId?: string,
  ipAddress?: string
): boolean {
  const role = getUserRole(user)
  const context = rbacManager.createContext(user, role, resourceOwnerId, ipAddress)
  return rbacManager.canAccessResource(context, resourceType, action, resourceOwnerId)
}

// Permission decorator for API routes
export function requirePermission(permission: Permission) {
  return function(
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function(...args: any[]) {
      const req = args[0] // Assuming first arg is request
      const user = req.user // Assuming user is attached to request
      
      if (!user) {
        throw new AuthorizationError('Authentication required', 'AUTH_REQUIRED')
      }

      enforcePermission(user, permission, req.ip)
      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}

// Rate limiting based on subscription tier
export function getTierRateLimit(tier: string): {
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
} {
  const baseLimits = {
    free: { requestsPerMinute: 10, requestsPerHour: 100, requestsPerDay: 500 },
    starter: { requestsPerMinute: 30, requestsPerHour: 300, requestsPerDay: 2000 },
    growth: { requestsPerMinute: 60, requestsPerHour: 600, requestsPerDay: 5000 },
    professional: { requestsPerMinute: 120, requestsPerHour: 1200, requestsPerDay: 10000 },
    enterprise: { requestsPerMinute: 300, requestsPerHour: 3000, requestsPerDay: 25000 }
  }

  return baseLimits[tier as keyof typeof baseLimits] || baseLimits.free
}