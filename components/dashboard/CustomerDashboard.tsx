'use client'
import { useState, useEffect, useMemo } from 'react'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { LoadingState } from '../ui/LoadingState'
import ProgressRing from './ProgressRing'
import ActionCards from './ActionCards'
import DirectoryGrid from './DirectoryGrid'
import NotificationCenter from './NotificationCenter'
import BusinessInfoEditor from './BusinessInfoEditor'
import ContentGapAnalyzer from '../seo/ContentGapAnalyzer'
import CompetitiveBenchmarking from '../analytics/CompetitiveBenchmarking'
import { getTier, canAccessFeature } from '../../lib/config/pricing'
import { 
  CustomerDashboard as CustomerDashboardType,
  DirectoryStatus, 
  BusinessInfo, 
  Notification, 
  ActionCard,
  DashboardStats 
} from '../../types/dashboard'

type DashboardData = {
  dashboard: CustomerDashboardType
  directories: DirectoryStatus[]
  businessInfo: BusinessInfo
  notifications: Notification[]
  actions: ActionCard[]
}

interface CustomerDashboardProps {
  userId: string
  userTier?: string // Add user tier prop
  initialData?: DashboardData
  onDataUpdate?: (data: any) => void
  className?: string
}

// Fetch real dashboard data from API
const fetchDashboardData = async (userId: string): Promise<DashboardData> => {
  try {
    const response = await fetch(`/api/customer/dashboard-data?customerId=${userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CUSTOMER_API_KEY || 'customer-api-key'}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard data: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.message || 'Failed to fetch dashboard data');
    }

    return result.data;
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    // Return fallback data on error
    return getFallbackData(userId);
  }
};

// Fallback data in case API fails
const getFallbackData = (userId: string): DashboardData => {
  return {
    dashboard: {
      totalDirectories: 0,
      submitted: 0,
      live: 0,
      pending: 0,
      lastUpdated: new Date().toISOString(),
      userId,
      businessName: 'Loading...'
    },
    directories: [],
    businessInfo: {
      id: userId,
      businessName: 'Loading...',
      description: '',
      website: '',
      phone: '',
      email: '',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      categories: [],
      socialMedia: {}
    },
    notifications: [],
    actions: []
  };
}

export default function CustomerDashboard({ 
  userId, 
  userTier = 'starter', // Default to starter tier
  initialData, 
  onDataUpdate, 
  className = '' 
}: CustomerDashboardProps) {
  const [data, setData] = useState<DashboardData>(initialData || getFallbackData(userId))
  const [isLoading, setIsLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'overview' | 'directories' | 'seo-tools' | 'analytics' | 'profile'>('overview')
  const [showBusinessEditor, setShowBusinessEditor] = useState(false)

  // Check feature access based on user tier
  const hasContentGapAnalysis = canAccessFeature(userTier, 'seoTools')
  const hasCompetitiveBenchmarking = canAccessFeature(userTier, 'competitorAnalysis')
  const tierInfo = getTier(userTier)

  // Generate navigation items based on user tier
  const navigationItems = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'directories', label: 'Directories', icon: '📁' },
    ...(hasContentGapAnalysis || hasCompetitiveBenchmarking ? [{ key: 'seo-tools', label: 'SEO Tools', icon: '🔍' }] : []),
    ...(hasCompetitiveBenchmarking ? [{ key: 'analytics', label: 'Analytics', icon: '📈' }] : []),
    { key: 'profile', label: 'Profile', icon: '⚙️' }
  ]

  // Calculate dashboard stats
  const stats: DashboardStats = useMemo(() => {
    const directories = data.directories
    const totalDirectories = directories.length
    const live = directories.filter(d => d.status === 'live').length
    const submitted = directories.filter(d => d.status === 'submitted' || d.status === 'processing').length
    const pending = directories.filter(d => d.status === 'pending').length
    const rejected = directories.filter(d => d.status === 'rejected').length
    
    const completionRate = totalDirectories > 0 ? (live / totalDirectories) * 100 : 0
    
    // Calculate average approval time (mock calculation)
    const approvedDirectories = directories.filter(d => d.status === 'live' && d.submittedAt && d.liveAt)
    const averageApprovalTime = approvedDirectories.length > 0 
      ? approvedDirectories.reduce((sum, dir) => {
          const submitted = new Date(dir.submittedAt!).getTime()
          const approved = new Date(dir.liveAt!).getTime()
          return sum + (approved - submitted) / (1000 * 60 * 60 * 24) // days
        }, 0) / approvedDirectories.length
      : 0

    return {
      totalDirectories,
      submitted,
      live,
      pending,
      rejectedCount: rejected,
      completionRate,
      averageApprovalTime: Math.round(averageApprovalTime),
      monthlyTraffic: directories.reduce((sum, dir) => sum + (dir.estimatedTraffic || 0), 0),
      leadGeneration: live * 15 // Mock: assume 15 leads per live directory
    }
  }, [data.directories])

  // Load dashboard data on mount
  useEffect(() => {
    if (!initialData) {
      loadDashboardData();
    }
  }, [userId, initialData]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboardData();
    }, 30000);

    return () => clearInterval(interval);
  }, [userId]);

  const loadDashboardData = async () => {
    try {
      setError(null);
      const freshData = await fetchDashboardData(userId);
      setData(freshData);
      onDataUpdate?.(freshData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBusinessInfoSave = async (updatedInfo: BusinessInfo) => {
    setIsLoading(true)
    setError(null)

    try {
      // In a real app, this would make an API call
      await new Promise(resolve => setTimeout(resolve, 1500)) // Simulate API delay
      
      setData(prev => ({
        ...prev,
        businessInfo: updatedInfo
      }))
      
      setShowBusinessEditor(false)
      onDataUpdate?.(data)
    } catch (err) {
      setError('Failed to save business information. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkNotificationAsRead = (notificationId: string) => {
    setData(prev => ({
      ...prev,
      notifications: prev.notifications.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    }))
  }

  const handleMarkAllNotificationsAsRead = () => {
    setData(prev => ({
      ...prev,
      notifications: prev.notifications.map(notification => ({
        ...notification,
        read: true
      }))
    }))
  }

  if (error && !data) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${className}`}>
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-6 max-w-md text-center">
          <span className="text-4xl mb-4 block">⚠️</span>
          <h3 className="text-lg font-bold text-white mb-2">Failed to Load Dashboard</h3>
          <p className="text-danger-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen bg-secondary-900 ${className}`}>
        {/* Header */}
        <header className="bg-secondary-800 border-b border-secondary-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-white flex items-center gap-3">
                  ⚡ Dashboard
                  <span className="text-base lg:text-lg font-normal text-secondary-400">
                    {data.businessInfo.businessName}
                  </span>
                </h1>
                <p className="text-secondary-400 mt-2">
                  Last updated {new Date(data.dashboard.lastUpdated).toLocaleString()}
                </p>
              </div>

              {/* Navigation */}
              <nav className="flex gap-2">
                {navigationItems.map((view) => (
                  <button
                    key={view.key}
                    onClick={() => setActiveView(view.key as typeof activeView)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      activeView === view.key
                        ? 'bg-volt-500 text-secondary-900'
                        : 'text-secondary-400 hover:text-secondary-300 hover:bg-secondary-700/50'
                    }`}
                  >
                    <span>{view.icon}</span>
                    <span className="hidden sm:inline">{view.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeView === 'overview' && (
            <div className="space-y-8">
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-secondary-400 text-sm">Total Directories</p>
                      <p className="text-2xl font-bold text-white">{stats.totalDirectories}</p>
                    </div>
                    <span className="text-3xl">📁</span>
                  </div>
                </div>

                <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-secondary-400 text-sm">Live Listings</p>
                      <p className="text-2xl font-bold text-success-400">{stats.live}</p>
                    </div>
                    <span className="text-3xl">✅</span>
                  </div>
                </div>

                <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-secondary-400 text-sm">Monthly Traffic</p>
                      <p className="text-2xl font-bold text-volt-400">
                        {stats.monthlyTraffic?.toLocaleString() || 'N/A'}
                      </p>
                    </div>
                    <span className="text-3xl">📈</span>
                  </div>
                </div>

                <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-secondary-400 text-sm">Est. Leads</p>
                      <p className="text-2xl font-bold text-volt-400">{stats.leadGeneration}/mo</p>
                    </div>
                    <span className="text-3xl">🎯</span>
                  </div>
                </div>
              </div>

              {/* Progress and Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                      📊 Completion Progress
                    </h3>
                    <div className="flex justify-center">
                      <ProgressRing 
                        progress={stats.completionRate}
                        size="lg"
                        label="Directory Completion"
                      />
                    </div>
                    <div className="mt-6 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-secondary-400">Avg. Approval Time:</span>
                        <span className="text-white font-medium">
                          {stats.averageApprovalTime} days
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-secondary-400">Success Rate:</span>
                        <span className="text-success-400 font-medium">
                          {Math.round((stats.live / (stats.live + stats.rejectedCount || 1)) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <ActionCards actions={data.actions} maxItems={4} />
                </div>
              </div>

              {/* Notifications */}
              <NotificationCenter
                notifications={data.notifications}
                onMarkAsRead={handleMarkNotificationAsRead}
                onMarkAllAsRead={handleMarkAllNotificationsAsRead}
                compact={true}
                maxItems={5}
              />
            </div>
          )}

          {activeView === 'directories' && (
            <DirectoryGrid 
              directories={data.directories}
              showFilters={true}
            />
          )}

          {activeView === 'seo-tools' && (hasContentGapAnalysis || hasCompetitiveBenchmarking) && (
            <div className="space-y-8">
              <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  🔍 SEO Tools
                  <span className="text-sm font-normal bg-volt-500/20 text-volt-400 px-2 py-1 rounded">
                    {tierInfo?.name || userTier}
                  </span>
                </h2>
                <p className="text-secondary-400 mb-6">
                  Advanced SEO analysis tools to help you outrank competitors and identify content opportunities.
                </p>

                {hasContentGapAnalysis && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      📈 Content Gap Analysis
                    </h3>
                    <ContentGapAnalyzer userTier={userTier as 'professional' | 'enterprise'} />
                  </div>
                )}

                {hasCompetitiveBenchmarking && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      🏆 Competitive Benchmarking
                    </h3>
                    <CompetitiveBenchmarking userTier={userTier as 'professional' | 'enterprise'} />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === 'analytics' && hasCompetitiveBenchmarking && (
            <div className="space-y-8">
              <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  📈 Advanced Analytics
                  <span className="text-sm font-normal bg-volt-500/20 text-volt-400 px-2 py-1 rounded">
                    {tierInfo?.name || userTier}
                  </span>
                </h2>
                <p className="text-secondary-400 mb-6">
                  Deep competitive insights and performance benchmarking against industry leaders.
                </p>
                <CompetitiveBenchmarking userTier={userTier as 'professional' | 'enterprise'} />
              </div>
            </div>
          )}

          {activeView === 'profile' && (
            <div className="space-y-8">
              {!showBusinessEditor ? (
                <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      🏢 Business Profile
                    </h3>
                    <button
                      onClick={() => setShowBusinessEditor(true)}
                      className="btn-primary"
                    >
                      Edit Profile
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-white mb-2">Business Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-secondary-400">Name:</span>
                            <span className="text-white">{data.businessInfo.businessName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-secondary-400">Website:</span>
                            <a 
                              href={data.businessInfo.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-volt-400 hover:text-volt-300"
                            >
                              {data.businessInfo.website}
                            </a>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-secondary-400">Categories:</span>
                            <span className="text-white">{data.businessInfo.categories.join(', ')}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-white mb-2">Contact Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-secondary-400">Email:</span>
                            <span className="text-white">{data.businessInfo.email}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-secondary-400">Phone:</span>
                            <span className="text-white">{data.businessInfo.phone}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-white mb-2">Address</h4>
                        <div className="text-sm text-secondary-300">
                          <p>{data.businessInfo.address.street}</p>
                          <p>{data.businessInfo.address.city}, {data.businessInfo.address.state} {data.businessInfo.address.zipCode}</p>
                          <p>{data.businessInfo.address.country}</p>
                        </div>
                      </div>

                      {data.businessInfo.description && (
                        <div>
                          <h4 className="font-semibold text-white mb-2">Description</h4>
                          <p className="text-sm text-secondary-300 leading-relaxed">
                            {data.businessInfo.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <BusinessInfoEditor
                  businessInfo={data.businessInfo}
                  onSave={handleBusinessInfoSave}
                  onCancel={() => setShowBusinessEditor(false)}
                  isLoading={isLoading}
                />
              )}
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="fixed inset-0 bg-secondary-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <LoadingState 
                message="Saving changes..."
                variant="spinner"
                size="lg"
              />
            </div>
          )}

          {/* Error Toast */}
          {error && (
            <div className="fixed bottom-4 right-4 bg-danger-500/90 backdrop-blur-sm text-white px-6 py-4 rounded-lg shadow-2xl z-50 max-w-md">
              <div className="flex items-start gap-3">
                <span className="text-xl">❌</span>
                <div>
                  <h4 className="font-bold mb-1">Error</h4>
                  <p className="text-sm">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-white/80 hover:text-white ml-auto"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  )
}

