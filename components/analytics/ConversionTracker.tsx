import { useEffect, useRef } from 'react'

interface ConversionEvent {
  event: string
  data?: Record<string, any>
}

interface ConversionTrackerProps {
  event: string
  data?: Record<string, any>
  trigger?: 'immediate' | 'scroll' | 'time' | 'interaction'
  delay?: number
  scrollPercentage?: number
}

export function ConversionTracker({ 
  event, 
  data = {}, 
  trigger = 'immediate',
  delay = 0,
  scrollPercentage = 50 
}: ConversionTrackerProps) {
  const hasTracked = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (hasTracked.current) return

    switch (trigger) {
      case 'immediate':
        if (delay > 0) {
          timeoutRef.current = setTimeout(() => trackEvent(event, data), delay)
        } else {
          trackEvent(event, data)
        }
        break

      case 'time':
        timeoutRef.current = setTimeout(() => {
          trackEvent(event, data)
          hasTracked.current = true
        }, delay || 5000)
        break

      case 'scroll':
        const handleScroll = () => {
          const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
          if (scrolled >= scrollPercentage && !hasTracked.current) {
            trackEvent(event, data)
            hasTracked.current = true
            window.removeEventListener('scroll', handleScroll)
          }
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)

      case 'interaction':
        const handleInteraction = () => {
          if (!hasTracked.current) {
            trackEvent(event, data)
            hasTracked.current = true
            document.removeEventListener('click', handleInteraction)
            document.removeEventListener('keydown', handleInteraction)
          }
        }
        document.addEventListener('click', handleInteraction)
        document.addEventListener('keydown', handleInteraction)
        return () => {
          document.removeEventListener('click', handleInteraction)
          document.removeEventListener('keydown', handleInteraction)
        }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [event, data, trigger, delay, scrollPercentage])

  return null // This component doesn't render anything
}

// Core tracking function
function trackEvent(event: string, data: Record<string, any> = {}): void {
  const eventData = {
    ...data,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
  }

  // Google Analytics 4
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event, {
      ...eventData,
      event_category: 'Guides',
      send_to: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    })
  }

  // Facebook Pixel
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', event, eventData)
  }

  // Custom analytics endpoint
  if (typeof window !== 'undefined') {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event,
        data: eventData,
        session_id: getSessionId()
      })
    }).catch(error => {
      console.error('Analytics tracking failed:', error)
    })
  }

  // Console log for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('Tracking event:', event, eventData)
  }
}

// Session management
function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  
  let sessionId = localStorage.getItem('directoryBolt_session_id')
  if (!sessionId) {
    sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2)
    localStorage.setItem('directoryBolt_session_id', sessionId)
  }
  return sessionId
}

// Enhanced tracking hooks
export function useGuideEngagement(guideSlug: string) {
  useEffect(() => {
    let readingStartTime = Date.now()
    let maxScrollDepth = 0
    let isActive = true
    let interactionCount = 0

    // Track reading time
    const trackReadingTime = () => {
      if (isActive) {
        const readingTime = Date.now() - readingStartTime
        trackEvent('guide_reading_time', {
          guide: guideSlug,
          reading_time_seconds: Math.floor(readingTime / 1000),
          max_scroll_depth: maxScrollDepth
        })
      }
    }

    // Track scroll depth
    const handleScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      )
      maxScrollDepth = Math.max(maxScrollDepth, scrollPercent)

      // Track milestone scroll depths
      if (scrollPercent >= 25 && !window.directoryBolt_scroll_25) {
        window.directoryBolt_scroll_25 = true
        trackEvent('guide_scroll_depth', { guide: guideSlug, depth: 25 })
      }
      if (scrollPercent >= 50 && !window.directoryBolt_scroll_50) {
        window.directoryBolt_scroll_50 = true
        trackEvent('guide_scroll_depth', { guide: guideSlug, depth: 50 })
      }
      if (scrollPercent >= 75 && !window.directoryBolt_scroll_75) {
        window.directoryBolt_scroll_75 = true
        trackEvent('guide_scroll_depth', { guide: guideSlug, depth: 75 })
      }
      if (scrollPercent >= 90 && !window.directoryBolt_scroll_90) {
        window.directoryBolt_scroll_90 = true
        trackEvent('guide_scroll_depth', { guide: guideSlug, depth: 90 })
        trackEvent('guide_completion', { guide: guideSlug })
      }
    }

    // Track interactions
    const handleInteraction = () => {
      interactionCount++
      if (interactionCount === 1) {
        trackEvent('guide_first_interaction', { guide: guideSlug })
      }
    }

    // Track visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isActive = false
        trackReadingTime()
      } else {
        isActive = true
        readingStartTime = Date.now()
      }
    }

    // Attach event listeners
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('click', handleInteraction)
    window.addEventListener('keydown', handleInteraction)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', trackReadingTime)

    // Clean up
    return () => {
      trackReadingTime()
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', trackReadingTime)
    }
  }, [guideSlug])
}

// Conversion funnel tracking
export function trackConversionFunnel(step: string, data: Record<string, any> = {}): void {
  trackEvent('conversion_funnel', {
    funnel_step: step,
    ...data
  })
}

// A/B test tracking
export function trackABTest(testName: string, variant: string, data: Record<string, any> = {}): void {
  trackEvent('ab_test', {
    test_name: testName,
    variant,
    ...data
  })
}

// Performance tracking
export function trackPerformance(metrics: Record<string, number>): void {
  trackEvent('performance_metrics', metrics)
}

// Custom event wrapper for easy use
export function trackCustomEvent(eventName: string, properties: Record<string, any> = {}): void {
  trackEvent(eventName, properties)
}

// Enhanced conversion analytics
export function trackFormInteraction(formId: string, field: string, action: 'focus' | 'blur' | 'change' | 'error'): void {
  trackEvent('form_interaction', {
    form_id: formId,
    field,
    action,
    form_category: 'conversion'
  })
}

export function trackButtonClick(buttonId: string, buttonText: string, context: string): void {
  trackEvent('button_click', {
    button_id: buttonId,
    button_text: buttonText,
    context,
    click_category: 'conversion'
  })
}

export function trackModalInteraction(modalId: string, action: 'open' | 'close' | 'submit', context: string): void {
  trackEvent('modal_interaction', {
    modal_id: modalId,
    action,
    context,
    interaction_category: 'conversion'
  })
}

export function trackUserFlow(stepName: string, flowId: string, stepNumber: number): void {
  trackEvent('user_flow_step', {
    step_name: stepName,
    flow_id: flowId,
    step_number: stepNumber,
    flow_category: 'conversion'
  })
}

export function trackEngagementMetrics(metrics: {
  timeOnPage?: number
  scrollDepth?: number
  interactionCount?: number
  heatmapClicks?: Array<{ x: number, y: number, element: string }>
}): void {
  trackEvent('engagement_metrics', {
    ...metrics,
    metric_category: 'user_behavior'
  })
}

export function trackConversionFunnelDropoff(funnelStep: string, reason: string, userData: Record<string, any> = {}): void {
  trackEvent('funnel_dropoff', {
    funnel_step: funnelStep,
    dropoff_reason: reason,
    ...userData,
    funnel_category: 'conversion'
  })
}

export function trackPersonalizationEvent(personalizationType: string, variant: string, effectiveness: 'high' | 'medium' | 'low'): void {
  trackEvent('personalization_event', {
    personalization_type: personalizationType,
    variant,
    effectiveness,
    personalization_category: 'optimization'
  })
}

export function trackRevenue(amount: number, currency: string, source: string, conversionPath: string[]): void {
  trackEvent('revenue_tracked', {
    revenue_amount: amount,
    currency,
    revenue_source: source,
    conversion_path: conversionPath,
    revenue_category: 'conversion'
  })
}

// Enhanced user session tracking
export class UserSessionTracker {
  private sessionStart: number
  private lastActivity: number
  private pageViews: number
  private interactions: number
  private scrollDepth: number
  private sessionId: string

  constructor() {
    this.sessionStart = Date.now()
    this.lastActivity = Date.now()
    this.pageViews = 1
    this.interactions = 0
    this.scrollDepth = 0
    this.sessionId = getSessionId()
    this.setupTracking()
  }

  private setupTracking() {
    // Track user activity
    const activityEvents = ['click', 'keydown', 'scroll', 'mousemove']
    activityEvents.forEach(event => {
      document.addEventListener(event, () => {
        this.lastActivity = Date.now()
        if (event === 'click' || event === 'keydown') {
          this.interactions++
        }
      }, { passive: true })
    })

    // Track scroll depth
    let maxScrollDepth = 0
    window.addEventListener('scroll', () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      )
      maxScrollDepth = Math.max(maxScrollDepth, scrollPercent)
      this.scrollDepth = maxScrollDepth
    }, { passive: true })

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackSessionMetrics()
      }
    })

    // Track before unload
    window.addEventListener('beforeunload', () => {
      this.trackSessionMetrics()
    })
  }

  trackPageView(page: string) {
    this.pageViews++
    trackEvent('page_view', {
      page,
      session_id: this.sessionId,
      page_views_in_session: this.pageViews,
      session_duration: Date.now() - this.sessionStart
    })
  }

  trackSessionMetrics() {
    const sessionDuration = Date.now() - this.sessionStart
    const inactivityTime = Date.now() - this.lastActivity
    
    trackEvent('session_metrics', {
      session_id: this.sessionId,
      session_duration: sessionDuration,
      inactivity_time: inactivityTime,
      page_views: this.pageViews,
      interactions: this.interactions,
      max_scroll_depth: this.scrollDepth,
      session_quality: this.calculateSessionQuality(sessionDuration, this.interactions, this.scrollDepth)
    })
  }

  private calculateSessionQuality(duration: number, interactions: number, scrollDepth: number): 'high' | 'medium' | 'low' {
    const durationScore = duration > 60000 ? 3 : duration > 30000 ? 2 : 1
    const interactionScore = interactions > 10 ? 3 : interactions > 5 ? 2 : 1
    const scrollScore = scrollDepth > 50 ? 3 : scrollDepth > 25 ? 2 : 1
    
    const totalScore = durationScore + interactionScore + scrollScore
    
    if (totalScore >= 8) return 'high'
    if (totalScore >= 6) return 'medium'
    return 'low'
  }
}

// Heat mapping functionality
export class HeatmapTracker {
  private clicks: Array<{ x: number, y: number, element: string, timestamp: number }> = []
  private scrollData: Array<{ depth: number, timestamp: number }> = []
  
  constructor() {
    this.setupClickTracking()
    this.setupScrollTracking()
  }

  private setupClickTracking() {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const elementInfo = this.getElementInfo(target)
      
      this.clicks.push({
        x: event.clientX,
        y: event.clientY,
        element: elementInfo,
        timestamp: Date.now()
      })

      // Send heatmap data periodically
      if (this.clicks.length >= 10) {
        this.sendHeatmapData()
      }
    })
  }

  private setupScrollTracking() {
    let scrollTimer: NodeJS.Timeout
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => {
        const scrollPercent = Math.round(
          (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
        )
        
        this.scrollData.push({
          depth: scrollPercent,
          timestamp: Date.now()
        })
      }, 100)
    }, { passive: true })
  }

  private getElementInfo(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase()
    const id = element.id ? `#${element.id}` : ''
    const className = element.className ? `.${element.className.replace(/\s+/g, '.')}` : ''
    const textContent = element.textContent?.slice(0, 50) || ''
    
    return `${tagName}${id}${className} [${textContent}]`
  }

  private sendHeatmapData() {
    if (this.clicks.length > 0) {
      trackEvent('heatmap_data', {
        clicks: this.clicks.splice(0, 10), // Send and clear first 10 clicks
        scroll_data: this.scrollData.splice(0, 20), // Send and clear scroll data
        page_url: window.location.href,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight
      })
    }
  }

  flush() {
    this.sendHeatmapData()
  }
}

// Conversion attribution tracking
export class AttributionTracker {
  private touchpoints: Array<{
    source: string
    medium: string
    campaign: string
    timestamp: number
    url: string
  }> = []

  constructor() {
    this.trackTouchpoint()
    this.loadPreviousTouchpoints()
  }

  private trackTouchpoint() {
    const urlParams = new URLSearchParams(window.location.search)
    const referrer = document.referrer
    
    const touchpoint = {
      source: urlParams.get('utm_source') || this.getSourceFromReferrer(referrer),
      medium: urlParams.get('utm_medium') || this.getMediumFromReferrer(referrer),
      campaign: urlParams.get('utm_campaign') || 'direct',
      timestamp: Date.now(),
      url: window.location.href
    }

    this.touchpoints.push(touchpoint)
    this.saveTouchpoints()

    trackEvent('touchpoint', touchpoint)
  }

  private getSourceFromReferrer(referrer: string): string {
    if (!referrer) return 'direct'
    if (referrer.includes('google')) return 'google'
    if (referrer.includes('facebook')) return 'facebook'
    if (referrer.includes('linkedin')) return 'linkedin'
    if (referrer.includes('twitter')) return 'twitter'
    return 'referral'
  }

  private getMediumFromReferrer(referrer: string): string {
    if (!referrer) return 'direct'
    if (referrer.includes('google')) return 'organic'
    if (referrer.includes('facebook') || referrer.includes('linkedin') || referrer.includes('twitter')) return 'social'
    return 'referral'
  }

  private loadPreviousTouchpoints() {
    try {
      const saved = localStorage.getItem('attribution_touchpoints')
      if (saved) {
        this.touchpoints = JSON.parse(saved)
      }
    } catch (error) {
      console.warn('Failed to load attribution touchpoints:', error)
    }
  }

  private saveTouchpoints() {
    try {
      // Keep only last 10 touchpoints and those from last 30 days
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
      const recentTouchpoints = this.touchpoints
        .filter(tp => tp.timestamp > thirtyDaysAgo)
        .slice(-10)
      
      localStorage.setItem('attribution_touchpoints', JSON.stringify(recentTouchpoints))
    } catch (error) {
      console.warn('Failed to save attribution touchpoints:', error)
    }
  }

  trackConversion(conversionValue: number, conversionType: string) {
    trackEvent('conversion_attribution', {
      conversion_value: conversionValue,
      conversion_type: conversionType,
      attribution_path: this.touchpoints,
      first_touch: this.touchpoints[0],
      last_touch: this.touchpoints[this.touchpoints.length - 1],
      touchpoint_count: this.touchpoints.length
    })
  }
}

// Initialize global trackers
let sessionTracker: UserSessionTracker
let heatmapTracker: HeatmapTracker
let attributionTracker: AttributionTracker

if (typeof window !== 'undefined') {
  sessionTracker = new UserSessionTracker()
  heatmapTracker = new HeatmapTracker()
  attributionTracker = new AttributionTracker()

  // Expose for external use
  window.directoryBoltAnalytics = {
    sessionTracker,
    heatmapTracker,
    attributionTracker,
    trackCustomEvent,
    trackFormInteraction,
    trackButtonClick,
    trackModalInteraction,
    trackUserFlow,
    trackConversionFunnel,
    trackABTest,
    trackPerformance
  }
}

// Global type declarations for TypeScript
declare global {
  interface Window {
    gtag: (...args: any[]) => void
    fbq: (...args: any[]) => void
    directoryBolt_scroll_25?: boolean
    directoryBolt_scroll_50?: boolean
    directoryBolt_scroll_75?: boolean
    directoryBolt_scroll_90?: boolean
    directoryBoltAnalytics?: {
      sessionTracker: UserSessionTracker
      heatmapTracker: HeatmapTracker
      attributionTracker: AttributionTracker
      trackCustomEvent: typeof trackCustomEvent
      trackFormInteraction: typeof trackFormInteraction
      trackButtonClick: typeof trackButtonClick
      trackModalInteraction: typeof trackModalInteraction
      trackUserFlow: typeof trackUserFlow
      trackConversionFunnel: typeof trackConversionFunnel
      trackABTest: typeof trackABTest
      trackPerformance: typeof trackPerformance
    }
  }
}