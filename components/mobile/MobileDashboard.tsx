'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import MobileHeader from './MobileHeader'
import MobileNavigation, { MobileBottomNavigation } from './MobileNavigation'
import { PWAManager } from '@/lib/pwa/pwa-manager'

interface MobileDashboardProps {
  userId: string
  userTier: string
  data: any
  className?: string
}

export default function MobileDashboard({
  userId,
  userTier,
  data,
  className = ''
}: MobileDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'directories' | 'analytics' | 'profile'>('overview')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pwaManager, setPwaManager] = useState<PWAManager | null>(null)

  // Initialize PWA manager
  useEffect(() => {
    const pwa = PWAManager.getInstance()
    setPwaManager(pwa)
    pwa.init()
    pwa.setupOfflineHandling()
  }, [])

  // Pull-to-refresh functionality
  const handlePullToRefresh = async () => {
    setIsRefreshing(true)
    try {
      // Trigger actual data refresh
      window.location.reload()
    } catch (error) {
      console.error('Refresh failed:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Touch gesture handling
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.targetTouches[0]) {
      setTouchStart(e.targetTouches[0].clientX)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.targetTouches[0]) {
      setTouchEnd(e.targetTouches[0].clientX)
    }
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    if (isLeftSwipe || isRightSwipe) {
      // Handle tab switching with swipe
      const tabs = ['overview', 'directories', 'analytics', 'profile']
      const currentIndex = tabs.indexOf(activeTab)
      
      if (isLeftSwipe && currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1] as any)
      } else if (isRightSwipe && currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1] as any)
      }
    }
  }

  const stats = {
    totalDirectories: data?.directories?.length || 0,
    liveListings: data?.directories?.filter((d: any) => d.status === 'live').length || 0,
    pendingSubmissions: data?.directories?.filter((d: any) => d.status === 'pending').length || 0,
    monthlyTraffic: data?.monthlyTraffic || 0
  }

  return (
    <div className={`min-h-screen bg-secondary-900 ${className}`}>
      {/* Mobile Header with PWA integration */}
      <MobileHeader
        title="DirectoryBolt"
        subtitle={`${userTier} Plan`}
        onMenuClick={() => setShowMobileMenu(true)}
        showNotifications={true}
        showPWAPrompt={true}
      />

      {/* Mobile Side Navigation */}
      <MobileNavigation
        isOpen={showMobileMenu}
        onClose={() => setShowMobileMenu(false)}
      />

      {/* Main Content */}
      <main 
        className="pb-20"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="px-4 py-6 space-y-6">
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Quick Stats */}
              <div>
                <h2 className="text-lg font-bold text-white mb-4">Overview</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{stats.totalDirectories}</div>
                      <div className="text-xs text-secondary-400">Total Directories</div>
                    </div>
                  </div>
                  
                  <div className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-success-400">{stats.liveListings}</div>
                      <div className="text-xs text-secondary-400">Live Listings</div>
                    </div>
                  </div>
                  
                  <div className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-volt-400">{stats.pendingSubmissions}</div>
                      <div className="text-xs text-secondary-400">Pending</div>
                    </div>
                  </div>
                  
                  <div className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-volt-400">
                        {stats.monthlyTraffic?.toLocaleString() || 'N/A'}
                      </div>
                      <div className="text-xs text-secondary-400">Monthly Traffic</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-md font-semibold text-white mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button className="bg-volt-500/20 text-volt-400 p-4 rounded-lg text-center hover:bg-volt-500/30 transition-colors">
                    <div className="text-2xl mb-2">📊</div>
                    <div className="text-sm font-medium">View Analytics</div>
                  </button>
                  
                  <button className="bg-blue-500/20 text-blue-400 p-4 rounded-lg text-center hover:bg-blue-500/30 transition-colors">
                    <div className="text-2xl mb-2">📝</div>
                    <div className="text-sm font-medium">Update Profile</div>
                  </button>
                  
                  <button className="bg-green-500/20 text-green-400 p-4 rounded-lg text-center hover:bg-green-500/30 transition-colors">
                    <div className="text-2xl mb-2">🚀</div>
                    <div className="text-sm font-medium">New Submission</div>
                  </button>
                  
                  <button className="bg-purple-500/20 text-purple-400 p-4 rounded-lg text-center hover:bg-purple-500/30 transition-colors">
                    <div className="text-2xl mb-2">💬</div>
                    <div className="text-sm font-medium">Support</div>
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h3 className="text-md font-semibold text-white mb-3">Recent Activity</h3>
                <div className="space-y-3">
                  {[
                    { icon: '✅', text: 'Business listing approved on Google My Business', time: '2 hours ago', type: 'success' },
                    { icon: '🔄', text: 'Submission to Yelp is being processed', time: '4 hours ago', type: 'pending' },
                    { icon: '📊', text: 'Weekly analytics report generated', time: '1 day ago', type: 'info' }
                  ].map((activity, index) => (
                    <div key={index} className="bg-secondary-800 rounded-lg p-3 border border-secondary-700">
                      <div className="flex items-start gap-3">
                        <span className="text-lg">{activity.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm text-white">{activity.text}</p>
                          <p className="text-xs text-secondary-400 mt-1">{activity.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'directories' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-bold text-white">Directories</h2>
              
              {/* Status Filter */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {['all', 'live', 'pending', 'processing', 'rejected'].map(status => (
                  <button
                    key={status}
                    className="flex-shrink-0 px-3 py-1.5 bg-secondary-800 border border-secondary-700 rounded-full text-xs font-medium text-secondary-300 hover:text-white transition-colors capitalize"
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Directory List */}
              <div className="space-y-3">
                {(data?.directories || []).slice(0, 10).map((directory: any, index: number) => (
                  <div key={index} className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-white text-sm">{directory.name || `Directory ${index + 1}`}</h3>
                        <p className="text-xs text-secondary-400 mt-1">{directory.category || 'Business'}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            directory.status === 'live' ? 'bg-success-500/20 text-success-400' :
                            directory.status === 'pending' ? 'bg-volt-500/20 text-volt-400' :
                            directory.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {directory.status || 'pending'}
                          </span>
                          <span className="text-xs text-secondary-500">
                            {directory.submittedAt ? new Date(directory.submittedAt).toLocaleDateString() : 'Today'}
                          </span>
                        </div>
                      </div>
                      
                      <button className="p-2 text-secondary-400 hover:text-white transition-colors">
                        <span className="text-sm">⋯</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-lg font-bold text-white">Analytics</h2>
              
              {/* Performance Chart Placeholder */}
              <div className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
                <h3 className="font-medium text-white mb-4">Performance Trends</h3>
                <div className="h-32 bg-secondary-700 rounded flex items-center justify-center">
                  <span className="text-secondary-400 text-sm">Chart would render here</span>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-secondary-400">Visibility Score</div>
                      <div className="text-xl font-bold text-white">87%</div>
                    </div>
                    <div className="text-2xl">📈</div>
                  </div>
                </div>
                
                <div className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-secondary-400">Est. Monthly Leads</div>
                      <div className="text-xl font-bold text-white">42</div>
                    </div>
                    <div className="text-2xl">🎯</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-lg font-bold text-white">Profile</h2>
              
              {/* Profile Info */}
              <div className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-volt-500/20 rounded-full flex items-center justify-center">
                    <span className="text-volt-400 font-bold text-lg">
                      {data?.businessInfo?.businessName?.[0] || 'B'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{data?.businessInfo?.businessName || 'Business Name'}</h3>
                    <p className="text-sm text-secondary-400">{data?.businessInfo?.industry || 'Industry'}</p>
                  </div>
                </div>
                
                <button className="w-full bg-volt-500/20 text-volt-400 py-2 rounded-lg text-sm font-medium hover:bg-volt-500/30 transition-colors">
                  Edit Profile
                </button>
              </div>

              {/* Settings */}
              <div className="space-y-3">
                <h3 className="font-medium text-white">Settings</h3>
                
                {[
                  { icon: '🔔', label: 'Notifications', value: 'Enabled' },
                  { icon: '🎨', label: 'Theme', value: 'Dark' },
                  { icon: '🌐', label: 'Language', value: 'English' },
                  { icon: '🔒', label: 'Privacy', value: 'Private' }
                ].map((setting, index) => (
                  <div key={index} className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{setting.icon}</span>
                        <span className="text-white font-medium">{setting.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-secondary-400">{setting.value}</span>
                        <span className="text-secondary-400">›</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNavigation />
    </div>
  )
}