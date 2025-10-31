// @ts-nocheck

import { NextApiRequest, NextApiResponse } from 'next';
import { withSessionValidation, SessionData } from './session-management';

interface AuthOptions {
  required?: boolean;
  userType?: 'customer' | 'staff' | 'any';
  permissions?: string[];
  roles?: string[];
}

interface EndpointAuthConfig {
  required: boolean;
  userType: 'customer' | 'staff' | 'any';
  permissions: string[];
  roles: string[];
}

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  userType: 'customer' | 'staff';
}

export interface AuthenticatedRequest extends NextApiRequest {
  session?: SessionData;
  user?: AuthenticatedUser;
}

const AUTH_CONFIG = {
  publicEndpoints: [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/reset-password',
    '/api/health',
    '/api/robots',
    '/api/sitemap',
    '/api/stripe/webhook',
    '/api/payments/webhook'
  ],
  staffOnlyEndpoints: [
    '/api/staff/',
    '/api/admin/',
    '/api/analytics/',
    '/api/queue/',
    '/api/monitor/'
  ],
  customerEndpoints: [
    '/api/user/',
    '/api/customer/',
    '/api/directories/',
    '/api/submissions/'
  ],
  permissionEndpoints: {
    '/api/staff/analytics': ['analytics'],
    '/api/staff/queue': ['queue', 'processing'],
    '/api/staff/users': ['support', 'admin'],
    '/api/admin/': ['admin'],
    '/api/analytics/': ['analytics', 'admin']
  } as Record<string, string[]>
};

const ROLE_PERMISSIONS = {
  admin: ['admin', 'analytics', 'queue', 'processing', 'support', 'users'],
  manager: ['analytics', 'queue', 'processing', 'support'],
  analyst: ['analytics', 'queue'],
  support: ['support', 'queue'],
  enterprise: ['premium_features', 'priority_support', 'bulk_operations'],
  professional: ['premium_features', 'priority_support'],
  growth: ['premium_features'],
  starter: ['basic_features']
} as const;

type RoleKey = keyof typeof ROLE_PERMISSIONS;

export function withAuthentication(options: AuthOptions = {}) {
  const {
    required = true,
    userType = 'any',
    permissions = [],
    roles = []
  } = options;

  return function middleware(
    handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void> | void
  ) {
    return withSessionValidation(userType, required)(async (req, res) => {
      if (!required && !req.session) {
        return handler(req, res);
      }

      if (required && !req.session) {
        return res.status(401).json({
          error: 'Authentication Required',
          message: 'Please log in to access this resource.',
          code: 'NO_AUTHENTICATION'
        });
      }

      if (req.session) {
        const userPermissions = getUserPermissions(req.session.role || '', req.session.userType);

        req.user = {
          id: req.session.userId,
          email: req.session.email,
          role: req.session.role || '',
          permissions: userPermissions,
          userType: req.session.userType
        };

        if (roles.length > 0 && !roles.includes(req.user.role)) {
          return res.status(403).json({
            error: 'Access Denied',
            message: 'Insufficient role privileges for this resource.',
            code: 'INSUFFICIENT_ROLE',
            required: roles,
            current: req.user.role
          });
        }

        if (permissions.length > 0) {
          const hasPermission = permissions.some((permission) => userPermissions.includes(permission));
          if (!hasPermission) {
            return res.status(403).json({
              error: 'Access Denied',
              message: 'Insufficient permissions for this resource.',
              code: 'INSUFFICIENT_PERMISSIONS',
              required: permissions,
              current: userPermissions
            });
          }
        }

        logAuthenticatedAccess(req);
      }

      return handler(req, res);
    });
  };
}

export function withAutoAuthentication() {
  return function middleware(
    handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void> | void
  ) {
    return async function wrappedHandler(req: AuthenticatedRequest, res: NextApiResponse) {
      const pathname = req.url || '';

      if (isPublicEndpoint(pathname)) {
        return handler(req, res);
      }

      const authRequirements = getEndpointAuthRequirements(pathname);
      const authMiddleware = withAuthentication(authRequirements);
      return authMiddleware(handler)(req, res);
    };
  };
}

function isPublicEndpoint(pathname: string): boolean {
  return AUTH_CONFIG.publicEndpoints.some((endpoint) => pathname.startsWith(endpoint));
}

function getEndpointAuthRequirements(pathname: string): EndpointAuthConfig {
  if (AUTH_CONFIG.staffOnlyEndpoints.some((endpoint) => pathname.startsWith(endpoint))) {
    const permissions = getEndpointPermissions(pathname);
    return {
      required: true,
      userType: 'staff',
      permissions,
      roles: []
    };
  }

  if (AUTH_CONFIG.customerEndpoints.some((endpoint) => pathname.startsWith(endpoint))) {
    return {
      required: true,
      userType: 'customer',
      permissions: [],
      roles: []
    };
  }

  return {
    required: true,
    userType: 'any',
    permissions: [],
    roles: []
  };
}

function getEndpointPermissions(pathname: string): string[] {
  for (const [endpoint, permissions] of Object.entries(AUTH_CONFIG.permissionEndpoints)) {
    if (pathname.startsWith(endpoint)) {
      return permissions;
    }
  }
  return [];
}

function getUserPermissions(role: string, userType: 'customer' | 'staff'): string[] {
  if (!role) {
    return userType === 'customer' ? ['basic_features'] : [];
  }

  const key = role as RoleKey;
  return ROLE_PERMISSIONS[key] ? [...ROLE_PERMISSIONS[key]] : [];
}

export function hasPermission(user: AuthenticatedUser | undefined, permission: string): boolean {
  return user?.permissions.includes(permission) ?? false;
}

export function hasRole(user: AuthenticatedUser | undefined, role: string): boolean {
  return user?.role === role;
}

export function hasAnyRole(user: AuthenticatedUser | undefined, roles: string[]): boolean {
  return user ? roles.includes(user.role) : false;
}

export function hasAnyPermission(user: AuthenticatedUser | undefined, permissions: string[]): boolean {
  return user ? permissions.some((permission) => user.permissions.includes(permission)) : false;
}

function logAuthenticatedAccess(req: AuthenticatedRequest): void {
  if (req.user && req.url?.startsWith('/api/')) {
    console.log('[auth] authenticated API access', {
      timestamp: new Date().toISOString(),
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
      userType: req.user.userType,
      endpoint: req.url,
      method: req.method,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });
  }
}

export { AUTH_CONFIG, ROLE_PERMISSIONS };
