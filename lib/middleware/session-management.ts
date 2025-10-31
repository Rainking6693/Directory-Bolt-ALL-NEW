// 🔐 SESSION MANAGEMENT MIDDLEWARE - AUTH-002
// Comprehensive session handling for staff dashboard and user authentication
// Implements secure session storage, validation, and automatic renewal

import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize, parse } from 'cookie';
import crypto from 'crypto';

// Session Configuration
const SESSION_CONFIG = {
  // Session settings
  sessionName: 'directorybolt_session',
  staffSessionName: 'staff_session',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  staffMaxAge: 8 * 60 * 60 * 1000, // 8 hours for staff
  
  // Security settings
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'strict' as const,
  
  // Session storage (in production, use Redis or database)
  storage: new Map<string, SessionData>(),
  
  // Cleanup interval
  cleanupInterval: 60 * 60 * 1000, // 1 hour
  
  // Session renewal threshold
  renewalThreshold: 30 * 60 * 1000, // Renew if less than 30 minutes remaining
};

// Session data interface
interface SessionData {
  id: string;
  userId: string;
  userType: 'customer' | 'staff';
  email: string;
  role?: string;
  permissions?: string[];
  createdAt: number;
  lastAccessed: number;
  expiresAt: number;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

// Session manager class
class SessionManager {
  private static instance: SessionManager;
  private cleanupTimer: NodeJS.Timeout | null = null;
  
  constructor() {
    this.startCleanupTimer();
  }
  
  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }
  
  // Create a new session
  createSession(
    userId: string,
    userType: 'customer' | 'staff',
    email: string,
    ipAddress: string,
    userAgent: string,
    role?: string,
    permissions?: string[]
  ): SessionData {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    const maxAge = userType === 'staff' ? SESSION_CONFIG.staffMaxAge : SESSION_CONFIG.maxAge;
    
    const sessionData: SessionData = {
      id: sessionId,
      userId,
      userType,
      email,
      role,
      permissions,
      createdAt: now,
      lastAccessed: now,
      expiresAt: now + maxAge,
      ipAddress,
      userAgent,
      isActive: true
    };
    
    SESSION_CONFIG.storage.set(sessionId, sessionData);
    
    console.log('✅ Session created', {
      sessionId,
      userId,
      userType,
      email,
      expiresAt: new Date(sessionData.expiresAt).toISOString()
    });
    
    return sessionData;
  }
  
  // Validate and retrieve session
  validateSession(sessionId: string, ipAddress: string, userAgent: string): SessionData | null {
    const session = SESSION_CONFIG.storage.get(sessionId);
    
    if (!session) {
      return null;
    }
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      this.destroySession(sessionId);
      return null;
    }
    
    // Check if session is active
    if (!session.isActive) {
      return null;
    }
    
    // Security check: IP address validation (optional, can be disabled for mobile users)
    if (process.env.STRICT_IP_VALIDATION === 'true' && session.ipAddress !== ipAddress) {
      console.warn('⚠️ Session IP mismatch', {
        sessionId,
        originalIP: session.ipAddress,
        currentIP: ipAddress
      });
      // Optionally destroy session or just log the warning
      // this.destroySession(sessionId);
      // return null;
    }
    
    // Update last accessed time
    session.lastAccessed = Date.now();
    SESSION_CONFIG.storage.set(sessionId, session);
    
    return session;
  }
  
  // Renew session if close to expiry
  renewSession(sessionId: string): SessionData | null {
    const session = SESSION_CONFIG.storage.get(sessionId);
    
    if (!session) {
      return null;
    }
    
    const now = Date.now();
    const timeUntilExpiry = session.expiresAt - now;
    
    // Renew if within renewal threshold
    if (timeUntilExpiry < SESSION_CONFIG.renewalThreshold) {
      const maxAge = session.userType === 'staff' ? SESSION_CONFIG.staffMaxAge : SESSION_CONFIG.maxAge;
      session.expiresAt = now + maxAge;
      session.lastAccessed = now;
      
      SESSION_CONFIG.storage.set(sessionId, session);
      
      console.log('🔄 Session renewed', {
        sessionId,
        userId: session.userId,
        newExpiresAt: new Date(session.expiresAt).toISOString()
      });
    }
    
    return session;
  }
  
  // Destroy session
  destroySession(sessionId: string): boolean {
    const session = SESSION_CONFIG.storage.get(sessionId);
    const deleted = SESSION_CONFIG.storage.delete(sessionId);
    
    if (deleted && session) {
      console.log('🗑️ Session destroyed', {
        sessionId,
        userId: session.userId,
        userType: session.userType
      });
    }
    
    return deleted;
  }
  
  // Destroy all sessions for a user
  destroyUserSessions(userId: string): number {
    let destroyedCount = 0;
    
    for (const [sessionId, session] of SESSION_CONFIG.storage.entries()) {
      if (session.userId === userId) {
        SESSION_CONFIG.storage.delete(sessionId);
        destroyedCount++;
      }
    }
    
    console.log('🗑️ User sessions destroyed', {
      userId,
      destroyedCount
    });
    
    return destroyedCount;
  }
  
  // Get active sessions for a user
  getUserSessions(userId: string): SessionData[] {
    const userSessions: SessionData[] = [];
    const now = Date.now();
    
    for (const session of SESSION_CONFIG.storage.values()) {
      if (session.userId === userId && session.isActive && now < session.expiresAt) {
        userSessions.push(session);
      }
    }
    
    return userSessions;
  }
  
  // Generate secure session ID
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  // Cleanup expired sessions
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of SESSION_CONFIG.storage.entries()) {
      if (now > session.expiresAt) {
        SESSION_CONFIG.storage.delete(sessionId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log('🧹 Cleaned up expired sessions', {
        cleanedCount,
        remainingSessions: SESSION_CONFIG.storage.size
      });
    }
  }
  
  // Start automatic cleanup timer
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, SESSION_CONFIG.cleanupInterval);
  }
  
  // Stop cleanup timer
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Middleware function for session validation
export function withSessionValidation(
  userType: 'customer' | 'staff' | 'any' = 'any',
  required: boolean = true
) {
  return function middleware(
    handler: (req: NextApiRequest & { session?: SessionData }, res: NextApiResponse) => Promise<void> | void
  ) {
    return async function wrappedHandler(
      req: NextApiRequest & { session?: SessionData },
      res: NextApiResponse
    ) {
      const sessionManager = SessionManager.getInstance();
      const clientIP = getClientIP(req);
      const userAgent = req.headers['user-agent'] || '';
      
      // Get session ID from cookies
      const cookies = parse(req.headers.cookie || '');
      const sessionId = userType === 'staff' 
        ? cookies[SESSION_CONFIG.staffSessionName]
        : cookies[SESSION_CONFIG.sessionName];
      
      if (sessionId) {
        // Validate session
        const session = sessionManager.validateSession(sessionId, clientIP, userAgent);
        
        if (session) {
          // Check user type if specified
          if (userType !== 'any' && session.userType !== userType) {
            return res.status(403).json({
              error: 'Access Denied',
              message: 'Invalid user type for this resource',
              code: 'INVALID_USER_TYPE'
            });
          }
          
          // Renew session if needed
          sessionManager.renewSession(sessionId);
          
          // Attach session to request
          req.session = session;
          
          // Set renewed session cookie
          const cookieName = session.userType === 'staff' 
            ? SESSION_CONFIG.staffSessionName 
            : SESSION_CONFIG.sessionName;
          
          const cookie = serialize(cookieName, sessionId, {
            maxAge: session.userType === 'staff' ? SESSION_CONFIG.staffMaxAge : SESSION_CONFIG.maxAge,
            httpOnly: SESSION_CONFIG.httpOnly,
            secure: SESSION_CONFIG.secure,
            sameSite: SESSION_CONFIG.sameSite,
            path: '/'
          });
          
          res.setHeader('Set-Cookie', cookie);
        } else if (required) {
          // Invalid or expired session
          return res.status(401).json({
            error: 'Authentication Required',
            message: 'Your session has expired. Please log in again.',
            code: 'SESSION_EXPIRED'
          });
        }
      } else if (required) {
        // No session found
        return res.status(401).json({
          error: 'Authentication Required',
          message: 'Please log in to access this resource.',
          code: 'NO_SESSION'
        });
      }
      
      // Continue to the actual handler
      return handler(req, res);
    };
  };
}

// Helper function to create session cookie
export function createSessionCookie(
  sessionData: SessionData
): string {
  const cookieName = sessionData.userType === 'staff' 
    ? SESSION_CONFIG.staffSessionName 
    : SESSION_CONFIG.sessionName;
  
  return serialize(cookieName, sessionData.id, {
    maxAge: sessionData.userType === 'staff' ? SESSION_CONFIG.staffMaxAge : SESSION_CONFIG.maxAge,
    httpOnly: SESSION_CONFIG.httpOnly,
    secure: SESSION_CONFIG.secure,
    sameSite: SESSION_CONFIG.sameSite,
    path: '/'
  });
}

// Helper function to destroy session cookie
export function destroySessionCookie(
  userType: 'customer' | 'staff'
): string {
  const cookieName = userType === 'staff' 
    ? SESSION_CONFIG.staffSessionName 
    : SESSION_CONFIG.sessionName;
  
  return serialize(cookieName, '', {
    maxAge: 0,
    httpOnly: SESSION_CONFIG.httpOnly,
    secure: SESSION_CONFIG.secure,
    sameSite: SESSION_CONFIG.sameSite,
    path: '/'
  });
}

// Get client IP address
function getClientIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  
  if (typeof realIP === 'string') {
    return realIP;
  }
  
  if (typeof cfConnectingIP === 'string') {
    return cfConnectingIP;
  }
  
  return req.socket.remoteAddress || 'unknown';
}

// Export session manager for direct use
export { SessionManager, SESSION_CONFIG };
export type { SessionData };