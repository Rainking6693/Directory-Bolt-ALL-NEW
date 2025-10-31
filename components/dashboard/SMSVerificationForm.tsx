'use client'
import { useState, useEffect } from 'react'
import { LoadingState } from '../ui/LoadingState'
import { PendingAction, VerificationFormData } from '../../types/dashboard'

interface SMSVerificationFormProps {
  action: PendingAction
  onSubmit: (formData: VerificationFormData) => Promise<void>
  onCancel: () => void
  isLoading: boolean
}

export function SMSVerificationForm({
  action,
  onSubmit,
  onCancel,
  isLoading
}: SMSVerificationFormProps) {
  const [smsCode, setSmsCode] = useState('')
  const [phoneNumber, setPhoneNumber] = useState(action.metadata?.phoneNumber || '')
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'phone' | 'code'>('phone')

  // Countdown timer for resend SMS
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }

    return () => {}
  }, [countdown])

  const validatePhoneNumber = (phone: string) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/
    return phoneRegex.test(phone.replace(/\s/g, ''))
  }

  const validateSMSCode = (code: string) => {
    return /^\d{4,8}$/.test(code)
  }

  const handleSendSMS = async () => {
    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid phone number')
      return
    }

    setError(null)
    
    try {
      // Simulate SMS sending API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setIsCodeSent(true)
      setStep('code')
      setCountdown(60) // 60 second countdown
    } catch (err) {
      setError('Failed to send SMS. Please try again.')
    }
  }

  const handleResendSMS = async () => {
    if (countdown > 0) return

    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setCountdown(60)
    } catch (err) {
      setError('Failed to resend SMS. Please try again.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateSMSCode(smsCode)) {
      setError('Please enter a valid verification code (4-8 digits)')
      return
    }

    setError(null)

    try {
      await onSubmit({
        actionId: action.id,
        type: 'sms',
        data: {
          phoneNumber,
          smsCode,
          verified: true
        }
      })
    } catch (err) {
      setError('Invalid verification code. Please try again.')
    }
  }

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')
    
    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length >= 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
    } else if (digits.length >= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    } else if (digits.length >= 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    }
    return digits
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhoneNumber(formatted)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📱</span>
          <div>
            <h3 className="text-xl font-bold text-white">SMS Verification</h3>
            <p className="text-secondary-400 text-sm">{action.directory}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="text-secondary-400 hover:text-secondary-300 text-xl"
          disabled={isLoading}
        >
          ✕
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-secondary-700/50 rounded-lg p-4 mb-6 border border-secondary-600">
        <p className="text-secondary-300 text-sm leading-relaxed">
          {action.instructions}
        </p>
      </div>

      {step === 'phone' && (
        <div className="space-y-6">
          {/* Phone Number Input */}
          <div>
            <label className="block text-white font-medium mb-2">
              Business Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              className="input-field w-full"
              disabled={isLoading}
              maxLength={14}
            />
            <p className="text-secondary-400 text-xs mt-1">
              We'll send a verification code to this number
            </p>
          </div>

          {/* Send SMS Button */}
          <div className="flex gap-3">
            <button
              onClick={handleSendSMS}
              disabled={!phoneNumber || isLoading}
              className="btn-primary flex-1"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                  Sending SMS...
                </div>
              ) : (
                'Send Verification Code'
              )}
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'code' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Success Message */}
          <div className="bg-success-500/20 border border-success-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-success-400">
              <span className="text-lg">✅</span>
              <p className="text-sm">
                Verification code sent to {phoneNumber}
              </p>
            </div>
          </div>

          {/* SMS Code Input */}
          <div>
            <label className="block text-white font-medium mb-2">
              Verification Code
            </label>
            <input
              type="text"
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Enter 4-8 digit code"
              className="input-field w-full text-center text-2xl tracking-widest"
              disabled={isLoading}
              maxLength={8}
              autoFocus
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-secondary-400 text-xs">
                Check your text messages for the verification code
              </p>
              
              {countdown > 0 ? (
                <p className="text-secondary-400 text-xs">
                  Resend in {countdown}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendSMS}
                  className="text-volt-400 hover:text-volt-300 text-xs underline"
                  disabled={isLoading}
                >
                  Resend Code
                </button>
              )}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!smsCode || isLoading}
              className="btn-primary flex-1"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                  Verifying...
                </div>
              ) : (
                'Verify Code'
              )}
            </button>
            <button
              type="button"
              onClick={() => setStep('phone')}
              disabled={isLoading}
              className="btn-secondary"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 bg-danger-500/20 border border-danger-500/30 rounded-lg p-3">
          <div className="flex items-start gap-2 text-danger-400">
            <span className="text-lg">❌</span>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 pt-4 border-t border-secondary-700">
        <h4 className="text-white font-medium mb-2">Need Help?</h4>
        <div className="space-y-2 text-xs text-secondary-400">
          <p>• Make sure your phone can receive text messages</p>
          <p>• Check your spam/junk folder if you don't see the code</p>
          <p>• The verification code expires in 10 minutes</p>
          <p>• You can request up to {action.maxAttempts} codes per day</p>
        </div>
      </div>

      {/* Attempt Counter */}
      {action.attempts !== undefined && action.maxAttempts && (
        <div className="mt-4 text-center">
          <p className="text-xs text-secondary-400">
            Attempt {action.attempts + 1} of {action.maxAttempts}
          </p>
        </div>
      )}
    </div>
  )
}

export default SMSVerificationForm