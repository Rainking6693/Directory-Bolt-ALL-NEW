// 🚀 CONVERSION TRACKER - Free-to-Paid Upgrade Funnel Analytics
// Advanced conversion tracking, funnel optimization, and value demonstration metrics

import { logger } from '../utils/logger'
import { AnalysisTier } from './analysis-tier-manager'

export interface ConversionFunnel {
  id: string
  name: string
  stages: ConversionStage[]
  targetTier: AnalysisTier
  valueThreshold: number // Minimum demonstrated value to trigger conversion
}

export interface ConversionStage {
  name: string
  description: string
  triggerEvents: string[]
  successCriteria: string[]
  valueDemo: ValueDemonstration
  nextStage?: string
  conversionGoal?: boolean
}

export interface ValueDemonstration {
  metric: string
  value: number
  format: 'currency' | 'percentage' | 'number'
  context: string
  evidence: string[]
}

export interface UserJourneyEvent {
  userId: string
  eventType: ConversionEventType
  stage: string
  timestamp: Date
  data: Record<string, any>
  valueShown?: ValueDemonstration
  source: string
  sessionId: string
}

export type ConversionEventType = 
  | 'feature_discovered' 
  | 'feature_attempted'
  | 'feature_locked'
  | 'value_demonstrated'
  | 'upgrade_prompt_shown'
  | 'upgrade_prompt_clicked'
  | 'upgrade_started'
  | 'upgrade_completed'
  | 'upgrade_abandoned'
  | 'tier_upgraded'
  | 'analysis_completed'
  | 'report_downloaded'
  | 'pricing_viewed'
  | 'tier_selected'
  | 'billing_preference_changed'
  | 'upgrade_prompt_dismissed'

export interface ConversionMetrics {
  funnelId: string
  timeframe: 'day' | 'week' | 'month' | 'quarter'
  totalUsers: number
  conversions: number
  conversionRate: number
  averageTimeToConversion: number // hours
  stageMetrics: StageMetrics[]
  cohortAnalysis: CohortAnalysis[]
  valueImpactAnalysis: ValueImpactAnalysis
}

export interface StageMetrics {
  stageName: string
  usersEntered: number
  usersExited: number
  usersProgressed: number
  conversionRate: number
  averageTimeInStage: number // hours
  dropOffRate: number
}

export interface CohortAnalysis {
  cohort: string // date or identifier
  totalUsers: number
  conversions: Record<string, number> // day 1, day 7, day 30, etc.
  revenueGenerated: number
  averageRevenue: number
}

export interface ValueImpactAnalysis {
  totalValueShown: number
  averageValuePerUser: number
  valueToConversionCorrelation: number
  highValueConversions: number // > $10K value shown
  lowValueConversions: number // < $1K value shown
  optimalValueThreshold: number
}

export interface UpgradeAttribution {
  userId: string
  conversionDate: Date
  fromTier: AnalysisTier
  toTier: AnalysisTier
  revenue: number
  touchpoints: TouchpointAttribution[]
  timeToConversion: number // hours
  triggerEvent: string
}

export interface TouchpointAttribution {
  event: ConversionEventType
  timestamp: Date
  weight: number // 0-1 contribution to conversion
  valueShown?: number
  source: string
}

export class ConversionTracker {
  private funnels: Map<string, ConversionFunnel> = new Map()
  private userEvents: Map<string, UserJourneyEvent[]> = new Map() // userId -> events
  private conversions: UpgradeAttribution[] = []

  constructor() {
    this.initializeDefaultFunnels()
    logger.info('Conversion Tracker initialized with advanced funnel analytics')
  }

  private initializeDefaultFunnels(): void {
    // Free-to-Basic Funnel
    const freeToBasicFunnel: ConversionFunnel = {
      id: 'free_to_basic',
      name: 'Free to Starter Plan',
      targetTier: 'basic',
      valueThreshold: 800, // $800 demonstrated value
      stages: [
        {
          name: 'awareness',
          description: 'User discovers advanced features',
          triggerEvents: ['feature_discovered'],
          successCriteria: ['viewed_premium_features'],
          valueDemo: {
            metric: 'potential_savings',
            value: 800,
            format: 'currency',
            context: 'Monthly time savings from automation',
            evidence: ['25 directory opportunities', 'Screenshots enabled', 'Priority email support']
          }
        },
        {
          name: 'interest',
          description: 'User attempts locked features',
          triggerEvents: ['feature_locked', 'feature_attempted'],
          successCriteria: ['multiple_feature_attempts'],
          valueDemo: {
            metric: 'efficiency_gain',
            value: 300,
            format: 'percentage',
            context: 'Increased efficiency with enhanced features',
            evidence: ['Automated directory optimization', 'Professional screenshots', 'Enhanced support']
          }
        },
        {
          name: 'consideration',
          description: 'User sees upgrade prompts and value demos',
          triggerEvents: ['upgrade_prompt_shown', 'value_demonstrated'],
          successCriteria: ['engaged_with_pricing'],
          valueDemo: {
            metric: 'roi_projection',
            value: 810,
            format: 'percentage',
            context: 'Return on investment within 60 days',
            evidence: ['Case studies', 'ROI calculator', 'Success metrics']
          }
        },
        {
          name: 'conversion',
          description: 'User upgrades to paid plan',
          triggerEvents: ['upgrade_started'],
          successCriteria: ['upgrade_completed'],
          valueDemo: {
            metric: 'immediate_value',
            value: 99,
            format: 'currency',
            context: 'Immediate access to premium features worth $800+',
            evidence: ['Instant feature unlock', '30-day money-back guarantee']
          },
          conversionGoal: true
        }
      ]
    }

    // Free-to-Premium Funnel (Direct)
    const freeToPremiumFunnel: ConversionFunnel = {
      id: 'free_to_premium',
      name: 'Free to Growth Plan',
      targetTier: 'premium',
      valueThreshold: 2600, // $2,600 demonstrated value
      stages: [
        {
          name: 'awareness',
          description: 'User discovers comprehensive AI analysis',
          triggerEvents: ['feature_discovered', 'analysis_completed'],
          successCriteria: ['viewed_full_analysis_preview'],
          valueDemo: {
            metric: 'potential_revenue',
            value: 15000,
            format: 'currency',
            context: 'Potential annual revenue from directory optimization',
            evidence: ['100+ directory opportunities', 'Competitor analysis', 'Revenue projections']
          }
        },
        {
          name: 'interest',
          description: 'User experiences high-value feature locks',
          triggerEvents: ['feature_locked', 'value_demonstrated'],
          successCriteria: ['high_value_features_attempted'],
          valueDemo: {
            metric: 'competitive_advantage',
            value: 400,
            format: 'percentage',
            context: 'Competitive advantage over businesses without AI analysis',
            evidence: ['Market positioning insights', 'Competitor gap analysis', 'Strategic recommendations']
          }
        },
        {
          name: 'evaluation',
          description: 'User evaluates premium value proposition',
          triggerEvents: ['upgrade_prompt_shown', 'report_downloaded'],
          successCriteria: ['engaged_with_roi_calculator'],
          valueDemo: {
            metric: 'time_savings',
            value: 160,
            format: 'number',
            context: 'Hours saved monthly with AI-powered analysis',
            evidence: ['Automated competitor research', 'AI-generated strategies', 'Priority support']
          }
        },
        {
          name: 'conversion',
          description: 'User upgrades to premium plan',
          triggerEvents: ['upgrade_started'],
          successCriteria: ['upgrade_completed'],
          valueDemo: {
            metric: 'roi_guarantee',
            value: 870,
            format: 'percentage',
            context: 'Guaranteed ROI within 90 days or money back',
            evidence: ['Success guarantee', 'Dedicated support', 'Proven methodology']
          },
          conversionGoal: true
        }
      ]
    }

    this.funnels.set(freeToBasicFunnel.id, freeToBasicFunnel)
    this.funnels.set(freeToPremiumFunnel.id, freeToPremiumFunnel)
  }

  // Event Tracking Methods

  async trackEvent(event: Omit<UserJourneyEvent, 'timestamp'>): Promise<void> {
    const fullEvent: UserJourneyEvent = {
      ...event,
      timestamp: new Date()
    }

    // Store event
    if (!this.userEvents.has(event.userId)) {
      this.userEvents.set(event.userId, [])
    }
    this.userEvents.get(event.userId)!.push(fullEvent)

    // Process funnel progression
    await this.processFunnelProgression(fullEvent)

    // Log high-value events
    if (['feature_locked', 'value_demonstrated', 'upgrade_prompt_shown', 'upgrade_completed'].includes(event.eventType)) {
      logger.info('High-value conversion event tracked', {
        metadata: {
          userId: event.userId,
          eventType: event.eventType,
          stage: event.stage,
          valueShown: event.valueShown?.value,
          source: event.source
        }
      })
    }
  }

  private async processFunnelProgression(event: UserJourneyEvent): Promise<void> {
    for (const funnel of this.funnels.values()) {
      const currentStage = this.getCurrentUserStage(event.userId, funnel.id)
      const stage = funnel.stages.find(s => s.name === currentStage)
      
      if (stage && stage.triggerEvents.includes(event.eventType)) {
        await this.progressUserInFunnel(event, funnel, stage)
      }
    }
  }

  private async progressUserInFunnel(
    event: UserJourneyEvent, 
    funnel: ConversionFunnel, 
    currentStage: ConversionStage
  ): Promise<void> {
    const nextStageIndex = funnel.stages.findIndex(s => s.name === currentStage.name) + 1
    
    // Check if user meets success criteria for current stage
    const meetsCriteria = await this.checkSuccessCriteria(event.userId, currentStage.successCriteria)
    
    if (meetsCriteria && nextStageIndex < funnel.stages.length) {
      const nextStage = funnel.stages[nextStageIndex]
      
      // Demonstrate value for next stage
      await this.demonstrateValue(event.userId, nextStage.valueDemo, funnel.id)
      
      // Check if this is a conversion stage
      if (nextStage.conversionGoal) {
        await this.trackPotentialConversion(event.userId, funnel)
      }
    }
  }

  private getCurrentUserStage(userId: string, funnelId: string): string {
    const userEvents = this.userEvents.get(userId) || []
    const funnelEvents = userEvents.filter(e => e.data.funnelId === funnelId)
    
    if (funnelEvents.length === 0) return 'awareness'
    
    // Determine stage based on latest event
    const latestEvent = funnelEvents[funnelEvents.length - 1]
    return latestEvent.stage || 'awareness'
  }

  private async checkSuccessCriteria(userId: string, criteria: string[]): Promise<boolean> {
    const userEvents = this.userEvents.get(userId) || []
    
    // Simple criteria checking - can be enhanced
    for (const criterion of criteria) {
      const hasMetCriterion = userEvents.some(event => 
        event.eventType.includes(criterion.replace('_', '')) ||
        event.data.action === criterion
      )
      if (!hasMetCriterion) return false
    }
    
    return true
  }

  private async demonstrateValue(
    userId: string, 
    valueDemo: ValueDemonstration, 
    funnelId: string
  ): Promise<void> {
    await this.trackEvent({
      userId,
      eventType: 'value_demonstrated',
      stage: 'value_demo',
      data: { funnelId, metric: valueDemo.metric },
      valueShown: valueDemo,
      source: 'conversion_funnel',
      sessionId: this.generateSessionId(userId)
    })
  }

  // Conversion Attribution

  async recordConversion(attribution: Omit<UpgradeAttribution, 'touchpoints' | 'timeToConversion'>): Promise<void> {
    const userEvents = this.userEvents.get(attribution.userId) || []
    
    // Calculate touchpoint attribution
    const touchpoints = this.calculateTouchpointAttribution(userEvents, attribution.conversionDate)
    
    // Calculate time to conversion
    const firstEvent = userEvents[0]
    const timeToConversion = firstEvent ? 
      (attribution.conversionDate.getTime() - firstEvent.timestamp.getTime()) / (1000 * 60 * 60) : 0
    
    const fullAttribution: UpgradeAttribution = {
      ...attribution,
      touchpoints,
      timeToConversion
    }
    
    this.conversions.push(fullAttribution)
    
    logger.info('Conversion recorded with full attribution', {
      metadata: {
        userId: attribution.userId,
        revenue: attribution.revenue,
        fromTier: attribution.fromTier,
        toTier: attribution.toTier,
        timeToConversion,
        touchpoints: touchpoints.length
      }
    })
  }

  private calculateTouchpointAttribution(
    events: UserJourneyEvent[], 
    conversionDate: Date
  ): TouchpointAttribution[] {
    const attributionWindow = 30 * 24 * 60 * 60 * 1000 // 30 days in ms
    const conversionTime = conversionDate.getTime()
    
    const relevantEvents = events.filter(event => 
      (conversionTime - event.timestamp.getTime()) <= attributionWindow
    )
    
    // Apply attribution weighting (time-decay model)
    return relevantEvents.map(event => {
      const timeDiff = conversionTime - event.timestamp.getTime()
      const timeDecay = Math.exp(-timeDiff / (7 * 24 * 60 * 60 * 1000)) // 7-day half-life
      
      let baseWeight = 0.1 // Default weight
      
      // Assign higher weights to key conversion events
      switch (event.eventType) {
        case 'feature_locked': baseWeight = 0.3; break
        case 'value_demonstrated': baseWeight = 0.4; break
        case 'upgrade_prompt_clicked': baseWeight = 0.6; break
        case 'upgrade_started': baseWeight = 0.8; break
        default: baseWeight = 0.1
      }
      
      return {
        event: event.eventType,
        timestamp: event.timestamp,
        weight: baseWeight * timeDecay,
        valueShown: event.valueShown?.value,
        source: event.source
      }
    })
  }

  // Analytics & Reporting

  getConversionMetrics(funnelId: string, timeframe: 'day' | 'week' | 'month' | 'quarter'): ConversionMetrics {
    const funnel = this.funnels.get(funnelId)
    if (!funnel) throw new Error(`Funnel ${funnelId} not found`)
    
    const timeRangeMs = this.getTimeRangeMs(timeframe)
    const cutoff = new Date(Date.now() - timeRangeMs)
    
    // Get users in timeframe
    const relevantUsers = new Set<string>()
    const relevantEvents = new Map<string, UserJourneyEvent[]>()
    
    for (const [userId, events] of this.userEvents.entries()) {
      const timeframeEvents = events.filter(e => e.timestamp >= cutoff)
      if (timeframeEvents.length > 0) {
        relevantUsers.add(userId)
        relevantEvents.set(userId, timeframeEvents)
      }
    }
    
    const totalUsers = relevantUsers.size
    const conversions = this.conversions.filter(c => c.conversionDate >= cutoff && 
      (c.toTier === funnel.targetTier)).length
    
    const stageMetrics = this.calculateStageMetrics(funnel, relevantEvents)
    const cohortAnalysis = this.calculateCohortAnalysis(funnelId, timeframe)
    const valueImpactAnalysis = this.calculateValueImpactAnalysis(relevantEvents)
    
    return {
      funnelId,
      timeframe,
      totalUsers,
      conversions,
      conversionRate: totalUsers > 0 ? (conversions / totalUsers) * 100 : 0,
      averageTimeToConversion: this.calculateAverageTimeToConversion(funnelId, cutoff),
      stageMetrics,
      cohortAnalysis,
      valueImpactAnalysis
    }
  }

  private calculateStageMetrics(
    funnel: ConversionFunnel, 
    userEvents: Map<string, UserJourneyEvent[]>
  ): StageMetrics[] {
    return funnel.stages.map(stage => {
      let usersEntered = 0
      let usersExited = 0
      let usersProgressed = 0
      let totalTimeInStage = 0
      
      for (const events of userEvents.values()) {
        const stageEvents = events.filter(e => e.stage === stage.name)
        if (stageEvents.length > 0) {
          usersEntered++
          
          // Calculate time in stage
          const stageTime = this.calculateTimeInStage(events, stage.name)
          totalTimeInStage += stageTime
          
          // Check if user progressed to next stage
          const nextStageIndex = funnel.stages.findIndex(s => s.name === stage.name) + 1
          if (nextStageIndex < funnel.stages.length) {
            const nextStageName = funnel.stages[nextStageIndex].name
            const hasNextStageEvents = events.some(e => e.stage === nextStageName)
            if (hasNextStageEvents) usersProgressed++
          }
        }
      }
      
      usersExited = usersEntered - usersProgressed
      
      return {
        stageName: stage.name,
        usersEntered,
        usersExited,
        usersProgressed,
        conversionRate: usersEntered > 0 ? (usersProgressed / usersEntered) * 100 : 0,
        averageTimeInStage: usersEntered > 0 ? totalTimeInStage / usersEntered : 0,
        dropOffRate: usersEntered > 0 ? (usersExited / usersEntered) * 100 : 0
      }
    })
  }

  private calculateTimeInStage(events: UserJourneyEvent[], stageName: string): number {
    const stageEvents = events.filter(e => e.stage === stageName).sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    )
    
    if (stageEvents.length < 2) return 0
    
    const firstEvent = stageEvents[0]
    const lastEvent = stageEvents[stageEvents.length - 1]
    
    return (lastEvent.timestamp.getTime() - firstEvent.timestamp.getTime()) / (1000 * 60 * 60) // hours
  }

  private calculateCohortAnalysis(funnelId: string, timeframe: 'day' | 'week' | 'month' | 'quarter'): CohortAnalysis[] {
    // Simplified cohort analysis - can be enhanced
    const cohorts: CohortAnalysis[] = []
    
    // Group users by signup date
    const cohortGroups = new Map<string, string[]>()
    
    for (const [userId, events] of this.userEvents.entries()) {
      const firstEvent = events[0]
      if (firstEvent) {
        const cohortKey = this.getCohortKey(firstEvent.timestamp, timeframe)
        if (!cohortGroups.has(cohortKey)) {
          cohortGroups.set(cohortKey, [])
        }
        cohortGroups.get(cohortKey)!.push(userId)
      }
    }
    
    // Calculate conversion rates for each cohort
    for (const [cohortKey, userIds] of cohortGroups.entries()) {
      const totalUsers = userIds.length
      const conversions = this.conversions.filter(c => userIds.includes(c.userId))
      
      const conversionsByDay: Record<string, number> = {}
      conversions.forEach(c => {
        const dayKey = Math.floor(c.timeToConversion / 24).toString()
        conversionsByDay[dayKey] = (conversionsByDay[dayKey] || 0) + 1
      })
      
      const revenue = conversions.reduce((sum, c) => sum + c.revenue, 0)
      
      cohorts.push({
        cohort: cohortKey,
        totalUsers,
        conversions: conversionsByDay,
        revenueGenerated: revenue,
        averageRevenue: totalUsers > 0 ? revenue / totalUsers : 0
      })
    }
    
    return cohorts
  }

  private calculateValueImpactAnalysis(userEvents: Map<string, UserJourneyEvent[]>): ValueImpactAnalysis {
    let totalValueShown = 0
    let totalUsers = 0
    let highValueConversions = 0
    let lowValueConversions = 0
    const valuePerUser: number[] = []
    
    for (const events of userEvents.values()) {
      totalUsers++
      let userValueShown = 0
      
      const valueEvents = events.filter(e => e.valueShown)
      for (const event of valueEvents) {
        userValueShown += event.valueShown!.value
      }
      
      totalValueShown += userValueShown
      valuePerUser.push(userValueShown)
      
      // Check if user converted and classify by value shown
      const userId = events[0]?.userId
      const converted = this.conversions.some(c => c.userId === userId)
      
      if (converted) {
        if (userValueShown > 10000) highValueConversions++
        else if (userValueShown < 1000) lowValueConversions++
      }
    }
    
    // Calculate correlation (simplified)
    const averageValue = totalUsers > 0 ? totalValueShown / totalUsers : 0
    const correlation = this.calculateCorrelation(valuePerUser)
    
    return {
      totalValueShown,
      averageValuePerUser: averageValue,
      valueToConversionCorrelation: correlation,
      highValueConversions,
      lowValueConversions,
      optimalValueThreshold: this.calculateOptimalValueThreshold(valuePerUser)
    }
  }

  // Helper Methods

  private generateSessionId(userId: string): string {
    return `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getTimeRangeMs(timeframe: 'day' | 'week' | 'month' | 'quarter'): number {
    switch (timeframe) {
      case 'day': return 24 * 60 * 60 * 1000
      case 'week': return 7 * 24 * 60 * 60 * 1000
      case 'month': return 30 * 24 * 60 * 60 * 1000
      case 'quarter': return 90 * 24 * 60 * 60 * 1000
      default: return 30 * 24 * 60 * 60 * 1000
    }
  }

  private getCohortKey(date: Date, timeframe: 'day' | 'week' | 'month' | 'quarter'): string {
    switch (timeframe) {
      case 'day': return date.toISOString().split('T')[0]
      case 'week': return `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`
      case 'month': return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      case 'quarter': return `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`
      default: return date.toISOString().split('T')[0]
    }
  }

  private calculateAverageTimeToConversion(funnelId: string, cutoff: Date): number {
    const relevantConversions = this.conversions.filter(c => c.conversionDate >= cutoff)
    
    if (relevantConversions.length === 0) return 0
    
    const totalTime = relevantConversions.reduce((sum, c) => sum + c.timeToConversion, 0)
    return totalTime / relevantConversions.length
  }

  private calculateCorrelation(values: number[]): number {
    // Simplified correlation calculation
    if (values.length < 2) return 0
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    
    return variance > 0 ? Math.min(1, variance / 10000) : 0
  }

  private calculateOptimalValueThreshold(values: number[]): number {
    if (values.length === 0) return 1000
    
    values.sort((a, b) => a - b)
    const medianIndex = Math.floor(values.length / 2)
    return values[medianIndex] || 1000
  }

  private async trackPotentialConversion(userId: string, funnel: ConversionFunnel): Promise<void> {
    logger.info('Potential conversion identified', {
      metadata: {
        userId,
        funnelId: funnel.id,
        targetTier: funnel.targetTier,
        valueThreshold: funnel.valueThreshold
      }
    })
    
    // Trigger conversion-focused actions (e.g., send targeted offers, schedule follow-ups)
  }

  // Public API Methods

  getFunnelMetrics(funnelId: string): ConversionMetrics {
    return this.getConversionMetrics(funnelId, 'month')
  }

  getTopConversionEvents(): Array<{event: ConversionEventType, count: number}> {
    const eventCounts = new Map<ConversionEventType, number>()
    
    for (const events of this.userEvents.values()) {
      for (const event of events) {
        eventCounts.set(event.eventType, (eventCounts.get(event.eventType) || 0) + 1)
      }
    }
    
    return Array.from(eventCounts.entries())
      .map(([event, count]: [string, number]) => ({event, count}))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  getUserConversionPath(userId: string): UserJourneyEvent[] {
    return this.userEvents.get(userId) || []
  }

  getConversionRate(tier: AnalysisTier, timeframe: 'day' | 'week' | 'month' = 'month'): number {
    const targetFunnels = Array.from(this.funnels.values()).filter(f => f.targetTier === tier)
    
    let totalConversions = 0
    let totalUsers = 0
    
    for (const funnel of targetFunnels) {
      const metrics = this.getConversionMetrics(funnel.id, timeframe)
      totalConversions += metrics.conversions
      totalUsers += metrics.totalUsers
    }
    
    return totalUsers > 0 ? (totalConversions / totalUsers) * 100 : 0
  }
}

// Singleton instance
let conversionTrackerInstance: ConversionTracker | null = null

export function getConversionTracker(): ConversionTracker {
  if (!conversionTrackerInstance) {
    conversionTrackerInstance = new ConversionTracker()
  }
  return conversionTrackerInstance
}

// Convenience exports
export const ConversionTracking = {
  track: (event: Omit<UserJourneyEvent, 'timestamp'>) => getConversionTracker().trackEvent(event),
  recordConversion: (attribution: Omit<UpgradeAttribution, 'touchpoints' | 'timeToConversion'>) => 
    getConversionTracker().recordConversion(attribution),
  getMetrics: (funnelId: string) => getConversionTracker().getFunnelMetrics(funnelId),
  getConversionRate: (tier: AnalysisTier) => getConversionTracker().getConversionRate(tier),
  getUserJourney: (userId: string) => getConversionTracker().getUserConversionPath(userId)
}
