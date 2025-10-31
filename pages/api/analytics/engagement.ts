import { NextRequest, NextResponse } from 'next/server'

interface EngagementEvent {
  userId: string
  event: string
  timestamp: string
  data: Record<string, any>
  sessionId?: string
  userTier?: string
}

interface UserAnalytics {
  userId: string
  totalEvents: number
  sessionsCount: number
  lastActiveAt: string
  onboardingCompleted: boolean
  featuresUsed: string[]
  engagementScore: number
  retentionMetrics: {
    daysSinceSignup: number
    daysActive: number
    lastVisit: string
  }
}

// In-memory storage for demo (replace with database in production)
const engagementEvents: Map<string, EngagementEvent[]> = new Map()
const userAnalytics: Map<string, UserAnalytics> = new Map()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, event, data, sessionId, userTier } = body

    if (!userId || !event) {
      return NextResponse.json(
        { error: 'User ID and event are required' },
        { status: 400 }
      )
    }

    const engagementEvent: EngagementEvent = {
      userId,
      event,
      timestamp: new Date().toISOString(),
      data: data || {},
      sessionId,
      userTier
    }

    // Store event
    const userEvents = engagementEvents.get(userId) || []
    userEvents.push(engagementEvent)
    engagementEvents.set(userId, userEvents)

    // Update analytics
    updateUserAnalytics(userId, engagementEvent)

    return NextResponse.json({
      success: true,
      event: engagementEvent
    })
  } catch (error) {
    console.error('Error tracking engagement:', error)
    return NextResponse.json(
      { error: 'Failed to track engagement' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')
  const type = url.searchParams.get('type') || 'analytics'
  const timeframe = url.searchParams.get('timeframe') || '7d'

  if (!userId) {
    return NextResponse.json(
      { error: 'User ID is required' },
      { status: 400 }
    )
  }

  try {
    if (type === 'events') {
      const events = engagementEvents.get(userId) || []
      const filteredEvents = filterEventsByTimeframe(events, timeframe)
      
      return NextResponse.json({
        events: filteredEvents,
        total: filteredEvents.length
      })
    }

    if (type === 'analytics') {
      const analytics = userAnalytics.get(userId)
      
      if (!analytics) {
        return NextResponse.json({
          analytics: null,
          message: 'No analytics data found'
        })
      }

      return NextResponse.json({
        analytics,
        insights: generateInsights(userId, analytics)
      })
    }

    return NextResponse.json(
      { error: 'Invalid type parameter' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error retrieving engagement data:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve engagement data' },
      { status: 500 }
    )
  }
}

function updateUserAnalytics(userId: string, event: EngagementEvent) {
  const existing = userAnalytics.get(userId) || {
    userId,
    totalEvents: 0,
    sessionsCount: 0,
    lastActiveAt: event.timestamp,
    onboardingCompleted: false,
    featuresUsed: [],
    engagementScore: 0,
    retentionMetrics: {
      daysSinceSignup: 0,
      daysActive: 0,
      lastVisit: event.timestamp
    }
  }

  // Update basic metrics
  existing.totalEvents++
  existing.lastActiveAt = event.timestamp

  // Track feature usage
  if (event.event.startsWith('feature_')) {
    const feature = event.event.replace('feature_', '')
    if (!existing.featuresUsed.includes(feature)) {
      existing.featuresUsed.push(feature)
    }
  }

  // Track onboarding completion
  if (event.event === 'onboarding_completed') {
    existing.onboardingCompleted = true
  }

  // Calculate engagement score
  existing.engagementScore = calculateEngagementScore(userId, existing)

  // Update retention metrics
  existing.retentionMetrics.lastVisit = event.timestamp
  
  userAnalytics.set(userId, existing)
}

function calculateEngagementScore(userId: string, analytics: UserAnalytics): number {
  let score = 0
  
  // Base score from total events
  score += Math.min(analytics.totalEvents * 2, 100)
  
  // Bonus for onboarding completion
  if (analytics.onboardingCompleted) score += 50
  
  // Bonus for feature usage diversity
  score += analytics.featuresUsed.length * 10
  
  // Recent activity bonus
  const hoursSinceLastActive = (Date.now() - new Date(analytics.lastActiveAt).getTime()) / (1000 * 60 * 60)
  if (hoursSinceLastActive < 24) score += 25
  else if (hoursSinceLastActive < 72) score += 10
  
  return Math.min(score, 1000) // Cap at 1000
}

function filterEventsByTimeframe(events: EngagementEvent[], timeframe: string): EngagementEvent[] {
  const now = new Date()
  let startDate: Date
  
  switch (timeframe) {
    case '1d':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    default:
      return events
  }
  
  return events.filter(event => new Date(event.timestamp) >= startDate)
}

function generateInsights(userId: string, analytics: UserAnalytics) {
  const insights = []
  
  // Engagement level
  if (analytics.engagementScore > 500) {
    insights.push({
      type: 'positive',
      title: 'High Engagement',
      description: 'This user is highly engaged with the platform',
      action: 'Consider offering advanced features or upgrade options'
    })
  } else if (analytics.engagementScore < 100) {
    insights.push({
      type: 'warning',
      title: 'Low Engagement',
      description: 'User may need additional support or guidance',
      action: 'Send onboarding reminders or offer personal assistance'
    })
  }
  
  // Feature usage
  if (analytics.featuresUsed.length > 5) {
    insights.push({
      type: 'positive',
      title: 'Feature Explorer',
      description: 'User is actively exploring different features',
      action: 'Highlight advanced features they haven\'t tried'
    })
  }
  
  // Onboarding
  if (!analytics.onboardingCompleted && analytics.totalEvents > 10) {
    insights.push({
      type: 'warning',
      title: 'Incomplete Onboarding',
      description: 'User is active but hasn\'t completed onboarding',
      action: 'Send targeted onboarding completion reminder'
    })
  }
  
  return insights
}