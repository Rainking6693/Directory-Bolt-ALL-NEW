'use client'
import { useState } from 'react'
import { BusinessInfo } from '../../types/dashboard'

interface BusinessInfoEditorProps {
  businessInfo: BusinessInfo
  onSave: (updatedInfo: BusinessInfo) => void
  onCancel?: () => void
  isLoading?: boolean
  className?: string
  compact?: boolean
}

export function BusinessInfoEditor({
  businessInfo,
  onSave,
  onCancel,
  isLoading = false,
  className = '',
  compact = false
}: BusinessInfoEditorProps) {
  const [formData, setFormData] = useState<BusinessInfo>(businessInfo)
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'social' | 'hours'>('basic')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)

  const handleInputChange = (field: keyof BusinessInfo, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleAddressChange = (field: keyof BusinessInfo['address'], value: string) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }))
    setIsDirty(true)
  }

  const handleSocialMediaChange = (platform: keyof NonNullable<BusinessInfo['socialMedia']>, value: string) => {
    setFormData(prev => ({
      ...prev,
      socialMedia: { ...prev.socialMedia, [platform]: value }
    }))
    setIsDirty(true)
  }

  const handleCategoryChange = (index: number, value: string) => {
    setFormData(prev => {
      const newCategories = [...prev.categories]
      newCategories[index] = value
      return { ...prev, categories: newCategories }
    })
    setIsDirty(true)
  }

  const addCategory = () => {
    setFormData(prev => ({
      ...prev,
      categories: [...prev.categories, '']
    }))
    setIsDirty(true)
  }

  const removeCategory = (index: number) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index)
    }))
    setIsDirty(true)
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

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData)
      setIsDirty(false)
    }
  }

  const handleCancel = () => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to cancel?')
      if (!confirmed) return
    }
    setFormData(businessInfo)
    setIsDirty(false)
    setErrors({})
    onCancel?.()
  }

  const tabs = [
    { key: 'basic', label: 'Basic Info', icon: '🏢' },
    { key: 'contact', label: 'Contact', icon: '📞' },
    { key: 'social', label: 'Social Media', icon: '🌐' },
    { key: 'hours', label: 'Hours', icon: '🕐' }
  ]

  const daysOfWeek = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ]

  if (compact) {
    return (
      <div className={`bg-secondary-800 rounded-xl border border-secondary-700 p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            ✏️ Quick Edit
          </h3>
          {isDirty && (
            <span className="text-xs text-volt-400 bg-volt-500/20 px-2 py-1 rounded border border-volt-500/30">
              Unsaved Changes
            </span>
          )}
        </div>

        <div className="space-y-4">
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

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={isLoading || !isDirty}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-secondary-800 rounded-xl border border-secondary-700 ${className}`}>
      <div className="p-6 border-b border-secondary-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            ✏️ Business Information
          </h3>
          {isDirty && (
            <span className="text-sm text-volt-400 bg-volt-500/20 px-3 py-1 rounded border border-volt-500/30">
              Unsaved Changes
            </span>
          )}
        </div>

        {/* Tabs */}
        <nav className="flex space-x-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-volt-500/20 text-volt-400 border border-volt-500/30'
                  : 'text-secondary-400 hover:text-secondary-300 hover:bg-secondary-700/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
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
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Business Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="input-field h-32 resize-none"
                placeholder="Describe your business, services, and what makes you unique..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Categories *
              </label>
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
              {errors.categories && (
                <p className="text-danger-400 text-sm mt-1">{errors.categories}</p>
              )}
            </div>
          </div>
        )}

        {/* Contact Tab */}
        {activeTab === 'contact' && (
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
          </div>
        )}

        {/* Social Media Tab */}
        {activeTab === 'social' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary-300 mb-2">
                  Facebook
                </label>
                <input
                  type="url"
                  value={formData.socialMedia?.facebook || ''}
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
                  value={formData.socialMedia?.twitter || ''}
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
                  value={formData.socialMedia?.linkedin || ''}
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
                  value={formData.socialMedia?.instagram || ''}
                  onChange={(e) => handleSocialMediaChange('instagram', e.target.value)}
                  className="input-field"
                  placeholder="https://instagram.com/yourbusiness"
                />
              </div>
            </div>
          </div>
        )}

        {/* Hours Tab */}
        {activeTab === 'hours' && (
          <div className="space-y-4">
            <p className="text-secondary-400 text-sm mb-4">
              Set your business hours for each day of the week
            </p>
            {daysOfWeek.map((day) => (
              <div key={day} className="flex items-center gap-4 p-4 bg-secondary-700/50 rounded-lg">
                <div className="w-20">
                  <span className="text-white font-medium capitalize">{day}</span>
                </div>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!formData.openingHours?.[day]?.closed}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        openingHours: {
                          ...prev.openingHours,
                          [day]: {
                            open: prev.openingHours?.[day]?.open || '09:00',
                            close: prev.openingHours?.[day]?.close || '17:00',
                            closed: !e.target.checked
                          }
                        }
                      }))
                      setIsDirty(true)
                    }}
                    className="rounded border-secondary-600 bg-secondary-700 text-volt-500 focus:ring-volt-500"
                  />
                  <span className="text-secondary-300 text-sm">Open</span>
                </label>

                {!formData.openingHours?.[day]?.closed && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={formData.openingHours?.[day]?.open || '09:00'}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          openingHours: {
                            ...prev.openingHours,
                            [day]: {
                              open: e.target.value,
                              close: prev.openingHours?.[day]?.close || '17:00',
                              closed: false
                            }
                          }
                        }))
                        setIsDirty(true)
                      }}
                      className="bg-secondary-700 border border-secondary-600 rounded px-3 py-1 text-white text-sm focus:ring-2 focus:ring-volt-500 focus:border-volt-500"
                    />
                    <span className="text-secondary-400">to</span>
                    <input
                      type="time"
                      value={formData.openingHours?.[day]?.close || '17:00'}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          openingHours: {
                            ...prev.openingHours,
                            [day]: {
                              open: prev.openingHours?.[day]?.open || '09:00',
                              close: e.target.value,
                              closed: false
                            }
                          }
                        }))
                        setIsDirty(true)
                      }}
                      className="bg-secondary-700 border border-secondary-600 rounded px-3 py-1 text-white text-sm focus:ring-2 focus:ring-volt-500 focus:border-volt-500"
                    />
                  </div>
                )}

                {formData.openingHours?.[day]?.closed && (
                  <span className="text-secondary-500 text-sm italic">Closed</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-secondary-700">
          <button
            onClick={handleSave}
            disabled={isLoading || !isDirty}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="btn-secondary sm:w-auto"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default BusinessInfoEditor