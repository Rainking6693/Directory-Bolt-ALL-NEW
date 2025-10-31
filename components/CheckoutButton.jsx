'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useCheckout } from '../lib/hooks/useApiCall'
import { useSecurity, useCSPNonce } from '../lib/hooks/useSecurity'
import { secureFetch } from '../lib/utils/security'
import { ErrorDisplay } from './ui/ErrorDisplay'
import { StripeErrorDisplay } from './ui/StripeErrorDisplay'
import { SuccessState } from './ui/SuccessState'
import { PaymentStatusDisplay } from './ui/PaymentStatusDisplay'
import { apiDebugger } from '../lib/utils/api-debugger'
import { getStripeClientConfig, isStripeConfigured, getStripeConfigurationMessage } from '../lib/utils/stripe-client-config'

// Add-ons system removed for simplified user experience
// All features now included in base plans

// Add-ons system completely removed for simplified user experience

const CheckoutButton = ({
  plan = 'starter',
  children = 'Start Free Trial',
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  successUrl = '',
  cancelUrl = '',
  onSuccess = (data) => {},
  onError = (error) => {},
  showDebugInfo = false,
  customerEmail = '',
  metadata = {},
  ...props
}) => {
  const router = useRouter()
  const { createCheckoutSession, loading: isLoading, error, reset } = useCheckout()
  const [showError, setShowError] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [requestPayload, setRequestPayload] = useState(null)
  const [responseData, setResponseData] = useState(null)
  const [validationErrors, setValidationErrors] = useState([])
  const [stripeConfigured, setStripeConfigured] = useState(null)
  const [configurationStatus, setConfigurationStatus] = useState(null)
  
  // Initialize security features
  useSecurity()
  const cspNonce = useCSPNonce()
  
  // Check for debug mode and Stripe configuration on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const debugParam = urlParams.get('debug')
      const debugStorage = localStorage.getItem('directorybolt_debug')
      setDebugMode(debugParam === 'true' || debugStorage === 'true' || apiDebugger.isDebugMode())
      
      // Check Stripe configuration
      const configured = isStripeConfigured()
      const status = getStripeConfigurationMessage()
      setStripeConfigured(configured)
      setConfigurationStatus(status)
      
      if (debugMode) {
        console.log('🔒 Stripe Configuration Check:', {
          configured,
          status,
          config: getStripeClientConfig()
        })
      }
    }
  }, [debugMode])

  const handleCheckout = async () => {
    if (disabled || isLoading) return

    // Reset any previous errors and debug data
    reset()
    setShowError(false)
    setShowSuccess(false)
    setValidationErrors([])
    setRequestPayload(null)
    setResponseData(null)
    
    // Client-side validation
    const validation = validateCheckoutRequest(plan, stripeConfigured, configurationStatus)
    if (validation.errors.length > 0) {
      setValidationErrors(validation.errors)
      setShowError(true)
      return
    }

    // Proceed with checkout
    await proceedWithCheckout()
  }

  const proceedWithCheckout = async () => {
    
    if (debugMode) {
      console.group('🔍 DirectoryBolt Checkout Debug')
      console.log('Plan:', plan)
      console.log('Environment Check:', apiDebugger.validateEnvironment())
      console.log('Debug Mode:', debugMode)
      console.groupEnd()
    }

    // Handle free plan - redirect to analysis
    if (plan === 'free') {
      router.push('/analyze')
      return
    }

    // No special handling needed for subscription plan - proceed with normal checkout

    try {
      const checkoutPayload = {
        plan: plan,
        customerEmail: customerEmail || `user@example.com`, // In real app, get from auth
        success_url: successUrl || `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
        cancel_url: cancelUrl || `${window.location.origin}/pricing?cancelled=true&plan=${plan}`,
        metadata: metadata
      }
      
      // Store payload for debugging
      setRequestPayload(checkoutPayload)
      
      if (debugMode) {
        console.log('🚀 Starting checkout session creation...', {
          plan,
          payload: checkoutPayload,
          timestamp: new Date().toISOString()
        })
      }
      
      // Use the new Stripe API endpoint for Phase 2 pricing
      const response = await secureFetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cspNonce && { 'X-CSP-Nonce': cspNonce })
        },
        body: JSON.stringify(checkoutPayload)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Store response for debugging
      setResponseData(data)
      
      if (debugMode) {
        console.log('✅ Checkout session created successfully:', {
          sessionId: data.sessionId,
          hasUrl: !!data.checkoutUrl,
          success: data.success,
          requestId: data.requestId
        })
      }
      
      if (data.success && data.checkoutUrl) {
        // Show success state briefly before redirect
        setShowSuccess(true)
        
        // Call success callback if provided
        if (onSuccess) {
          onSuccess(data)
        }
        
        // Small delay to show success state, then redirect
        setTimeout(() => {
          window.location.href = data.checkoutUrl
        }, 1500)
      } else {
        throw new Error(data.error || data.message || 'Invalid checkout session response - missing checkout URL')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      
      // Enhanced error handling for checkout failures
      let enhancedError = {
        message: err.message || 'Unknown error occurred',
        type: 'checkout_error',
        originalError: err,
        requestPayload: requestPayload,
        timestamp: new Date().toISOString()
      }
      
      // Store error response data for debugging
      if (err.responseData) {
        setResponseData(err.responseData)
        enhancedError.responseData = err.responseData
      }
      
      if (debugMode) {
        console.group('❌ Checkout Error Debug')
        console.error('Error:', err)
        console.log('Enhanced Error:', enhancedError)
        console.log('Request Payload:', requestPayload)
        console.log('Response Data:', err.responseData)
        console.groupEnd()
      }
      
      // Set the enhanced error for display
      reset()
      setShowError(true)
      
      // Call error callback if provided
      if (onError) {
        onError(enhancedError)
      }
    }
  }

  const handleRetryCheckout = () => {
    setShowError(false)
    handleCheckout()
  }

  const handleDismissError = () => {
    setShowError(false)
    reset()
  }

  // Define button styles based on variant and size - Enhanced for mobile
  const getButtonStyles = () => {
    const baseStyles = 'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-volt-500 focus:ring-offset-2 focus:ring-offset-secondary-900 active:scale-95 touch-manipulation'
    
    const variants = {
      primary: 'bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 hover:from-volt-400 hover:to-volt-500 shadow-2xl hover:shadow-volt-500/50 animate-glow active:from-volt-600 active:to-volt-700',
      secondary: 'border-2 border-volt-500 text-volt-500 bg-transparent hover:bg-volt-500 hover:text-secondary-900 active:bg-volt-600 active:border-volt-600',
      outline: 'border border-secondary-600 text-white bg-secondary-800 hover:bg-secondary-700 hover:border-secondary-500 active:bg-secondary-600',
      ghost: 'text-volt-400 hover:text-volt-300 hover:bg-volt-500/10 active:bg-volt-500/20',
      danger: 'bg-gradient-to-r from-danger-500 to-danger-600 text-white hover:from-danger-400 hover:to-danger-500 active:from-danger-600 active:to-danger-700'
    }
    
    const sizes = {
      sm: 'px-3 py-2 text-sm min-h-[36px] sm:px-4',
      md: 'px-4 py-3 text-base min-h-[44px] sm:px-6',
      lg: 'px-6 py-4 text-base min-h-[52px] sm:px-8 sm:text-lg',
      xl: 'px-8 py-5 text-lg min-h-[60px] sm:px-10 sm:text-xl'
    }
    
    const disabledStyles = disabled || isLoading 
      ? 'opacity-75 cursor-not-allowed transform-none hover:scale-100 active:scale-100' 
      : ''
    
    // Add mobile-specific styles
    const mobileStyles = 'sm:min-w-0' // Allow full width on mobile, auto width on desktop
    
    return `${baseStyles} ${variants[variant]} ${sizes[size]} ${disabledStyles} ${mobileStyles} ${className}`
  }

  // Show success state
  if (showSuccess) {
    return (
      <div className="bg-gradient-to-r from-success-900/30 to-success-800/20 border border-success-500/40 p-4 sm:p-6 rounded-xl shadow-lg animate-zoom-in">
        <div className="text-center">
          <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 animate-bounce">🚀</div>
          <h3 className="text-success-400 font-bold text-base sm:text-lg mb-1 sm:mb-2">
            Payment Setup Complete!
          </h3>
          <p className="text-success-300 text-xs sm:text-sm mb-3 sm:mb-4">
            Redirecting to secure Stripe checkout...
          </p>
          <div className="flex items-center justify-center gap-2">
            <div className="relative">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-success-400 border-t-transparent"></div>
              <div className="absolute inset-0 animate-ping rounded-full h-4 w-4 border border-success-400 opacity-20"></div>
            </div>
            <span className="text-success-400 text-xs sm:text-sm font-medium">Preparing secure payment...</span>
          </div>
          <div className="mt-3 pt-3 border-t border-success-500/30">
            <p className="text-xs text-success-400/80 flex items-center justify-center gap-2">
              <span>🔒</span>
              <span>256-bit SSL encryption • Your data is secure</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={handleCheckout}
        disabled={disabled || isLoading}
        className={getButtonStyles()}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 sm:gap-3 min-h-[24px]">
            <div className="relative">
              <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-current border-t-transparent"></div>
              <div className="absolute inset-0 animate-ping rounded-full h-4 w-4 sm:h-5 sm:w-5 border border-current opacity-30"></div>
            </div>
            <span className="font-medium text-sm sm:text-base">
              {plan === 'free' ? 'Redirecting...' : 
               plan === 'subscription' ? 'Setting up subscription...' :
               `Setting up ${plan} plan...`}
            </span>
          </div>
        ) : (
          <>
            {children}
            {plan !== 'free' && (
              <span className="ml-2">🚀</span>
            )}
          </>
        )}
      </button>

      {/* Validation Errors - Enhanced for mobile and clarity */}
      {validationErrors.length > 0 && (
        <div className="mt-4">
          <div className="bg-gradient-to-r from-warning-900/30 to-warning-800/20 border border-warning-500/40 p-4 rounded-xl shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">⚠️</span>
              <h4 className="text-warning-400 font-bold text-base">
                Please fix these issues to continue:
              </h4>
            </div>
            <ul className="text-warning-300 text-sm space-y-2 ml-8">
              {validationErrors.map((error, index) => (
                <li key={index} className="flex items-start gap-3 p-2 bg-warning-900/20 rounded-lg">
                  <span className="text-warning-400 font-bold min-w-[6px]">•</span>
                  <span className="leading-relaxed">{error}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t border-warning-500/30">
              <p className="text-xs text-warning-400 opacity-80">
                💡 If you continue to see these errors, try refreshing the page or contact support
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {showError && error && (
        <div className="mt-4">
          {/* Use StripeErrorDisplay for payment errors, fallback to regular ErrorDisplay */}
          {error.type === 'payment' || error.requestId ? (
            <StripeErrorDisplay
              error={error}
              onRetry={handleRetryCheckout}
              onDismiss={handleDismissError}
              compact={true}
              showDebugInfo={debugMode || showDebugInfo}
              requestPayload={requestPayload}
              responseData={responseData}
            />
          ) : (
            <ErrorDisplay
              error={error}
              onRetry={handleRetryCheckout}
              onDismiss={handleDismissError}
              compact={true}
            />
          )}
        </div>
      )}
      
      {/* Payment Configuration Status */}
      {configurationStatus && !configurationStatus.isConfigured && (
        <div className="mt-4">
          <PaymentStatusDisplay
            showDebugInfo={debugMode || showDebugInfo}
            compact={false}
          />
        </div>
      )}
      
      {/* Debug Panel */}
      {debugMode && (
        <div className="mt-4">
          <DebugPanel 
            plan={plan}
            requestPayload={requestPayload}
            responseData={responseData}
            error={error}
            apiLogs={apiDebugger.getDebugLogs({ url: 'create-checkout-session' }).slice(0, 3)}
          />
        </div>
      )}

      {/* Add-ons system removed for simplified user experience */}
    </>
  )
}

// Preset button components for common use cases
export const StartTrialButton = ({ plan = 'growth', ...props }) => (
  <CheckoutButton
    plan={plan}
    variant="primary"
    size="lg"
    {...props}
  >
    Start Free Trial
  </CheckoutButton>
)

export const UpgradeButton = ({ plan = 'professional', size = 'md', ...props }) => (
  <CheckoutButton
    plan={plan}
    variant="primary"
    size={size}
    {...props}
  >
    Upgrade Now
  </CheckoutButton>
)

export const GetStartedButton = ({ plan = 'free', ...props }) => (
  <CheckoutButton
    plan={plan}
    variant="secondary"
    size="lg"
    {...props}
  >
    Get Started Free
  </CheckoutButton>
)

export const SubscriptionButton = ({ ...props }) => (
  <CheckoutButton
    plan="subscription"
    variant="secondary"
    size="md"
    {...props}
  >
    Subscribe Monthly
  </CheckoutButton>
)

// Upgrade prompt button with built-in messaging
export const UpgradePromptButton = ({ 
  currentPlan = 'free',
  requiredPlan = 'starter',
  feature = 'this feature',
  ...props 
}) => {
  const getUpgradeMessage = () => {
    if (currentPlan === 'free') {
      return `Upgrade to ${requiredPlan} to unlock ${feature}`
    }
    return `Upgrade to ${requiredPlan} for ${feature}`
  }

  return (
    <div className="text-center py-4">
      <p className="text-secondary-400 text-sm mb-4">
        {getUpgradeMessage()}
      </p>
      <CheckoutButton
        plan={requiredPlan}
        variant="primary"
        size="sm"
        {...props}
      >
        Upgrade to {requiredPlan}
      </CheckoutButton>
    </div>
  )
}

// Client-side validation function
function validateCheckoutRequest(plan, stripeConfigured, configurationStatus) {
  const errors = []
  
  // Plan validation with user-friendly messages
  const validPlans = ['free', 'starter', 'growth', 'professional', 'enterprise', 'pro', 'subscription']
  if (!plan) {
    errors.push('Please select a pricing plan to continue')
  } else if (!validPlans.includes(plan)) {
    errors.push(`The selected plan "${plan}" is not available. Please choose from: Starter ($149 ONE-TIME), Growth ($299 ONE-TIME), Professional ($499 ONE-TIME), or Enterprise ($799 ONE-TIME)`)
  }
  
  // Skip Stripe validation for free plan
  if (plan === 'free') {
    return { errors }
  }
  
  // Enhanced Stripe configuration validation with user-friendly messages
  if (stripeConfigured === false && configurationStatus) {
    if (configurationStatus.type === 'error') {
      errors.push('Payment system temporarily unavailable. Please try again in a few minutes or contact support.')
    } else if (configurationStatus.type === 'warning' && process.env.NODE_ENV === 'production') {
      errors.push('Payment processing is currently under maintenance. Please try again shortly.')
    }
  }
  
  // Environment validations with clearer messages
  if (typeof window !== 'undefined') {
    // Check if running on localhost without HTTPS (for production builds)
    if (window.location.protocol !== 'https:' && 
        !window.location.hostname.includes('localhost') && 
        !window.location.hostname.includes('127.0.0.1')) {
      errors.push('Secure checkout requires HTTPS. Please ensure you\'re accessing the site securely.')
    }
    
    // Check for required browser features
    if (!window.fetch) {
      errors.push('Your browser doesn\'t support secure payments. Please update your browser and try again.')
    }
  }
  
  return { errors }
}

// Debug Panel Component
function DebugPanel({ plan, requestPayload, responseData, error, apiLogs }) {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <div className="bg-secondary-800/50 border border-secondary-600/30 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 text-left flex items-center justify-between text-secondary-300 hover:text-secondary-200"
      >
        <span className="font-medium flex items-center gap-2">
          🔍 Debug Information
          <span className="text-xs bg-volt-500/20 text-volt-400 px-2 py-1 rounded">DEV</span>
        </span>
        <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>
      
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Environment Info */}
          <div>
            <h5 className="text-xs font-medium text-secondary-400 mb-1">Environment:</h5>
            <div className="text-xs bg-secondary-900/50 p-2 rounded">
              <div className="grid grid-cols-2 gap-2 text-secondary-300">
                <div>URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}</div>
                <div>Protocol: {typeof window !== 'undefined' ? window.location.protocol : 'N/A'}</div>
                <div>Debug Mode: {apiDebugger.isDebugMode() ? 'Enabled' : 'Disabled'}</div>
                <div>Plan: {plan}</div>
              </div>
            </div>
          </div>
          
          {/* Request Payload */}
          {requestPayload && (
            <div>
              <h5 className="text-xs font-medium text-secondary-400 mb-1">Request Payload:</h5>
              <pre className="text-xs bg-secondary-900/50 p-2 rounded font-mono text-secondary-300 overflow-auto max-h-32">
                {JSON.stringify(requestPayload, null, 2)}
              </pre>
            </div>
          )}
          
          {/* Response Data */}
          {responseData && (
            <div>
              <h5 className="text-xs font-medium text-secondary-400 mb-1">Response Data:</h5>
              <pre className="text-xs bg-secondary-900/50 p-2 rounded font-mono text-secondary-300 overflow-auto max-h-32">
                {JSON.stringify(responseData, null, 2)}
              </pre>
            </div>
          )}
          
          {/* Error Details */}
          {error && (
            <div>
              <h5 className="text-xs font-medium text-danger-400 mb-1">Error Details:</h5>
              <pre className="text-xs bg-secondary-900/50 p-2 rounded font-mono text-danger-300 overflow-auto max-h-32">
                {JSON.stringify({
                  message: error.message,
                  type: error.type,
                  stripeCode: error.stripeCode,
                  requestId: error.requestId,
                  statusCode: error.statusCode
                }, null, 2)}
              </pre>
            </div>
          )}
          
          {/* API Logs */}
          {apiLogs && apiLogs.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-secondary-400 mb-1">Recent API Calls:</h5>
              <div className="space-y-1">
                {apiLogs.map((log, index) => (
                  <div key={index} className="text-xs bg-secondary-900/50 p-2 rounded">
                    <div className="flex justify-between items-center text-secondary-300">
                      <span>{log.method} {log.url}</span>
                      <span className={log.error ? 'text-danger-400' : 'text-success-400'}>
                        {log.responseStatus || (log.error ? 'ERROR' : 'PENDING')}
                      </span>
                    </div>
                    {log.timing.duration && (
                      <div className="text-secondary-400 mt-1">
                        {log.timing.duration.toFixed(2)}ms
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const logs = apiDebugger.exportLogs()
                const blob = new Blob([logs], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `directorybolt-debug-${new Date().toISOString().slice(0, 19)}.json`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }}
              className="text-xs px-2 py-1 bg-volt-500/20 text-volt-400 rounded hover:bg-volt-500/30 transition-colors"
            >
              Export Logs
            </button>
            <button
              onClick={() => apiDebugger.clearLogs()}
              className="text-xs px-2 py-1 bg-danger-500/20 text-danger-400 rounded hover:bg-danger-500/30 transition-colors"
            >
              Clear Logs
            </button>
            <button
              onClick={() => {
                console.log('API Debug Summary:', apiDebugger.getSummary())
                console.log('Environment Validation:', apiDebugger.validateEnvironment())
              }}
              className="text-xs px-2 py-1 bg-info-500/20 text-info-400 rounded hover:bg-info-500/30 transition-colors"
            >
              Log Summary
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export { CheckoutButton as default }
export { CheckoutButton }