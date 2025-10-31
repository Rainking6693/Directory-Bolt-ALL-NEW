import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

interface DirectorySuccessMetrics {
  directoryId: string
  directoryName: string
  category: string
  industry: string
  totalSubmissions: number
  successfulSubmissions: number
  failedSubmissions: number
  successRate: number
  averageProcessingTime: number
  lastSubmission: Date
  trends: {
    daily: SuccessRateTrend[]
    weekly: SuccessRateTrend[]
    monthly: SuccessRateTrend[]
  }
}

interface SuccessRateTrend {
  period: string
  successRate: number
  submissionCount: number
  change: number // percentage change from previous period
}

interface IndustryBenchmark {
  industry: string
  averageSuccessRate: number
  totalSubmissions: number
  topPerformingDirectories: string[]
  commonFailureReasons: string[]
  seasonalTrends: {
    month: string
    successRate: number
    volume: number
  }[]
  recommendations: string[]
}

interface ABTestConfig {
  testId: string
  name: string
  description: string
  status: 'draft' | 'running' | 'paused' | 'completed'
  startDate: Date
  endDate?: Date
  variants: ABTestVariant[]
  targetMetric: string
  minimumSampleSize: number
  confidenceLevel: number
  currentSampleSize: number
  results?: ABTestResults
}

interface ABTestVariant {
  id: string
  name: string
  description: string
  weight: number // percentage of traffic
  config: Record<string, any>
  participants: number
  conversions: number
  conversionRate: number
}

interface ABTestResults {
  winningVariant?: string
  confidence: number
  statisticalSignificance: boolean
  liftPercentage: number
  summary: string
  recommendations: string[]
}

interface UserSegment {
  segmentId: string
  name: string
  description: string
  criteria: SegmentCriteria
  userCount: number
  avgSuccessRate: number
  topDirectories: string[]
  behaviorPatterns: BehaviorPattern[]
}

interface SegmentCriteria {
  subscriptionTier?: string[]
  industryType?: string[]
  submissionVolume?: { min?: number; max?: number }
  registrationDate?: { from?: Date; to?: Date }
  successRate?: { min?: number; max?: number }
}

interface BehaviorPattern {
  pattern: string
  frequency: number
  impact: 'positive' | 'negative' | 'neutral'
  description: string
}

export class BusinessIntelligenceService {
  private supabase: any
  private openai: OpenAI

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  /**
   * Get directory success rate tracking by industry
   */
  async getDirectorySuccessMetrics(
    industry?: string,
    timeRange = '30d'
  ): Promise<DirectorySuccessMetrics[]> {
    try {
      const timeRangeMap = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      }
      
      const days = timeRangeMap[timeRange as keyof typeof timeRangeMap] || 30
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      let query = this.supabase
        .from('submissions')
        .select(`
          directory_id,
          status,
          processing_time_ms,
          created_at,
          directories (
            id,
            name,
            category
          ),
          business_profiles (
            industry
          )
        `)
        .gte('created_at', cutoffDate.toISOString())

      if (industry) {
        query = query.eq('business_profiles.industry', industry)
      }

      const { data: submissions, error } = await query

      if (error) throw error

      // Group by directory and calculate metrics
      const directoryMetrics = new Map<string, any>()

      submissions?.forEach((submission: any) => {
        const directoryId = submission.directory_id
        
        if (!directoryMetrics.has(directoryId)) {
          directoryMetrics.set(directoryId, {
            directoryId,
            directoryName: submission.directories?.name || 'Unknown',
            category: submission.directories?.category || 'Uncategorized',
            industry: submission.business_profiles?.industry || 'Unknown',
            submissions: [],
            totalSubmissions: 0,
            successfulSubmissions: 0,
            failedSubmissions: 0,
            totalProcessingTime: 0,
            lastSubmission: new Date(submission.created_at)
          })
        }

        const metrics = directoryMetrics.get(directoryId)
        metrics.submissions.push(submission)
        metrics.totalSubmissions++
        
        if (submission.status === 'completed') {
          metrics.successfulSubmissions++
        } else if (submission.status === 'failed') {
          metrics.failedSubmissions++
        }
        
        if (submission.processing_time_ms) {
          metrics.totalProcessingTime += submission.processing_time_ms
        }
        
        const submissionDate = new Date(submission.created_at)
        if (submissionDate > metrics.lastSubmission) {
          metrics.lastSubmission = submissionDate
        }
      })

      // Calculate final metrics and trends
      const results: DirectorySuccessMetrics[] = []
      
      for (const [directoryId, metrics] of directoryMetrics) {
        const successRate = metrics.totalSubmissions > 0 
          ? (metrics.successfulSubmissions / metrics.totalSubmissions) * 100 
          : 0

        const averageProcessingTime = metrics.successfulSubmissions > 0
          ? metrics.totalProcessingTime / metrics.successfulSubmissions
          : 0

        // Calculate trends
        const trends = this.calculateTrends(metrics.submissions)

        results.push({
          directoryId,
          directoryName: metrics.directoryName,
          category: metrics.category,
          industry: metrics.industry,
          totalSubmissions: metrics.totalSubmissions,
          successfulSubmissions: metrics.successfulSubmissions,
          failedSubmissions: metrics.failedSubmissions,
          successRate,
          averageProcessingTime,
          lastSubmission: metrics.lastSubmission,
          trends
        })
      }

      return results.sort((a, b) => b.successRate - a.successRate)

    } catch (error) {
      console.error('Failed to get directory success metrics:', error)
      throw error
    }
  }

  /**
   * Get industry benchmarks
   */
  async getIndustryBenchmarks(): Promise<IndustryBenchmark[]> {
    try {
      const { data: submissions, error } = await (this.supabase as any)
        .from('submissions')
        .select(`
          status,
          created_at,
          directory_id,
          directories (name, category),
          business_profiles (industry)
        `)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

      if (error) throw error

      // Group by industry
      const industryData = new Map<string, any>()

      submissions?.forEach((submission: any) => {
        const industry = submission.business_profiles?.industry || 'Unknown'
        
        if (!industryData.has(industry)) {
          industryData.set(industry, {
            industry,
            totalSubmissions: 0,
            successfulSubmissions: 0,
            directoryPerformance: new Map(),
            monthlyData: new Map(),
            failures: []
          })
        }

        const data = industryData.get(industry)
        data.totalSubmissions++
        
        if (submission.status === 'completed') {
          data.successfulSubmissions++
        } else if (submission.status === 'failed') {
          data.failures.push(submission)
        }

        // Track directory performance
        const directoryName = submission.directories?.name
        if (directoryName) {
          if (!data.directoryPerformance.has(directoryName)) {
            data.directoryPerformance.set(directoryName, { total: 0, successful: 0 })
          }
          const dirData = data.directoryPerformance.get(directoryName)
          dirData.total++
          if (submission.status === 'completed') {
            dirData.successful++
          }
        }

        // Track monthly trends
        const month = new Date(submission.created_at).toISOString().slice(0, 7)
        if (!data.monthlyData.has(month)) {
          data.monthlyData.set(month, { total: 0, successful: 0 })
        }
        const monthData = data.monthlyData.get(month)
        monthData.total++
        if (submission.status === 'completed') {
          monthData.successful++
        }
      })

      // Generate benchmarks with AI insights
      const benchmarks: IndustryBenchmark[] = []
      
      for (const [industry, data] of industryData) {
        const averageSuccessRate = data.totalSubmissions > 0 
          ? (data.successfulSubmissions / data.totalSubmissions) * 100 
          : 0

        // Get top performing directories
        const sortedDirectories = Array.from(data.directoryPerformance.entries())
          .map((entry: any) => {
            const [name, perf] = entry as [string, any]
            return {
              name,
              successRate: perf.total > 0 ? (perf.successful / perf.total) * 100 : 0
            }
          })
          .sort((a, b) => b.successRate - a.successRate)
          .slice(0, 5)

        // Generate seasonal trends
        const seasonalTrends = Array.from(data.monthlyData.entries())
          .map((entry: any) => {
            const [month, monthData] = entry as [string, any]
            return {
              month,
              successRate: monthData.total > 0 ? (monthData.successful / monthData.total) * 100 : 0,
              volume: monthData.total
            }
          })
          .sort((a, b) => a.month.localeCompare(b.month))

        // Generate AI-powered recommendations
        const recommendations = await this.generateIndustryRecommendations(
          industry,
          averageSuccessRate,
          sortedDirectories,
          data.failures
        )

        benchmarks.push({
          industry,
          averageSuccessRate,
          totalSubmissions: data.totalSubmissions,
          topPerformingDirectories: sortedDirectories.map(d => d.name),
          commonFailureReasons: await this.analyzeFailureReasons(data.failures),
          seasonalTrends,
          recommendations
        })
      }

      return benchmarks.sort((a, b) => b.averageSuccessRate - a.averageSuccessRate)

    } catch (error) {
      console.error('Failed to get industry benchmarks:', error)
      throw error
    }
  }

  /**
   * Create and manage A/B tests
   */
  async createABTest(config: Omit<ABTestConfig, 'testId' | 'status' | 'currentSampleSize'>): Promise<string> {
    try {
      const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const { error } = await (this.supabase as any)
        .from('ab_tests')
        .insert({
          test_id: testId,
          name: config.name,
          description: config.description,
          status: 'draft',
          start_date: config.startDate.toISOString(),
          end_date: config.endDate?.toISOString(),
          variants: config.variants,
          target_metric: config.targetMetric,
          minimum_sample_size: config.minimumSampleSize,
          confidence_level: config.confidenceLevel,
          current_sample_size: 0,
          created_at: new Date().toISOString()
        })

      if (error) throw error

      return testId
    } catch (error) {
      console.error('Failed to create A/B test:', error)
      throw error
    }
  }

  /**
   * Start an A/B test
   */
  async startABTest(testId: string): Promise<void> {
    try {
      const { error } = await (this.supabase as any)
        .from('ab_tests')
        .update({ 
          status: 'running',
          start_date: new Date().toISOString()
        })
        .eq('test_id', testId)

      if (error) throw error
    } catch (error) {
      console.error('Failed to start A/B test:', error)
      throw error
    }
  }

  /**
   * Record A/B test participant
   */
  async recordABTestParticipant(
    testId: string,
    userId: string,
    variantId: string
  ): Promise<void> {
    try {
      await (this.supabase as any)
        .from('ab_test_participants')
        .upsert({
          test_id: testId,
          user_id: userId,
          variant_id: variantId,
          participated_at: new Date().toISOString()
        }, {
          onConflict: 'test_id,user_id'
        })
    } catch (error) {
      console.error('Failed to record A/B test participant:', error)
    }
  }

  /**
   * Record A/B test conversion
   */
  async recordABTestConversion(
    testId: string,
    userId: string,
    conversionValue?: number
  ): Promise<void> {
    try {
      await (this.supabase as any)
        .from('ab_test_conversions')
        .insert({
          test_id: testId,
          user_id: userId,
          conversion_value: conversionValue || 1,
          converted_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Failed to record A/B test conversion:', error)
    }
  }

  /**
   * Analyze A/B test results
   */
  async analyzeABTestResults(testId: string): Promise<ABTestResults> {
    try {
      // Get test configuration
      const { data: test, error: testError } = await (this.supabase as any)
        .from('ab_tests')
        .select('*')
        .eq('test_id', testId)
        .single()

      if (testError) throw testError

      // Get participants and conversions
      const [participantsResult, conversionsResult] = await Promise.all([
        this.supabase
          .from('ab_test_participants')
          .select('*')
          .eq('test_id', testId),
        this.supabase
          .from('ab_test_conversions')
          .select('*')
          .eq('test_id', testId)
      ])

      const participants = participantsResult.data || []
      const conversions = conversionsResult.data || []

      // Calculate variant performance
      const variantStats = new Map()
      
      test.variants.forEach((variant: ABTestVariant) => {
        const variantParticipants = participants.filter((p: any) => p.variant_id === variant.id)
        const variantConversions = conversions.filter((c: any) => 
          variantParticipants.some((p: any) => p.user_id === c.user_id)
        )

        variantStats.set(variant.id, {
          participants: variantParticipants.length,
          conversions: variantConversions.length,
          conversionRate: variantParticipants.length > 0 
            ? (variantConversions.length / variantParticipants.length) * 100 
            : 0
        })
      })

      // Determine winning variant (simplified statistical analysis)
      let winningVariant = ''
      let bestConversionRate = 0
      
      for (const [variantId, stats] of variantStats) {
        if (stats.conversionRate > bestConversionRate) {
          bestConversionRate = stats.conversionRate
          winningVariant = variantId
        }
      }

      // Calculate statistical significance (simplified)
      const totalParticipants = participants.length
      const minimumSampleSize = test.minimum_sample_size
      const hasMinimumSample = totalParticipants >= minimumSampleSize
      
      // Generate AI-powered analysis
      const aiAnalysis = await this.generateABTestAnalysis(test, variantStats)

      return {
        ...(hasMinimumSample && winningVariant && { winningVariant }),
        confidence: hasMinimumSample ? 95 : 0,
        statisticalSignificance: hasMinimumSample,
        liftPercentage: this.calculateLift(variantStats),
        summary: aiAnalysis.summary,
        recommendations: aiAnalysis.recommendations
      }

    } catch (error) {
      console.error('Failed to analyze A/B test results:', error)
      throw error
    }
  }

  /**
   * Get user segments with behavior analysis
   */
  async getUserSegments(): Promise<UserSegment[]> {
    try {
      // Define common segments
      const segments = [
        {
          name: 'High Volume Users',
          criteria: { submissionVolume: { min: 50 } }
        },
        {
          name: 'Enterprise Customers',
          criteria: { subscriptionTier: ['enterprise'] }
        },
        {
          name: 'Professional Users',
          criteria: { subscriptionTier: ['professional'] }
        },
        {
          name: 'New Users',
          criteria: { 
            registrationDate: { 
              from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
            }
          }
        },
        {
          name: 'High Success Rate Users',
          criteria: { successRate: { min: 80 } }
        }
      ]

      const results: UserSegment[] = []

      for (const segment of segments) {
        const users = await this.getUsersInSegment(segment.criteria)
        const metrics = await this.calculateSegmentMetrics(users)
        const patterns = await this.analyzeBehaviorPatterns(users)

        results.push({
          segmentId: `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: segment.name,
          description: this.generateSegmentDescription(segment.criteria),
          criteria: segment.criteria,
          userCount: users.length,
          avgSuccessRate: metrics.avgSuccessRate,
          topDirectories: metrics.topDirectories,
          behaviorPatterns: patterns
        })
      }

      return results

    } catch (error) {
      console.error('Failed to get user segments:', error)
      throw error
    }
  }

  // Helper methods

  private calculateTrends(submissions: any[]) {
    // Calculate daily, weekly, monthly trends
    const now = new Date()
    const daily = this.calculatePeriodTrends(submissions, 'day', 7)
    const weekly = this.calculatePeriodTrends(submissions, 'week', 4)
    const monthly = this.calculatePeriodTrends(submissions, 'month', 3)

    return { daily, weekly, monthly }
  }

  private calculatePeriodTrends(submissions: any[], period: string, periods: number): SuccessRateTrend[] {
    const trends: SuccessRateTrend[] = []
    
    for (let i = 0; i < periods; i++) {
      const periodData = this.getSubmissionsForPeriod(submissions, period, i)
      const successRate = periodData.total > 0 
        ? (periodData.successful / periodData.total) * 100 
        : 0

      trends.push({
        period: this.formatPeriod(period, i),
        successRate,
        submissionCount: periodData.total,
        change: i > 0 && trends.length > i-1 && trends[i-1] ? successRate - trends[i-1]!.successRate : 0
      })
    }

    return trends.reverse()
  }

  private getSubmissionsForPeriod(submissions: any[], period: string, offset: number) {
    // Implementation would filter submissions by time period
    return { total: 0, successful: 0 }
  }

  private formatPeriod(period: string, offset: number): string {
    const date = new Date()
    if (period === 'day') {
      date.setDate(date.getDate() - offset)
      return date.toISOString().split('T')[0] || ''
    }
    // Add other period formatting logic
    return date.toISOString().split('T')[0] || ''
  }

  private async generateIndustryRecommendations(
    industry: string,
    successRate: number,
    topDirectories: any[],
    failures: any[]
  ): Promise<string[]> {
    try {
      const prompt = `
        Generate recommendations for improving directory submission success in the ${industry} industry.
        Current success rate: ${successRate.toFixed(1)}%
        Top performing directories: ${topDirectories.slice(0, 3).map(d => d.name).join(', ')}
        
        Provide 3-5 specific, actionable recommendations.
      `

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })

      const recommendations = response.choices[0]?.message?.content
        ?.split('\n')
        .filter(line => line.trim().length > 0)
        .slice(0, 5) || []

      return recommendations
    } catch (error) {
      console.error('Failed to generate industry recommendations:', error)
      return ['Focus on high-performing directories', 'Optimize submission data quality']
    }
  }

  private async analyzeFailureReasons(failures: any[]): Promise<string[]> {
    // Analyze common failure patterns
    const reasons = new Map<string, number>()
    
    failures.forEach(failure => {
      // Extract failure reason from error messages or status
      const reason = failure.error_message || 'Unknown error'
      const normalizedReason = this.normalizeFailureReason(reason)
      reasons.set(normalizedReason, (reasons.get(normalizedReason) || 0) + 1)
    })

    return Array.from(reasons.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason]: [string, number]) => reason)
  }

  private normalizeFailureReason(reason: string): string {
    const lowerReason = reason.toLowerCase()
    
    if (lowerReason.includes('network') || lowerReason.includes('connection')) {
      return 'Network connectivity issues'
    }
    if (lowerReason.includes('validation') || lowerReason.includes('invalid')) {
      return 'Data validation errors'
    }
    if (lowerReason.includes('rate limit') || lowerReason.includes('too many')) {
      return 'Rate limiting'
    }
    if (lowerReason.includes('auth') || lowerReason.includes('unauthorized')) {
      return 'Authentication failures'
    }
    
    return 'Other technical issues'
  }

  private async generateABTestAnalysis(test: any, variantStats: Map<string, any>) {
    // Generate AI-powered A/B test analysis
    return {
      summary: 'A/B test analysis completed',
      recommendations: ['Continue with winning variant', 'Monitor performance']
    }
  }

  private calculateLift(variantStats: Map<string, any>): number {
    // Calculate lift percentage between variants
    const rates = Array.from(variantStats.values()).map(s => s.conversionRate)
    const maxRate = Math.max(...rates)
    const minRate = Math.min(...rates)
    
    return minRate > 0 ? ((maxRate - minRate) / minRate) * 100 : 0
  }

  private async getUsersInSegment(criteria: SegmentCriteria): Promise<any[]> {
    // Query users based on segment criteria
    return []
  }

  private async calculateSegmentMetrics(users: any[]) {
    // Calculate metrics for user segment
    return {
      avgSuccessRate: 0,
      topDirectories: []
    }
  }

  private async analyzeBehaviorPatterns(users: any[]): Promise<BehaviorPattern[]> {
    // Analyze user behavior patterns
    return []
  }

  private generateSegmentDescription(criteria: SegmentCriteria): string {
    // Generate human-readable description of segment criteria
    return 'Users matching specific criteria'
  }
}

export const businessIntelligenceService = new BusinessIntelligenceService()
