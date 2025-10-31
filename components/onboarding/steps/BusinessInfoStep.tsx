'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { OnboardingStepProps } from '../OnboardingFlow'

interface BusinessInfo {
  businessName: string
  website: string
  industry: string
  description: string
  location: string
  phoneNumber: string
  targetAudience: string
}

const INDUSTRY_OPTIONS = [
  'Technology',
  'Healthcare',
  'Retail',
  'Professional Services',
  'Real Estate',
  'Food & Beverage',
  'Automotive',
  'Construction',
  'Education',
  'Finance',
  'Legal',
  'Marketing',
  'Non-profit',
  'Other'
]

export default function BusinessInfoStep({
  onNext,
  data,
  updateData
}: OnboardingStepProps) {
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    businessName: data.businessName || '',
    website: data.website || '',
    industry: data.industry || '',
    description: data.description || '',
    location: data.location || '',
    phoneNumber: data.phoneNumber || '',
    targetAudience: data.targetAudience || ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Update parent data when local state changes
  useEffect(() => {
    Object.entries(businessInfo).forEach(([key, value]) => {
      updateData(key, value)
    })
  }, [businessInfo, updateData])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!businessInfo.businessName.trim()) {
      newErrors.businessName = 'Business name is required'
    }

    if (!businessInfo.website.trim()) {
      newErrors.website = 'Website URL is required'
    } else if (!/^https?:\/\/.+/i.test(businessInfo.website)) {
      newErrors.website = 'Please enter a valid website URL (including http:// or https://)'
    }

    if (!businessInfo.industry) {
      newErrors.industry = 'Please select your industry'
    }

    if (!businessInfo.description.trim()) {
      newErrors.description = 'Business description is required'
    } else if (businessInfo.description.length < 20) {
      newErrors.description = 'Please provide a more detailed description (at least 20 characters)'
    }

    if (!businessInfo.location.trim()) {
      newErrors.location = 'Location is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof BusinessInfo, value: string) => {
    setBusinessInfo(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = () => {
    if (validateForm()) {
      onNext()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <div className="bg-secondary-800 rounded-2xl border border-secondary-700 p-8">
        <div className="mb-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-2">
            Tell us about your business
          </h3>
          <p className="text-secondary-400">
            This information helps us find the most relevant directories and optimize your listings
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Business Name */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-white mb-2">
              Business Name *
            </label>
            <input
              type="text"
              value={businessInfo.businessName}
              onChange={(e) => handleInputChange('businessName', e.target.value)}
              placeholder="e.g., Acme Digital Solutions"
              className={`w-full px-4 py-3 rounded-lg bg-secondary-700 border text-white placeholder-secondary-400 focus:outline-none focus:ring-2 transition-colors ${
                errors.businessName 
                  ? 'border-red-500 focus:ring-red-500/50' 
                  : 'border-secondary-600 focus:ring-volt-500/50'
              }`}
            />
            {errors.businessName && (
              <p className="text-red-400 text-sm mt-1">{errors.businessName}</p>
            )}
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Website URL *
            </label>
            <input
              type="url"
              value={businessInfo.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
              placeholder="https://yourwebsite.com"
              className={`w-full px-4 py-3 rounded-lg bg-secondary-700 border text-white placeholder-secondary-400 focus:outline-none focus:ring-2 transition-colors ${
                errors.website 
                  ? 'border-red-500 focus:ring-red-500/50' 
                  : 'border-secondary-600 focus:ring-volt-500/50'
              }`}
            />
            {errors.website && (
              <p className="text-red-400 text-sm mt-1">{errors.website}</p>
            )}
          </div>

          {/* Industry */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Industry *
            </label>
            <select
              value={businessInfo.industry}
              onChange={(e) => handleInputChange('industry', e.target.value)}
              className={`w-full px-4 py-3 rounded-lg bg-secondary-700 border text-white focus:outline-none focus:ring-2 transition-colors ${
                errors.industry 
                  ? 'border-red-500 focus:ring-red-500/50' 
                  : 'border-secondary-600 focus:ring-volt-500/50'
              }`}
            >
              <option value="">Select your industry</option>
              {INDUSTRY_OPTIONS.map(industry => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
            {errors.industry && (
              <p className="text-red-400 text-sm mt-1">{errors.industry}</p>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Primary Location *
            </label>
            <input
              type="text"
              value={businessInfo.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="e.g., San Francisco, CA"
              className={`w-full px-4 py-3 rounded-lg bg-secondary-700 border text-white placeholder-secondary-400 focus:outline-none focus:ring-2 transition-colors ${
                errors.location 
                  ? 'border-red-500 focus:ring-red-500/50' 
                  : 'border-secondary-600 focus:ring-volt-500/50'
              }`}
            />
            {errors.location && (
              <p className="text-red-400 text-sm mt-1">{errors.location}</p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={businessInfo.phoneNumber}
              onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full px-4 py-3 rounded-lg bg-secondary-700 border border-secondary-600 text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500/50 transition-colors"
            />
          </div>

          {/* Business Description */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-white mb-2">
              Business Description *
            </label>
            <textarea
              value={businessInfo.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              placeholder="Describe what your business does, your services, and what makes you unique..."
              className={`w-full px-4 py-3 rounded-lg bg-secondary-700 border text-white placeholder-secondary-400 focus:outline-none focus:ring-2 transition-colors resize-none ${
                errors.description 
                  ? 'border-red-500 focus:ring-red-500/50' 
                  : 'border-secondary-600 focus:ring-volt-500/50'
              }`}
            />
            {errors.description && (
              <p className="text-red-400 text-sm mt-1">{errors.description}</p>
            )}
            <p className="text-secondary-400 text-xs mt-1">
              {businessInfo.description.length}/500 characters
            </p>
          </div>

          {/* Target Audience */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-white mb-2">
              Target Audience
            </label>
            <input
              type="text"
              value={businessInfo.targetAudience}
              onChange={(e) => handleInputChange('targetAudience', e.target.value)}
              placeholder="e.g., Small business owners, tech startups, local consumers"
              className="w-full px-4 py-3 rounded-lg bg-secondary-700 border border-secondary-600 text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500/50 transition-colors"
            />
            <p className="text-secondary-400 text-xs mt-1">
              Help us find directories where your ideal customers spend time
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={handleSubmit}
            className="bg-volt-500 hover:bg-volt-400 text-secondary-900 font-bold py-3 px-8 rounded-lg transition-colors flex items-center gap-2"
          >
            Continue →
          </button>
        </div>
      </div>
    </motion.div>
  )
}