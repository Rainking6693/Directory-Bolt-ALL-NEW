// PERFORMANCE ANALYTICS API ENDPOINTS
// Handles real-user performance data collection and reporting

import { NextApiRequest, NextApiResponse } from 'next'

interface PerformanceMetric {
  id: string
  userId?: string
  sessionId: string
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

// In-memory storage for demo (replace with database in production)
const metricsStorage: PerformanceMetric[] = []
const errorStorage: any[] = []

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    return handleMetricsSubmission(req, res)
  } else if (req.method === 'GET') {
    return handleAnalyticsQuery(req, res)
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

async function handleMetricsSubmission(req: NextApiRequest, res: NextApiResponse) {
  try {
    const metric: PerformanceMetric = {
      id: generateId(),
      sessionId: req.body.sessionId || generateSessionId(),
      userId: req.body.userId,
      ...req.body,
      timestamp: new Date().toISOString()
    }

    // Validate required fields
    if (!metric.navigationTiming || !metric.featureUsage) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required performance data' 
      })
    }

    // Store metrics (in production, save to database)
    metricsStorage.push(metric)

    // Keep only last 1000 metrics to prevent memory issues
    if (metricsStorage.length > 1000) {
      metricsStorage.splice(0, metricsStorage.length - 1000)
    }

    // Generate insights in real-time
    const insights = generatePerformanceInsights(metric)

    // Send alerts for critical issues
    if (insights.criticalIssues.length > 0) {
      await sendPerformanceAlert(metric, insights.criticalIssues)
    }

    return res.status(200).json({
      success: true,
      data: {
        metricId: metric.id,
        insights: insights.summary,
        recommendations: insights.recommendations.slice(0, 3) // Top 3 recommendations
      }
    })

  } catch (error) {
    console.error('Error handling metrics submission:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to process performance metrics'
    })
  }
}

async function handleAnalyticsQuery(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { range = '7d', feature } = req.query

    const timeRangeMs = getTimeRangeMs(range as string)
    const cutoffTime = new Date(Date.now() - timeRangeMs).toISOString()

    // Filter metrics by time range
    const recentMetrics = metricsStorage.filter(
      metric => metric.timestamp >= cutoffTime
    )

    // Generate analytics data
    const analyticsData = {
      dailyActiveUsers: getDailyActiveUsers(recentMetrics),
      featureAdoption: getFeatureAdoption(recentMetrics),
      performanceScore: getAveragePerformanceScore(recentMetrics),
      userSatisfactionScore: calculateUserSatisfactionScore(recentMetrics),
      revenueImpact: calculateRevenueImpact(recentMetrics),
      topIssues: getTopPerformanceIssues(recentMetrics),
      improvements: getPerformanceImprovements(recentMetrics),
      demographics: getUserDemographics(recentMetrics)
    }

    return res.status(200).json({
      success: true,
      data: analyticsData,
      metadata: {
        range,
        totalMetrics: recentMetrics.length,
        lastUpdated: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error handling analytics query:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to generate analytics data'
    })
  }
}

function generatePerformanceInsights(metric: PerformanceMetric) {
  const insights = {
    criticalIssues: [] as string[],
    recommendations: [] as string[],
    summary: {
      performanceGrade: 'A',
      issuesFound: 0,
      featuresUsed: 0
    }
  }

  // Check navigation timing issues
  if (metric.navigationTiming.largestContentfulPaint > 4000) {
    insights.criticalIssues.push('Slow Largest Contentful Paint (> 4s)')
    insights.recommendations.push('Optimize images and reduce render-blocking resources')
  }

  if (metric.navigationTiming.firstInputDelay > 300) {
    insights.criticalIssues.push('High First Input Delay (> 300ms)')
    insights.recommendations.push('Reduce JavaScript execution time and main thread blocking')
  }

  if (metric.navigationTiming.cumulativeLayoutShift > 0.25) {
    insights.criticalIssues.push('High Cumulative Layout Shift (> 0.25)')
    insights.recommendations.push('Ensure size attributes on images and reserve space for dynamic content')
  }

  // Check error frequency
  if (metric.errors.length > 0) {
    insights.criticalIssues.push(`${metric.errors.length} JavaScript errors detected`)
    insights.recommendations.push('Fix JavaScript errors to improve user experience')
  }

  // Calculate performance grade
  const issueCount = insights.criticalIssues.length
  if (issueCount === 0) insights.summary.performanceGrade = 'A'
  else if (issueCount <= 2) insights.summary.performanceGrade = 'B'
  else if (issueCount <= 4) insights.summary.performanceGrade = 'C'
  else insights.summary.performanceGrade = 'F'

  insights.summary.issuesFound = issueCount
  insights.summary.featuresUsed = Object.values(metric.featureUsage).filter(Boolean).length

  return insights
}

async function sendPerformanceAlert(metric: PerformanceMetric, issues: string[]) {
  // In production, send to monitoring service (Slack, email, etc.)
  console.warn('🚨 Performance Alert:', {
    userId: metric.userId,
    sessionId: metric.sessionId,
    issues: issues,
    timestamp: metric.timestamp,
    userAgent: metric.userAgent
  })

  // Could integrate with services like:
  // - Slack webhook
  // - Email alerts
  // - PagerDuty
  // - DataDog alerts
}

function getDailyActiveUsers(metrics: PerformanceMetric[]): number {
  const uniqueUsers = new Set()
  const today = new Date().toDateString()
  
  metrics.forEach(metric => {
    const metricDate = new Date(metric.timestamp).toDateString()
    if (metricDate === today && metric.userId) {
      uniqueUsers.add(metric.userId)
    }
  })
  
  return uniqueUsers.size
}

function getFeatureAdoption(metrics: PerformanceMetric[]) {
  const adoption = {
    seoTools: { users: 0, sessions: 0, conversionRate: 0 },
    competitiveAnalysis: { users: 0, sessions: 0, conversionRate: 0 },
    contentGapAnalysis: { users: 0, sessions: 0, conversionRate: 0 }
  }

  const userSets = {
    seoTools: new Set(),
    competitiveAnalysis: new Set(),
    contentGapAnalysis: new Set()
  }

  let totalSessions = 0
  let checkoutConversions = 0

  metrics.forEach(metric => {
    totalSessions++
    
    if (metric.featureUsage.seoToolsAccessed) {
      adoption.seoTools.sessions++
      if (metric.userId) userSets.seoTools.add(metric.userId)
    }
    
    if (metric.featureUsage.competitiveBenchmarkingUsed) {
      adoption.competitiveAnalysis.sessions++
      if (metric.userId) userSets.competitiveAnalysis.add(metric.userId)
    }
    
    if (metric.featureUsage.contentGapAnalysisUsed) {
      adoption.contentGapAnalysis.sessions++
      if (metric.userId) userSets.contentGapAnalysis.add(metric.userId)
    }

    if (metric.featureUsage.checkoutCompleted) {
      checkoutConversions++
    }
  })

  // Calculate conversion rates
  adoption.seoTools.users = userSets.seoTools.size
  adoption.seoTools.conversionRate = totalSessions > 0 ? Math.round((checkoutConversions / totalSessions) * 100) : 0

  adoption.competitiveAnalysis.users = userSets.competitiveAnalysis.size
  adoption.competitiveAnalysis.conversionRate = adoption.seoTools.conversionRate // Simplified

  adoption.contentGapAnalysis.users = userSets.contentGapAnalysis.size  
  adoption.contentGapAnalysis.conversionRate = adoption.seoTools.conversionRate // Simplified

  return adoption
}

function getAveragePerformanceScore(metrics: PerformanceMetric[]): number {
  if (metrics.length === 0) return 100

  const scores = metrics.map(metric => {
    let score = 100
    
    // Deduct points for poor performance
    if (metric.navigationTiming.largestContentfulPaint > 2500) score -= 20
    if (metric.navigationTiming.firstInputDelay > 100) score -= 15
    if (metric.navigationTiming.cumulativeLayoutShift > 0.1) score -= 15
    if (metric.navigationTiming.loadTime > 3000) score -= 25
    if (metric.errors.length > 0) score -= metric.errors.length * 5
    
    return Math.max(0, score)
  })

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

function calculateUserSatisfactionScore(metrics: PerformanceMetric[]): number {
  // Simplified satisfaction calculation based on performance and feature usage
  const avgPerformance = getAveragePerformanceScore(metrics)
  const featureUsageRate = metrics.filter(m => 
    Object.values(m.featureUsage).some(Boolean)
  ).length / Math.max(metrics.length, 1)
  
  return Math.round((avgPerformance * 0.7) + (featureUsageRate * 100 * 0.3))
}

function calculateRevenueImpact(metrics: PerformanceMetric[]): number {
  // Simplified revenue calculation
  const conversions = metrics.filter(m => m.featureUsage.checkoutCompleted).length
  const averageOrderValue = 350 // Average based on pricing tiers
  
  return conversions * averageOrderValue
}

function getTopPerformanceIssues(metrics: PerformanceMetric[]) {
  const issues = {
    slowLCP: 0,
    highFID: 0,
    highCLS: 0,
    jsErrors: 0
  }

  metrics.forEach(metric => {
    if (metric.navigationTiming.largestContentfulPaint > 2500) issues.slowLCP++
    if (metric.navigationTiming.firstInputDelay > 100) issues.highFID++
    if (metric.navigationTiming.cumulativeLayoutShift > 0.1) issues.highCLS++
    if (metric.errors.length > 0) issues.jsErrors++
  })

  return Object.entries(issues)
    .map(([issue, count]) => ({ issue, count, percentage: Math.round((count / metrics.length) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

function getPerformanceImprovements(metrics: PerformanceMetric[]) {
  // Compare recent vs older metrics to show improvements
  const recentMetrics = metrics.slice(-100) // Last 100 metrics
  const olderMetrics = metrics.slice(0, 100) // First 100 metrics

  if (olderMetrics.length === 0) return null

  const recentScore = getAveragePerformanceScore(recentMetrics)
  const olderScore = getAveragePerformanceScore(olderMetrics)
  
  return {
    scoreChange: recentScore - olderScore,
    trend: recentScore > olderScore ? 'improving' : 'declining',
    improvements: recentScore > olderScore ? [
      'Reduced page load times',
      'Improved Core Web Vitals scores',
      'Fewer JavaScript errors'
    ] : []
  }
}

function getUserDemographics(metrics: PerformanceMetric[]) {
  const browsers = new Map()
  const connections = new Map()
  const viewports = { mobile: 0, tablet: 0, desktop: 0 }

  metrics.forEach(metric => {
    // Browser detection
    const browser = getBrowserFromUserAgent(metric.userAgent)
    browsers.set(browser, (browsers.get(browser) || 0) + 1)
    
    // Connection type
    connections.set(metric.connection, (connections.get(metric.connection) || 0) + 1)
    
    // Viewport categorization
    if (metric.viewport.width < 768) viewports.mobile++
    else if (metric.viewport.width < 1024) viewports.tablet++
    else viewports.desktop++
  })

  return {
    browsers: Array.from(browsers.entries()).map(([browser, count]) => ({ browser, count })),
    connections: Array.from(connections.entries()).map(([connection, count]) => ({ connection, count })),
    viewports
  }
}

function getBrowserFromUserAgent(userAgent: string): string {
  if (userAgent.includes('Chrome')) return 'Chrome'
  if (userAgent.includes('Firefox')) return 'Firefox'
  if (userAgent.includes('Safari')) return 'Safari'
  if (userAgent.includes('Edge')) return 'Edge'
  return 'Other'
}

function getTimeRangeMs(range: string): number {
  switch (range) {
    case '24h': return 24 * 60 * 60 * 1000
    case '7d': return 7 * 24 * 60 * 60 * 1000
    case '30d': return 30 * 24 * 60 * 60 * 1000
    default: return 7 * 24 * 60 * 60 * 1000
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

function generateSessionId(): string {
  return 'sess_' + generateId()
}