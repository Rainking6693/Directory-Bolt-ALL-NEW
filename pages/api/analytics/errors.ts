// ANALYTICS ERRORS API ENDPOINT
// Handles JavaScript error reporting and tracking

import { NextApiRequest, NextApiResponse } from 'next'

// In-memory storage for demo (replace with database in production)
const errorStorage: any[] = []

interface ErrorReport {
  id: string
  timestamp: string
  userId?: string
  sessionId?: string
  message: string
  stack?: string
  url: string
  lineNumber?: number
  columnNumber?: number
  userAgent: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'javascript' | 'network' | 'security' | 'performance' | 'user_action'
  context?: any
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    })
  }

  try {
    const errorReport: ErrorReport = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      userId: req.body.userId,
      sessionId: req.body.sessionId || generateSessionId(),
      message: req.body.message || 'Unknown error',
      stack: req.body.stack,
      url: req.body.url || req.headers.referer || 'unknown',
      lineNumber: req.body.lineNumber,
      columnNumber: req.body.columnNumber,
      userAgent: req.headers['user-agent'] || 'unknown',
      severity: determineSeverity(req.body),
      category: determineCategory(req.body),
      context: req.body.context
    }

    // Store error
    errorStorage.push(errorReport)

    // Keep only last 1000 errors to prevent memory issues
    if (errorStorage.length > 1000) {
      errorStorage.splice(0, errorStorage.length - 1000)
    }

    // Log critical errors immediately
    if (errorReport.severity === 'critical') {
      console.error('🚨 CRITICAL ERROR:', {
        id: errorReport.id,
        message: errorReport.message,
        url: errorReport.url,
        userId: errorReport.userId,
        stack: errorReport.stack?.substring(0, 200) + '...'
      })
      
      // In production, send to monitoring service
      await sendCriticalErrorAlert(errorReport)
    } else {
      console.warn('⚠️ Error reported:', {
        id: errorReport.id,
        severity: errorReport.severity,
        category: errorReport.category,
        message: errorReport.message,
        userId: errorReport.userId
      })
    }

    // Generate error insights
    const insights = generateErrorInsights(errorReport)

    return res.status(200).json({
      success: true,
      data: {
        errorId: errorReport.id,
        severity: errorReport.severity,
        category: errorReport.category,
        insights,
        recommendations: insights.recommendations.slice(0, 3)
      }
    })

  } catch (error) {
    console.error('Error handling error report:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to process error report'
    })
  }
}

function determineSeverity(errorData: any): ErrorReport['severity'] {
  const message = (errorData.message || '').toLowerCase()
  const stack = (errorData.stack || '').toLowerCase()
  
  // Critical errors
  if (
    message.includes('security') ||
    message.includes('unauthorized') ||
    message.includes('payment') ||
    message.includes('stripe') ||
    stack.includes('checkout') ||
    stack.includes('payment')
  ) {
    return 'critical'
  }
  
  // High severity errors
  if (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    message.includes('cors') ||
    stack.includes('api')
  ) {
    return 'high'
  }
  
  // Medium severity errors
  if (
    message.includes('permission') ||
    message.includes('not found') ||
    message.includes('validation') ||
    stack.includes('form')
  ) {
    return 'medium'
  }
  
  // Default to low
  return 'low'
}

function determineCategory(errorData: any): ErrorReport['category'] {
  const message = (errorData.message || '').toLowerCase()
  const stack = (errorData.stack || '').toLowerCase()
  const url = (errorData.url || '').toLowerCase()
  
  // Network errors
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('cors')
  ) {
    return 'network'
  }
  
  // Security errors
  if (
    message.includes('security') ||
    message.includes('unauthorized') ||
    message.includes('csrf') ||
    message.includes('xss')
  ) {
    return 'security'
  }
  
  // Performance errors
  if (
    message.includes('memory') ||
    message.includes('performance') ||
    message.includes('timeout') ||
    stack.includes('performance')
  ) {
    return 'performance'
  }
  
  // User action errors
  if (
    stack.includes('click') ||
    stack.includes('submit') ||
    stack.includes('input') ||
    url.includes('checkout') ||
    url.includes('form')
  ) {
    return 'user_action'
  }
  
  // Default to JavaScript
  return 'javascript'
}

function generateErrorInsights(errorReport: ErrorReport) {
  const insights = {
    severity: errorReport.severity,
    category: errorReport.category,
    impact: getErrorImpact(errorReport),
    recommendations: [] as string[],
    relatedErrors: getRelatedErrorCount(errorReport),
    trend: getErrorTrend(errorReport)
  }

  // Generate recommendations based on error type
  switch (errorReport.category) {
    case 'network':
      insights.recommendations.push(
        'Implement retry logic for network requests',
        'Add proper error handling for API calls',
        'Consider using service workers for offline functionality'
      )
      break
      
    case 'security':
      insights.recommendations.push(
        'Review authentication and authorization logic',
        'Implement proper CSRF protection',
        'Add security headers and content validation'
      )
      break
      
    case 'performance':
      insights.recommendations.push(
        'Optimize memory usage and clean up event listeners',
        'Implement lazy loading for heavy components',
        'Add performance monitoring and alerts'
      )
      break
      
    case 'user_action':
      insights.recommendations.push(
        'Add form validation and user feedback',
        'Implement loading states for user actions',
        'Add error boundaries around interactive components'
      )
      break
      
    default:
      insights.recommendations.push(
        'Add try-catch blocks around error-prone code',
        'Implement proper error logging and monitoring',
        'Add unit tests to catch errors early'
      )
  }

  return insights
}

function getErrorImpact(errorReport: ErrorReport): string {
  if (errorReport.severity === 'critical') return 'high'
  if (errorReport.severity === 'high') return 'medium'
  return 'low'
}

function getRelatedErrorCount(errorReport: ErrorReport): number {
  // Count similar errors in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  return errorStorage.filter(error => 
    error.message === errorReport.message &&
    new Date(error.timestamp) > oneHourAgo
  ).length
}

function getErrorTrend(errorReport: ErrorReport): 'increasing' | 'stable' | 'decreasing' {
  // Simple trend analysis based on recent similar errors
  const recentErrors = errorStorage
    .filter(error => error.message === errorReport.message)
    .slice(-10)
  
  if (recentErrors.length < 3) return 'stable'
  
  const recent = recentErrors.slice(-3)
  const older = recentErrors.slice(-6, -3)
  
  if (recent.length > older.length) return 'increasing'
  if (recent.length < older.length) return 'decreasing'
  return 'stable'
}

async function sendCriticalErrorAlert(errorReport: ErrorReport) {
  // In production, integrate with monitoring services:
  // - Slack webhook
  // - PagerDuty
  // - Email alerts
  // - DataDog/NewRelic
  
  console.log('🚨 Would send critical error alert:', {
    errorId: errorReport.id,
    severity: errorReport.severity,
    message: errorReport.message,
    userId: errorReport.userId,
    timestamp: errorReport.timestamp
  })
  
  // Example Slack webhook (commented out for demo)
  /*
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Critical Error on DirectoryBolt`,
          attachments: [{
            color: 'danger',
            fields: [
              { title: 'Error ID', value: errorReport.id, short: true },
              { title: 'User ID', value: errorReport.userId || 'Anonymous', short: true },
              { title: 'Message', value: errorReport.message, short: false },
              { title: 'URL', value: errorReport.url, short: false }
            ]
          }]
        })
      })
    } catch (webhookError) {
      console.error('Failed to send Slack alert:', webhookError)
    }
  }
  */
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

function generateSessionId(): string {
  return 'sess_' + generateId()
}