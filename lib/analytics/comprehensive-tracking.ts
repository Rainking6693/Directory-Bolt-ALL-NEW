// Comprehensive Analytics and User Journey Tracking
import { dbManager } from '../database/optimized-queries'

interface AnalyticsEvent {
  customer_id?: string
  session_id?: string
  event_type: 'pageview' | 'interaction' | 'conversion' | 'error' | 'performance'
  event_name: string
  event_data: Record<string, any>
  timestamp: string
  user_agent?: string
  ip_address?: string
  referrer?: string
  page_url?: string
}

interface ConversionFunnel {
  step: string
  users: number
  conversion_rate: number
  drop_off_rate: number
  average_time: number
}

interface UserJourney {
  session_id: string
  customer_id?: string
  events: AnalyticsEvent[]
  start_time: string
  end_time?: string
  total_duration?: number
  conversion_outcome?: 'converted' | 'abandoned' | 'in_progress'
}

class ComprehensiveAnalytics {
  private static instance: ComprehensiveAnalytics
  private eventBuffer: AnalyticsEvent[] = []
  private bufferSize: number = 100
  private flushInterval: number = 30000 // 30 seconds

  private constructor() {
    this.startEventFlusher()
    this.startPerformanceMonitoring()
  }

  static getInstance(): ComprehensiveAnalytics {
    if (!ComprehensiveAnalytics.instance) {
      ComprehensiveAnalytics.instance = new ComprehensiveAnalytics()
    }
    return ComprehensiveAnalytics.instance
  }

  // Track user events with context
  async trackEvent(event: Omit<AnalyticsEvent, 'timestamp'>) {
    const enrichedEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date().toISOString()
    }

    this.eventBuffer.push(enrichedEvent)

    // Immediate flush for critical events
    const criticalEvents = ['conversion', 'error', 'payment_failure']
    if (criticalEvents.includes(event.event_name)) {
      await this.flushEvents()
    }

    // Auto-flush when buffer is full
    if (this.eventBuffer.length >= this.bufferSize) {
      await this.flushEvents()
    }
  }

  // Flush events to database
  private async flushEvents() {
    if (this.eventBuffer.length === 0) return

    const events = this.eventBuffer.splice(0)
    
    try {
      const { error } = await dbManager.getClient()
        .from('analytics_events')
        .insert(events.map(event => ({
          id: crypto.randomUUID(),
          customer_id: event.customer_id,
          event_type: event.event_type,
          event_name: event.event_name,
          event_data: event.event_data,
          created_at: event.timestamp
        })))

      if (error) {
        console.error('❌ Failed to flush analytics events:', error)
        // Re-add events to buffer for retry
        this.eventBuffer.unshift(...events)
      }
    } catch (error) {
      console.error('❌ Analytics flush error:', error)
    }
  }

  // Start automatic event flushing
  private startEventFlusher() {
    setInterval(async () => {
      await this.flushEvents()
    }, this.flushInterval)
  }

  // Track page views with performance metrics
  async trackPageView(data: {
    page_url: string
    referrer?: string
    user_agent?: string
    session_id?: string
    customer_id?: string
    load_time?: number
    core_web_vitals?: {
      fcp: number // First Contentful Paint
      lcp: number // Largest Contentful Paint
      fid: number // First Input Delay
      cls: number // Cumulative Layout Shift
    }
  }) {
    await this.trackEvent({
      event_type: 'pageview',
      event_name: 'page_viewed',
      event_data: {
        page: data.page_url,
        referrer: data.referrer,
        load_time: data.load_time,
        core_web_vitals: data.core_web_vitals
      },
      session_id: data.session_id,
      customer_id: data.customer_id,
      user_agent: data.user_agent,
      page_url: data.page_url,
      referrer: data.referrer
    })
  }

  // Track user interactions
  async trackInteraction(data: {
    element: string
    action: string
    page_url: string
    session_id?: string
    customer_id?: string
    additional_data?: Record<string, any>
  }) {
    await this.trackEvent({
      event_type: 'interaction',
      event_name: `${data.element}_${data.action}`,
      event_data: {
        element: data.element,
        action: data.action,
        page: data.page_url,
        ...data.additional_data
      },
      session_id: data.session_id,
      customer_id: data.customer_id,
      page_url: data.page_url
    })
  }

  // Track conversion events
  async trackConversion(data: {
    conversion_type: 'registration' | 'payment' | 'upgrade'
    value?: number
    package_type?: string
    session_id?: string
    customer_id?: string
    additional_data?: Record<string, any>
  }) {
    await this.trackEvent({
      event_type: 'conversion',
      event_name: `${data.conversion_type}_completed`,
      event_data: {
        conversion_type: data.conversion_type,
        value: data.value,
        package_type: data.package_type,
        ...data.additional_data
      },
      session_id: data.session_id,
      customer_id: data.customer_id
    })
  }

  // Track errors with context
  async trackError(data: {
    error_type: 'client' | 'server' | 'network'
    error_message: string
    error_stack?: string
    page_url?: string
    session_id?: string
    customer_id?: string
    additional_context?: Record<string, any>
  }) {
    await this.trackEvent({
      event_type: 'error',
      event_name: `${data.error_type}_error`,
      event_data: {
        error_type: data.error_type,
        message: data.error_message,
        stack: data.error_stack,
        context: data.additional_context
      },
      session_id: data.session_id,
      customer_id: data.customer_id,
      page_url: data.page_url
    })
  }

  // Generate conversion funnel analysis
  async getConversionFunnel(timeRange: '1d' | '7d' | '30d' = '7d'): Promise<ConversionFunnel[]> {
    const days = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: events, error } = await dbManager.getClient()
      .from('analytics_events')
      .select('event_name, session_id, created_at')
      .gte('created_at', startDate)
      .in('event_name', [
        'page_viewed',
        'pricing_viewed',
        'package_selected',
        'checkout_initiated',
        'payment_completed',
        'registration_completed'
      ])
      .order('created_at', { ascending: true })

    if (error || !events) {
      return []
    }

    // Group events by session
    const sessionEvents = events.reduce((acc, event) => {
      if (!acc[event.session_id]) {
        acc[event.session_id] = []
      }
      acc[event.session_id].push(event)
      return acc
    }, {} as Record<string, typeof events>)

    // Calculate funnel metrics
    const funnelSteps = [
      { step: 'Landing Page', event: 'page_viewed' },
      { step: 'Pricing Page', event: 'pricing_viewed' },
      { step: 'Package Selected', event: 'package_selected' },
      { step: 'Checkout Initiated', event: 'checkout_initiated' },
      { step: 'Payment Completed', event: 'payment_completed' },
      { step: 'Registration Completed', event: 'registration_completed' }
    ]

    const totalSessions = Object.keys(sessionEvents).length
    const funnel: ConversionFunnel[] = []

    for (let i = 0; i < funnelSteps.length; i++) {
      const step = funnelSteps[i]
      const sessionsWithStep = Object.values(sessionEvents).filter(sessionEventList =>
        sessionEventList.some(event => event.event_name === step.event)
      ).length

      const conversionRate = i === 0 ? 100 : (sessionsWithStep / funnel[i - 1].users) * 100
      const dropOffRate = i === 0 ? 0 : 100 - conversionRate

      funnel.push({
        step: step.step,
        users: sessionsWithStep,
        conversion_rate: Math.round(conversionRate * 100) / 100,
        drop_off_rate: Math.round(dropOffRate * 100) / 100,
        average_time: 0 // Calculate if needed
      })
    }

    return funnel
  }

  // Get user journey analysis
  async getUserJourney(sessionId: string): Promise<UserJourney | null> {
    const { data: events, error } = await dbManager.getClient()
      .from('analytics_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error || !events || events.length === 0) {
      return null
    }

    const startTime = events[0].created_at
    const endTime = events[events.length - 1].created_at
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime()

    // Determine conversion outcome
    const hasConversion = events.some(event => 
      ['payment_completed', 'registration_completed'].includes(event.event_name)
    )
    const hasAbandonment = events.some(event => 
      event.event_name === 'checkout_abandoned'
    )

    let conversionOutcome: 'converted' | 'abandoned' | 'in_progress' = 'in_progress'
    if (hasConversion) conversionOutcome = 'converted'
    else if (hasAbandonment) conversionOutcome = 'abandoned'

    return {
      session_id: sessionId,
      customer_id: events.find(e => e.customer_id)?.customer_id,
      events: events.map(event => ({
        customer_id: event.customer_id,
        session_id: event.session_id,
        event_type: event.event_type as any,
        event_name: event.event_name,
        event_data: event.event_data || {},
        timestamp: event.created_at
      })),
      start_time: startTime,
      end_time: endTime,
      total_duration: duration,
      conversion_outcome: conversionOutcome
    }
  }

  // Start performance monitoring
  private startPerformanceMonitoring() {
    // Monitor system performance metrics
    setInterval(async () => {
      const metrics = {
        memory_usage: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }

      await this.trackEvent({
        event_type: 'performance',
        event_name: 'system_metrics',
        event_data: metrics
      })
    }, 60000) // Every minute
  }

  // Get real-time analytics dashboard data
  async getDashboardMetrics(timeRange: '1h' | '24h' | '7d' = '24h') {
    const hours = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : 24 * 7
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    const { data, error } = await dbManager.getClient()
      .from('analytics_events')
      .select('event_type, event_name, created_at')
      .gte('created_at', startTime)

    if (error || !data) {
      return null
    }

    // Calculate metrics
    const totalEvents = data.length
    const sessionIds = data.map((e) => {
      if (typeof (e as Record<string, unknown>).session_id !== 'undefined') {
        const value = (e as Record<string, unknown>).session_id
        return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
      }
      return `${e.event_type ?? 'unknown'}-${e.created_at ?? ''}`
    })
    const uniqueSessions = new Set(sessionIds.filter(Boolean)).size
    const conversions = data.filter(e => e.event_name.includes('completed')).length
    const errors = data.filter(e => e.event_type === 'error').length

    return {
      total_events: totalEvents,
      unique_sessions: uniqueSessions,
      conversions: conversions,
      error_rate: totalEvents > 0 ? (errors / totalEvents) * 100 : 0,
      conversion_rate: uniqueSessions > 0 ? (conversions / uniqueSessions) * 100 : 0
    }
  }
}

export const analytics = ComprehensiveAnalytics.getInstance()
export default ComprehensiveAnalytics