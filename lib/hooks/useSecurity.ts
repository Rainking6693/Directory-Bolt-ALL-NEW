import { useEffect } from 'react'
import { 
  initializeTrustedTypes, 
  initializeCSPReporting,
  generateNonce
} from '../utils/security'

/**
 * Custom hook to initialize security features
 * Call this in your main App component or layout
 */
export function useSecurity() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Initialize Trusted Types policies
      initializeTrustedTypes()
      
      // Initialize CSP violation reporting
      initializeCSPReporting()
      
      // Add security event listeners
      window.addEventListener('unhandledrejection', (event) => {
        // Log security-related promise rejections
        if (event.reason?.message?.includes('CSP') || 
            event.reason?.message?.includes('Trusted Types')) {
          console.warn('Security-related promise rejection:', event.reason)
        }
      })
      
      // Validate browser security features
      validateBrowserSecurity()
    }
  }, [])
}

/**
 * Hook to get a CSP nonce for inline scripts
 */
export function useCSPNonce(): string | null {
  if (typeof window === 'undefined') return null
  
  // Get nonce from meta tag if server-side rendered
  const nonceElement = document.querySelector('meta[property="csp-nonce"]')
  if (nonceElement) {
    return nonceElement.getAttribute('content')
  }
  
  // Generate client-side nonce
  return generateNonce()
}

/**
 * Validate browser security capabilities
 */
function validateBrowserSecurity(): void {
  const features = {
    trustedTypes: !!(window as any).trustedTypes,
    fetch: !!window.fetch,
    crypto: !!(window as any).crypto,
    csp: checkCSPSupport(),
    cors: checkCORSSupport()
  }
  
  console.log('Browser Security Features:', features)
  
  // Warn about missing critical features
  if (!features.trustedTypes) {
    console.warn('Trusted Types not supported - falling back to manual sanitization')
  }
  
  if (!features.fetch) {
    console.error('Fetch API not supported - this may cause payment issues')
  }
  
  if (!features.crypto) {
    console.warn('Crypto API not fully supported - using fallback for nonce generation')
  }
}

/**
 * Check if CSP is supported and active
 */
function checkCSPSupport(): boolean {
  try {
    // Try to access CSP API if available
    return 'SecurityPolicyViolationEvent' in window
  } catch {
    return false
  }
}

/**
 * Check CORS support
 */
function checkCORSSupport(): boolean {
  return 'XMLHttpRequest' in window && 'withCredentials' in new XMLHttpRequest()
}

/**
 * Hook for secure third-party script loading
 */
export function useSecureScriptLoader() {
  const loadScript = (src: string, options: { 
    nonce?: string
    integrity?: string
    crossOrigin?: string
    async?: boolean
    defer?: boolean
  } = {}) => {
    return new Promise<void>((resolve, reject) => {
      // Validate URL against CSP policy
      const allowedDomains = [
        'js.stripe.com',
        'www.googletagmanager.com',
        'www.google-analytics.com'
      ]
      
      try {
        const url = new URL(src)
        const isAllowed = allowedDomains.some(domain => url.hostname === domain)
        
        if (!isAllowed) {
          throw new Error(`Script URL not allowed by CSP: ${src}`)
        }
      } catch (error) {
        reject(error)
        return
      }
      
      // Create script element
      const script = document.createElement('script')
      script.src = src
      
      // Apply security attributes
      if (options.nonce) script.nonce = options.nonce
      if (options.integrity) script.integrity = options.integrity
      if (options.crossOrigin) script.crossOrigin = options.crossOrigin
      
      script.async = options.async ?? true
      script.defer = options.defer ?? false
      
      // Handle load/error events
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
      
      // Add to document
      document.head.appendChild(script)
    })
  }
  
  return { loadScript }
}

/**
 * Hook for secure image loading with CSP compliance
 */
export function useSecureImageLoader() {
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      
      // Set security attributes
      img.crossOrigin = 'anonymous'
      img.referrerPolicy = 'strict-origin-when-cross-origin'
      
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
      
      img.src = src
    })
  }
  
  return { loadImage }
}