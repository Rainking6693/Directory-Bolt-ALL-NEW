// @ts-nocheck
// 🔒 IP WHITELISTING MIDDLEWARE - INFRA-004
// Restricts admin and staff access to authorized IP addresses
// Provides secure access control for administrative functions

import type { NextApiRequest, NextApiResponse } from 'next';

// IP Whitelist Configuration
const IP_WHITELIST_CONFIG = {
  // Enable/disable IP whitelisting
  enabled: process.env.NODE_ENV === 'production',
  
  // Allowed IP addresses for admin access
  allowedIPs: [
    // Add your office/home IP addresses here
    // Example: '192.168.1.100',
    // Example: '203.0.113.0/24', // CIDR notation supported
  ],
  
  // Allowed IP ranges for staff access
  staffAllowedIPs: [
    // Add staff IP addresses here
    // Can be more permissive than admin IPs
  ],
  
  // Emergency bypass (use with caution)
  emergencyBypass: {
    enabled: false,
    token: process.env.EMERGENCY_BYPASS_TOKEN,
    validUntil: process.env.EMERGENCY_BYPASS_EXPIRES
  },
  
  // Development mode settings
  development: {
    allowLocalhost: true,
    allowPrivateNetworks: true,
    logAllRequests: true
  }
};

// IP address utilities
class IPWhitelist {
  private static instance: IPWhitelist;
  private allowedIPs: Set<string>;
  private allowedRanges: Array<{ network: string; mask: number }>;
  
  constructor() {
    this.allowedIPs = new Set();
    this.allowedRanges = [];
    this.initializeWhitelist();
  }
  
  static getInstance(): IPWhitelist {
    if (!IPWhitelist.instance) {
      IPWhitelist.instance = new IPWhitelist();
    }
    return IPWhitelist.instance;
  }
  
  private initializeWhitelist(): void {
    const allIPs = [
      ...IP_WHITELIST_CONFIG.allowedIPs,
      ...IP_WHITELIST_CONFIG.staffAllowedIPs
    ];
    
    for (const ip of allIPs) {
      if (ip.includes('/')) {
        // CIDR notation
        const [network, maskBits] = ip.split('/');
        this.allowedRanges.push({
          network,
          mask: parseInt(maskBits, 10)
        });
      } else {
        // Single IP
        this.allowedIPs.add(ip);
      }
    }
    
    // Add development IPs if in development mode
    if (process.env.NODE_ENV !== 'production' && IP_WHITELIST_CONFIG.development.allowLocalhost) {
      this.allowedIPs.add('127.0.0.1');
      this.allowedIPs.add('::1');
      this.allowedIPs.add('localhost');
    }
  }
  
  isIPAllowed(ip: string): boolean {
    // Skip check if disabled
    if (!IP_WHITELIST_CONFIG.enabled) {
      return true;
    }
    
    // Check emergency bypass
    if (this.checkEmergencyBypass()) {
      return true;
    }
    
    // Normalize IP address
    const normalizedIP = this.normalizeIP(ip);
    
    // Check direct IP match
    if (this.allowedIPs.has(normalizedIP)) {
      return true;
    }
    
    // Check IP ranges (CIDR)
    for (const range of this.allowedRanges) {
      if (this.isIPInRange(normalizedIP, range.network, range.mask)) {
        return true;
      }
    }
    
    // Check development mode allowances
    if (process.env.NODE_ENV !== 'production') {
      if (IP_WHITELIST_CONFIG.development.allowPrivateNetworks && this.isPrivateNetwork(normalizedIP)) {
        return true;
      }
    }
    
    return false;
  }
  
  private normalizeIP(ip: string): string {
    // Remove IPv6 prefix if present
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }
    return ip;
  }
  
  private isIPInRange(ip: string, network: string, maskBits: number): boolean {
    try {
      const ipNum = this.ipToNumber(ip);
      const networkNum = this.ipToNumber(network);
      const mask = (0xffffffff << (32 - maskBits)) >>> 0;
      
      return (ipNum & mask) === (networkNum & mask);
    } catch (error) {
      console.error('Error checking IP range:', error);
      return false;
    }
  }
  
  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }
  
  private isPrivateNetwork(ip: string): boolean {
    const privateRanges = [
      { network: '10.0.0.0', mask: 8 },
      { network: '172.16.0.0', mask: 12 },
      { network: '192.168.0.0', mask: 16 },
      { network: '127.0.0.0', mask: 8 }
    ];
    
    return privateRanges.some(range => 
      this.isIPInRange(ip, range.network, range.mask)
    );
  }
  
  private checkEmergencyBypass(): boolean {
    if (!IP_WHITELIST_CONFIG.emergencyBypass.enabled) {
      return false;
    }
    
    const validUntil = IP_WHITELIST_CONFIG.emergencyBypass.validUntil;
    if (validUntil && new Date() > new Date(validUntil)) {
      return false;
    }
    
    return true;
  }
}

// Middleware function for API routes
export function withIPWhitelist(
  allowedLevel: 'admin' | 'staff' = 'staff'
) {
  return function middleware(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
  ) {
    return async function wrappedHandler(
      req: NextApiRequest,
      res: NextApiResponse
    ) {
      const clientIP = getClientIP(req);
      const ipWhitelist = IPWhitelist.getInstance();
      
      // Check if IP is allowed
      if (!ipWhitelist.isIPAllowed(clientIP)) {
        // Log unauthorized access attempt
        logUnauthorizedAccess(req, clientIP, allowedLevel);
        
        // Return 403 Forbidden
        return res.status(403).json({
          error: 'Access Denied',
          message: 'Your IP address is not authorized to access this resource.',
          code: 'IP_NOT_WHITELISTED',
          timestamp: new Date().toISOString()
        });
      }
      
      // Log authorized access
      logAuthorizedAccess(req, clientIP, allowedLevel);
      
      // Continue to the actual handler
      return handler(req, res);
    };
  };
}

// Get client IP address from request
function getClientIP(req: NextApiRequest): string {
  // Check various headers for the real IP
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  
  if (typeof forwarded === 'string') {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  if (typeof realIP === 'string') {
    return realIP;
  }
  
  if (typeof cfConnectingIP === 'string') {
    return cfConnectingIP;
  }
  
  // Fallback to connection remote address
  return req.socket.remoteAddress || 'unknown';
}

// Logging functions
function logUnauthorizedAccess(
  req: NextApiRequest,
  clientIP: string,
  level: string
): void {
  console.warn('🚫 UNAUTHORIZED IP ACCESS ATTEMPT', {
    timestamp: new Date().toISOString(),
    ip: clientIP,
    path: req.url,
    method: req.method,
    userAgent: req.headers['user-agent'],
    level,
    headers: {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'cf-connecting-ip': req.headers['cf-connecting-ip']
    }
  });
}

function logAuthorizedAccess(
  req: NextApiRequest,
  clientIP: string,
  level: string
): void {
  if (IP_WHITELIST_CONFIG.development.logAllRequests || process.env.NODE_ENV === 'production') {
    console.log('✅ AUTHORIZED IP ACCESS', {
      timestamp: new Date().toISOString(),
      ip: clientIP,
      path: req.url,
      method: req.method,
      level
    });
  }
}

// Utility function to add IP to whitelist (for emergency access)
export function addEmergencyIP(ip: string, durationHours: number = 24): void {
  const ipWhitelist = IPWhitelist.getInstance();
  (ipWhitelist as any).allowedIPs.add(ip);
  
  console.log('🚨 EMERGENCY IP ADDED', {
    timestamp: new Date().toISOString(),
    ip,
    durationHours,
    expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
  });
  
  // Remove after duration
  setTimeout(() => {
    (ipWhitelist as any).allowedIPs.delete(ip);
    console.log('⏰ EMERGENCY IP EXPIRED', {
      timestamp: new Date().toISOString(),
      ip
    });
  }, durationHours * 60 * 60 * 1000);
}

// Export configuration for external use
export { IP_WHITELIST_CONFIG };

// Export the IPWhitelist class for advanced usage
export { IPWhitelist };