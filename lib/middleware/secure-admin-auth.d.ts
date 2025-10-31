export interface AdminAuthUser {
  type: 'admin'
  permissions: string[] | Record<string, boolean>
  sessionId?: string
  lastActivity?: string
}

export interface AdminAuthSessionInfo {
  sessionId: string
  clientIp?: string
  userAgent?: string
  createdAt?: number
  lastActivity?: number
  expiresAt?: number
}

export interface AdminAuthResult {
  authenticated: boolean
  user?: AdminAuthUser
  sessionInfo?: AdminAuthSessionInfo
  error?: string
  retryAfter?: number
}

export declare function authenticateAdmin(req: any): Promise<AdminAuthResult>
export declare function requireAdminAuth(options?: any): any
export declare const secureAdminAuth: any
