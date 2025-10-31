'use client'
import { useEffect, useState } from 'react'

export function CheckoutProcessing() {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return ''
        return prev + '.'
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="text-center animate-slide-up">
      <div className="max-w-md mx-auto">
        {/* Processing Animation */}
        <div className="mb-8">
          <div className="relative">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-volt-500 to-volt-600 rounded-full flex items-center justify-center animate-pulse">
              <div className="text-3xl">🚀</div>
            </div>
            <div className="absolute inset-0 w-24 h-24 mx-auto border-4 border-volt-500/30 rounded-full animate-spin"></div>
          </div>
        </div>

        {/* Processing Message */}
        <h2 className="text-2xl md:text-3xl font-black text-white mb-4">
          Creating Your
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600"> Checkout</span>
        </h2>
        
        <p className="text-lg text-secondary-300 mb-8">
          Setting up your secure payment session{dots}
        </p>

        {/* Processing Steps */}
        <div className="bg-secondary-800/50 border border-secondary-600/50 rounded-xl p-6 text-left">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-success-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-secondary-200">Validating your selections</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-volt-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
              </div>
              <span className="text-secondary-200">Creating secure payment session</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-secondary-600 rounded-full flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 bg-secondary-400 rounded-full"></div>
              </div>
              <span className="text-secondary-400">Redirecting to secure checkout</span>
            </div>
          </div>
        </div>

        {/* Security Note */}
        <div className="mt-6 bg-success-900/20 border border-success-600/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-success-300 text-sm font-medium mb-2">
            <span>🔒</span>
            <span>Your payment is secure</span>
          </div>
          <div className="text-xs text-secondary-400">
            You'll be redirected to Stripe's secure checkout where you can complete your payment safely.
          </div>
        </div>
      </div>
    </div>
  )
}