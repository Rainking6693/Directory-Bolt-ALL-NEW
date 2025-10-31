'use client'
import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

interface BrandingOptions {
  companyName: string
  logo: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily: string
  customDomain?: string
  favicon?: string
}

interface WhiteLabelSettings {
  branding: BrandingOptions
  hideDirectoryBoltBranding: boolean
  customFooter: string
  customHeaders: boolean
  clientPortalAccess: boolean
  customReportTemplates: boolean
  apiCredentials: {
    enabled: boolean
    clientId: string
    clientSecret: string
  }
  emailTemplates: {
    enabled: boolean
    welcomeEmail: string
    reportDelivery: string
    followUp: string
  }
}

interface WhiteLabelCustomizationProps {
  userTier: 'free' | 'starter' | 'growth' | 'professional'
  currentSettings: WhiteLabelSettings
  onSave: (settings: WhiteLabelSettings) => void
  onUpgrade: () => void
}

export default function WhiteLabelCustomization({
  userTier,
  currentSettings,
  onSave,
  onUpgrade
}: WhiteLabelCustomizationProps) {
  const [settings, setSettings] = useState<WhiteLabelSettings>(currentSettings)
  const [activeTab, setActiveTab] = useState('branding')
  const [previewMode, setPreviewMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  const hasWhiteLabelAccess = userTier === 'professional'
  
  const brandingPresets = [
    {
      name: 'Corporate Blue',
      colors: { primary: '#1E40AF', secondary: '#3B82F6', accent: '#60A5FA' },
      font: 'Inter'
    },
    {
      name: 'Modern Green',
      colors: { primary: '#059669', secondary: '#10B981', accent: '#34D399' },
      font: 'Poppins'
    },
    {
      name: 'Professional Purple',
      colors: { primary: '#7C3AED', secondary: '#8B5CF6', accent: '#A78BFA' },
      font: 'Roboto'
    },
    {
      name: 'Elegant Black',
      colors: { primary: '#1F2937', secondary: '#374151', accent: '#6B7280' },
      font: 'Montserrat'
    }
  ]

  const fontOptions = [
    { name: 'Inter', category: 'Modern Sans-serif' },
    { name: 'Roboto', category: 'Clean Sans-serif' },
    { name: 'Poppins', category: 'Rounded Sans-serif' },
    { name: 'Montserrat', category: 'Geometric Sans-serif' },
    { name: 'Merriweather', category: 'Professional Serif' },
    { name: 'Open Sans', category: 'Friendly Sans-serif' }
  ]

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    onSave(settings)
    setIsSaving(false)
  }

  const handlePresetApply = (preset: typeof brandingPresets[0]) => {
    setSettings(prev => ({
      ...prev,
      branding: {
        ...prev.branding,
        primaryColor: preset.colors.primary,
        secondaryColor: preset.colors.secondary,
        accentColor: preset.colors.accent,
        fontFamily: preset.font
      }
    }))
  }

  const PreviewCard = () => (
    <div className="bg-secondary-800/50 rounded-2xl border border-secondary-700 p-6">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
        <span>👁️</span>
        Live Preview
      </h3>
      
      <div 
        className="bg-white rounded-xl p-6 border-2 min-h-[400px]"
        style={{ 
          borderColor: settings.branding.primaryColor,
          fontFamily: settings.branding.fontFamily 
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-4 rounded-lg mb-6"
          style={{ backgroundColor: settings.branding.primaryColor }}
        >
          <div className="flex items-center gap-3">
            {settings.branding.logo ? (
              <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                <span className="text-sm font-bold" style={{ color: settings.branding.primaryColor }}>
                  {settings.branding.companyName.charAt(0)}
                </span>
              </div>
            ) : (
              <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
                <span className="text-white text-sm">📊</span>
              </div>
            )}
            <h2 className="text-white font-bold text-lg">
              {settings.branding.companyName || 'Your Company Name'}
            </h2>
          </div>
          <div className="text-white text-sm opacity-80">
            Business Intelligence Report
          </div>
        </div>

        {/* Sample Content */}
        <div className="space-y-4">
          <div>
            <h3 
              className="text-xl font-bold mb-2"
              style={{ color: settings.branding.primaryColor }}
            >
              Executive Summary
            </h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              Our comprehensive analysis identified 47 high-value directory opportunities 
              with an estimated monthly value potential of $4,200 based on your business profile.
            </p>
          </div>

          {/* Sample Chart */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 
              className="font-semibold mb-3 text-sm"
              style={{ color: settings.branding.secondaryColor }}
            >
              Opportunity Distribution
            </h4>
            <div className="flex gap-2 h-20">
              {[65, 45, 80, 30].map((height, idx) => (
                <div key={idx} className="flex-1 flex items-end">
                  <div 
                    className="w-full rounded-t transition-all duration-500"
                    style={{ 
                      height: `${height}%`,
                      backgroundColor: idx === 0 ? settings.branding.primaryColor :
                                      idx === 1 ? settings.branding.secondaryColor :
                                      idx === 2 ? settings.branding.accentColor :
                                      settings.branding.secondaryColor + '80'
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Sample Table */}
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div 
              className="px-4 py-2 text-white font-semibold text-sm"
              style={{ backgroundColor: settings.branding.secondaryColor }}
            >
              Top Directory Opportunities
            </div>
            <div className="divide-y divide-gray-200">
              {[
                { name: 'Industry Leader Directory', success: '94%', value: '$420' },
                { name: 'Business Excellence Hub', success: '87%', value: '$380' },
                { name: 'Professional Network Plus', success: '91%', value: '$350' }
              ].map((item, idx) => (
                <div key={idx} className="px-4 py-3 flex justify-between items-center text-sm">
                  <span className="text-gray-800 font-medium">{item.name}</span>
                  <div className="flex gap-4">
                    <span 
                      className="font-semibold"
                      style={{ color: settings.branding.accentColor }}
                    >
                      {item.success}
                    </span>
                    <span className="text-gray-600">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <div className="text-gray-500 text-xs">
            {!settings.hideDirectoryBoltBranding ? (
              <>
                Powered by DirectoryBolt • {settings.customFooter || 'Professional Business Intelligence'}
              </>
            ) : (
              settings.customFooter || 'Confidential Business Analysis Report'
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const BrandingTab = () => (
    <div className="space-y-8">
      {/* Company Information */}
      <div className="bg-secondary-800/50 rounded-xl border border-secondary-700 p-6">
        <h4 className="text-lg font-semibold text-white mb-4">Company Information</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-secondary-300 text-sm font-medium mb-2">
              Company Name
            </label>
            <input
              type="text"
              value={settings.branding.companyName}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                branding: { ...prev.branding, companyName: e.target.value }
              }))}
              className="w-full bg-secondary-900 border border-secondary-600 rounded-lg px-3 py-2 text-white focus:border-volt-500 transition-colors"
              placeholder="Enter your company name"
            />
          </div>

          <div>
            <label className="block text-secondary-300 text-sm font-medium mb-2">
              Custom Domain (Optional)
            </label>
            <input
              type="text"
              value={settings.branding.customDomain || ''}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                branding: { ...prev.branding, customDomain: e.target.value }
              }))}
              className="w-full bg-secondary-900 border border-secondary-600 rounded-lg px-3 py-2 text-white focus:border-volt-500 transition-colors"
              placeholder="reports.yourcompany.com"
            />
          </div>
        </div>

        {/* Logo Upload */}
        <div className="mt-6">
          <label className="block text-secondary-300 text-sm font-medium mb-3">
            Company Logo
          </label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-secondary-700 rounded-lg flex items-center justify-center overflow-hidden">
              {settings.branding.logo ? (
                <Image 
                  src={settings.branding.logo} 
                  alt="Company Logo" 
                  width={80} 
                  height={80} 
                  className="object-contain" 
                />
              ) : (
                <span className="text-secondary-400 text-xs text-center">No Logo</span>
              )}
            </div>
            <div>
              <button
                onClick={() => logoInputRef.current?.click()}
                className="bg-volt-500 hover:bg-volt-400 text-secondary-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Upload Logo
              </button>
              <p className="text-secondary-400 text-xs mt-2">
                Recommended: 200x200px, PNG or SVG format
              </p>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onload = () => {
                    setSettings(prev => ({
                      ...prev,
                      branding: { ...prev.branding, logo: reader.result as string }
                    }))
                  }
                  reader.readAsDataURL(file)
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Color Scheme */}
      <div className="bg-secondary-800/50 rounded-xl border border-secondary-700 p-6">
        <h4 className="text-lg font-semibold text-white mb-4">Brand Colors</h4>
        
        {/* Presets */}
        <div className="mb-6">
          <label className="block text-secondary-300 text-sm font-medium mb-3">
            Quick Presets
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {brandingPresets.map((preset, index) => (
              <button
                key={index}
                onClick={() => handlePresetApply(preset)}
                className="bg-secondary-700 hover:bg-secondary-600 rounded-lg p-3 transition-colors text-left"
              >
                <div className="flex gap-1 mb-2">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: preset.colors.primary }}
                  />
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: preset.colors.secondary }}
                  />
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: preset.colors.accent }}
                  />
                </div>
                <div className="text-white text-sm font-medium">{preset.name}</div>
                <div className="text-secondary-400 text-xs">{preset.font}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Colors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-secondary-300 text-sm font-medium mb-2">
              Primary Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.branding.primaryColor}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  branding: { ...prev.branding, primaryColor: e.target.value }
                }))}
                className="w-12 h-10 bg-secondary-900 border border-secondary-600 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.branding.primaryColor}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  branding: { ...prev.branding, primaryColor: e.target.value }
                }))}
                className="flex-1 bg-secondary-900 border border-secondary-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-secondary-300 text-sm font-medium mb-2">
              Secondary Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.branding.secondaryColor}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  branding: { ...prev.branding, secondaryColor: e.target.value }
                }))}
                className="w-12 h-10 bg-secondary-900 border border-secondary-600 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.branding.secondaryColor}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  branding: { ...prev.branding, secondaryColor: e.target.value }
                }))}
                className="flex-1 bg-secondary-900 border border-secondary-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-secondary-300 text-sm font-medium mb-2">
              Accent Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.branding.accentColor}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  branding: { ...prev.branding, accentColor: e.target.value }
                }))}
                className="w-12 h-10 bg-secondary-900 border border-secondary-600 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.branding.accentColor}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  branding: { ...prev.branding, accentColor: e.target.value }
                }))}
                className="flex-1 bg-secondary-900 border border-secondary-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="bg-secondary-800/50 rounded-xl border border-secondary-700 p-6">
        <h4 className="text-lg font-semibold text-white mb-4">Typography</h4>
        
        <div>
          <label className="block text-secondary-300 text-sm font-medium mb-2">
            Font Family
          </label>
          <select
            value={settings.branding.fontFamily}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              branding: { ...prev.branding, fontFamily: e.target.value }
            }))}
            className="w-full bg-secondary-900 border border-secondary-600 rounded-lg px-3 py-2 text-white focus:border-volt-500 transition-colors"
          >
            {fontOptions.map(font => (
              <option key={font.name} value={font.name}>
                {font.name} - {font.category}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )

  const SettingsTab = () => (
    <div className="space-y-8">
      {/* White Label Options */}
      <div className="bg-secondary-800/50 rounded-xl border border-secondary-700 p-6">
        <h4 className="text-lg font-semibold text-white mb-4">White Label Settings</h4>
        
        <div className="space-y-4">
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.hideDirectoryBoltBranding}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  hideDirectoryBoltBranding: e.target.checked
                }))}
                className="mt-1 rounded border-secondary-600 bg-secondary-900 text-volt-500 focus:ring-volt-500"
              />
              <div>
                <div className="text-white font-medium">Hide DirectoryBolt Branding</div>
                <div className="text-secondary-400 text-sm">
                  Remove all DirectoryBolt references from reports and dashboards
                </div>
              </div>
            </label>
          </div>

          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.customHeaders}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  customHeaders: e.target.checked
                }))}
                className="mt-1 rounded border-secondary-600 bg-secondary-900 text-volt-500 focus:ring-volt-500"
              />
              <div>
                <div className="text-white font-medium">Custom Report Headers</div>
                <div className="text-secondary-400 text-sm">
                  Use your company branding in all report headers
                </div>
              </div>
            </label>
          </div>

          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.clientPortalAccess}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  clientPortalAccess: e.target.checked
                }))}
                className="mt-1 rounded border-secondary-600 bg-secondary-900 text-volt-500 focus:ring-volt-500"
              />
              <div>
                <div className="text-white font-medium">Client Portal Access</div>
                <div className="text-secondary-400 text-sm">
                  Allow clients to access reports through your branded portal
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Custom Footer */}
      <div className="bg-secondary-800/50 rounded-xl border border-secondary-700 p-6">
        <h4 className="text-lg font-semibold text-white mb-4">Custom Footer Text</h4>
        
        <textarea
          value={settings.customFooter}
          onChange={(e) => setSettings(prev => ({ ...prev, customFooter: e.target.value }))}
          className="w-full bg-secondary-900 border border-secondary-600 rounded-lg px-3 py-2 text-white focus:border-volt-500 transition-colors resize-none"
          rows={3}
          placeholder="Enter custom footer text for your reports"
        />
        <p className="text-secondary-400 text-xs mt-2">
          This text will appear at the bottom of all generated reports
        </p>
      </div>

      {/* API Integration */}
      <div className="bg-secondary-800/50 rounded-xl border border-secondary-700 p-6">
        <h4 className="text-lg font-semibold text-white mb-4">API Integration</h4>
        
        <div className="space-y-4">
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.apiCredentials.enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  apiCredentials: { ...prev.apiCredentials, enabled: e.target.checked }
                }))}
                className="mt-1 rounded border-secondary-600 bg-secondary-900 text-volt-500 focus:ring-volt-500"
              />
              <div>
                <div className="text-white font-medium">Enable API Access</div>
                <div className="text-secondary-400 text-sm">
                  Allow integration with your existing tools and systems
                </div>
              </div>
            </label>
          </div>

          {settings.apiCredentials.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
              <div>
                <label className="block text-secondary-300 text-sm font-medium mb-2">
                  Client ID
                </label>
                <input
                  type="text"
                  value={settings.apiCredentials.clientId}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apiCredentials: { ...prev.apiCredentials, clientId: e.target.value }
                  }))}
                  className="w-full bg-secondary-900 border border-secondary-600 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Auto-generated"
                />
              </div>
              <div>
                <label className="block text-secondary-300 text-sm font-medium mb-2">
                  Client Secret
                </label>
                <input
                  type="password"
                  value={settings.apiCredentials.clientSecret}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apiCredentials: { ...prev.apiCredentials, clientSecret: e.target.value }
                  }))}
                  className="w-full bg-secondary-900 border border-secondary-600 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Click 'Generate' below"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (!hasWhiteLabelAccess) {
    return (
      <div className="bg-gradient-to-r from-volt-500/20 to-success-500/10 rounded-2xl border-2 border-volt-500/50 p-8 text-center">
        <div className="text-6xl mb-6">🎨</div>
        <h2 className="text-3xl font-black text-white mb-4">
          White-Label Customization
        </h2>
        <p className="text-secondary-300 text-lg mb-8 max-w-3xl mx-auto">
          Transform DirectoryBolt into your own branded business intelligence platform. 
          Remove our branding, add your logo, customize colors, and deliver reports under your company name.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-secondary-800/50 rounded-xl p-6">
            <div className="text-3xl mb-3">🏷️</div>
            <div className="text-lg font-bold text-white mb-2">Complete Rebranding</div>
            <div className="text-secondary-300 text-sm">
              Remove all DirectoryBolt branding and replace with your company identity
            </div>
          </div>
          <div className="bg-secondary-800/50 rounded-xl p-6">
            <div className="text-3xl mb-3">🎨</div>
            <div className="text-lg font-bold text-white mb-2">Custom Design</div>
            <div className="text-secondary-300 text-sm">
              Customize colors, fonts, logos, and styling to match your brand perfectly
            </div>
          </div>
          <div className="bg-secondary-800/50 rounded-xl p-6">
            <div className="text-3xl mb-3">🔗</div>
            <div className="text-lg font-bold text-white mb-2">API Integration</div>
            <div className="text-secondary-300 text-sm">
              Integrate with your existing tools and deliver seamless client experiences
            </div>
          </div>
        </div>

        <div className="bg-secondary-800/50 rounded-xl p-6 mb-8 max-w-2xl mx-auto">
          <h3 className="text-xl font-bold text-volt-400 mb-4">
            What You Get with Professional:
          </h3>
          <div className="space-y-3 text-left">
            {[
              'Complete white-label solution with your branding',
              'Custom domain and branded client portal',
              'Unlimited custom report templates',
              'API access for seamless integrations',
              'Remove all DirectoryBolt references',
              'Custom email templates and notifications',
              'Dedicated success manager and priority support'
            ].map((feature, index) => (
              <div key={index} className="flex items-start gap-3 text-sm">
                <span className="text-success-400 flex-shrink-0 mt-1">✓</span>
                <span className="text-secondary-200">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onUpgrade}
          className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black py-4 px-8 text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-volt-500/50"
        >
          🚀 Upgrade to Professional - $299 ONE-TIME
        </button>
        
        <div className="text-secondary-400 text-sm mt-4">
          🛡️ 30-day money-back guarantee • One-time purchase
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-black text-white mb-4">
          White-Label Customization
        </h2>
        <p className="text-secondary-300 text-lg max-w-3xl mx-auto">
          Create your own branded business intelligence platform. Customize every aspect to match your company's identity.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Left Column - Settings */}
        <div className="space-y-6">
          {/* Navigation Tabs */}
          <div className="flex gap-2">
            {[
              { id: 'branding', label: 'Branding', icon: '🎨' },
              { id: 'settings', label: 'Settings', icon: '⚙️' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-volt-500 text-secondary-900'
                    : 'bg-secondary-800 text-secondary-300 hover:bg-secondary-700 hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'branding' && <BrandingTab />}
              {activeTab === 'settings' && <SettingsTab />}
            </motion.div>
          </AnimatePresence>

          {/* Save Button */}
          <div className="flex items-center justify-between">
            <div className="text-secondary-400 text-sm">
              Changes are saved automatically
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-gradient-to-r from-success-500 to-success-600 text-white font-bold py-3 px-6 rounded-lg hover:from-success-400 hover:to-success-500 transition-all duration-300 disabled:opacity-50"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                '💾 Save Changes'
              )}
            </button>
          </div>
        </div>

        {/* Right Column - Preview */}
        <div className="xl:sticky xl:top-6">
          <PreviewCard />
        </div>
      </div>

      {/* Additional Features */}
      <div className="bg-secondary-800/30 rounded-2xl border border-secondary-700 p-8">
        <h3 className="text-2xl font-bold text-white mb-6 text-center">
          Additional Professional Features
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl mb-3">🔗</div>
            <div className="text-lg font-bold text-white mb-2">Custom Domain</div>
            <div className="text-secondary-300 text-sm">
              reports.yourcompany.com
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-3">📧</div>
            <div className="text-lg font-bold text-white mb-2">Email Templates</div>
            <div className="text-secondary-300 text-sm">
              Branded client communications
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-3">👥</div>
            <div className="text-lg font-bold text-white mb-2">Client Portal</div>
            <div className="text-secondary-300 text-sm">
              Self-service report access
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}