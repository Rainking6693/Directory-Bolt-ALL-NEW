// PERFORMANCE ANALYTICS & MONITORING SYSTEM
// Real-user performance monitoring for new features

import { useState, useEffect } from 'react'
import { LoadingState } from '../ui/LoadingState'

interface PerformanceMetrics {
  timestamp: string
  userAgent: string
  viewport: { width: number; height: number }
  connection: string
  navigationTiming: {
    loadTime: number
    domContentLoaded: number
    firstContentfulPaint: number
    largestContentfulPaint: number
    cumulativeLayoutShift: number
    firstInputDelay: number
  }
  featureUsage: {
    seoToolsAccessed: boolean
    competitiveBenchmarkingUsed: boolean
    contentGapAnalysisUsed: boolean
    dashboardInteractions: number
    checkoutStarted: boolean
    checkoutCompleted: boolean
  }
  errors: Array<{
    message: string
    stack: string
    timestamp: string
    url: string
  }>
}

interface AnalyticsData {
  dailyActiveUsers: number
  featureAdoption: {
    seoTools: { users: number; sessions: number; conversionRate: number }
    competitiveAnalysis: { users: number; sessions: number; conversionRate: number }
    contentGapAnalysis: { users: number; sessions: number; conversionRate: number }
  }
  performanceScore: number
  userSatisfactionScore: number
  revenueImpact: number
}

export default function PerformanceAnalyticsDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d')

  useEffect(() => {
    // Start performance monitoring
    initializePerformanceMonitoring()
    loadAnalyticsData()
  }, [timeRange])

  const initializePerformanceMonitoring = () => {
    // Web Vitals monitoring
    if (typeof window !== 'undefined') {
      // Navigation Timing API
      window.addEventListener('load', () => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const paintEntries = performance.getEntriesByType('paint')
        
        const metrics: PerformanceMetrics = {
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          connection: (navigator as any).connection?.effectiveType || 'unknown',
          navigationTiming: {
            loadTime: perfData.loadEventEnd - perfData.loadEventStart,
            domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
            firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
            largestContentfulPaint: 0, // Will be updated by observer
            cumulativeLayoutShift: 0, // Will be updated by observer
            firstInputDelay: 0 // Will be updated by observer
          },
          featureUsage: {
            seoToolsAccessed: false,
            competitiveBenchmarkingUsed: false,
            contentGapAnalysisUsed: false,
            dashboardInteractions: 0,
            checkoutStarted: false,
            checkoutCompleted: false
          },
          errors: []
        }

        setMetrics(metrics)
        
        // Send to analytics endpoint
        sendMetricsToServer(metrics)
      })

      // Core Web Vitals observers
      observeWebVitals()
      
      // Error tracking
      window.addEventListener('error', (event) => {
        trackError(event.error, event.filename, event.lineno)
      })

      window.addEventListener('unhandledrejection', (event) => {
        trackError(event.reason, 'Promise rejection', 0)
      })
    }
  }

  const observeWebVitals = () => {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        const lastEntry = entries[entries.length - 1]
        
        setMetrics(prev => prev && lastEntry ? {
          ...prev,
          navigationTiming: {
            ...prev.navigationTiming,
            largestContentfulPaint: lastEntry.startTime
          }
        } : prev)
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((entryList) => {
        let clsValue = 0
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        }
        
        setMetrics(prev => prev ? {
          ...prev,
          navigationTiming: {
            ...prev.navigationTiming,
            cumulativeLayoutShift: clsValue
          }
        } : null)
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })

      // First Input Delay
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        const firstEntry = entries[0]
        
        setMetrics(prev => prev && firstEntry ? {
          ...prev,
          navigationTiming: {
            ...prev.navigationTiming,
            firstInputDelay: (firstEntry as any).processingStart - firstEntry.startTime
          }
        } : prev)
      })
      fidObserver.observe({ entryTypes: ['first-input'] })
    }
  }

  const trackError = (error: any, filename: string, lineno: number) => {
    const errorInfo = {
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      timestamp: new Date().toISOString(),
      url: filename
    }

    setMetrics(prev => prev ? {
      ...prev,
      errors: [...prev.errors, errorInfo]
    } : null)

    // Send critical errors immediately
    sendErrorToServer(errorInfo)
  }

  const trackFeatureUsage = (feature: keyof PerformanceMetrics['featureUsage'], value: boolean | number) => {
    setMetrics(prev => {
      if (!prev) return null
      
      return {
        ...prev,
        featureUsage: {
          ...prev.featureUsage,
          [feature]: typeof value === 'number' 
            ? prev.featureUsage[feature as keyof typeof prev.featureUsage] as number + value
            : value
        }
      }
    })
  }

  const loadAnalyticsData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/analytics/performance?range=${timeRange}`)
      const data = await response.json()
      
      if (data.success) {
        setAnalytics(data.data)
      }
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const sendMetricsToServer = async (metrics: PerformanceMetrics) => {
    try {
      await fetch('/api/analytics/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      })
    } catch (error) {
      console.error('Failed to send metrics:', error)
    }
  }

  const sendErrorToServer = async (error: any) => {
    try {
      await fetch('/api/analytics/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error)
      })
    } catch (error) {
      console.error('Failed to send error:', error)
    }
  }

  const getPerformanceScore = () => {
    if (!metrics) return 0
    
    const { navigationTiming } = metrics
    let score = 100
    
    // Deduct points for poor metrics
    if (navigationTiming.largestContentfulPaint > 2500) score -= 20
    if (navigationTiming.firstInputDelay > 100) score -= 15
    if (navigationTiming.cumulativeLayoutShift > 0.1) score -= 15
    if (navigationTiming.loadTime > 3000) score -= 25
    if (metrics.errors.length > 0) score -= metrics.errors.length * 5
    
    return Math.max(0, score)
  }

  const getHealthStatus = (score: number) => {
    if (score >= 90) return { status: 'Excellent', color: 'text-green-600', bg: 'bg-green-100' }
    if (score >= 70) return { status: 'Good', color: 'text-blue-600', bg: 'bg-blue-100' }
    if (score >= 50) return { status: 'Needs Improvement', color: 'text-volt-600', bg: 'bg-volt-100' }
    return { status: 'Poor', color: 'text-red-600', bg: 'bg-red-100' }
  }

  // Expose tracking functions to global scope for other components
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).trackFeatureUsage = trackFeatureUsage
    }
  }, [])

  if (isLoading) {
    return <LoadingState message="Loading performance analytics..." />
  }

  const performanceScore = getPerformanceScore()
  const healthStatus = getHealthStatus(performanceScore)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Performance Analytics</h2>
          <p className="text-gray-600">Real-user monitoring and feature analytics</p>
        </div>
        
        <div className="flex gap-2">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Performance Score */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Overall Performance Score</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${healthStatus.bg} ${healthStatus.color}`}>
            {healthStatus.status}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-gray-900">{performanceScore}</div>
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${performanceScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Core Web Vitals */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-900 mb-2">Largest Contentful Paint</h4>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(metrics.navigationTiming.largestContentfulPaint)}ms
            </div>
            <div className={`text-sm ${metrics.navigationTiming.largestContentfulPaint <= 2500 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.navigationTiming.largestContentfulPaint <= 2500 ? 'Good' : 'Needs Improvement'}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-900 mb-2">First Input Delay</h4>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(metrics.navigationTiming.firstInputDelay)}ms
            </div>
            <div className={`text-sm ${metrics.navigationTiming.firstInputDelay <= 100 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.navigationTiming.firstInputDelay <= 100 ? 'Good' : 'Needs Improvement'}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-900 mb-2">Cumulative Layout Shift</h4>
            <div className="text-2xl font-bold text-gray-900">
              {metrics.navigationTiming.cumulativeLayoutShift.toFixed(3)}
            </div>
            <div className={`text-sm ${metrics.navigationTiming.cumulativeLayoutShift <= 0.1 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.navigationTiming.cumulativeLayoutShift <= 0.1 ? 'Good' : 'Needs Improvement'}
            </div>
          </div>
        </div>
      )}

      {/* Feature Analytics */}
      {analytics && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Adoption</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {analytics.featureAdoption.seoTools.users}
              </div>
              <div className="text-sm text-gray-600">SEO Tools Users</div>
              <div className="text-xs text-gray-500 mt-1">
                {analytics.featureAdoption.seoTools.conversionRate}% conversion
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {analytics.featureAdoption.competitiveAnalysis.users}
              </div>
              <div className="text-sm text-gray-600">Competitive Analysis Users</div>
              <div className="text-xs text-gray-500 mt-1">
                {analytics.featureAdoption.competitiveAnalysis.conversionRate}% conversion
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {analytics.featureAdoption.contentGapAnalysis.users}
              </div>
              <div className="text-sm text-gray-600">Content Gap Analysis Users</div>
              <div className="text-xs text-gray-500 mt-1">
                {analytics.featureAdoption.contentGapAnalysis.conversionRate}% conversion
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Tracking */}
      {metrics && metrics.errors.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4">Recent Errors</h3>
          
          <div className="space-y-3">
            {metrics.errors.slice(0, 5).map((error, index) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="font-medium text-red-900 mb-1">{error.message}</div>
                <div className="text-sm text-red-700">
                  {error.url} • {new Date(error.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}