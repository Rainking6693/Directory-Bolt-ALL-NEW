'use client'
import { useState, useEffect } from 'react'

interface CookieConsent {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [consent, setConsent] = useState<CookieConsent>({
    necessary: true, // Always required
    analytics: false,
    marketing: false
  })

  useEffect(() => {
    // Check if consent has been given before
    const existingConsent = localStorage.getItem('cookie-consent')
    if (!existingConsent) {
      setIsVisible(true)
    } else {
      const parsedConsent = JSON.parse(existingConsent)
      setConsent(parsedConsent)
      // Apply Google Analytics consent based on stored preferences
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('consent', 'update', {
          'analytics_storage': parsedConsent.analytics ? 'granted' : 'denied',
          'ad_storage': parsedConsent.marketing ? 'granted' : 'denied'
        })
      }
    }
  }, [])

  const acceptAll = () => {
    const fullConsent = {
      necessary: true,
      analytics: true,
      marketing: true
    }
    saveConsent(fullConsent)
  }

  const acceptSelected = () => {
    saveConsent(consent)
  }

  const rejectAll = () => {
    const minimalConsent = {
      necessary: true,
      analytics: false,
      marketing: false
    }
    saveConsent(minimalConsent)
  }

  const saveConsent = (consentData: CookieConsent) => {
    localStorage.setItem('cookie-consent', JSON.stringify(consentData))
    localStorage.setItem('cookie-consent-timestamp', new Date().toISOString())
    
    // Update Google Analytics consent
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', {
        'analytics_storage': consentData.analytics ? 'granted' : 'denied',
        'ad_storage': consentData.marketing ? 'granted' : 'denied'
      })
    }
    
    setIsVisible(false)
  }

  const handleConsentChange = (type: keyof CookieConsent, value: boolean) => {
    if (type === 'necessary') return // Necessary cookies cannot be disabled
    setConsent(prev => ({
      ...prev,
      [type]: value
    }))
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-secondary-900 border-t border-volt-500/30 shadow-2xl">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-volt-400 mb-2">Cookie Consent</h3>
            <p className="text-sm text-secondary-300 leading-relaxed">
              We use cookies to enhance your experience, analyze site traffic, and for marketing purposes. 
              You can customize your preferences or accept all cookies.{' '}
              <a href="/privacy" className="text-volt-400 hover:text-volt-300 underline">
                Learn more in our Privacy Policy
              </a>
            </p>
            
            {showDetails && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between p-3 bg-secondary-800 rounded-lg border border-volt-500/20">
                  <div>
                    <div className="font-medium text-volt-400">Necessary Cookies</div>
                    <div className="text-xs text-secondary-400">Required for basic site functionality</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={consent.necessary}
                    disabled
                    className="w-4 h-4 text-volt-500 bg-secondary-700 border-secondary-600 rounded focus:ring-volt-500 focus:ring-2"
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-secondary-800 rounded-lg border border-volt-500/20">
                  <div>
                    <div className="font-medium text-volt-400">Analytics Cookies</div>
                    <div className="text-xs text-secondary-400">Help us understand how you use our site</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={consent.analytics}
                    onChange={(e) => handleConsentChange('analytics', e.target.checked)}
                    className="w-4 h-4 text-volt-500 bg-secondary-700 border-secondary-600 rounded focus:ring-volt-500 focus:ring-2"
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-secondary-800 rounded-lg border border-volt-500/20">
                  <div>
                    <div className="font-medium text-volt-400">Marketing Cookies</div>
                    <div className="text-xs text-secondary-400">Used to deliver relevant advertisements</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={consent.marketing}
                    onChange={(e) => handleConsentChange('marketing', e.target.checked)}
                    className="w-4 h-4 text-volt-500 bg-secondary-700 border-secondary-600 rounded focus:ring-volt-500 focus:ring-2"
                  />
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-4 py-2 text-sm border border-volt-500/50 text-volt-400 rounded-lg hover:bg-volt-500/10 transition-all duration-200"
            >
              {showDetails ? 'Hide Options' : 'Customize'}
            </button>
            
            <button
              onClick={rejectAll}
              className="px-4 py-2 text-sm border border-secondary-600 text-secondary-300 rounded-lg hover:bg-secondary-700 transition-all duration-200"
            >
              Reject All
            </button>
            
            {showDetails && (
              <button
                onClick={acceptSelected}
                className="px-4 py-2 text-sm bg-volt-600 text-secondary-900 rounded-lg hover:bg-volt-500 transition-all duration-200"
              >
                Save Preferences
              </button>
            )}
            
            <button
              onClick={acceptAll}
              className="px-4 py-2 text-sm bg-volt-500 text-secondary-900 rounded-lg hover:bg-volt-400 transition-all duration-200 font-medium"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Type declaration moved to types/gtag.d.ts to avoid conflicts