// PaymentStatusDisplay - Shows payment configuration status and error messages
'use client'
import React, { useEffect, useState } from 'react'
import { getStripeConfigurationMessage } from '../../lib/utils/stripe-client-config'

interface PaymentStatusDisplayProps {
  onConfigurationChange?: (isConfigured: boolean) => void
  showDebugInfo?: boolean
  className?: string
  compact?: boolean
}

export const PaymentStatusDisplay: React.FC<PaymentStatusDisplayProps> = ({
  onConfigurationChange,
  showDebugInfo = false,
  className = '',
  compact = false
}) => {
  const [configStatus, setConfigStatus] = useState<ReturnType<typeof getStripeConfigurationMessage> | null>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const status = getStripeConfigurationMessage()
    setConfigStatus(status)
    
    if (onConfigurationChange) {
      onConfigurationChange(status.isConfigured)
    }
  }, [onConfigurationChange])

  // Don't render during SSR
  if (!isClient || !configStatus) {
    return null
  }

  // Don't show anything if properly configured and not in debug mode
  if (configStatus.isConfigured && !showDebugInfo) {
    return null
  }

  const getIcon = () => {
    switch (configStatus.type) {
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return '🔧'
    }
  }

  const getColorClasses = () => {
    switch (configStatus.type) {
      case 'error': return 'bg-danger-900/20 border-danger-500/30 text-danger-100'
      case 'warning': return 'bg-warning-900/20 border-warning-500/30 text-warning-100'
      case 'info': return 'bg-info-900/20 border-info-500/30 text-info-100'
      default: return 'bg-secondary-800/50 border-secondary-600/30 text-secondary-200'
    }
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${getColorClasses()} ${className}`}>
        <span>{getIcon()}</span>
        <span className="text-sm">{configStatus.message}</span>
      </div>
    )
  }

  return (
    <div className={`p-4 rounded-lg border ${getColorClasses()} ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-xl">
          {getIcon()}
        </div>
        <div className="flex-1">
          <h4 className="font-medium mb-2">
            Payment System Status
          </h4>
          <p className="text-sm mb-3">
            {configStatus.message}
          </p>
          
          {configStatus.recommendations && configStatus.recommendations.length > 0 && (
            <div className="mb-3">
              <h5 className="font-medium text-xs uppercase tracking-wider mb-2">
                Recommendations:
              </h5>
              <ul className="text-sm space-y-1">
                {configStatus.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-xs mt-1">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {showDebugInfo && process.env.NODE_ENV === 'development' && (
            <div className="mt-3 pt-3 border-t border-current/20">
              <h5 className="font-medium text-xs uppercase tracking-wider mb-2">
                Debug Info:
              </h5>
              <div className="text-xs font-mono space-y-1">
                <div>Environment: {process.env.NODE_ENV}</div>
                <div>
                  Publishable Key: {
                    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 
                      ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.substring(0, 12) + '...'
                      : 'Not set'
                  }
                </div>
                <div>URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Simplified version for inline display
export const PaymentStatusBadge: React.FC<{
  className?: string
  onClick?: () => void
}> = ({ className = '', onClick }) => {
  const [configStatus, setConfigStatus] = useState<ReturnType<typeof getStripeConfigurationMessage> | null>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setConfigStatus(getStripeConfigurationMessage())
  }, [])

  if (!isClient || !configStatus || configStatus.isConfigured) {
    return null
  }

  const getStatusColor = () => {
    switch (configStatus.type) {
      case 'error': return 'bg-danger-500/20 text-danger-400 border-danger-500/30'
      case 'warning': return 'bg-warning-500/20 text-warning-400 border-warning-500/30'
      default: return 'bg-info-500/20 text-info-400 border-info-500/30'
    }
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-2 py-1 text-xs font-medium rounded border ${getStatusColor()} hover:bg-opacity-80 transition-colors ${className}`}
    >
      <span>🔧</span>
      <span>Payment Config</span>
    </button>
  )
}

export default PaymentStatusDisplay