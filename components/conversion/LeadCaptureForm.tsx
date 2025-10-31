import React, { useState, useEffect } from 'react'
import { ChevronRight, Mail, Building, Globe, Phone, User, CheckCircle, AlertCircle } from 'lucide-react'
import { trackConversionFunnel, trackCustomEvent } from '../analytics/ConversionTracker'

interface LeadCaptureFormProps {
  variant?: 'inline' | 'modal' | 'sidebar'
  title?: string
  subtitle?: string
  context?: string
  source?: string
  style?: 'default' | 'minimal' | 'premium'
  onSubmit?: (data: LeadData) => void
  onClose?: () => void
}

interface LeadData {
  firstName: string
  lastName: string
  email: string
  company: string
  website: string
  phone?: string
  businessType?: string
  currentChallenge?: string
  monthlyRevenue?: string
  source?: string
  context?: string
}

interface FormErrors {
  [key: string]: string
}

export function LeadCaptureForm({
  variant = 'inline',
  title = 'Get Your Free Directory Analysis',
  subtitle = 'See which directories could boost your business visibility',
  context = 'guide',
  source = 'directory-guide',
  style = 'default',
  onSubmit,
  onClose
}: LeadCaptureFormProps) {
  const [formData, setFormData] = useState<LeadData>({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    website: '',
    phone: '',
    businessType: '',
    currentChallenge: '',
    monthlyRevenue: '',
    source,
    context
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [step, setStep] = useState(1)
  const [showValidation, setShowValidation] = useState(false)

  // Track form view
  useEffect(() => {
    trackConversionFunnel('lead_capture_view', {
      variant,
      context,
      source,
      style
    })
  }, [variant, context, source, style])

  const businessTypes = [
    'E-commerce/Retail',
    'Professional Services',
    'Restaurant/Food Service',
    'Healthcare',
    'Real Estate',
    'Technology/Software',
    'Manufacturing',
    'Non-profit',
    'Other'
  ]

  const revenueRanges = [
    'Under $10k/month',
    '$10k-$50k/month',
    '$50k-$100k/month',
    '$100k-$500k/month',
    '$500k+/month',
    'Prefer not to say'
  ]

  const challenges = [
    'Low online visibility',
    'Not enough leads',
    'Poor search rankings',
    'Competitor outranking us',
    'Manual marketing takes too much time',
    'Unclear which directories matter'
  ]

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateWebsite = (website: string): boolean => {
    if (!website) return false
    try {
      const url = website.startsWith('http') ? website : `https://${website}`
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: FormErrors = {}

    if (stepNumber === 1) {
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required'
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required'
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required'
      } else if (!validateEmail(formData.email)) {
        newErrors.email = 'Please enter a valid email address'
      }
    } else if (stepNumber === 2) {
      if (!formData.company.trim()) newErrors.company = 'Company name is required'
      if (!formData.website.trim()) {
        newErrors.website = 'Website is required'
      } else if (!validateWebsite(formData.website)) {
        newErrors.website = 'Please enter a valid website URL'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof LeadData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }

    // Track field completion
    if (value && !errors[field]) {
      trackCustomEvent('form_field_completed', {
        field,
        form_type: 'lead_capture',
        context,
        source
      })
    }
  }

  const handleNextStep = () => {
    setShowValidation(true)
    if (validateStep(step)) {
      setStep(step + 1)
      trackConversionFunnel('lead_capture_step_completed', {
        step,
        context,
        source
      })
    }
  }

  const handlePrevStep = () => {
    setStep(step - 1)
    setShowValidation(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setShowValidation(true)

    if (!validateStep(1) || !validateStep(2)) {
      setStep(1)
      return
    }

    setIsSubmitting(true)

    try {
      // Format website URL
      const formattedData = {
        ...formData,
        website: formData.website.startsWith('http') 
          ? formData.website 
          : `https://${formData.website}`
      }

      // Submit to API
      const response = await fetch('/api/leads/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedData)
      })

      if (response.ok) {
        setIsSubmitted(true)
        trackConversionFunnel('lead_capture_success', {
          context,
          source,
          business_type: formData.businessType,
          revenue_range: formData.monthlyRevenue
        })

        // Call parent callback if provided
        if (onSubmit) {
          onSubmit(formattedData)
        }
      } else {
        throw new Error('Failed to submit form')
      }
    } catch (error) {
      console.error('Form submission error:', error)
      trackConversionFunnel('lead_capture_error', {
        context,
        source,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      setErrors({ submit: 'Something went wrong. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getContainerClasses = () => {
    const baseClasses = "bg-gradient-to-br from-secondary-800 to-secondary-900 rounded-xl border"
    
    switch (style) {
      case 'minimal':
        return `${baseClasses} border-secondary-700 p-6`
      case 'premium':
        return `${baseClasses} border-volt-500/30 p-8 shadow-xl shadow-volt-500/10`
      default:
        return `${baseClasses} border-secondary-700 p-6`
    }
  }

  const getInputClasses = (field: string) => {
    const baseClasses = "w-full px-4 py-3 bg-secondary-700 border rounded-lg text-white placeholder-secondary-400 focus:outline-none focus:ring-2 transition-colors"
    const hasError = showValidation && errors[field]
    
    if (hasError) {
      return `${baseClasses} border-danger-500 focus:ring-danger-500/50`
    }
    return `${baseClasses} border-secondary-600 focus:border-volt-500 focus:ring-volt-500/50`
  }

  if (isSubmitted) {
    return (
      <div className={getContainerClasses()}>
        <div className="text-center">
          <CheckCircle className="mx-auto text-success-400 mb-4" size={48} />
          <h3 className="text-2xl font-bold text-white mb-3">
            Analysis Request Submitted!
          </h3>
          <p className="text-secondary-300 mb-6">
            We'll analyze your business and send you a personalized directory submission 
            strategy within 24 hours.
          </p>
          <div className="bg-volt-500/10 border border-volt-500/30 rounded-lg p-4">
            <p className="text-sm text-volt-400">
              <strong>Next Step:</strong> Check your email for immediate access to our 
              Directory Selection Tool while we prepare your custom analysis.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={getContainerClasses()}>
      {variant === 'modal' && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-secondary-400 hover:text-white"
        >
          ×
        </button>
      )}

      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
        <p className="text-secondary-300">{subtitle}</p>
      </div>

      {/* Progress Indicator */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center space-x-4">
          {[1, 2, 3].map((stepNum) => (
            <React.Fragment key={stepNum}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                stepNum < step ? 'bg-success-500 text-white' :
                stepNum === step ? 'bg-volt-500 text-secondary-900' :
                'bg-secondary-700 text-secondary-400'
              }`}>
                {stepNum < step ? <CheckCircle size={16} /> : stepNum}
              </div>
              {stepNum < 3 && (
                <div className={`w-8 h-0.5 ${
                  stepNum < step ? 'bg-success-500' : 'bg-secondary-700'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className={getInputClasses('firstName')}
                  placeholder="John"
                />
                {showValidation && errors.firstName && (
                  <p className="text-danger-400 text-sm mt-1 flex items-center">
                    <AlertCircle size={14} className="mr-1" />
                    {errors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className={getInputClasses('lastName')}
                  placeholder="Smith"
                />
                {showValidation && errors.lastName && (
                  <p className="text-danger-400 text-sm mt-1 flex items-center">
                    <AlertCircle size={14} className="mr-1" />
                    {errors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={getInputClasses('email')}
                placeholder="john@example.com"
              />
              {showValidation && errors.email && (
                <p className="text-danger-400 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.email}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextStep}
              className="w-full bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-3 px-6 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
            >
              Continue <ChevronRight size={18} className="ml-2" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                className={getInputClasses('company')}
                placeholder="Acme Corp"
              />
              {showValidation && errors.company && (
                <p className="text-danger-400 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.company}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Website *
              </label>
              <input
                type="text"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                className={getInputClasses('website')}
                placeholder="example.com"
              />
              {showValidation && errors.website && (
                <p className="text-danger-400 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.website}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className={getInputClasses('phone')}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handlePrevStep}
                className="flex-1 bg-secondary-700 text-white font-medium py-3 px-6 rounded-lg hover:bg-secondary-600 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="flex-1 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-3 px-6 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
              >
                Continue <ChevronRight size={18} className="ml-2" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Business Type
              </label>
              <select
                value={formData.businessType}
                onChange={(e) => handleInputChange('businessType', e.target.value)}
                className={getInputClasses('businessType')}
              >
                <option value="">Select your business type</option>
                {businessTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Current Challenge
              </label>
              <select
                value={formData.currentChallenge}
                onChange={(e) => handleInputChange('currentChallenge', e.target.value)}
                className={getInputClasses('currentChallenge')}
              >
                <option value="">What's your biggest challenge?</option>
                {challenges.map(challenge => (
                  <option key={challenge} value={challenge}>{challenge}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Monthly Revenue
              </label>
              <select
                value={formData.monthlyRevenue}
                onChange={(e) => handleInputChange('monthlyRevenue', e.target.value)}
                className={getInputClasses('monthlyRevenue')}
              >
                <option value="">Select revenue range</option>
                {revenueRanges.map(range => (
                  <option key={range} value={range}>{range}</option>
                ))}
              </select>
            </div>

            {errors.submit && (
              <p className="text-danger-400 text-sm flex items-center">
                <AlertCircle size={14} className="mr-1" />
                {errors.submit}
              </p>
            )}

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handlePrevStep}
                className="flex-1 bg-secondary-700 text-white font-medium py-3 px-6 rounded-lg hover:bg-secondary-600 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-3 px-6 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? 'Submitting...' : 'Get My Free Analysis'}
              </button>
            </div>
          </div>
        )}
      </form>

      <p className="text-xs text-secondary-400 text-center mt-4">
        We respect your privacy. No spam, ever. Unsubscribe anytime.
      </p>
    </div>
  )
}