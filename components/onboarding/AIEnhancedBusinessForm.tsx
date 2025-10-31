// 🤖 AI-ENHANCED BUSINESS INFORMATION FORM
// Smart form with AI-powered suggestions and optimization

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

interface BusinessFormData {
  // Basic Information
  firstName: string
  lastName: string
  businessName: string
  email: string
  phone: string
  website: string
  
  // Enhanced AI Fields
  industry: string
  businessCategory: string
  businessModel: string
  targetAudience: string[]
  geographicTargets: string[]
  competitorFocus: string[]
  
  // Business Details
  description: string
  keyServices: string[]
  uniqueSellingProposition: string
  foundingYear: number | null
  employeeCount: string
  annualRevenue: string
  
  // Marketing & Goals
  currentMarketingChannels: string[]
  marketingBudget: string
  primaryGoals: string[]
  successMetrics: string[]
  
  // AI Preferences
  analysisPreferences: string[]
  priorityAreas: string[]
  competitiveAnalysisFocus: string[]
  
  // Contact & Location
  address: string
  city: string
  state: string
  zip: string
  country: string
  
  // Social Media
  facebook: string
  instagram: string
  linkedin: string
  twitter: string
  
  // File Upload
  logo: File | null
}

interface AIEnhancedBusinessFormProps {
  sessionId: string
  packageType: string
  analysisResults?: any // Pre-fill from analysis
  onSubmit: (formData: BusinessFormData) => Promise<void>
  loading: boolean
  error: string
}

export default function AIEnhancedBusinessForm({
  sessionId,
  packageType,
  analysisResults,
  onSubmit,
  loading,
  error
}: AIEnhancedBusinessFormProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<BusinessFormData>({
    firstName: '',
    lastName: '',
    businessName: '',
    email: '',
    phone: '',
    website: '',
    industry: '',
    businessCategory: '',
    businessModel: '',
    targetAudience: [],
    geographicTargets: [],
    competitorFocus: [],
    description: '',
    keyServices: [],
    uniqueSellingProposition: '',
    foundingYear: null,
    employeeCount: '',
    annualRevenue: '',
    currentMarketingChannels: [],
    marketingBudget: '',
    primaryGoals: [],
    successMetrics: [],
    analysisPreferences: [],
    priorityAreas: [],
    competitiveAnalysisFocus: [],
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
    facebook: '',
    instagram: '',
    linkedin: '',
    twitter: '',
    logo: null
  })
  
  const [aiSuggestions, setAiSuggestions] = useState<any>({})
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Pre-fill form with analysis results
  useEffect(() => {
    if (analysisResults?.aiAnalysis?.businessProfile) {
      const profile = analysisResults.aiAnalysis.businessProfile
      setFormData(prev => ({
        ...prev,
        businessName: profile.name || prev.businessName,
        website: profile.website || prev.website,
        industry: profile.industry || prev.industry,
        businessCategory: profile.category || prev.businessCategory,
        businessModel: profile.businessModel || prev.businessModel,
        description: profile.description || prev.description,
        targetAudience: profile.targetAudience || prev.targetAudience,
        uniqueSellingProposition: profile.uniqueSellingProposition || prev.uniqueSellingProposition,
        foundingYear: profile.foundingYear || prev.foundingYear,
        employeeCount: profile.employeeCount || prev.employeeCount
      }))
    }
  }, [analysisResults])

  // Generate AI suggestions based on current form data
  const generateAISuggestions = async (field: string, context: any) => {
    if (!formData.businessName || !formData.industry) return
    
    setIsGeneratingSuggestions(true)
    try {
      const response = await fetch('/api/ai-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field,
          context: {
            businessName: formData.businessName,
            industry: formData.industry,
            businessCategory: formData.businessCategory,
            businessModel: formData.businessModel,
            ...context
          }
        })
      })
      
      if (response.ok) {
        const suggestions = await response.json()
        setAiSuggestions((prev: any) => ({ ...prev, [field]: suggestions }))
      }
    } catch (error) {
      console.error('Failed to generate AI suggestions:', error)
    } finally {
      setIsGeneratingSuggestions(false)
    }
  }

  // Handle form field changes
  const handleFieldChange = (field: keyof BusinessFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
    
    // Generate AI suggestions for certain fields
    if (['description', 'uniqueSellingProposition', 'keyServices'].includes(field)) {
      setTimeout(() => generateAISuggestions(field, { currentValue: value }), 1000)
    }
  }

  // Handle array field changes
  const handleArrayFieldChange = (field: keyof BusinessFormData, value: string, action: 'add' | 'remove') => {
    setFormData(prev => {
      const currentArray = prev[field] as string[]
      if (action === 'add' && !currentArray.includes(value)) {
        return { ...prev, [field]: [...currentArray, value] }
      } else if (action === 'remove') {
        return { ...prev, [field]: currentArray.filter(item => item !== value) }
      }
      return prev
    })
  }

  // Validate current step
  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {}
    
    switch (step) {
      case 1: // Basic Information
        if (!formData.firstName.trim()) errors.firstName = 'First name is required'
        if (!formData.lastName.trim()) errors.lastName = 'Last name is required'
        if (!formData.email.trim()) errors.email = 'Email is required'
        if (!formData.businessName.trim()) errors.businessName = 'Business name is required'
        if (!formData.website.trim()) errors.website = 'Website is required'
        break
        
      case 2: // Business Profile
        if (!formData.industry.trim()) errors.industry = 'Industry is required'
        if (!formData.businessCategory.trim()) errors.businessCategory = 'Business category is required'
        if (!formData.description.trim()) errors.description = 'Business description is required'
        break
        
      case 3: // AI Preferences
        if (formData.primaryGoals.length === 0) errors.primaryGoals = 'Select at least one primary goal'
        if (formData.analysisPreferences.length === 0) errors.analysisPreferences = 'Select at least one analysis preference'
        break
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle step navigation
  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (validateStep(currentStep)) {
      await onSubmit(formData)
    }
  }

  const steps = [
    { number: 1, title: 'Basic Information', description: 'Contact details and business basics' },
    { number: 2, title: 'Business Profile', description: 'Industry, category, and description' },
    { number: 3, title: 'AI Preferences', description: 'Analysis focus and goals' },
    { number: 4, title: 'Additional Details', description: 'Location, social media, and final details' }
  ]

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                currentStep >= step.number
                  ? 'bg-volt-500 text-secondary-900'
                  : 'bg-secondary-700 text-secondary-300'
              }`}>
                {currentStep > step.number ? '✓' : step.number}
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-4 ${
                  currentStep > step.number ? 'bg-volt-500' : 'bg-secondary-700'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-white">{steps[currentStep - 1].title}</h3>
          <p className="text-secondary-300">{steps[currentStep - 1].description}</p>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleFieldChange('firstName', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-700 border rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500 ${
                    validationErrors.firstName ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="Enter your first name"
                />
                {validationErrors.firstName && (
                  <p className="mt-1 text-sm text-danger-400">{validationErrors.firstName}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleFieldChange('lastName', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-700 border rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500 ${
                    validationErrors.lastName ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="Enter your last name"
                />
                {validationErrors.lastName && (
                  <p className="mt-1 text-sm text-danger-400">{validationErrors.lastName}</p>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Business Name *
              </label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => handleFieldChange('businessName', e.target.value)}
                className={`w-full px-4 py-3 bg-secondary-700 border rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500 ${
                  validationErrors.businessName ? 'border-danger-500' : 'border-secondary-600'
                }`}
                placeholder="Enter your business name"
              />
              {validationErrors.businessName && (
                <p className="mt-1 text-sm text-danger-400">{validationErrors.businessName}</p>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-700 border rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500 ${
                    validationErrors.email ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="your@email.com"
                />
                {validationErrors.email && (
                  <p className="mt-1 text-sm text-danger-400">{validationErrors.email}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                  className="w-full px-4 py-3 bg-secondary-700 border border-secondary-600 rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Website URL *
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => handleFieldChange('website', e.target.value)}
                className={`w-full px-4 py-3 bg-secondary-700 border rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500 ${
                  validationErrors.website ? 'border-danger-500' : 'border-secondary-600'
                }`}
                placeholder="https://yourwebsite.com"
              />
              {validationErrors.website && (
                <p className="mt-1 text-sm text-danger-400">{validationErrors.website}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Business Profile */}
        {currentStep === 2 && (
          <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  Industry *
                </label>
                <select
                  value={formData.industry}
                  onChange={(e) => handleFieldChange('industry', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-700 border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-volt-500 ${
                    validationErrors.industry ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                >
                  <option value="">Select Industry</option>
                  <option value="Technology">Technology</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Finance">Finance</option>
                  <option value="Retail">Retail</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Education">Education</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="Professional Services">Professional Services</option>
                  <option value="Food & Beverage">Food & Beverage</option>
                  <option value="Other">Other</option>
                </select>
                {validationErrors.industry && (
                  <p className="mt-1 text-sm text-danger-400">{validationErrors.industry}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  Business Category *
                </label>
                <select
                  value={formData.businessCategory}
                  onChange={(e) => handleFieldChange('businessCategory', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-700 border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-volt-500 ${
                    validationErrors.businessCategory ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                >
                  <option value="">Select Category</option>
                  <option value="B2B">B2B (Business to Business)</option>
                  <option value="B2C">B2C (Business to Consumer)</option>
                  <option value="B2B2C">B2B2C (Business to Business to Consumer)</option>
                  <option value="Marketplace">Marketplace</option>
                  <option value="SaaS">SaaS (Software as a Service)</option>
                  <option value="E-commerce">E-commerce</option>
                  <option value="Service">Service Business</option>
                  <option value="Local">Local Business</option>
                </select>
                {validationErrors.businessCategory && (
                  <p className="mt-1 text-sm text-danger-400">{validationErrors.businessCategory}</p>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Business Description *
                <span className="text-xs text-volt-400 ml-2">
                  {isGeneratingSuggestions ? '🤖 Generating AI suggestions...' : '🤖 AI-enhanced'}
                </span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                rows={4}
                className={`w-full px-4 py-3 bg-secondary-700 border rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500 resize-none ${
                  validationErrors.description ? 'border-danger-500' : 'border-secondary-600'
                }`}
                placeholder="Describe what your business does, who you serve, and what makes you unique..."
              />
              {validationErrors.description && (
                <p className="mt-1 text-sm text-danger-400">{validationErrors.description}</p>
              )}
              
              {/* AI Suggestions for Description */}
              {aiSuggestions.description && (
                <div className="mt-3 p-3 bg-volt-500/10 border border-volt-500/30 rounded-lg">
                  <h4 className="text-sm font-semibold text-volt-400 mb-2">🤖 AI Suggestions:</h4>
                  <div className="space-y-2">
                    {aiSuggestions.description.map((suggestion: string, index: number) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleFieldChange('description', suggestion)}
                        className="block w-full text-left text-sm text-secondary-200 hover:text-white p-2 rounded hover:bg-volt-500/20 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: AI Preferences */}
        {currentStep === 3 && (
          <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-3">
                Primary Business Goals * <span className="text-xs text-volt-400">(Select all that apply)</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  'Increase online visibility',
                  'Generate more leads',
                  'Improve SEO rankings',
                  'Build brand awareness',
                  'Expand market reach',
                  'Competitive analysis',
                  'Local market dominance',
                  'Revenue growth'
                ].map((goal) => (
                  <label key={goal} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.primaryGoals.includes(goal)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleArrayFieldChange('primaryGoals', goal, 'add')
                        } else {
                          handleArrayFieldChange('primaryGoals', goal, 'remove')
                        }
                      }}
                      className="w-4 h-4 text-volt-500 bg-secondary-700 border-secondary-600 rounded focus:ring-volt-500"
                    />
                    <span className="text-secondary-200">{goal}</span>
                  </label>
                ))}
              </div>
              {validationErrors.primaryGoals && (
                <p className="mt-1 text-sm text-danger-400">{validationErrors.primaryGoals}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-3">
                AI Analysis Preferences * <span className="text-xs text-volt-400">(Select areas of focus)</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  'Competitive intelligence',
                  'Market opportunity analysis',
                  'SEO optimization',
                  'Content strategy',
                  'Directory optimization',
                  'Revenue projections',
                  'Risk assessment',
                  'Growth recommendations'
                ].map((preference) => (
                  <label key={preference} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.analysisPreferences.includes(preference)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleArrayFieldChange('analysisPreferences', preference, 'add')
                        } else {
                          handleArrayFieldChange('analysisPreferences', preference, 'remove')
                        }
                      }}
                      className="w-4 h-4 text-volt-500 bg-secondary-700 border-secondary-600 rounded focus:ring-volt-500"
                    />
                    <span className="text-secondary-200">{preference}</span>
                  </label>
                ))}
              </div>
              {validationErrors.analysisPreferences && (
                <p className="mt-1 text-sm text-danger-400">{validationErrors.analysisPreferences}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Additional Details */}
        {currentStep === 4 && (
          <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleFieldChange('city', e.target.value)}
                  className="w-full px-4 py-3 bg-secondary-700 border border-secondary-600 rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500"
                  placeholder="Enter city"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  State/Province
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleFieldChange('state', e.target.value)}
                  className="w-full px-4 py-3 bg-secondary-700 border border-secondary-600 rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500"
                  placeholder="Enter state/province"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-3">
                Social Media Profiles <span className="text-xs text-secondary-400">(Optional)</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="url"
                  value={formData.facebook}
                  onChange={(e) => handleFieldChange('facebook', e.target.value)}
                  className="w-full px-4 py-3 bg-secondary-700 border border-secondary-600 rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500"
                  placeholder="Facebook URL"
                />
                <input
                  type="url"
                  value={formData.linkedin}
                  onChange={(e) => handleFieldChange('linkedin', e.target.value)}
                  className="w-full px-4 py-3 bg-secondary-700 border border-secondary-600 rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500"
                  placeholder="LinkedIn URL"
                />
                <input
                  type="url"
                  value={formData.instagram}
                  onChange={(e) => handleFieldChange('instagram', e.target.value)}
                  className="w-full px-4 py-3 bg-secondary-700 border border-secondary-600 rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500"
                  placeholder="Instagram URL"
                />
                <input
                  type="url"
                  value={formData.twitter}
                  onChange={(e) => handleFieldChange('twitter', e.target.value)}
                  className="w-full px-4 py-3 bg-secondary-700 border border-secondary-600 rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-500"
                  placeholder="Twitter URL"
                />
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/30 rounded-xl p-4">
            <p className="text-danger-400 font-medium">{error}</p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-6">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="px-6 py-3 border-2 border-secondary-600 text-secondary-300 font-semibold rounded-xl hover:bg-secondary-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          
          <div className="text-center">
            <span className="text-secondary-400 text-sm">
              Step {currentStep} of {steps.length}
            </span>
          </div>
          
          {currentStep < steps.length ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-6 py-3 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300"
            >
              Next →
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-success-500 to-success-600 text-white font-bold rounded-xl hover:from-success-400 hover:to-success-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  🚀 Complete Setup
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}