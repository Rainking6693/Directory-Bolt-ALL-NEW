// useStripeConfig - React hook for client-side Stripe configuration validation
'use client'
import { useState, useEffect } from 'react'
import { getStripeClientConfig, getStripeConfigurationMessage, logStripeClientConfig } from '../utils/stripe-client-config'
import type { StripeClientConfig } from '../utils/stripe-client-config'

interface UseStripeConfigReturn {
  config: StripeClientConfig | null
  isConfigured: boolean
  isLoading: boolean
  configurationMessage: ReturnType<typeof getStripeConfigurationMessage> | null
  refreshConfig: () => void
  logConfig: () => void
}

export function useStripeConfig(): UseStripeConfigReturn {
  const [config, setConfig] = useState<StripeClientConfig | null>(null)
  const [configurationMessage, setConfigurationMessage] = useState<ReturnType<typeof getStripeConfigurationMessage> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshConfig = () => {
    if (typeof window === 'undefined') return
    
    try {
      const stripeConfig = getStripeClientConfig()
      const message = getStripeConfigurationMessage()
      
      setConfig(stripeConfig)
      setConfigurationMessage(message)
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load Stripe configuration:', error)
      setConfig(null)
      setConfigurationMessage({
        isConfigured: false,
        message: 'Failed to load payment configuration',
        type: 'error'
      })
      setIsLoading(false)
    }
  }

  const logConfig = () => {
    logStripeClientConfig()
  }

  useEffect(() => {
    refreshConfig()
  }, [])

  return {
    config,
    isConfigured: config?.isConfigured ?? false,
    isLoading,
    configurationMessage,
    refreshConfig,
    logConfig
  }
}

export default useStripeConfig