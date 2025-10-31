'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export interface WhiteLabelConfig {
  id: string
  organizationId: string
  companyName: string
  logo: {
    primary: string // URL to logo
    secondary?: string // URL to secondary/dark logo
    favicon: string // URL to favicon
    dimensions: { width: number; height: number }
  }
  branding: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    backgroundColor: string
    textColor: string
    linkColor: string
    borderColor: string
    customCSS?: string
  }
  domain: {
    customDomain?: string
    subdomain: string // e.g., 'client.directorybolt.com'
    sslEnabled: boolean
  }
  messaging: {
    companyTagline?: string
    welcomeMessage?: string
    footerText?: string
    supportEmail: string
    supportPhone?: string
  }
  features: {
    hideDirectoryBoltBranding: boolean
    customReportHeaders: boolean
    whiteLabelmails: boolean
    customAnalyticsDomain: boolean
  }
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface WhiteLabelBrandingProps {
  organizationId: string
  userTier: string
  currentConfig?: WhiteLabelConfig
  onConfigChange?: (config: WhiteLabelConfig) => void
  className?: string
}

const DEFAULT_CONFIG: Partial<WhiteLabelConfig> = {
  branding: {
    primaryColor: '#FFC107',
    secondaryColor: '#1A1D29',
    accentColor: '#007AFF',
    backgroundColor: '#0F1419',
    textColor: '#FFFFFF',
    linkColor: '#FFC107',
    borderColor: '#2A2D3A'
  },
  features: {
    hideDirectoryBoltBranding: false,
    customReportHeaders: false,
    whiteLabelmails: false,
    customAnalyticsDomain: false
  }
}

export default function WhiteLabelBranding({
  organizationId,
  userTier,
  currentConfig,
  onConfigChange,
  className = ''
}: WhiteLabelBrandingProps) {
  const [config, setConfig] = useState<Partial<WhiteLabelConfig>>(
    currentConfig || DEFAULT_CONFIG
  )
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'branding' | 'domain' | 'messaging' | 'features'>('branding')

  // Check if user has access to white-label features
  const hasWhiteLabelAccess = userTier === 'professional' || userTier === 'enterprise'

  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig)
    }
  }, [currentConfig])

  const updateConfig = (section: keyof WhiteLabelConfig, updates: any) => {
    const newConfig = {
      ...config,
      [section]: {
        ...(config[section] as any),
        ...updates
      }
    }
    setConfig(newConfig)
  }

  const handleSave = async () => {
    if (!hasWhiteLabelAccess) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/enterprise/white-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          config: {
            ...config,
            organizationId,
            updatedAt: new Date().toISOString()
          }
        })
      })

      if (response.ok) {
        const { config: savedConfig } = await response.json()
        setConfig(savedConfig)
        onConfigChange?.(savedConfig)
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Failed to save white-label config:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogoUpload = async (file: File, type: 'primary' | 'secondary' | 'favicon') => {
    // In production, upload to cloud storage
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    formData.append('organizationId', organizationId)

    try {
      const response = await fetch('/api/enterprise/upload-logo', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const { url } = await response.json()
        updateConfig('logo', { [type]: url })
      }
    } catch (error) {
      console.error('Failed to upload logo:', error)
    }
  }

  const generatePreviewCSS = () => {
    if (!config.branding) return ''

    return `
      :root {
        --primary-color: ${config.branding.primaryColor};
        --secondary-color: ${config.branding.secondaryColor};
        --accent-color: ${config.branding.accentColor};
        --background-color: ${config.branding.backgroundColor};
        --text-color: ${config.branding.textColor};
        --link-color: ${config.branding.linkColor};
        --border-color: ${config.branding.borderColor};
      }
      ${config.branding.customCSS || ''}
    `
  }

  if (!hasWhiteLabelAccess) {
    return (
      <div className={`${className} bg-secondary-800 rounded-xl border border-secondary-700 p-8 text-center`}>
        <div className="mb-6">
          <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🏷️</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">White-Label Branding</h3>
          <p className="text-secondary-400 mb-6">
            Customize DirectoryBolt with your own branding and domain
          </p>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-6">
          <p className="text-orange-400 text-sm">
            White-label branding is available for Professional and Enterprise plans
          </p>
        </div>

        <button className="bg-volt-500 hover:bg-volt-400 text-secondary-900 px-6 py-3 rounded-lg font-medium transition-colors">
          Upgrade to Access White-Label Features
        </button>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            🏷️ White-Label Branding
          </h2>
          <p className="text-secondary-400">
            Customize DirectoryBolt with your brand identity
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              previewMode
                ? 'bg-blue-500 text-white'
                : 'bg-secondary-700 text-secondary-300 hover:text-white'
            }`}
          >
            {previewMode ? 'Exit Preview' : 'Preview'}
          </button>

          {isEditing ? (
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-secondary-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-success-500 hover:bg-success-400 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-volt-500 hover:bg-volt-400 text-secondary-900 rounded-lg font-medium transition-colors"
            >
              Edit Branding
            </button>
          )}
        </div>
      </div>

      {/* Preview Mode */}
      {previewMode && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h3 className="font-semibold text-blue-400 mb-2">Preview Mode Active</h3>
          <p className="text-blue-300 text-sm">
            This is how your white-labeled DirectoryBolt will appear to your clients
          </p>
          <style dangerouslySetInnerHTML={{ __html: generatePreviewCSS() }} />
        </div>
      )}

      <div className="bg-secondary-800 rounded-xl border border-secondary-700">
        {/* Tabs */}
        <div className="border-b border-secondary-700">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'branding', label: 'Colors & Logo', icon: '🎨' },
              { id: 'domain', label: 'Domain', icon: '🌐' },
              { id: 'messaging', label: 'Messaging', icon: '💬' },
              { id: 'features', label: 'Features', icon: '⚙️' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-volt-500 text-volt-400'
                    : 'border-transparent text-secondary-400 hover:text-secondary-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'branding' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Logo Upload */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Logo & Brand Assets</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { key: 'primary', label: 'Primary Logo', description: 'Main logo (recommended: 200x60px)' },
                    { key: 'secondary', label: 'Secondary Logo', description: 'Dark/light variant (optional)' },
                    { key: 'favicon', label: 'Favicon', description: 'Browser icon (32x32px)' }
                  ].map(logoType => (
                    <div key={logoType.key} className="border border-secondary-600 rounded-lg p-4">
                      <h4 className="font-medium text-white mb-2">{logoType.label}</h4>
                      <p className="text-sm text-secondary-400 mb-4">{logoType.description}</p>
                      
                      {config.logo?.[logoType.key as keyof typeof config.logo] && (
                        <div className="mb-4">
                          <img
                            src={config.logo[logoType.key as keyof typeof config.logo] as string}
                            alt={logoType.label}
                            className="max-h-16 rounded border border-secondary-600"
                          />
                        </div>
                      )}

                      {isEditing && (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleLogoUpload(file, logoType.key as any)
                            }
                          }}
                          className="w-full text-sm text-secondary-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-volt-500 file:text-secondary-900 hover:file:bg-volt-400"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Color Scheme */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Color Scheme</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { key: 'primaryColor', label: 'Primary Color', description: 'Main brand color' },
                    { key: 'secondaryColor', label: 'Secondary Color', description: 'Background color' },
                    { key: 'accentColor', label: 'Accent Color', description: 'Highlight color' },
                    { key: 'backgroundColor', label: 'Background', description: 'Page background' },
                    { key: 'textColor', label: 'Text Color', description: 'Primary text' },
                    { key: 'linkColor', label: 'Link Color', description: 'Clickable links' }
                  ].map(colorField => (
                    <div key={colorField.key} className="space-y-2">
                      <label className="block text-sm font-medium text-white">
                        {colorField.label}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.branding?.[colorField.key as keyof typeof config.branding] || '#000000'}
                          onChange={(e) => updateConfig('branding', { [colorField.key]: e.target.value })}
                          disabled={!isEditing}
                          className="w-12 h-8 rounded border border-secondary-600 disabled:opacity-50"
                        />
                        <input
                          type="text"
                          value={config.branding?.[colorField.key as keyof typeof config.branding] || ''}
                          onChange={(e) => updateConfig('branding', { [colorField.key]: e.target.value })}
                          placeholder="#000000"
                          disabled={!isEditing}
                          className="flex-1 px-3 py-2 bg-secondary-700 border border-secondary-600 rounded text-white text-sm disabled:opacity-50"
                        />
                      </div>
                      <p className="text-xs text-secondary-400">{colorField.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom CSS */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Custom CSS (Advanced)</h3>
                <textarea
                  value={config.branding?.customCSS || ''}
                  onChange={(e) => updateConfig('branding', { customCSS: e.target.value })}
                  placeholder="/* Add custom CSS rules here */"
                  disabled={!isEditing}
                  rows={8}
                  className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded text-white text-sm font-mono disabled:opacity-50"
                />
                <p className="text-xs text-secondary-400 mt-2">
                  Add custom CSS to fine-tune the appearance. Use CSS variables for consistency.
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === 'domain' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h3 className="text-lg font-semibold text-white">Domain Configuration</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Subdomain
                  </label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={config.domain?.subdomain || ''}
                      onChange={(e) => updateConfig('domain', { subdomain: e.target.value })}
                      placeholder="yourcompany"
                      disabled={!isEditing}
                      className="flex-1 px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-l text-white disabled:opacity-50"
                    />
                    <span className="px-3 py-2 bg-secondary-600 border border-secondary-600 rounded-r text-secondary-300 text-sm">
                      .directorybolt.com
                    </span>
                  </div>
                  <p className="text-xs text-secondary-400 mt-1">
                    Your clients will access DirectoryBolt at this subdomain
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Custom Domain (Optional)
                  </label>
                  <input
                    type="text"
                    value={config.domain?.customDomain || ''}
                    onChange={(e) => updateConfig('domain', { customDomain: e.target.value })}
                    placeholder="directory.yourcompany.com"
                    disabled={!isEditing}
                    className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded text-white disabled:opacity-50"
                  />
                  <p className="text-xs text-secondary-400 mt-1">
                    Use your own domain (requires DNS configuration)
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-secondary-700/50 rounded-lg">
                <div>
                  <div className="font-medium text-white">SSL Certificate</div>
                  <div className="text-sm text-secondary-400">Secure HTTPS connection</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.domain?.sslEnabled || false}
                    onChange={(e) => updateConfig('domain', { sslEnabled: e.target.checked })}
                    disabled={!isEditing}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-secondary-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-volt-500"></div>
                </label>
              </div>
            </motion.div>
          )}

          {activeTab === 'messaging' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h3 className="text-lg font-semibold text-white">Custom Messaging</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={config.companyName || ''}
                    onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                    placeholder="Your Company Name"
                    disabled={!isEditing}
                    className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded text-white disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Company Tagline
                  </label>
                  <input
                    type="text"
                    value={config.messaging?.companyTagline || ''}
                    onChange={(e) => updateConfig('messaging', { companyTagline: e.target.value })}
                    placeholder="Your company's mission"
                    disabled={!isEditing}
                    className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded text-white disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Support Email
                  </label>
                  <input
                    type="email"
                    value={config.messaging?.supportEmail || ''}
                    onChange={(e) => updateConfig('messaging', { supportEmail: e.target.value })}
                    placeholder="support@yourcompany.com"
                    disabled={!isEditing}
                    className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded text-white disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Support Phone
                  </label>
                  <input
                    type="tel"
                    value={config.messaging?.supportPhone || ''}
                    onChange={(e) => updateConfig('messaging', { supportPhone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    disabled={!isEditing}
                    className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded text-white disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Welcome Message
                </label>
                <textarea
                  value={config.messaging?.welcomeMessage || ''}
                  onChange={(e) => updateConfig('messaging', { welcomeMessage: e.target.value })}
                  placeholder="Welcome to our directory submission platform..."
                  disabled={!isEditing}
                  rows={3}
                  className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Footer Text
                </label>
                <textarea
                  value={config.messaging?.footerText || ''}
                  onChange={(e) => updateConfig('messaging', { footerText: e.target.value })}
                  placeholder="© 2024 Your Company. All rights reserved."
                  disabled={!isEditing}
                  rows={2}
                  className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded text-white disabled:opacity-50"
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'features' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h3 className="text-lg font-semibold text-white">White-Label Features</h3>

              <div className="space-y-4">
                {[
                  {
                    key: 'hideDirectoryBoltBranding',
                    label: 'Hide DirectoryBolt Branding',
                    description: 'Remove all DirectoryBolt logos and mentions from the interface'
                  },
                  {
                    key: 'customReportHeaders',
                    label: 'Custom Report Headers',
                    description: 'Use your company branding in generated reports and analytics'
                  },
                  {
                    key: 'whiteLabelmails',
                    label: 'White-Label Emails',
                    description: 'Send emails from your domain with your branding'
                  },
                  {
                    key: 'customAnalyticsDomain',
                    label: 'Custom Analytics Domain',
                    description: 'Host analytics on your own subdomain for better data ownership'
                  }
                ].map(feature => (
                  <div key={feature.key} className="flex items-center justify-between p-4 bg-secondary-700/50 rounded-lg">
                    <div>
                      <div className="font-medium text-white">{feature.label}</div>
                      <div className="text-sm text-secondary-400">{feature.description}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.features?.[feature.key as keyof typeof config.features] || false}
                        onChange={(e) => updateConfig('features', { [feature.key]: e.target.checked })}
                        disabled={!isEditing}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-secondary-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-volt-500"></div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-medium text-blue-400 mb-2">Implementation Notes</h4>
                <ul className="text-sm text-blue-300 space-y-1">
                  <li>• White-label changes take effect within 24 hours</li>
                  <li>• Custom domain requires DNS configuration on your end</li>
                  <li>• Email white-labeling requires domain verification</li>
                  <li>• Some features may require additional setup time</li>
                </ul>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}