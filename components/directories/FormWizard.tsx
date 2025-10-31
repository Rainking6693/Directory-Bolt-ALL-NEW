'use client'

import { useState, useEffect } from 'react'
import type { Directory } from '../../lib/types/directory'

interface FormField {
  id: string
  label: string
  type: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'select' | 'checkbox' | 'file'
  required: boolean
  placeholder?: string
  options?: string[]
  validation?: {
    pattern?: string
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
  }
  dependency?: {
    field: string
    value: any
  }
}

interface FormStep {
  id: string
  title: string
  description: string
  fields: FormField[]
  requiredDirectoryCount?: number
}

interface FormWizardProps {
  selectedDirectories: Directory[]
  businessData?: Record<string, any>
  onSubmit: (formData: Record<string, any>) => void
  onSave?: (formData: Record<string, any>) => void
  isSubmitting?: boolean
}

const FORM_STEPS: FormStep[] = [
  {
    id: 'business-info',
    title: 'Business Information',
    description: 'Core information about your business',
    fields: [
      {
        id: 'businessName',
        label: 'Business Name',
        type: 'text',
        required: true,
        placeholder: 'Enter your business name'
      },
      {
        id: 'businessDescription',
        label: 'Business Description',
        type: 'textarea',
        required: true,
        placeholder: 'Briefly describe what your business does...',
        validation: { maxLength: 500 }
      },
      {
        id: 'businessWebsite',
        label: 'Website URL',
        type: 'url',
        required: true,
        placeholder: 'https://www.yourbusiness.com'
      },
      {
        id: 'businessCategory',
        label: 'Business Category',
        type: 'select',
        required: true,
        options: [
          'Technology',
          'Healthcare',
          'Finance',
          'Education',
          'Retail',
          'Restaurant',
          'Professional Services',
          'Real Estate',
          'Automotive',
          'Non-Profit',
          'Other'
        ]
      }
    ]
  },
  {
    id: 'contact-info',
    title: 'Contact Information',
    description: 'How directories can reach you',
    fields: [
      {
        id: 'contactEmail',
        label: 'Contact Email',
        type: 'email',
        required: true,
        placeholder: 'contact@yourbusiness.com'
      },
      {
        id: 'contactPhone',
        label: 'Phone Number',
        type: 'tel',
        required: true,
        placeholder: '+1 (555) 123-4567'
      },
      {
        id: 'businessAddress',
        label: 'Business Address',
        type: 'textarea',
        required: false,
        placeholder: '123 Main St, City, State 12345'
      },
      {
        id: 'contactPerson',
        label: 'Contact Person',
        type: 'text',
        required: false,
        placeholder: 'Full name of primary contact'
      }
    ]
  },
  {
    id: 'business-details',
    title: 'Additional Details',
    description: 'Enhanced information for better listings',
    fields: [
      {
        id: 'yearEstablished',
        label: 'Year Established',
        type: 'text',
        required: false,
        placeholder: '2020',
        validation: { pattern: '^[0-9]{4}$' }
      },
      {
        id: 'employeeCount',
        label: 'Number of Employees',
        type: 'select',
        required: false,
        options: ['1', '2-10', '11-50', '51-200', '201-500', '500+']
      },
      {
        id: 'annualRevenue',
        label: 'Annual Revenue Range',
        type: 'select',
        required: false,
        options: [
          'Under $100K',
          '$100K - $500K',
          '$500K - $1M',
          '$1M - $5M',
          '$5M - $10M',
          'Over $10M',
          'Prefer not to say'
        ]
      },
      {
        id: 'businessHours',
        label: 'Business Hours',
        type: 'textarea',
        required: false,
        placeholder: 'Monday-Friday: 9:00 AM - 5:00 PM\nSaturday: 10:00 AM - 3:00 PM\nSunday: Closed'
      }
    ]
  },
  {
    id: 'media-assets',
    title: 'Media & Assets',
    description: 'Upload logos and images for your listings',
    fields: [
      {
        id: 'businessLogo',
        label: 'Business Logo',
        type: 'file',
        required: false
      },
      {
        id: 'businessImages',
        label: 'Business Photos',
        type: 'file',
        required: false
      },
      {
        id: 'socialMediaLinks',
        label: 'Social Media Links',
        type: 'textarea',
        required: false,
        placeholder: 'Facebook: https://facebook.com/yourbusiness\nTwitter: https://twitter.com/yourbusiness\nLinkedIn: https://linkedin.com/company/yourbusiness'
      }
    ]
  },
  {
    id: 'review-submit',
    title: 'Review & Submit',
    description: 'Review your information before submitting',
    fields: [
      {
        id: 'agreeToTerms',
        label: 'I agree to the Terms of Service and Privacy Policy',
        type: 'checkbox',
        required: true
      },
      {
        id: 'allowContact',
        label: 'Allow directories to contact me for verification',
        type: 'checkbox',
        required: false
      }
    ]
  }
]

export function FormWizard({
  selectedDirectories,
  businessData,
  onSubmit,
  onSave,
  isSubmitting = false
}: FormWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, any>>(businessData || {})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set())

  // Auto-save form data periodically
  useEffect(() => {
    if (onSave && Object.keys(formData).length > 0) {
      const saveTimeout = setTimeout(() => {
        onSave(formData)
      }, 2000)
      
      return () => clearTimeout(saveTimeout)
    }

    return () => {}
  }, [formData, onSave])

  const validateField = (field: FormField, value: any): string | null => {
    // Required validation
    if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return `${field.label} is required`
    }

    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null // Skip other validations for empty non-required fields
    }

    // Type-specific validation
    switch (field.type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value)) {
          return 'Please enter a valid email address'
        }
        break

      case 'url':
        try {
          new URL(value)
        } catch {
          return 'Please enter a valid URL'
        }
        break

      case 'tel':
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/
        if (!phoneRegex.test(value)) {
          return 'Please enter a valid phone number'
        }
        break
    }

    // Pattern validation
    if (field.validation?.pattern) {
      const regex = new RegExp(field.validation.pattern)
      if (!regex.test(value)) {
        return `Invalid format for ${field.label}`
      }
    }

    // Length validation
    if (field.validation?.minLength && value.length < field.validation.minLength) {
      return `${field.label} must be at least ${field.validation.minLength} characters`
    }
    
    if (field.validation?.maxLength && value.length > field.validation.maxLength) {
      return `${field.label} must be no more than ${field.validation.maxLength} characters`
    }

    return null
  }

  const validateStep = (stepIndex: number): boolean => {
    const step = FORM_STEPS[stepIndex]
    const stepErrors: Record<string, string> = {}
    let isValid = true

    step.fields.forEach(field => {
      // Check dependency
      if (field.dependency) {
        const dependencyValue = formData[field.dependency.field]
        if (dependencyValue !== field.dependency.value) {
          return // Skip validation if dependency not met
        }
      }

      const error = validateField(field, formData[field.id])
      if (error) {
        stepErrors[field.id] = error
        isValid = false
      }
    })

    setErrors(prev => ({ ...prev, ...stepErrors }))
    return isValid
  }

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
    setTouchedFields(prev => new Set([...prev, fieldId]))
    
    // Clear error for this field
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldId]
        return newErrors
      })
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, FORM_STEPS.length - 1))
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  const handleSubmit = () => {
    // Validate all steps
    let allValid = true
    for (let i = 0; i < FORM_STEPS.length; i++) {
      if (!validateStep(i)) {
        allValid = false
      }
    }

    if (allValid) {
      onSubmit(formData)
    }
  }

  const renderField = (field: FormField) => {
    // Check dependency
    if (field.dependency) {
      const dependencyValue = formData[field.dependency.field]
      if (dependencyValue !== field.dependency.value) {
        return null
      }
    }

    const value = formData[field.id] || ''
    const error = errors[field.id]
    const isTouched = touchedFields.has(field.id)

    const baseClasses = `w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:outline-none focus:ring-1 transition-colors ${
      error && isTouched 
        ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
        : 'border-secondary-600 focus:border-volt-500 focus:ring-volt-500'
    }`

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-secondary-300">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
              className={baseClasses}
              maxLength={field.validation?.maxLength}
            />
            {field.validation?.maxLength && (
              <div className="text-xs text-secondary-500 text-right">
                {value.length}/{field.validation.maxLength}
              </div>
            )}
            {error && isTouched && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
          </div>
        )

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-secondary-300">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className={baseClasses}
            >
              <option value="">Select {field.label}</option>
              {field.options?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {error && isTouched && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
          </div>
        )

      case 'checkbox':
        return (
          <div key={field.id} className="space-y-2">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={value === true}
                onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                className="mt-1 w-4 h-4 text-volt-500 bg-secondary-900 border-secondary-600 rounded focus:ring-volt-500 focus:ring-2"
              />
              <span className="text-sm text-secondary-300">
                {field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </span>
            </label>
            {error && isTouched && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
          </div>
        )

      case 'file':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-secondary-300">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <input
              type="file"
              onChange={(e) => handleFieldChange(field.id, e.target.files?.[0])}
              className="w-full px-4 py-3 bg-secondary-900 border border-secondary-600 rounded-lg text-white focus:outline-none focus:border-volt-500 focus:ring-1 focus:ring-volt-500"
              accept="image/*"
            />
            {error && isTouched && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
          </div>
        )

      default:
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-secondary-300">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <input
              type={field.type}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className={baseClasses}
              minLength={field.validation?.minLength}
              maxLength={field.validation?.maxLength}
            />
            {error && isTouched && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
          </div>
        )
    }
  }

  const currentStepData = FORM_STEPS[currentStep]
  const progress = ((currentStep + 1) / FORM_STEPS.length) * 100

  return (
    <div className="max-w-4xl mx-auto bg-secondary-800 rounded-xl border border-secondary-700 overflow-hidden">
      {/* Progress Header */}
      <div className="p-6 bg-secondary-900/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Directory Submission Form</h2>
            <p className="text-secondary-400">
              Submitting to {selectedDirectories.length} directories
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-secondary-400">
              Step {currentStep + 1} of {FORM_STEPS.length}
            </div>
            <div className="text-volt-400 font-medium">
              {Math.round(progress)}% Complete
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-secondary-700 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-volt-500 to-volt-400 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step Navigation */}
        <div className="flex items-center justify-between mt-6">
          {FORM_STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center ${
                index < FORM_STEPS.length - 1 ? 'flex-1' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                index < currentStep 
                  ? 'bg-volt-500 text-secondary-900'
                  : index === currentStep
                  ? 'bg-volt-500 text-secondary-900'
                  : 'bg-secondary-700 text-secondary-400'
              }`}>
                {index < currentStep ? '✓' : index + 1}
              </div>
              {index < FORM_STEPS.length - 1 && (
                <div className={`flex-1 h-1 mx-2 ${
                  index < currentStep ? 'bg-volt-500' : 'bg-secondary-700'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6">
        <div className="mb-8">
          <h3 className="text-xl font-bold text-volt-400 mb-2">
            {currentStepData.title}
          </h3>
          <p className="text-secondary-400">
            {currentStepData.description}
          </p>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          {currentStepData.fields.map(field => renderField(field))}
        </div>

        {/* Special Review Section */}
        {currentStep === FORM_STEPS.length - 1 && (
          <div className="mt-8 p-6 bg-secondary-900/30 rounded-lg">
            <h4 className="text-lg font-bold text-white mb-4">Submission Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-secondary-400">Business Name:</span>
                <div className="text-white font-medium">{formData.businessName}</div>
              </div>
              <div>
                <span className="text-secondary-400">Website:</span>
                <div className="text-white font-medium">{formData.businessWebsite}</div>
              </div>
              <div>
                <span className="text-secondary-400">Email:</span>
                <div className="text-white font-medium">{formData.contactEmail}</div>
              </div>
              <div>
                <span className="text-secondary-400">Selected Directories:</span>
                <div className="text-volt-400 font-medium">{selectedDirectories.length} directories</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Form Navigation */}
      <div className="flex items-center justify-between p-6 bg-secondary-900/30 border-t border-secondary-700">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 0}
          className="px-6 py-3 text-secondary-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous
        </button>

        <div className="flex items-center gap-3">
          {onSave && (
            <button
              onClick={() => onSave(formData)}
              className="px-4 py-3 text-secondary-300 hover:text-white transition-colors"
            >
              Save Draft
            </button>
          )}
          
          {currentStep < FORM_STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold rounded-lg hover:from-volt-400 hover:to-volt-500 transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:from-green-500 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </div>
              ) : (
                'Submit to Directories'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}