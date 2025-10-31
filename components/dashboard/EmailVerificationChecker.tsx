'use client'
import { useState, useEffect } from 'react'
import { LoadingState } from '../ui/LoadingState'
import { PendingAction, VerificationFormData } from '../../types/dashboard'

interface EmailVerificationCheckerProps {
  action: PendingAction
  onSubmit: (formData: VerificationFormData) => Promise<void>
  onCancel: () => void
  isLoading: boolean
}

export function EmailVerificationChecker({
  action,
  onSubmit,
  onCancel,
  isLoading
}: EmailVerificationCheckerProps) {
  const [email, setEmail] = useState(action.metadata?.email || '')
  const [isEmailSent, setIsEmailSent] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [verificationStatus, setVerificationStatus] = useState<'not_sent' | 'sent' | 'verified' | 'expired'>('not_sent')

  // Auto-check timer
  useEffect(() => {
    if (isEmailSent && verificationStatus === 'sent') {
      const checkInterval = setInterval(() => {
        handleCheckVerification(true) // Silent check
      }, 10000) // Check every 10 seconds

      return () => clearInterval(checkInterval)
    }

    return () => {}
  }, [isEmailSent, verificationStatus])

  // Countdown timer for resend email
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }

    return () => {}
  }, [countdown])

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSendEmail = async () => {
    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    setError(null)
    setIsChecking(true)
    
    try {
      // Simulate email sending API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setIsEmailSent(true)
      setVerificationStatus('sent')
      setCountdown(60) // 60 second countdown for resend
      setLastCheckTime(new Date())
    } catch (err) {
      setError('Failed to send verification email. Please try again.')
    } finally {
      setIsChecking(false)
    }
  }

  const handleResendEmail = async () => {
    if (countdown > 0) return

    setIsChecking(true)
    setError(null)

    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setCountdown(60)
      setLastCheckTime(new Date())
    } catch (err) {
      setError('Failed to resend verification email. Please try again.')
    } finally {
      setIsChecking(false)
    }
  }

  const handleCheckVerification = async (silent: boolean = false) => {
    if (!silent) {
      setIsChecking(true)
      setError(null)
    }

    try {
      // Simulate checking verification status
      await new Promise(resolve => setTimeout(resolve, silent ? 500 : 1500))
      
      // Simulate random verification success (20% chance for demo)
      const isVerified = Math.random() < 0.2 || !silent
      
      if (isVerified && !silent) {
        setVerificationStatus('verified')
      } else {
        setLastCheckTime(new Date())
      }
    } catch (err) {
      if (!silent) {
        setError('Failed to check verification status. Please try again.')
      }
    } finally {
      if (!silent) {
        setIsChecking(false)
      }
    }
  }

  const handleMarkAsVerified = async () => {
    // Manual verification - user claims they clicked the link
    try {
      await onSubmit({
        actionId: action.id,
        type: 'email',
        data: {
          email,
          verified: true,
          manualVerification: true
        }
      })
    } catch (err) {
      setError('Failed to verify email. Please try again or contact support.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (verificationStatus !== 'verified') {
      setError('Please verify your email address first by clicking the verification link.')
      return
    }

    setError(null)

    try {
      await onSubmit({
        actionId: action.id,
        type: 'email',
        data: {
          email,
          verified: true,
          verifiedAt: new Date().toISOString()
        }
      })
    } catch (err) {
      setError('Failed to complete email verification. Please try again.')
    }
  }

  const formatEmailDomain = (email: string) => {
    const domain = email.split('@')[1]
    return domain
  }

  const getEmailProviderName = (email: string) => {
    const domain = formatEmailDomain(email).toLowerCase()
    
    const providers: { [key: string]: string } = {
      'gmail.com': 'Gmail',
      'outlook.com': 'Outlook',
      'hotmail.com': 'Hotmail',
      'yahoo.com': 'Yahoo Mail',
      'icloud.com': 'iCloud Mail',
      'aol.com': 'AOL Mail'
    }

    return providers[domain] || 'your email provider'
  }

  const getEmailProviderUrl = (email: string) => {
    const domain = formatEmailDomain(email).toLowerCase()
    
    const urls: { [key: string]: string } = {
      'gmail.com': 'https://mail.google.com',
      'outlook.com': 'https://outlook.live.com',
      'hotmail.com': 'https://outlook.live.com',
      'yahoo.com': 'https://mail.yahoo.com',
      'icloud.com': 'https://www.icloud.com/mail',
      'aol.com': 'https://mail.aol.com'
    }

    return urls[domain]
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📧</span>
          <div>
            <h3 className="text-xl font-bold text-white">Email Verification</h3>
            <p className="text-secondary-400 text-sm">{action.directory}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="text-secondary-400 hover:text-secondary-300 text-xl"
          disabled={isLoading || isChecking}
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

      {!isEmailSent && verificationStatus === 'not_sent' && (
        <div className="space-y-6">
          {/* Email Input */}
          <div>
            <label className="block text-white font-medium mb-2">
              Business Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@yourbusiness.com"
              className="input-field w-full"
              disabled={isLoading || isChecking}
            />
            <p className="text-secondary-400 text-xs mt-1">
              We'll send a verification link to this email address
            </p>
          </div>

          {/* Send Email Button */}
          <div className="flex gap-3">
            <button
              onClick={handleSendEmail}
              disabled={!email || isLoading || isChecking}
              className="btn-primary flex-1"
            >
              {isChecking ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                  Sending Email...
                </div>
              ) : (
                'Send Verification Email'
              )}
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading || isChecking}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isEmailSent && verificationStatus === 'sent' && (
        <div className="space-y-6">
          {/* Email Sent Success */}
          <div className="bg-success-500/20 border border-success-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-success-400 mb-2">
              <span className="text-lg">✅</span>
              <p className="text-sm font-medium">Verification email sent!</p>
            </div>
            <p className="text-success-300 text-sm">
              Check your inbox at <strong>{email}</strong> and click the verification link.
            </p>
          </div>

          {/* Quick Access to Email Provider */}
          {getEmailProviderUrl(email) && (
            <div className="bg-volt-500/20 border border-volt-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium text-sm mb-1">Quick Access</p>
                  <p className="text-secondary-300 text-xs">
                    Click to open {getEmailProviderName(email)} in a new tab
                  </p>
                </div>
                <a
                  href={getEmailProviderUrl(email)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm"
                >
                  Open {getEmailProviderName(email)}
                </a>
              </div>
            </div>
          )}

          {/* Status Check */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Verification Status</p>
                {lastCheckTime && (
                  <p className="text-secondary-400 text-xs">
                    Last checked: {lastCheckTime.toLocaleTimeString()}
                  </p>
                )}
              </div>
              
              <button
                onClick={() => handleCheckVerification(false)}
                disabled={isChecking}
                className="btn-secondary text-sm"
              >
                {isChecking ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-3 h-3 border-2 border-white/20 border-t-white rounded-full" />
                    Checking...
                  </div>
                ) : (
                  'Check Now'
                )}
              </button>
            </div>

            {/* Manual Verification Option */}
            <div className="bg-secondary-700/50 rounded-lg p-4 border border-secondary-600">
              <div className="space-y-3">
                <p className="text-white font-medium text-sm">Already clicked the link?</p>
                <p className="text-secondary-300 text-xs">
                  If you've already clicked the verification link in your email, you can mark this as complete manually.
                </p>
                <button
                  onClick={handleMarkAsVerified}
                  disabled={isLoading}
                  className="btn-primary text-sm"
                >
                  I've Verified My Email
                </button>
              </div>
            </div>

            {/* Resend Option */}
            <div className="flex items-center justify-between pt-4 border-t border-secondary-700">
              <p className="text-secondary-400 text-sm">
                Didn't receive the email?
              </p>
              
              {countdown > 0 ? (
                <p className="text-secondary-400 text-sm">
                  Resend in {countdown}s
                </p>
              ) : (
                <button
                  onClick={handleResendEmail}
                  disabled={isChecking}
                  className="text-volt-400 hover:text-volt-300 text-sm underline"
                >
                  Resend Email
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {verificationStatus === 'verified' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Verification Success */}
          <div className="bg-success-500/20 border border-success-500/30 rounded-lg p-6 text-center">
            <span className="text-6xl block mb-4">🎉</span>
            <h4 className="text-xl font-bold text-success-400 mb-2">Email Verified!</h4>
            <p className="text-success-300 text-sm">
              Your email address <strong>{email}</strong> has been successfully verified.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary flex-1"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                  Completing...
                </div>
              ) : (
                'Complete Verification'
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="btn-secondary"
            >
              Cancel
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
        <h4 className="text-white font-medium mb-2">Troubleshooting</h4>
        <div className="space-y-2 text-xs text-secondary-400">
          <p>• Check your spam/junk folder if you don't see the email</p>
          <p>• Make sure you're checking the correct email address</p>
          <p>• The verification link expires in 24 hours</p>
          <p>• Contact support if you continue to have issues</p>
          <p>• Some corporate firewalls may block verification emails</p>
        </div>

        {email && (
          <div className="mt-4 p-3 bg-secondary-700/30 rounded-lg">
            <p className="text-xs text-secondary-400 mb-1">Email being verified:</p>
            <p className="text-white text-sm font-mono">{email}</p>
          </div>
        )}
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

export default EmailVerificationChecker