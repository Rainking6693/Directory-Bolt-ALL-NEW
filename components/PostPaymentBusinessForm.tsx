'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Transition } from '@headlessui/react'
import Image from 'next/image'

interface BusinessFormData {
  firstName: string
  lastName: string
  businessName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  website: string
  description: string
  facebook: string
  instagram: string
  linkedin: string
  logo: File | null
}

interface PostPaymentBusinessFormProps {
  sessionId?: string
  packageType?: string
  onSubmit: (data: BusinessFormData) => Promise<void>
  loading?: boolean
  error?: string
  className?: string
}

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' }
]

export default function PostPaymentBusinessForm({
  sessionId,
  packageType,
  onSubmit,
  loading = false,
  error,
  className = ''
}: PostPaymentBusinessFormProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<BusinessFormData>({
    firstName: '',
    lastName: '',
    businessName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    website: '',
    description: '',
    facebook: '',
    instagram: '',
    linkedin: '',
    logo: null
  })
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({})
  const [isVisible, setIsVisible] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  
  const totalSteps = 3
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  const validateStep = (step: number): boolean => {
    const errors: {[key: string]: string} = {}

    if (step === 1) {
      // Personal & Business Information
      if (!formData.firstName.trim()) errors.firstName = 'First name is required'
      if (!formData.lastName.trim()) errors.lastName = 'Last name is required'
      if (!formData.businessName.trim()) errors.businessName = 'Business name is required'
      if (!formData.email.trim()) {
        errors.email = 'Email is required'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = 'Please enter a valid email address'
      }
      if (!formData.phone.trim()) {
        errors.phone = 'Phone number is required'
      } else {
        // Clean phone number for validation (remove formatting)
        const cleanPhone = formData.phone.replace(/[\s\(\)\-\.]/g, '')
        // Allow more flexible phone number formats
        if (!/^[\+]?[0-9]{7,15}$/.test(cleanPhone)) {
          errors.phone = 'Please enter a valid phone number'
        }
      }
      if (!formData.website.trim()) {
        errors.website = 'Business website is required'
      } else if (!/^https?:\/\/.+/.test(formData.website)) {
        errors.website = 'Please enter a valid website URL (including http:// or https://)'
      }
    }

    if (step === 2) {
      // Location Information
      if (!formData.address.trim()) errors.address = 'Business address is required'
      if (!formData.city.trim()) errors.city = 'City is required'
      if (!formData.state.trim()) errors.state = 'State is required'
      if (!formData.zip.trim()) {
        errors.zip = 'ZIP code is required'
      } else if (!/^\d{5}(-\d{4})?$/.test(formData.zip)) {
        errors.zip = 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)'
      }
      if (!formData.description.trim()) {
        errors.description = 'Business description is required'
      } else if (formData.description.length < 50) {
        errors.description = 'Please provide at least 50 characters describing your business'
      }
    }

    if (step === 3) {
      // Social Media & Logo (all optional, but validate format if provided)
      if (formData.facebook && !formData.facebook.match(/^https?:\/\/(www\.)?(facebook|fb)\.com\/.+/)) {
        errors.facebook = 'Please enter a valid Facebook URL'
      }
      if (formData.instagram && !formData.instagram.match(/^https?:\/\/(www\.)?instagram\.com\/.+/)) {
        errors.instagram = 'Please enter a valid Instagram URL'
      }
      if (formData.linkedin && !formData.linkedin.match(/^https?:\/\/(www\.)?linkedin\.com\/.+/)) {
        errors.linkedin = 'Please enter a valid LinkedIn URL'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (field: keyof BusinessFormData, value: string | File | null) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setFormErrors(prev => ({ ...prev, logo: 'File size must be less than 5MB' }))
        return
      }
      
      // Validate file type
      if (!file.type.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
        setFormErrors(prev => ({ ...prev, logo: 'Please upload a valid image file (JPEG, PNG, GIF, or WebP)' }))
        return
      }

      handleInputChange('logo', file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (validateStep(currentStep)) {
      await onSubmit(formData)
    }
  }

  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Header */}
      <div className="mb-8 bg-secondary-800/50 p-6 rounded-xl border border-secondary-600">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Complete Your Business Profile
          </h1>
          <p className="text-secondary-300">
            We need some additional information to optimize your directory submissions
          </p>
          {packageType && (
            <div className="mt-4 inline-flex items-center px-4 py-2 bg-volt-500/20 border border-volt-500/30 rounded-full">
              <span className="text-volt-400 font-semibold">{packageType} Package</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="w-full bg-secondary-700 rounded-full h-3 mb-4">
            <div 
              className="bg-gradient-to-r from-volt-500 to-volt-600 h-3 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          
          {/* Step Indicators */}
          <div className="flex justify-between text-xs">
            <div className={`text-center ${currentStep >= 1 ? 'text-volt-400' : 'text-secondary-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 ${
                currentStep >= 1 ? 'bg-volt-500 text-secondary-900' : 'bg-secondary-600 text-secondary-400'
              }`}>
                1
              </div>
              <span className="font-medium">Basic Info</span>
            </div>
            <div className={`text-center ${currentStep >= 2 ? 'text-volt-400' : 'text-secondary-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 ${
                currentStep >= 2 ? 'bg-volt-500 text-secondary-900' : 'bg-secondary-600 text-secondary-400'
              }`}>
                2
              </div>
              <span className="font-medium">Location & Details</span>
            </div>
            <div className={`text-center ${currentStep >= 3 ? 'text-volt-400' : 'text-secondary-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 ${
                currentStep >= 3 ? 'bg-volt-500 text-secondary-900' : 'bg-secondary-600 text-secondary-400'
              }`}>
                3
              </div>
              <span className="font-medium">Social & Branding</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-danger-900/20 border border-danger-500/30 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-danger-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-danger-400">{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Step 1: Personal & Business Information */}
        <Transition
          show={currentStep === 1}
          enter="transition-all duration-500"
          enterFrom="opacity-0 translate-x-8"
          enterTo="opacity-100 translate-x-0"
          leave="transition-all duration-300"
          leaveFrom="opacity-100 translate-x-0"
          leaveTo="opacity-0 -translate-x-8"
        >
          <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="bg-secondary-800/50 p-6 rounded-xl border border-secondary-600">
            <h3 className="text-xl font-semibold text-volt-400 mb-6">Personal & Business Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Name */}
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-secondary-300 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.firstName ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="Enter your first name"
                />
                {formErrors.firstName && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.firstName}</p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-secondary-300 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.lastName ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="Enter your last name"
                />
                {formErrors.lastName && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.lastName}</p>
                )}
              </div>

              {/* Business Name */}
              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-secondary-300 mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.businessName ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="Your business name"
                />
                {formErrors.businessName && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.businessName}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-secondary-300 mb-2">
                  Business Email *
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.email ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="contact@yourbusiness.com"
                />
                {formErrors.email && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.email}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-secondary-300 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.phone ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="+1 (555) 123-4567"
                />
                {formErrors.phone && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.phone}</p>
                )}
              </div>

              {/* Website */}
              <div>
                <label htmlFor="website" className="block text-sm font-medium text-secondary-300 mb-2">
                  Business Website *
                </label>
                <input
                  type="url"
                  id="website"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.website ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="https://www.yourbusiness.com"
                />
                {formErrors.website && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.website}</p>
                )}
              </div>
            </div>
          </form>
        </Transition>

        {/* Step 2: Location & Description */}
        <Transition
          show={currentStep === 2}
          enter="transition-all duration-500"
          enterFrom="opacity-0 translate-x-8"
          enterTo="opacity-100 translate-x-0"
          leave="transition-all duration-300"
          leaveFrom="opacity-100 translate-x-0"
          leaveTo="opacity-0 -translate-x-8"
        >
          <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="bg-secondary-800/50 p-6 rounded-xl border border-secondary-600">
            <h3 className="text-xl font-semibold text-volt-400 mb-6">Location & Business Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Address */}
              <div className="md:col-span-2">
                <label htmlFor="address" className="block text-sm font-medium text-secondary-300 mb-2">
                  Business Address *
                </label>
                <input
                  type="text"
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.address ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="123 Business St"
                />
                {formErrors.address && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.address}</p>
                )}
              </div>

              {/* City */}
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-secondary-300 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.city ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="New York"
                />
                {formErrors.city && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.city}</p>
                )}
              </div>

              {/* State */}
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-secondary-300 mb-2">
                  State *
                </label>
                <select
                  id="state"
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.state ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                >
                  <option value="">Select a state</option>
                  {US_STATES.map((state) => (
                    <option key={state.value} value={state.value}>
                      {state.label}
                    </option>
                  ))}
                </select>
                {formErrors.state && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.state}</p>
                )}
              </div>

              {/* ZIP Code */}
              <div className="md:col-span-2">
                <label htmlFor="zip" className="block text-sm font-medium text-secondary-300 mb-2">
                  ZIP Code *
                </label>
                <input
                  type="text"
                  id="zip"
                  value={formData.zip}
                  onChange={(e) => handleInputChange('zip', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.zip ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="12345"
                />
                {formErrors.zip && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.zip}</p>
                )}
              </div>
            </div>

            {/* Business Description */}
            <div className="mt-6">
              <label htmlFor="description" className="block text-sm font-medium text-secondary-300 mb-2">
                Business Description *
              </label>
              <textarea
                id="description"
                rows={4}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all resize-none ${
                  formErrors.description ? 'border-danger-500' : 'border-secondary-600'
                }`}
                placeholder="Describe your business, services, and target market (minimum 50 characters)"
              />
              <div className="flex justify-between items-center mt-1">
                {formErrors.description ? (
                  <p className="text-sm text-danger-400">{formErrors.description}</p>
                ) : (
                  <p className="text-sm text-secondary-400">
                    {formData.description.length < 50 
                      ? `${50 - formData.description.length} characters remaining`
                      : 'Good to go!'
                    }
                  </p>
                )}
                <span className="text-xs text-secondary-500">
                  {formData.description.length}/1000
                </span>
              </div>
            </div>
          </form>
        </Transition>

        {/* Step 3: Social Media & Branding */}
        <Transition
          show={currentStep === 3}
          enter="transition-all duration-500"
          enterFrom="opacity-0 translate-x-8"
          enterTo="opacity-100 translate-x-0"
          leave="transition-all duration-300"
          leaveFrom="opacity-100 translate-x-0"
          leaveTo="opacity-0 -translate-x-8"
        >
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="bg-secondary-800/50 p-6 rounded-xl border border-secondary-600">
            <h3 className="text-xl font-semibold text-volt-400 mb-2">Social Media & Branding</h3>
            <p className="text-secondary-300 mb-6 text-sm">
              Optional: Provide your social media profiles and logo to enhance your directory listings
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Facebook */}
              <div>
                <label htmlFor="facebook" className="block text-sm font-medium text-secondary-300 mb-2">
                  Facebook Profile <span className="text-secondary-500">(Optional)</span>
                </label>
                <input
                  type="url"
                  id="facebook"
                  value={formData.facebook}
                  onChange={(e) => handleInputChange('facebook', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.facebook ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="https://facebook.com/yourbusiness"
                />
                {formErrors.facebook && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.facebook}</p>
                )}
              </div>

              {/* Instagram */}
              <div>
                <label htmlFor="instagram" className="block text-sm font-medium text-secondary-300 mb-2">
                  Instagram Profile <span className="text-secondary-500">(Optional)</span>
                </label>
                <input
                  type="url"
                  id="instagram"
                  value={formData.instagram}
                  onChange={(e) => handleInputChange('instagram', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.instagram ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="https://instagram.com/yourbusiness"
                />
                {formErrors.instagram && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.instagram}</p>
                )}
              </div>

              {/* LinkedIn */}
              <div className="md:col-span-2">
                <label htmlFor="linkedin" className="block text-sm font-medium text-secondary-300 mb-2">
                  LinkedIn Profile <span className="text-secondary-500">(Optional)</span>
                </label>
                <input
                  type="url"
                  id="linkedin"
                  value={formData.linkedin}
                  onChange={(e) => handleInputChange('linkedin', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.linkedin ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="https://linkedin.com/company/yourbusiness"
                />
                {formErrors.linkedin && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.linkedin}</p>
                )}
              </div>
            </div>

            {/* Logo Upload */}
            <div className="mt-6">
              <label htmlFor="logo" className="block text-sm font-medium text-secondary-300 mb-2">
                Business Logo <span className="text-secondary-500">(Optional)</span>
              </label>
              <div className="flex items-center space-x-6">
                <div className="flex-shrink-0">
                  {logoPreview ? (
                    <div className="relative">
                      <Image 
                        src={logoPreview} 
                        alt="Logo preview" 
                        width={80}
                        height={80}
                        className="w-20 h-20 object-cover rounded-lg border border-secondary-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setLogoPreview(null)
                          handleInputChange('logo', null)
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-danger-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-danger-600"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 border-2 border-dashed border-secondary-600 rounded-lg flex items-center justify-center">
                      <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    id="logo"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="logo"
                    className="cursor-pointer inline-flex items-center px-4 py-2 border border-secondary-600 text-secondary-300 rounded-lg hover:border-volt-500 hover:text-volt-400 transition-all"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload Logo
                  </label>
                  <p className="text-xs text-secondary-500 mt-1">
                    PNG, JPG, GIF or WebP. Max 5MB.
                  </p>
                </div>
              </div>
              {formErrors.logo && (
                <p className="mt-1 text-sm text-danger-400">{formErrors.logo}</p>
              )}
            </div>
          </form>
        </Transition>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-6">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="px-6 py-3 border border-secondary-600 text-secondary-300 rounded-lg hover:border-secondary-500 hover:text-white transition-all"
            >
              ← Previous
            </button>
          ) : (
            <div></div>
          )}

          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-8 py-3 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all transform hover:scale-105"
            >
              Next Step →
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all transform hover:scale-105 disabled:opacity-75 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-secondary-900 border-t-transparent mr-2"></div>
                  Saving Information...
                </>
              ) : (
                'Complete Setup 🚀'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}