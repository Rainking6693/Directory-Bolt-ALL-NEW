'use client'
import { useState } from 'react'
import { VerificationAction } from '../../../../types/dashboard'

interface EmailVerificationDisplayProps {
  action: VerificationAction
  onResend: () => void
}

export function EmailVerificationDisplay({ action, onResend }: EmailVerificationDisplayProps) {
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  const emailAddress = action.contactInfo?.email || 'your registered email'
  
  // Mask email for privacy (show first 2 chars and domain)
  const maskEmail = (email: string) => {
    if (email === 'your registered email') return email
    const [localPart, domain] = email.split('@')
    if (localPart.length <= 2) return email
    const maskedLocal = localPart.substring(0, 2) + '*'.repeat(localPart.length - 2)
    return `${maskedLocal}@${domain}`
  }

  const handleResend = async () => {
    setIsResending(true)
    setResendSuccess(false)

    try {
      await new Promise(resolve => setTimeout(resolve, 1500)) // Simulate API call
      onResend()
      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to resend email:', error)
    } finally {
      setIsResending(false)
    }
  }

  const getStatusDisplay = () => {
    switch (action.status) {
      case 'pending':
        return {
          icon: '📧',
          title: 'Email Verification Required',
          message: 'Check your email and click the verification link to continue.',
          bgColor: 'bg-volt-500/10',
          borderColor: 'border-volt-500/30',
          iconBg: 'bg-volt-500/20',
          textColor: 'text-volt-400'
        }
      case 'in_progress':
        return {
          icon: '⏳',
          title: 'Email Verification Sent',
          message: 'We\'ve sent a verification email. Please check your inbox and spam folder.',
          bgColor: 'bg-volt-500/10',
          borderColor: 'border-volt-500/30',
          iconBg: 'bg-volt-500/20',
          textColor: 'text-volt-400'
        }
      case 'completed':
        return {
          icon: '✅',
          title: 'Email Verified Successfully',
          message: 'Your email has been verified! This verification is now complete.',
          bgColor: 'bg-success-500/10',
          borderColor: 'border-success-500/30',
          iconBg: 'bg-success-500/20',
          textColor: 'text-success-400'
        }
      default:
        return {
          icon: '📧',
          title: 'Email Verification',
          message: 'Please verify your email address to continue.',
          bgColor: 'bg-secondary-700/30',
          borderColor: 'border-secondary-600',
          iconBg: 'bg-secondary-600/50',
          textColor: 'text-secondary-300'
        }
    }
  }

  const status = getStatusDisplay()

  return (
    <div className="mt-6 p-6 bg-secondary-700/30 rounded-lg border border-secondary-600">
      <div className={`p-6 rounded-lg border ${status.borderColor} ${status.bgColor}`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${status.iconBg}`}>
            <span className="text-2xl">{status.icon}</span>
          </div>
          
          <div className="flex-1">
            <h4 className="text-lg font-bold text-white mb-2">{status.title}</h4>
            <p className="text-secondary-300 text-sm mb-4 leading-relaxed">
              {status.message}
            </p>

            <div className="space-y-4">
              <div className={`p-4 rounded-lg bg-secondary-800/50 border border-secondary-600`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-lg">📮</span>
                  <div>
                    <p className="text-white font-medium text-sm">Email sent to:</p>
                    <p className={`font-mono text-sm ${status.textColor}`}>
                      {maskEmail(emailAddress)}
                    </p>
                  </div>
                </div>

                {action.status !== 'completed' && (
                  <div className="space-y-3">
                    <div className="text-xs text-secondary-400 space-y-1">
                      <p>• Check your inbox and spam/junk folder</p>
                      <p>• Click the verification link in the email</p>
                      <p>• The link expires in 24 hours</p>
                    </div>

                    {!resendSuccess ? (
                      <div className="flex items-center justify-between pt-2 border-t border-secondary-600">
                        <span className="text-secondary-400 text-xs">Didn't receive the email?</span>
                        <button
                          onClick={handleResend}
                          disabled={isResending}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-volt-500/20 hover:bg-volt-500/30 text-volt-400 border border-volt-500/30 rounded-lg text-xs font-medium transition-all"
                        >
                          {isResending ? (
                            <>
                              <div className="w-3 h-3 border border-volt-400 border-t-transparent rounded-full animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <span>🔄</span>
                              Resend Email
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-2 border-t border-secondary-600">
                        <span className="text-success-400 text-xs">✓</span>
                        <span className="text-success-400 text-xs">Verification email sent successfully!</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {action.status === 'completed' && (
                <div className="flex items-center justify-center p-4 bg-success-500/10 border border-success-500/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎉</span>
                    <div>
                      <p className="text-success-400 font-bold text-sm">Verification Complete!</p>
                      <p className="text-success-300 text-xs">Your email has been successfully verified.</p>
                    </div>
                  </div>
                </div>
              )}

              {action.status !== 'completed' && (
                <div className="bg-secondary-800/30 border border-secondary-600 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">💡</span>
                    <div>
                      <p className="text-secondary-300 text-sm font-medium mb-2">Troubleshooting Tips:</p>
                      <ul className="text-xs text-secondary-400 space-y-1">
                        <li>• Check spam/junk folders for the verification email</li>
                        <li>• Add noreply@directorybolt.com to your contacts</li>
                        <li>• Make sure your email client allows HTML emails</li>
                        <li>• Wait a few minutes - emails can be delayed</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailVerificationDisplay