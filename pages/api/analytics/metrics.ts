// ANALYTICS METRICS API ENDPOINT
// Handles performance metrics submission from frontend

import { NextApiRequest, NextApiResponse } from 'next'

// In-memory storage for demo (replace with database in production)
const metricsStorage: any[] = []

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    })
  }

  try {
    const metric = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      ...req.body,
      // Ensure proper data structure
      sessionId: req.body.sessionId || generateSessionId(),
      userId: req.body.userId || null
    }

    // Validate required fields
    if (!metric.navigationTiming || !metric.userAgent) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required performance data (navigationTiming, userAgent)' 
      })
    }

    // Store metrics
    metricsStorage.push(metric)

    // Keep only last 1000 metrics to prevent memory issues
    if (metricsStorage.length > 1000) {
      metricsStorage.splice(0, metricsStorage.length - 1000)
    }

    // Generate quick insights
    const performanceScore = calculatePerformanceScore(metric)
    const insights = generateQuickInsights(metric, performanceScore)

    console.log('📊 Performance metric received:', {
      id: metric.id,
      userId: metric.userId,
      performanceScore,
      lcp: metric.navigationTiming.largestContentfulPaint,
      fid: metric.navigationTiming.firstInputDelay,
      cls: metric.navigationTiming.cumulativeLayoutShift
    })

    return res.status(200).json({
      success: true,
      data: {
        metricId: metric.id,
        performanceScore,
        insights,
        recommendations: insights.recommendations.slice(0, 2) // Top 2 recommendations
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

function calculatePerformanceScore(metric: any): number {
  let score = 100
  
  const { navigationTiming } = metric
  
  // Deduct points for poor Core Web Vitals
  if (navigationTiming.largestContentfulPaint > 4000) score -= 30
  else if (navigationTiming.largestContentfulPaint > 2500) score -= 15
  
  if (navigationTiming.firstInputDelay > 300) score -= 25
  else if (navigationTiming.firstInputDelay > 100) score -= 10
  
  if (navigationTiming.cumulativeLayoutShift > 0.25) score -= 25
  else if (navigationTiming.cumulativeLayoutShift > 0.1) score -= 10
  
  // Deduct for load time
  if (navigationTiming.loadTime > 5000) score -= 20
  else if (navigationTiming.loadTime > 3000) score -= 10
  
  // Deduct for errors
  if (metric.errors && metric.errors.length > 0) {
    score -= Math.min(metric.errors.length * 5, 20)
  }
  
  return Math.max(0, Math.round(score))
}

function generateQuickInsights(metric: any, performanceScore: number) {
  const insights = {
    grade: getPerformanceGrade(performanceScore),
    criticalIssues: [] as string[],
    recommendations: [] as string[],
    summary: {
      performanceScore,
      issuesFound: 0,
      featuresUsed: metric.featureUsage ? Object.values(metric.featureUsage).filter(Boolean).length : 0
    }
  }

  const { navigationTiming } = metric

  // Identify critical issues and recommendations
  if (navigationTiming.largestContentfulPaint > 4000) {
    insights.criticalIssues.push('Very slow Largest Contentful Paint (> 4s)')
    insights.recommendations.push('Optimize images, use WebP format, and implement lazy loading')
  } else if (navigationTiming.largestContentfulPaint > 2500) {
    insights.criticalIssues.push('Slow Largest Contentful Paint (> 2.5s)')
    insights.recommendations.push('Compress images and reduce render-blocking resources')
  }

  if (navigationTiming.firstInputDelay > 300) {
    insights.criticalIssues.push('High First Input Delay (> 300ms)')
    insights.recommendations.push('Reduce JavaScript execution time and optimize main thread')
  }

  if (navigationTiming.cumulativeLayoutShift > 0.25) {
    insights.criticalIssues.push('High Cumulative Layout Shift (> 0.25)')
    insights.recommendations.push('Set size attributes on images and reserve space for dynamic content')
  }

  if (metric.errors && metric.errors.length > 0) {
    insights.criticalIssues.push(`${metric.errors.length} JavaScript errors detected`)
    insights.recommendations.push('Fix JavaScript errors to improve user experience')
  }

  insights.summary.issuesFound = insights.criticalIssues.length

  return insights
}

function getPerformanceGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

function generateSessionId(): string {
  return 'sess_' + generateId()
}