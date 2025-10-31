'use client'
import { useState, useEffect, useRef } from 'react'
import { VerificationAction } from '../../../../types/dashboard'

interface SMSVerificationFormProps {
  action: VerificationAction
  onComplete: () => void
  onCancel: () => void
}

export function SMSVerificationForm({ action, onComplete, onCancel }: SMSVerificationFormProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phoneNumber, setPhoneNumber] = useState(action.contactInfo?.phone || '')
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [canResend, setCanResend] = useState(false)

  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (step === 'code' && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setCanResend(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }

    return () => {}
  }, [step, timeRemaining])

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '')
    
    // Apply US phone number formatting
    if (cleaned.length <= 3) {
      return cleaned
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`
    } else if (cleaned.length <= 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    } else {
      return `+${cleaned.slice(0, -10)} (${cleaned.slice(-10, -7)}) ${cleaned.slice(-7, -4)}-${cleaned.slice(-4)}`
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhoneNumber(formatted)
    setError(null)
  }

  const handleSendCode = async () => {
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      setError('Please enter a valid phone number')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Simulate API call to send SMS
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setStep('code')
      setTimeRemaining(60) // 60 seconds countdown
      setCanResend(false)
      
      // Focus first code input
      setTimeout(() => {
        codeRefs.current[0]?.focus()
      }, 100)
    } catch (err) {
      setError('Failed to send verification code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return // Prevent pasting multiple characters
    
    const newCode = [...verificationCode]
    newCode[index] = value
    setVerificationCode(newCode)
    setError(null)

    // Auto-focus next input
    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all fields are filled
    if (newCode.every(digit => digit !== '') && value) {
      setTimeout(() => handleVerifyCode(newCode), 100)
    }
  }

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      codeRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      codeRefs.current[index + 1]?.focus()
    }
  }

  const handleVerifyCode = async (code = verificationCode) => {
    const codeString = code.join('')
    if (codeString.length !== 6) {
      setError('Please enter the complete 6-digit code')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Simulate API call to verify code
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Simulate success/failure (90% success rate for demo)
      if (Math.random() > 0.1) {
        onComplete()
      } else {
        throw new Error('Invalid verification code')
      }
    } catch (err) {
      setError('Invalid verification code. Please try again.')
      setVerificationCode(['', '', '', '', '', ''])
      codeRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    setIsLoading(true)
    setError(null)
    setVerificationCode(['', '', '', '', '', ''])

    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setTimeRemaining(60)
      setCanResend(false)
    } catch (err) {
      setError('Failed to resend code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mt-6 p-6 bg-secondary-700/30 rounded-lg border border-secondary-600">
      <div className="max-w-md mx-auto">
        {step === 'phone' ? (
          <>
            <div className="text-center mb-6">
              <h4 className="text-lg font-bold text-white mb-2">📱 SMS Verification</h4>
              <p className="text-secondary-300 text-sm">
                We'll send a verification code to your mobile phone
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="phone-input" className="block text-sm font-medium text-secondary-300 mb-2">
                  Phone Number
                </label>
                <input
                  id="phone-input"
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  className="input-field text-center text-lg"
                  autoFocus
                  maxLength={18}
                />
                <p className="text-xs text-secondary-400 mt-2">
                  Standard messaging rates may apply
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-danger-500/10 border border-danger-500/30 rounded-lg">
                  <span className="text-danger-400">❌</span>
                  <span className="text-danger-400 text-sm">{error}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSendCode}
                  disabled={isLoading || phoneNumber.replace(/\D/g, '').length < 10}
                  className="btn-primary flex-1"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-secondary-800 border-t-transparent rounded-full animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    'Send Code'
                  )}
                </button>
                <button
                  onClick={onCancel}
                  className="btn-secondary"
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <h4 className="text-lg font-bold text-white mb-2">Enter Verification Code</h4>
              <p className="text-secondary-300 text-sm">
                Code sent to {phoneNumber}
              </p>
              <button
                onClick={() => setStep('phone')}
                className="text-volt-400 hover:text-volt-300 text-sm underline mt-1"
              >
                Change number
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex justify-center gap-2">
                {verificationCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => codeRefs.current[index] = el}
                    type="text"
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(index, e)}
                    className="w-12 h-12 text-center text-xl font-bold bg-secondary-800 border-2 border-secondary-600 rounded-lg text-white focus:ring-volt-500 focus:border-volt-500 transition-all"
                    maxLength={1}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-danger-500/10 border border-danger-500/30 rounded-lg">
                  <span className="text-danger-400">❌</span>
                  <span className="text-danger-400 text-sm">{error}</span>
                </div>
              )}

              <div className="text-center">
                {timeRemaining > 0 ? (
                  <p className="text-secondary-400 text-sm">
                    Didn't receive the code? Resend in {timeRemaining}s
                  </p>
                ) : canResend ? (
                  <button
                    onClick={handleResendCode}
                    disabled={isLoading}
                    className="text-volt-400 hover:text-volt-300 text-sm underline"
                  >
                    {isLoading ? 'Sending...' : 'Resend Code'}
                  </button>
                ) : null}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleVerifyCode()}
                  disabled={isLoading || verificationCode.some(digit => digit === '')}
                  className="btn-primary flex-1"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-secondary-800 border-t-transparent rounded-full animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Code'
                  )}
                </button>
                <button
                  onClick={onCancel}
                  className="btn-secondary"
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SMSVerificationForm