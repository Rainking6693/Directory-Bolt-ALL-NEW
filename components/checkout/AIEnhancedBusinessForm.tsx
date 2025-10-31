'use client'
import { useState, useEffect } from 'react'
import { BusinessIntelligence } from '../../lib/services/ai-business-intelligence-engine'

interface AIAnalysisPreferences {
  competitiveAnalysis: {
    enabled: boolean
    focusAreas: string[]
    depth: 'basic' | 'detailed' | 'comprehensive'
  }
  targetMarket: {
    geographic: string[]
    demographic: string[]
    industryVerticals: string[]
  }
  industryCustomization: {
    industryType: string
    businessModel: 'b2b' | 'b2c' | 'both'
    companyStage: 'startup' | 'growth' | 'established' | 'enterprise'
  }
  directoryPreferences: {
    priorityRegions: string[]
    industrySpecificDirectories: boolean
    premiumDirectoriesOnly: boolean
    niche: boolean
  }
}

interface EnhancedBusinessInfo {
  // Core business information
  businessName: string
  website: string
  description: string
  email: string
  phone: string
  categories: string[]
  
  // Address information
  address: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  
  // Social media
  socialMedia: {
    facebook?: string
    twitter?: string
    linkedin?: string
    instagram?: string
  }
  
  // AI analysis preferences
  aiPreferences: AIAnalysisPreferences
  
  // Pre-populated AI insights
  aiSuggestions?: {
    optimizedDescription?: string
    suggestedCategories?: string[]
    keywordRecommendations?: string[]
    competitorInsights?: string[]
  }
}

interface AIEnhancedBusinessFormProps {
  onSubmit: (businessInfo: EnhancedBusinessInfo) => void
  onBack?: () => void
  initialWebsite?: string
  className?: string
}

const DEFAULT_PREFERENCES: AIAnalysisPreferences = {
  competitiveAnalysis: {
    enabled: true,
    focusAreas: ['pricing', 'services', 'market-positioning'],
    depth: 'detailed'
  },
  targetMarket: {
    geographic: ['United States'],
    demographic: [],
    industryVerticals: []
  },
  industryCustomization: {
    industryType: '',
    businessModel: 'both',
    companyStage: 'established'
  },
  directoryPreferences: {
    priorityRegions: ['United States'],
    industrySpecificDirectories: true,
    premiumDirectoriesOnly: false,
    niche: false
  }
}

const INDUSTRY_TYPES = [
  'Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing',
  'Real Estate', 'Food & Beverage', 'Professional Services',
  'Education', 'Entertainment', 'Non-Profit', 'Other'
]

const COMPETITIVE_FOCUS_AREAS = [
  'pricing', 'services', 'market-positioning', 'digital-presence',
  'customer-reviews', 'seo-strategy', 'social-media', 'content-marketing'
]

const GEOGRAPHIC_REGIONS = [
  'United States', 'Canada', 'United Kingdom', 'Australia',
  'Germany', 'France', 'Spain', 'Italy', 'Global'
]

export function AIEnhancedBusinessForm({
  onSubmit,
  onBack,
  initialWebsite = '',
  className = ''
}: AIEnhancedBusinessFormProps) {
  const [formData, setFormData] = useState<EnhancedBusinessInfo>({
    businessName: '',
    website: initialWebsite,
    description: '',
    email: '',
    phone: '',
    categories: [''],
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'USA'
    },
    socialMedia: {},
    aiPreferences: DEFAULT_PREFERENCES
  })
  
  const [currentTab, setCurrentTab] = useState<'basic' | 'contact' | 'ai-preferences' | 'review'>('basic')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [hasAIData, setHasAIData] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState<number>(0)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Auto-analyze website when URL is provided or changed
  useEffect(() => {
    if (formData.website && formData.website.match(/^https?:\/\/.+/)) {
      performAIAnalysis()
    }
  }, [formData.website])

  const performAIAnalysis = async () => {
    if (!formData.website) return
    
    setIsAnalyzing(true)
    setAnalysisProgress(0)
    
    try {
      // Use the existing AI Business Intelligence Engine
      const analysisResult = await BusinessIntelligence.analyze({
        url: formData.website,
        userInput: {
          businessGoals: formData.aiPreferences.competitiveAnalysis.focusAreas,
          industryFocus: formData.aiPreferences.targetMarket.industryVerticals
        }
      })
      
      if (analysisResult.success && analysisResult.data) {
        const intelligence = analysisResult.data
        
        // Pre-populate business information from AI analysis
        setFormData(prev => ({
          ...prev,
          businessName: intelligence.profile.name || prev.businessName,
          description: intelligence.profile.description || prev.description,
          categories: intelligence.profile.secondaryCategories.length > 0 
            ? intelligence.profile.secondaryCategories 
            : prev.categories,
          phone: intelligence.profile.contactInfo.phone || prev.phone,
          email: intelligence.profile.contactInfo.email || prev.email,
          address: {
            ...prev.address,
            street: intelligence.profile.contactInfo.address?.street || prev.address.street,
            city: intelligence.profile.contactInfo.address?.city || prev.address.city,
            state: intelligence.profile.contactInfo.address?.state || prev.address.state,
            zipCode: intelligence.profile.contactInfo.address?.postalCode || prev.address.zipCode,
          },
          socialMedia: {
            ...prev.socialMedia,
            facebook: intelligence.profile.socialPresence?.platforms.find(p => p.name === 'facebook')?.url || prev.socialMedia.facebook,
            twitter: intelligence.profile.socialPresence?.platforms.find(p => p.name === 'twitter')?.url || prev.socialMedia.twitter,
            linkedin: intelligence.profile.socialPresence?.platforms.find(p => p.name === 'linkedin')?.url || prev.socialMedia.linkedin,
            instagram: intelligence.profile.socialPresence?.platforms.find(p => p.name === 'instagram')?.url || prev.socialMedia.instagram,
          },
          aiSuggestions: {
            optimizedDescription: intelligence.marketPositioning?.messagingFramework?.coreMessage,
            suggestedCategories: intelligence.profile.secondaryCategories,
            keywordRecommendations: intelligence.seoAnalysis?.keywordAnalysis?.primaryKeywords?.map(k => k.term) || [],
            competitorInsights: intelligence.competitiveAnalysis?.directCompetitors?.map(c => c.name) || []
          }
        }))
        
        setHasAIData(true)
      }
    } catch (error) {
      console.error('AI analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
      setAnalysisProgress(100)
    }
  }

  const handleInputChange = (field: keyof EnhancedBusinessInfo, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleAddressChange = (field: keyof EnhancedBusinessInfo['address'], value: string) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }))
  }

  const handleSocialMediaChange = (platform: keyof EnhancedBusinessInfo['socialMedia'], value: string) => {
    setFormData(prev => ({
      ...prev,
      socialMedia: { ...prev.socialMedia, [platform]: value }
    }))
  }

  const handleAIPreferenceChange = (section: keyof AIAnalysisPreferences, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      aiPreferences: {
        ...prev.aiPreferences,
        [section]: {
          ...prev.aiPreferences[section],
          [field]: value
        }
      }
    }))
  }

  const handleCategoryChange = (index: number, value: string) => {
    setFormData(prev => {
      const newCategories = [...prev.categories]
      newCategories[index] = value
      return { ...prev, categories: newCategories }
    })
  }

  const addCategory = () => {
    setFormData(prev => ({
      ...prev,
      categories: [...prev.categories, '']
    }))
  }

  const removeCategory = (index: number) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index)
    }))
  }

  const applySuggestion = (type: 'description' | 'categories') => {
    if (!formData.aiSuggestions) return
    
    if (type === 'description' && formData.aiSuggestions.optimizedDescription) {
      setFormData(prev => ({
        ...prev,
        description: formData.aiSuggestions!.optimizedDescription!
      }))
    }
    
    if (type === 'categories' && formData.aiSuggestions.suggestedCategories) {
      setFormData(prev => ({
        ...prev,
        categories: formData.aiSuggestions!.suggestedCategories!
      }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required'
    }

    if (!formData.website.trim()) {
      newErrors.website = 'Website URL is required'
    } else if (!formData.website.match(/^https?:\/\/.+/)) {
      newErrors.website = 'Please enter a valid website URL'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (formData.categories.length === 0 || !formData.categories.some(cat => cat.trim())) {
      newErrors.categories = 'At least one category is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  const tabs = [
    { key: 'basic', label: 'Basic Info', icon: '🏢' },
    { key: 'contact', label: 'Contact', icon: '📞' },
    { key: 'ai-preferences', label: 'AI Analysis', icon: '🤖' },
    { key: 'review', label: 'Review', icon: '✅' }
  ]

  return (
    <div className={`bg-secondary-800 rounded-xl border border-secondary-700 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-secondary-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            🤖 AI-Enhanced Business Profile
          </h3>
          {hasAIData && (
            <span className="text-sm text-success-400 bg-success-500/20 px-3 py-1 rounded border border-success-500/30">
              AI Analysis Complete
            </span>
          )}
        </div>

        {/* AI Analysis Progress */}
        {isAnalyzing && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-secondary-300 mb-2">
              <span>Analyzing your website...</span>
              <span>{analysisProgress}%</span>
            </div>
            <div className="w-full bg-secondary-700 rounded-full h-2">
              <div 
                className="bg-volt-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <nav className="flex space-x-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCurrentTab(tab.key as typeof currentTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
                currentTab === tab.key
                  ? 'bg-volt-500/20 text-volt-400 border border-volt-500/30'
                  : 'text-secondary-400 hover:text-secondary-300 hover:bg-secondary-700/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {/* Basic Info Tab */}
        {currentTab === 'basic' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  className="input-field"
                  placeholder="Your business name"
                />
                {errors.businessName && (
                  <p className="text-danger-400 text-sm mt-1">{errors.businessName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  Website *
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className="input-field"
                  placeholder="https://yourwebsite.com"
                />
                {errors.website && (
                  <p className="text-danger-400 text-sm mt-1">{errors.website}</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-secondary-300">
                  Business Description
                </label>
                {formData.aiSuggestions?.optimizedDescription && (
                  <button
                    onClick={() => applySuggestion('description')}
                    className="text-xs text-volt-400 hover:text-volt-300 flex items-center gap-1"
                  >
                    🤖 Apply AI Suggestion
                  </button>
                )}
              </div>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="input-field h-32 resize-none"
                placeholder="Describe your business, services, and what makes you unique..."
              />
              {formData.aiSuggestions?.optimizedDescription && (
                <div className="mt-2 p-3 bg-volt-500/10 border border-volt-500/30 rounded-lg">
                  <p className="text-xs text-volt-400 mb-1">AI Suggested Description:</p>
                  <p className="text-sm text-secondary-300">{formData.aiSuggestions.optimizedDescription}</p>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-secondary-300">
                  Categories *
                </label>
                {formData.aiSuggestions?.suggestedCategories && (
                  <button
                    onClick={() => applySuggestion('categories')}
                    className="text-xs text-volt-400 hover:text-volt-300 flex items-center gap-1"
                  >
                    🤖 Apply AI Suggestions
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {formData.categories.map((category, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => handleCategoryChange(index, e.target.value)}
                      className="input-field flex-1"
                      placeholder="e.g. Restaurant, Technology, Healthcare"
                    />
                    <button
                      onClick={() => removeCategory(index)}
                      className="px-3 py-2 bg-danger-600 hover:bg-danger-500 text-white rounded-lg transition-colors"
                      title="Remove category"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={addCategory}
                  className="text-volt-400 hover:text-volt-300 text-sm flex items-center gap-1 transition-colors"
                >
                  + Add Category
                </button>
              </div>
              {formData.aiSuggestions?.suggestedCategories && (
                <div className="mt-2 p-3 bg-volt-500/10 border border-volt-500/30 rounded-lg">
                  <p className="text-xs text-volt-400 mb-1">AI Suggested Categories:</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.aiSuggestions.suggestedCategories.map((cat, idx) => (
                      <span key={idx} className="text-xs bg-secondary-700 px-2 py-1 rounded text-secondary-300">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {errors.categories && (
                <p className="text-danger-400 text-sm mt-1">{errors.categories}</p>
              )}
            </div>
          </div>
        )}

        {/* Contact Tab */}
        {currentTab === 'contact' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="input-field"
                  placeholder="contact@yourbusiness.com"
                />
                {errors.email && (
                  <p className="text-danger-400 text-sm mt-1">{errors.email}</p>
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
                  className="input-field"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            {/* Address Section */}
            <div>
              <h4 className="text-md font-semibold text-white mb-4">Address</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-300 mb-2">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={formData.address.street}
                    onChange={(e) => handleAddressChange('street', e.target.value)}
                    className="input-field"
                    placeholder="123 Main Street"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-300 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.address.city}
                      onChange={(e) => handleAddressChange('city', e.target.value)}
                      className="input-field"
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-300 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={formData.address.state}
                      onChange={(e) => handleAddressChange('state', e.target.value)}
                      className="input-field"
                      placeholder="State"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-300 mb-2">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={formData.address.zipCode}
                      onChange={(e) => handleAddressChange('zipCode', e.target.value)}
                      className="input-field"
                      placeholder="12345"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-300 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.address.country}
                      onChange={(e) => handleAddressChange('country', e.target.value)}
                      className="input-field"
                      placeholder="USA"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media Section */}
            <div>
              <h4 className="text-md font-semibold text-white mb-4">Social Media</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-300 mb-2">
                    Facebook
                  </label>
                  <input
                    type="url"
                    value={formData.socialMedia.facebook || ''}
                    onChange={(e) => handleSocialMediaChange('facebook', e.target.value)}
                    className="input-field"
                    placeholder="https://facebook.com/yourbusiness"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-300 mb-2">
                    Twitter
                  </label>
                  <input
                    type="url"
                    value={formData.socialMedia.twitter || ''}
                    onChange={(e) => handleSocialMediaChange('twitter', e.target.value)}
                    className="input-field"
                    placeholder="https://twitter.com/yourbusiness"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-300 mb-2">
                    LinkedIn
                  </label>
                  <input
                    type="url"
                    value={formData.socialMedia.linkedin || ''}
                    onChange={(e) => handleSocialMediaChange('linkedin', e.target.value)}
                    className="input-field"
                    placeholder="https://linkedin.com/company/yourbusiness"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-300 mb-2">
                    Instagram
                  </label>
                  <input
                    type="url"
                    value={formData.socialMedia.instagram || ''}
                    onChange={(e) => handleSocialMediaChange('instagram', e.target.value)}
                    className="input-field"
                    placeholder="https://instagram.com/yourbusiness"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Preferences Tab */}
        {currentTab === 'ai-preferences' && (
          <div className="space-y-8">
            <div className="p-4 bg-volt-500/10 border border-volt-500/30 rounded-lg">
              <h4 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                🤖 AI Analysis Preferences
              </h4>
              <p className="text-secondary-300 text-sm">
                Customize how our AI analyzes your business and optimizes your directory listings.
              </p>
            </div>

            {/* Competitive Analysis */}
            <div>
              <h5 className="text-md font-semibold text-white mb-4">Competitive Analysis</h5>
              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.aiPreferences.competitiveAnalysis.enabled}
                    onChange={(e) => handleAIPreferenceChange('competitiveAnalysis', 'enabled', e.target.checked)}
                    className="rounded border-secondary-600 bg-secondary-700 text-volt-500 focus:ring-volt-500"
                  />
                  <span className="text-secondary-300">Enable competitive analysis</span>
                </label>

                {formData.aiPreferences.competitiveAnalysis.enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-secondary-300 mb-2">
                        Analysis Depth
                      </label>
                      <select
                        value={formData.aiPreferences.competitiveAnalysis.depth}
                        onChange={(e) => handleAIPreferenceChange('competitiveAnalysis', 'depth', e.target.value)}
                        className="input-field"
                      >
                        <option value="basic">Basic - Quick overview</option>
                        <option value="detailed">Detailed - Comprehensive analysis</option>
                        <option value="comprehensive">Comprehensive - Deep dive analysis</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary-300 mb-2">
                        Focus Areas
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {COMPETITIVE_FOCUS_AREAS.map(area => (
                          <label key={area} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={formData.aiPreferences.competitiveAnalysis.focusAreas.includes(area)}
                              onChange={(e) => {
                                const newFocusAreas = e.target.checked
                                  ? [...formData.aiPreferences.competitiveAnalysis.focusAreas, area]
                                  : formData.aiPreferences.competitiveAnalysis.focusAreas.filter(a => a !== area)
                                handleAIPreferenceChange('competitiveAnalysis', 'focusAreas', newFocusAreas)
                              }}
                              className="rounded border-secondary-600 bg-secondary-700 text-volt-500 focus:ring-volt-500"
                            />
                            <span className="text-sm text-secondary-300 capitalize">
                              {area.replace('-', ' ')}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Target Market */}
            <div>
              <h5 className="text-md font-semibold text-white mb-4">Target Market & Geographic Preferences</h5>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-300 mb-2">
                    Priority Regions
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {GEOGRAPHIC_REGIONS.map(region => (
                      <label key={region} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.aiPreferences.targetMarket.geographic.includes(region)}
                          onChange={(e) => {
                            const newRegions = e.target.checked
                              ? [...formData.aiPreferences.targetMarket.geographic, region]
                              : formData.aiPreferences.targetMarket.geographic.filter(r => r !== region)
                            handleAIPreferenceChange('targetMarket', 'geographic', newRegions)
                          }}
                          className="rounded border-secondary-600 bg-secondary-700 text-volt-500 focus:ring-volt-500"
                        />
                        <span className="text-sm text-secondary-300">{region}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Industry Customization */}
            <div>
              <h5 className="text-md font-semibold text-white mb-4">Industry Customization</h5>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-300 mb-2">
                      Industry Type
                    </label>
                    <select
                      value={formData.aiPreferences.industryCustomization.industryType}
                      onChange={(e) => handleAIPreferenceChange('industryCustomization', 'industryType', e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select industry...</option>
                      {INDUSTRY_TYPES.map(industry => (
                        <option key={industry} value={industry}>{industry}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-300 mb-2">
                      Business Model
                    </label>
                    <select
                      value={formData.aiPreferences.industryCustomization.businessModel}
                      onChange={(e) => handleAIPreferenceChange('industryCustomization', 'businessModel', e.target.value)}
                      className="input-field"
                    >
                      <option value="b2b">B2B - Business to Business</option>
                      <option value="b2c">B2C - Business to Consumer</option>
                      <option value="both">Both B2B and B2C</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-300 mb-2">
                    Company Stage
                  </label>
                  <select
                    value={formData.aiPreferences.industryCustomization.companyStage}
                    onChange={(e) => handleAIPreferenceChange('industryCustomization', 'companyStage', e.target.value)}
                    className="input-field"
                  >
                    <option value="startup">Startup (0-2 years)</option>
                    <option value="growth">Growth Stage (2-5 years)</option>
                    <option value="established">Established (5+ years)</option>
                    <option value="enterprise">Enterprise (Large organization)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Directory Preferences */}
            <div>
              <h5 className="text-md font-semibold text-white mb-4">Directory Optimization Preferences</h5>
              <div className="space-y-4">
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.aiPreferences.directoryPreferences.industrySpecificDirectories}
                      onChange={(e) => handleAIPreferenceChange('directoryPreferences', 'industrySpecificDirectories', e.target.checked)}
                      className="rounded border-secondary-600 bg-secondary-700 text-volt-500 focus:ring-volt-500"
                    />
                    <span className="text-secondary-300">Prioritize industry-specific directories</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.aiPreferences.directoryPreferences.premiumDirectoriesOnly}
                      onChange={(e) => handleAIPreferenceChange('directoryPreferences', 'premiumDirectoriesOnly', e.target.checked)}
                      className="rounded border-secondary-600 bg-secondary-700 text-volt-500 focus:ring-volt-500"
                    />
                    <span className="text-secondary-300">Premium directories only (DA 70+)</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.aiPreferences.directoryPreferences.niche}
                      onChange={(e) => handleAIPreferenceChange('directoryPreferences', 'niche', e.target.checked)}
                      className="rounded border-secondary-600 bg-secondary-700 text-volt-500 focus:ring-volt-500"
                    />
                    <span className="text-secondary-300">Include niche and specialized directories</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Review Tab */}
        {currentTab === 'review' && (
          <div className="space-y-6">
            <div className="p-4 bg-success-500/10 border border-success-500/30 rounded-lg">
              <h4 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                ✅ Review Your AI-Enhanced Business Profile
              </h4>
              <p className="text-secondary-300 text-sm">
                Review your information and AI preferences before submitting for directory optimization.
              </p>
            </div>

            {/* Business Information Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h5 className="font-semibold text-white">Business Information</h5>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-secondary-400">Name:</span>
                    <span className="text-white ml-2">{formData.businessName || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-secondary-400">Website:</span>
                    <span className="text-white ml-2">{formData.website || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-secondary-400">Categories:</span>
                    <span className="text-white ml-2">{formData.categories.filter(c => c).join(', ') || 'None'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="font-semibold text-white">AI Analysis Settings</h5>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-secondary-400">Competitive Analysis:</span>
                    <span className="text-white ml-2">
                      {formData.aiPreferences.competitiveAnalysis.enabled 
                        ? `${formData.aiPreferences.competitiveAnalysis.depth} analysis` 
                        : 'Disabled'}
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary-400">Industry:</span>
                    <span className="text-white ml-2">
                      {formData.aiPreferences.industryCustomization.industryType || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary-400">Geographic Focus:</span>
                    <span className="text-white ml-2">
                      {formData.aiPreferences.targetMarket.geographic.join(', ') || 'Global'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Suggestions Summary */}
            {hasAIData && formData.aiSuggestions && (
              <div className="p-4 bg-volt-500/10 border border-volt-500/30 rounded-lg">
                <h5 className="font-semibold text-volt-400 mb-3">AI Analysis Results</h5>
                {formData.aiSuggestions.competitorInsights && formData.aiSuggestions.competitorInsights.length > 0 && (
                  <div className="mb-3">
                    <span className="text-sm text-secondary-400">Key Competitors Identified:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {formData.aiSuggestions.competitorInsights.map((competitor, idx) => (
                        <span key={idx} className="text-xs bg-secondary-700 px-2 py-1 rounded text-secondary-300">
                          {competitor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {formData.aiSuggestions.keywordRecommendations && formData.aiSuggestions.keywordRecommendations.length > 0 && (
                  <div>
                    <span className="text-sm text-secondary-400">Recommended Keywords:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {formData.aiSuggestions.keywordRecommendations.slice(0, 8).map((keyword, idx) => (
                        <span key={idx} className="text-xs bg-secondary-700 px-2 py-1 rounded text-secondary-300">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-secondary-700">
          {currentTab !== 'basic' && (
            <button
              onClick={() => {
                const tabOrder = ['basic', 'contact', 'ai-preferences', 'review']
                const currentIndex = tabOrder.indexOf(currentTab)
                if (currentIndex > 0) {
                  setCurrentTab(tabOrder[currentIndex - 1] as typeof currentTab)
                }
              }}
              className="btn-secondary"
            >
              Previous
            </button>
          )}
          
          {currentTab !== 'review' ? (
            <button
              onClick={() => {
                const tabOrder = ['basic', 'contact', 'ai-preferences', 'review']
                const currentIndex = tabOrder.indexOf(currentTab)
                if (currentIndex < tabOrder.length - 1) {
                  setCurrentTab(tabOrder[currentIndex + 1] as typeof currentTab)
                }
              }}
              className="btn-primary flex-1"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="btn-primary flex-1"
            >
              Submit Business Profile
            </button>
          )}

          {onBack && (
            <button
              onClick={onBack}
              className="btn-secondary"
            >
              Back to Packages
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AIEnhancedBusinessForm