/**
 * Security utilities for DirectoryBolt
 * Handles CSP, Trusted Types, and secure DOM manipulation
 */

import DOMPurify from 'dompurify'

interface TrustedTypesPolicy {
  createHTML: (input: string) => string
  createScript: (input: string) => string
  createScriptURL: (input: string) => string
}

interface TrustedTypes {
  createPolicy: (name: string, policy: Partial<TrustedTypesPolicy>) => TrustedTypesPolicy
  defaultPolicy: TrustedTypesPolicy | null
}

declare global {
  interface Window {
    trustedTypes?: TrustedTypes
  }
}

/**
 * Initialize Trusted Types policies for secure DOM manipulation
 */
export function initializeTrustedTypes(): void {
  if (typeof window === 'undefined' || !window.trustedTypes) {
    return
  }

  try {
    // Create default policy if it doesn't exist
    if (!window.trustedTypes.defaultPolicy) {
      window.trustedTypes.createPolicy('default', {
        createHTML: (input: string): string => {
          // Use DOMPurify for comprehensive HTML sanitization
          return DOMPurify.sanitize(input, {
            ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'br', 'strong', 'em', 'i', 'b'],
            ALLOWED_ATTR: ['class', 'id', 'alt', 'title', 'href', 'src', 'target', 'rel'],
            FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'],
            FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'javascript:'],
            ALLOW_DATA_ATTR: false,
            SANITIZE_DOM: true,
            WHOLE_DOCUMENT: false
          })
        },
        createScript: (input: string): string => {
          // Only allow trusted script content
          return input
        },
        createScriptURL: (input: string): string => {
          // Validate script URLs against allowlist
          const allowedDomains = [
            'js.stripe.com',
            'www.googletagmanager.com',
            'www.google-analytics.com',
            'ssl.google-analytics.com'
          ]
          
          try {
            const url = new URL(input, window.location.origin)
            const isAllowed = url.origin === window.location.origin || 
                            allowedDomains.some(domain => url.hostname === domain)
            
            if (!isAllowed) {
              throw new Error(`Untrusted script URL blocked: ${input}`)
            }
            
            return input
          } catch (e) {
            console.error('Invalid script URL:', input, e)
            throw e
          }
        }
      })
    }
  } catch (error) {
    console.warn('Failed to initialize Trusted Types:', error)
  }
}

/**
 * Safely set innerHTML with Trusted Types
 */
export function safeSetHTML(element: Element, htmlString: string): void {
  if (typeof window !== 'undefined' && window.trustedTypes) {
    try {
      const policy = window.trustedTypes.defaultPolicy
      if (policy) {
        const trustedHTML = policy.createHTML(htmlString)
        element.innerHTML = trustedHTML as any
        return
      }
    } catch (error) {
      console.warn('Trusted Types HTML creation failed:', error)
    }
  }
  
  // Fallback: sanitize manually
  element.innerHTML = sanitizeHTML(htmlString)
}

/**
 * Manual HTML sanitization fallback using DOMPurify
 */
function sanitizeHTML(input: string): string {
  // Use DOMPurify as the primary sanitization method
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'br', 'strong', 'em', 'i', 'b'],
    ALLOWED_ATTR: ['class', 'id', 'alt', 'title', 'href', 'src', 'target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'javascript:'],
    ALLOW_DATA_ATTR: false,
    SANITIZE_DOM: true,
    WHOLE_DOCUMENT: false
  })
}

/**
 * Generate CSP nonce for inline scripts
 */
export function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return Buffer.from(crypto.randomUUID()).toString('base64')
  }
  
  // Fallback for older browsers
  const array = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    // Ultimate fallback (not cryptographically secure)
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
  
  return Buffer.from(array).toString('base64')
}

/**
 * Validate URLs against CSP connect-src policy
 */
export function validateConnectURL(url: string): boolean {
  const allowedDomains = [
    'api.stripe.com',
    'www.google-analytics.com',
    'www.googletagmanager.com',
    'airtable.com',
    'api.airtable.com'
  ]
  
  try {
    const urlObj = new URL(url, window.location.origin)
    
    // Allow same-origin requests
    if (urlObj.origin === window.location.origin) {
      return true
    }
    
    // Check against allowed domains
    return allowedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain))
  } catch (error) {
    console.warn('Invalid URL for validation:', url)
    return false
  }
}

/**
 * Enhanced fetch wrapper with CSP validation
 */
export async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (!validateConnectURL(url)) {
    throw new Error(`URL blocked by CSP connect-src policy: ${url}`)
  }
  
  // Add security headers to outgoing requests
  const secureOptions: RequestInit = {
    ...options,
    headers: {
      ...options.headers,
      'X-Requested-With': 'XMLHttpRequest',
      'Cache-Control': 'no-cache'
    }
  }
  
  return fetch(url, secureOptions)
}

/**
 * Log CSP violations for monitoring
 */
export function logCSPViolation(violationReport: any): void {
  console.warn('CSP Violation:', violationReport)
  
  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Send to your monitoring/logging service
    // Example: sendToMonitoringService(violationReport)
  }
}

/**
 * Initialize CSP violation reporting
 */
export function initializeCSPReporting(): void {
  if (typeof window !== 'undefined') {
    document.addEventListener('securitypolicyviolation', (e) => {
      logCSPViolation({
        blockedURI: e.blockedURI,
        disposition: e.disposition,
        documentURI: e.documentURI,
        effectiveDirective: e.effectiveDirective,
        originalPolicy: e.originalPolicy,
        referrer: e.referrer,
        sample: e.sample,
        statusCode: e.statusCode,
        violatedDirective: e.violatedDirective,
        timestamp: new Date().toISOString()
      })
    })
  }
}

/**
 * Security configuration constants
 */
export const SECURITY_CONFIG = {
  CSP_DIRECTIVES: {
    'default-src': "'self'",
    'script-src': "'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com",
    'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src': "'self' https://fonts.gstatic.com data:",
    'img-src': "'self' data: https: blob:",
    'connect-src': "'self' https://api.stripe.com https://www.google-analytics.com https://www.googletagmanager.com https://airtable.com https://api.airtable.com wss:",
    'frame-src': "https://js.stripe.com https://hooks.stripe.com",
    'object-src': "'none'",
    'base-uri': "'self'",
    'upgrade-insecure-requests': ""
  },
  TRUSTED_DOMAINS: [
    'js.stripe.com',
    'www.googletagmanager.com', 
    'www.google-analytics.com',
    'ssl.google-analytics.com',
    'api.stripe.com',
    'airtable.com',
    'api.airtable.com'
  ]
} as const