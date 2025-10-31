'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export interface UserPreferences {
  userId: string
  theme: 'dark' | 'light' | 'auto'
  language: string
  timezone: string
  dateFormat: 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd'
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
    frequency: 'immediate' | 'daily' | 'weekly'
    types: {
      submissions: boolean
      approvals: boolean
      rejections: boolean
      analytics: boolean
      marketing: boolean
    }
  }
  dashboard: {
    defaultView: 'overview' | 'directories' | 'seo-tools' | 'analytics'
    showQuickStats: boolean
    compactMode: boolean
    autoRefresh: boolean
    refreshInterval: 30 | 60 | 120 | 300 // seconds
    widgetOrder: string[]
    hiddenWidgets: string[]
  }
  privacy: {
    shareAnalytics: boolean
    allowTracking: boolean
    publicProfile: boolean
  }
  accessibility: {
    fontSize: 'small' | 'medium' | 'large' | 'xl'
    highContrast: boolean
    reducedMotion: boolean
    screenReader: boolean
  }
}

const DEFAULT_PREFERENCES: Omit<UserPreferences, 'userId'> = {
  theme: 'dark',
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/dd/yyyy',
  notifications: {
    email: true,
    push: true,
    sms: false,
    frequency: 'immediate',
    types: {
      submissions: true,
      approvals: true,
      rejections: true,
      analytics: false,
      marketing: false
    }
  },
  dashboard: {
    defaultView: 'overview',
    showQuickStats: true,
    compactMode: false,
    autoRefresh: true,
    refreshInterval: 30,
    widgetOrder: ['stats', 'progress', 'notifications', 'actions'],
    hiddenWidgets: []
  },
  privacy: {
    shareAnalytics: false,
    allowTracking: true,
    publicProfile: false
  },
  accessibility: {
    fontSize: 'medium',
    highContrast: false,
    reducedMotion: false,
    screenReader: false
  }
}

interface UserPreferencesManagerProps {
  userId: string
  onPreferencesChange?: (preferences: UserPreferences) => void
  className?: string
}

export default function UserPreferencesManager({
  userId,
  onPreferencesChange,
  className = ''
}: UserPreferencesManagerProps) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    userId,
    ...DEFAULT_PREFERENCES
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<'general' | 'notifications' | 'dashboard' | 'privacy' | 'accessibility'>('general')

  // Load user preferences on mount
  useEffect(() => {
    loadPreferences()
  }, [userId])

  const loadPreferences = async () => {
    try {
      const response = await fetch(`/api/user/preferences?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.preferences) {
          setPreferences({ userId, ...DEFAULT_PREFERENCES, ...data.preferences })
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const savePreferences = async (newPreferences: UserPreferences) => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, preferences: newPreferences })
      })

      if (response.ok) {
        setPreferences(newPreferences)
        onPreferencesChange?.(newPreferences)
      }
    } catch (error) {
      console.error('Failed to save preferences:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const updatePreference = (section: keyof UserPreferences, key: string, value: any) => {
    const sectionValue = preferences[section]
    const updatedSection =
      sectionValue && typeof sectionValue === 'object'
        ? { ...sectionValue, [key]: value }
        : value

    const updated = {
      ...preferences,
      [section]: updatedSection
    }
    savePreferences(updated)
  }

  const updateNestedPreference = (section: keyof UserPreferences, subsection: string, key: string, value: any) => {
    const sectionValue = preferences[section]
    const subsectionValue =
      sectionValue && typeof sectionValue === 'object'
        ? (sectionValue as Record<string, unknown>)[subsection]
        : undefined

    const updatedSubsection =
      subsectionValue && typeof subsectionValue === 'object'
        ? { ...subsectionValue, [key]: value }
        : { [key]: value }

    const updated = {
      ...preferences,
      [section]: {
        ...(sectionValue && typeof sectionValue === 'object' ? sectionValue : {}),
        [subsection]: updatedSubsection
      }
    }
    savePreferences(updated)
  }

  if (isLoading) {
    return <div className={`${className} animate-pulse bg-secondary-800 rounded-lg h-64`} />
  }

  const sections = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
    { id: 'accessibility', label: 'Accessibility', icon: '♿' }
  ]

  return (
    <div className={`bg-secondary-800 rounded-xl border border-secondary-700 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-secondary-700">
        <h2 className="text-xl font-bold text-white mb-2">User Preferences</h2>
        <p className="text-secondary-400">Customize your DirectoryBolt experience</p>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 border-r border-secondary-700 p-4">
          <nav className="space-y-2">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
                className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-3 ${
                  activeSection === section.id
                    ? 'bg-volt-500/20 text-volt-400'
                    : 'text-secondary-300 hover:text-white hover:bg-secondary-700'
                }`}
              >
                <span>{section.icon}</span>
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {activeSection === 'general' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h3 className="text-lg font-semibold text-white">General Settings</h3>

              {/* Theme */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Theme</label>
                <div className="grid grid-cols-3 gap-3">
                  {['dark', 'light', 'auto'].map(theme => (
                    <button
                      key={theme}
                      onClick={() => updatePreference('theme', '', theme)}
                      className={`p-3 rounded-lg border text-center capitalize ${
                        preferences.theme === theme
                          ? 'border-volt-500 bg-volt-500/20 text-volt-400'
                          : 'border-secondary-600 text-secondary-300 hover:border-secondary-500'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Language</label>
                <select
                  value={preferences.language}
                  onChange={(e) => updatePreference('language', '', e.target.value)}
                  className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>

              {/* Date Format */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Date Format</label>
                <div className="grid grid-cols-3 gap-3">
                  {['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'].map(format => (
                    <button
                      key={format}
                      onClick={() => updatePreference('dateFormat', '', format)}
                      className={`p-3 rounded-lg border text-center text-sm ${
                        preferences.dateFormat === format
                          ? 'border-volt-500 bg-volt-500/20 text-volt-400'
                          : 'border-secondary-600 text-secondary-300 hover:border-secondary-500'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h3 className="text-lg font-semibold text-white">Notification Settings</h3>

              {/* Delivery Methods */}
              <div>
                <h4 className="font-medium text-white mb-3">Delivery Methods</h4>
                <div className="space-y-3">
                  {[
                    { key: 'email', label: 'Email Notifications', description: 'Receive updates via email' },
                    { key: 'push', label: 'Push Notifications', description: 'Browser notifications' },
                    { key: 'sms', label: 'SMS Notifications', description: 'Text message alerts' }
                  ].map(method => (
                    <div key={method.key} className="flex items-center justify-between p-3 bg-secondary-700/50 rounded-lg">
                      <div>
                        <div className="font-medium text-white">{method.label}</div>
                        <div className="text-sm text-secondary-400">{method.description}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.notifications[method.key as keyof typeof preferences.notifications] as boolean}
                          onChange={(e) => updateNestedPreference('notifications', method.key, '', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-secondary-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-volt-500"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notification Types */}
              <div>
                <h4 className="font-medium text-white mb-3">Notification Types</h4>
                <div className="space-y-3">
                  {[
                    { key: 'submissions', label: 'Directory Submissions', description: 'When your business is submitted to directories' },
                    { key: 'approvals', label: 'Listing Approvals', description: 'When your listings go live' },
                    { key: 'rejections', label: 'Listing Rejections', description: 'When submissions are rejected' },
                    { key: 'analytics', label: 'Analytics Reports', description: 'Weekly performance summaries' },
                    { key: 'marketing', label: 'Marketing Updates', description: 'Product news and tips' }
                  ].map(type => (
                    <div key={type.key} className="flex items-center justify-between p-3 bg-secondary-700/50 rounded-lg">
                      <div>
                        <div className="font-medium text-white">{type.label}</div>
                        <div className="text-sm text-secondary-400">{type.description}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.notifications.types[type.key as keyof typeof preferences.notifications.types]}
                          onChange={(e) => updateNestedPreference('notifications', 'types', type.key, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-secondary-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-volt-500"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'dashboard' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h3 className="text-lg font-semibold text-white">Dashboard Settings</h3>

              {/* Default View */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Default View</label>
                <select
                  value={preferences.dashboard.defaultView}
                  onChange={(e) => updateNestedPreference('dashboard', 'defaultView', '', e.target.value)}
                  className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white"
                >
                  <option value="overview">Overview</option>
                  <option value="directories">Directories</option>
                  <option value="seo-tools">SEO Tools</option>
                  <option value="analytics">Analytics</option>
                </select>
              </div>

              {/* Auto Refresh */}
              <div className="flex items-center justify-between p-3 bg-secondary-700/50 rounded-lg">
                <div>
                  <div className="font-medium text-white">Auto Refresh</div>
                  <div className="text-sm text-secondary-400">Automatically update data</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.dashboard.autoRefresh}
                    onChange={(e) => updateNestedPreference('dashboard', 'autoRefresh', '', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-secondary-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-volt-500"></div>
                </label>
              </div>

              {/* Refresh Interval */}
              {preferences.dashboard.autoRefresh && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Refresh Interval</label>
                  <select
                    value={preferences.dashboard.refreshInterval}
                    onChange={(e) => updateNestedPreference('dashboard', 'refreshInterval', '', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white"
                  >
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>
              )}
            </motion.div>
          )}

          {activeSection === 'privacy' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h3 className="text-lg font-semibold text-white">Privacy Settings</h3>

              <div className="space-y-4">
                {[
                  { key: 'shareAnalytics', label: 'Share Analytics', description: 'Help improve DirectoryBolt by sharing anonymous usage data' },
                  { key: 'allowTracking', label: 'Allow Tracking', description: 'Enable tracking for personalized experience' },
                  { key: 'publicProfile', label: 'Public Profile', description: 'Make your business profile publicly visible' }
                ].map(setting => (
                  <div key={setting.key} className="flex items-center justify-between p-3 bg-secondary-700/50 rounded-lg">
                    <div>
                      <div className="font-medium text-white">{setting.label}</div>
                      <div className="text-sm text-secondary-400">{setting.description}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.privacy[setting.key as keyof typeof preferences.privacy]}
                        onChange={(e) => updateNestedPreference('privacy', setting.key, '', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-secondary-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-volt-500"></div>
                    </label>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeSection === 'accessibility' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h3 className="text-lg font-semibold text-white">Accessibility Settings</h3>

              {/* Font Size */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Font Size</label>
                <div className="grid grid-cols-4 gap-3">
                  {['small', 'medium', 'large', 'xl'].map(size => (
                    <button
                      key={size}
                      onClick={() => updateNestedPreference('accessibility', 'fontSize', '', size)}
                      className={`p-3 rounded-lg border text-center capitalize ${
                        preferences.accessibility.fontSize === size
                          ? 'border-volt-500 bg-volt-500/20 text-volt-400'
                          : 'border-secondary-600 text-secondary-300 hover:border-secondary-500'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accessibility Options */}
              <div className="space-y-4">
                {[
                  { key: 'highContrast', label: 'High Contrast', description: 'Increase color contrast for better visibility' },
                  { key: 'reducedMotion', label: 'Reduced Motion', description: 'Minimize animations and transitions' },
                  { key: 'screenReader', label: 'Screen Reader Support', description: 'Enhanced accessibility for screen readers' }
                ].map(setting => {
                  const currentValue = preferences.accessibility[setting.key as keyof typeof preferences.accessibility]
                  const isChecked = typeof currentValue === 'boolean' ? currentValue : false

                  return (
                    <div key={setting.key} className="flex items-center justify-between p-3 bg-secondary-700/50 rounded-lg">
                      <div>
                        <div className="font-medium text-white">{setting.label}</div>
                        <div className="text-sm text-secondary-400">{setting.description}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => updateNestedPreference('accessibility', setting.key, '', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-secondary-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-volt-500"></div>
                      </label>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Save Status */}
      {isSaving && (
        <div className="absolute bottom-4 right-4 bg-volt-500 text-secondary-900 px-4 py-2 rounded-lg text-sm font-medium">
          Saving...
        </div>
      )}
    </div>
  )
}