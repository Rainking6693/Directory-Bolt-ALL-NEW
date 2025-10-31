// 🔒 ANALYSIS COST TRACKER
// Track OpenAI and Anthropic API costs per analysis with ROI optimization

import type { 
  AiCostTracking, 
  AiProvider,
  AnalysisJob,
  SubscriptionTier 
} from '../database/tier-schema'
import { logger } from '../utils/logger'

// Current API pricing (as of January 2025) - update regularly
const AI_PRICING = {
  openai: {
    'gpt-4o': {
      input: 0.00001, // $0.01 per 1K input tokens
      output: 0.00003 // $0.03 per 1K output tokens
    },
    'gpt-4o-mini': {
      input: 0.000000375, // $0.000375 per 1K input tokens  
      output: 0.0000015 // $0.0015 per 1K output tokens
    },
    'gpt-3.5-turbo': {
      input: 0.000001, // $0.001 per 1K input tokens
      output: 0.000002 // $0.002 per 1K output tokens
    }
  },
  anthropic: {
    'claude-3-5-sonnet-20241022': {
      input: 0.000003, // $0.003 per 1K input tokens
      output: 0.000015 // $0.015 per 1K output tokens
    },
    'claude-3-haiku-20240307': {
      input: 0.00000025, // $0.00025 per 1K input tokens
      output: 0.00000125 // $0.00125 per 1K output tokens
    }
  }
} as const

export class AnalysisCostTracker {
  
  /**
   * Estimate cost before running analysis based on input complexity
   */
  estimateAnalysisCost(
    inputData: Record<string, any>,
    analysisType: string,
    userTier: SubscriptionTier
  ): {
    estimatedCost: number // In cents
    breakdown: {
      openai?: { model: string; inputTokens: number; outputTokens: number; cost: number }
      anthropic?: { model: string; inputTokens: number; outputTokens: number; cost: number }
    }
    recommendations: string[]
  } {
    const inputComplexity = this.calculateInputComplexity(inputData)
    let totalCost = 0
    const breakdown: any = {}
    const recommendations: string[] = []

    // Estimate based on analysis type and user tier
    switch (analysisType) {
      case 'basic_extraction':
        // Simple extraction using GPT-4o-mini for cost efficiency
        const basicTokens = Math.min(inputComplexity.estimatedTokens, 4000)
        const basicOutputTokens = Math.min(basicTokens * 0.3, 1000)
        
        breakdown.openai = {
          model: 'gpt-4o-mini',
          inputTokens: basicTokens,
          outputTokens: basicOutputTokens,
          cost: this.calculateOpenAICost('gpt-4o-mini', basicTokens, basicOutputTokens)
        }
        totalCost += breakdown.openai.cost

        recommendations.push('Using GPT-4o-mini for cost-effective basic extraction')
        break

      case 'ai_competitor_analysis':
        // More complex analysis using GPT-4o for better insights
        const compTokens = Math.min(inputComplexity.estimatedTokens, 8000)
        const compOutputTokens = Math.min(compTokens * 0.5, 3000)
        
        breakdown.openai = {
          model: 'gpt-4o',
          inputTokens: compTokens,
          outputTokens: compOutputTokens,
          cost: this.calculateOpenAICost('gpt-4o', compTokens, compOutputTokens)
        }
        totalCost += breakdown.openai.cost

        if (userTier === 'professional' || userTier === 'enterprise') {
          // Add Anthropic for cross-validation on higher tiers
          const anthropicTokens = Math.min(compTokens, 6000)
          const anthropicOutputTokens = Math.min(anthropicTokens * 0.4, 2000)
          
          breakdown.anthropic = {
            model: 'claude-3-haiku-20240307',
            inputTokens: anthropicTokens,
            outputTokens: anthropicOutputTokens,
            cost: this.calculateAnthropicCost('claude-3-haiku-20240307', anthropicTokens, anthropicOutputTokens)
          }
          totalCost += breakdown.anthropic.cost
          
          recommendations.push('Using dual AI providers for enhanced accuracy')
        }

        recommendations.push('Optimized model selection based on your tier')
        break

      case 'advanced_insights':
        // Premium analysis using Claude-3.5-Sonnet for best insights
        const advTokens = Math.min(inputComplexity.estimatedTokens, 12000)
        const advOutputTokens = Math.min(advTokens * 0.6, 5000)
        
        breakdown.anthropic = {
          model: 'claude-3-5-sonnet-20241022',
          inputTokens: advTokens,
          outputTokens: advOutputTokens,
          cost: this.calculateAnthropicCost('claude-3-5-sonnet-20241022', advTokens, advOutputTokens)
        }
        totalCost += breakdown.anthropic.cost

        if (userTier === 'enterprise') {
          // Add GPT-4o for comprehensive analysis
          breakdown.openai = {
            model: 'gpt-4o',
            inputTokens: advTokens,
            outputTokens: advOutputTokens,
            cost: this.calculateOpenAICost('gpt-4o', advTokens, advOutputTokens)
          }
          totalCost += breakdown.openai.cost
        }

        recommendations.push('Using premium AI models for advanced insights')
        break

      default:
        // Fallback to basic estimation
        totalCost = 200 // $2.00 in cents
        recommendations.push('Using standard pricing estimation')
    }

    // Add cost optimization recommendations
    if (totalCost > 500) { // > $5.00
      recommendations.push('Consider breaking down complex analysis into smaller parts')
    }
    
    if (userTier === 'free' && totalCost > 200) { // > $2.00
      recommendations.push('Upgrade to Starter plan for more cost-effective analysis')
    }

    return {
      estimatedCost: Math.round(totalCost),
      breakdown,
      recommendations
    }
  }

  /**
   * Track actual costs after analysis completion
   */
  async trackActualCosts(
    analysisJobId: string,
    userId: string,
    aiUsage: {
      openai?: {
        model: string
        inputTokens: number
        outputTokens: number
        responseTime: number
        requestId: string
      }
      anthropic?: {
        model: string
        inputTokens: number
        outputTokens: number
        responseTime: number
        requestId: string
      }
    }
  ): Promise<{
    totalCost: number
    openaiCost: number
    anthropicCost: number
    costBreakdown: AiCostTracking[]
  }> {
    const costRecords: AiCostTracking[] = []
    let totalCost = 0
    let openaiCost = 0
    let anthropicCost = 0

    try {
      // Track OpenAI usage
      if (aiUsage.openai) {
        const cost = this.calculateOpenAICost(
          aiUsage.openai.model,
          aiUsage.openai.inputTokens,
          aiUsage.openai.outputTokens
        )

        const costRecord: AiCostTracking = {
          id: `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          analysis_job_id: analysisJobId,
          user_id: userId,
          provider: 'openai',
          model_used: aiUsage.openai.model,
          input_tokens: aiUsage.openai.inputTokens,
          output_tokens: aiUsage.openai.outputTokens,
          total_tokens: aiUsage.openai.inputTokens + aiUsage.openai.outputTokens,
          cost_per_input_token: this.getOpenAIInputPrice(aiUsage.openai.model),
          cost_per_output_token: this.getOpenAIOutputPrice(aiUsage.openai.model),
          total_cost: cost,
          request_id: aiUsage.openai.requestId,
          response_time_ms: aiUsage.openai.responseTime,
          created_at: new Date()
        }

        costRecords.push(costRecord)
        openaiCost = cost
        totalCost += cost

        // Save to database
        await this.saveCostRecord(costRecord)
      }

      // Track Anthropic usage
      if (aiUsage.anthropic) {
        const cost = this.calculateAnthropicCost(
          aiUsage.anthropic.model,
          aiUsage.anthropic.inputTokens,
          aiUsage.anthropic.outputTokens
        )

        const costRecord: AiCostTracking = {
          id: `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          analysis_job_id: analysisJobId,
          user_id: userId,
          provider: 'anthropic',
          model_used: aiUsage.anthropic.model,
          input_tokens: aiUsage.anthropic.inputTokens,
          output_tokens: aiUsage.anthropic.outputTokens,
          total_tokens: aiUsage.anthropic.inputTokens + aiUsage.anthropic.outputTokens,
          cost_per_input_token: this.getAnthropicInputPrice(aiUsage.anthropic.model),
          cost_per_output_token: this.getAnthropicOutputPrice(aiUsage.anthropic.model),
          total_cost: cost,
          request_id: aiUsage.anthropic.requestId,
          response_time_ms: aiUsage.anthropic.responseTime,
          created_at: new Date()
        }

        costRecords.push(costRecord)
        anthropicCost = cost
        totalCost += cost

        // Save to database
        await this.saveCostRecord(costRecord)
      }

      logger.info('AI costs tracked', {
        analysisJobId,
        userId,
        totalCost,
        openaiCost,
        anthropicCost,
        recordCount: costRecords.length
      })

      return {
        totalCost: Math.round(totalCost),
        openaiCost: Math.round(openaiCost),
        anthropicCost: Math.round(anthropicCost),
        costBreakdown: costRecords
      }

    } catch (error) {
      logger.error('Error tracking AI costs', {
        analysisJobId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Get cost optimization recommendations based on usage patterns
   */
  async getCostOptimizationRecommendations(userId: string): Promise<{
    currentMonthSpend: number
    projectedMonthSpend: number
    recommendations: Array<{
      type: 'model_optimization' | 'tier_upgrade' | 'usage_pattern' | 'feature_optimization'
      title: string
      description: string
      potentialSavings: number // In cents
      implementationEffort: 'low' | 'medium' | 'high'
    }>
  }> {
    try {
      const usage = await this.getUserCostAnalysis(userId)
      const projectedSpend = usage.currentMonthSpend * (30 / new Date().getDate())
      const recommendations: any[] = []

      // Model optimization recommendations
      if (usage.modelBreakdown.openai?.['gpt-4o'] > usage.totalCost * 0.6) {
        recommendations.push({
          type: 'model_optimization',
          title: 'Optimize Model Usage',
          description: 'Consider using GPT-4o-mini for basic extractions to reduce costs by 90%',
          potentialSavings: Math.round(usage.modelBreakdown.openai['gpt-4o'] * 0.5),
          implementationEffort: 'low'
        })
      }

      // Tier upgrade recommendations  
      if (usage.currentMonthSpend > 3000 && usage.currentTier === 'starter') {
        recommendations.push({
          type: 'tier_upgrade',
          title: 'Consider Growth Plan',
          description: 'Higher tier includes more cost-effective analysis options and bulk discounts',
          potentialSavings: Math.round(usage.currentMonthSpend * 0.2),
          implementationEffort: 'low'
        })
      }

      // Usage pattern optimization
      if (usage.averageAnalysisSize > 10000) {
        recommendations.push({
          type: 'usage_pattern',
          title: 'Optimize Input Size',
          description: 'Break large analyses into smaller chunks to optimize token usage',
          potentialSavings: Math.round(usage.currentMonthSpend * 0.15),
          implementationEffort: 'medium'
        })
      }

      return {
        currentMonthSpend: usage.currentMonthSpend,
        projectedMonthSpend: Math.round(projectedSpend),
        recommendations
      }

    } catch (error) {
      logger.error('Error getting cost optimization recommendations', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Calculate ROI for different subscription tiers
   */
  calculateTierROI(
    monthlyAnalyses: number,
    averageAnalysisValue: number, // Customer's perceived value per analysis
    currentTier: SubscriptionTier
  ): Array<{
    tier: SubscriptionTier
    monthlyCost: number
    monthlyValue: number
    roi: number
    costPerAnalysis: number
    recommendation: string
  }> {
    const tierPricing = {
      free: 0,
      starter: 14900, // $149 in cents
      growth: 29900, // $299 in cents
      professional: 49900, // $499 in cents
      enterprise: 79900 // $799 in cents
    }

    const tierLimits = {
      free: 3,
      starter: 25,
      growth: 100,
      professional: 300,
      enterprise: -1 // Unlimited
    }

    return Object.entries(tierPricing).map(([tier, cost]: [string, number]) => {
      const tierLimit = tierLimits[tier as SubscriptionTier]
      const effectiveAnalyses = tierLimit === -1 ? monthlyAnalyses : Math.min(monthlyAnalyses, tierLimit)
      const monthlyValue = effectiveAnalyses * averageAnalysisValue
      const roi = cost > 0 ? ((monthlyValue - cost) / cost) * 100 : monthlyValue > 0 ? 1000 : 0
      const costPerAnalysis = effectiveAnalyses > 0 ? cost / effectiveAnalyses : 0

      let recommendation = ''
      if (tier === currentTier) {
        recommendation = 'Current plan'
      } else if (effectiveAnalyses < monthlyAnalyses) {
        recommendation = 'Insufficient capacity'
      } else if (roi > 200) {
        recommendation = 'High ROI - Recommended'
      } else if (roi > 100) {
        recommendation = 'Good ROI'
      } else {
        recommendation = 'Consider value vs cost'
      }

      return {
        tier: tier as SubscriptionTier,
        monthlyCost: cost,
        monthlyValue,
        roi: Math.round(roi),
        costPerAnalysis: Math.round(costPerAnalysis),
        recommendation
      }
    }).sort((a, b) => b.roi - a.roi)
  }

  // Private helper methods

  private calculateInputComplexity(inputData: Record<string, any>): {
    estimatedTokens: number
    complexity: 'low' | 'medium' | 'high'
  } {
    const dataString = JSON.stringify(inputData)
    const charCount = dataString.length
    
    // Rough token estimation: ~4 characters per token
    const estimatedTokens = Math.ceil(charCount / 4)
    
    let complexity: 'low' | 'medium' | 'high' = 'low'
    if (estimatedTokens > 8000) complexity = 'high'
    else if (estimatedTokens > 3000) complexity = 'medium'

    return { estimatedTokens, complexity }
  }

  private calculateOpenAICost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = AI_PRICING.openai[model as keyof typeof AI_PRICING.openai]
    if (!pricing) return 0

    const inputCost = (inputTokens / 1000) * pricing.input
    const outputCost = (outputTokens / 1000) * pricing.output
    
    return Math.round((inputCost + outputCost) * 100) // Convert to cents
  }

  private calculateAnthropicCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = AI_PRICING.anthropic[model as keyof typeof AI_PRICING.anthropic]
    if (!pricing) return 0

    const inputCost = (inputTokens / 1000) * pricing.input
    const outputCost = (outputTokens / 1000) * pricing.output
    
    return Math.round((inputCost + outputCost) * 100) // Convert to cents
  }

  private getOpenAIInputPrice(model: string): number {
    const pricing = AI_PRICING.openai[model as keyof typeof AI_PRICING.openai]
    return pricing ? Math.round(pricing.input * 100000) : 0 // Convert to cents per token
  }

  private getOpenAIOutputPrice(model: string): number {
    const pricing = AI_PRICING.openai[model as keyof typeof AI_PRICING.openai]
    return pricing ? Math.round(pricing.output * 100000) : 0 // Convert to cents per token
  }

  private getAnthropicInputPrice(model: string): number {
    const pricing = AI_PRICING.anthropic[model as keyof typeof AI_PRICING.anthropic]
    return pricing ? Math.round(pricing.input * 100000) : 0 // Convert to cents per token
  }

  private getAnthropicOutputPrice(model: string): number {
    const pricing = AI_PRICING.anthropic[model as keyof typeof AI_PRICING.anthropic]
    return pricing ? Math.round(pricing.output * 100000) : 0 // Convert to cents per token
  }

  private async saveCostRecord(record: AiCostTracking): Promise<void> {
    // TODO: Implement database save
    // await db.aiCostTracking.create({ data: record })
    
    logger.info('Cost record saved', {
      analysisJobId: record.analysis_job_id,
      provider: record.provider,
      model: record.model_used,
      totalCost: record.total_cost
    })
  }

  private async getUserCostAnalysis(userId: string): Promise<any> {
    // TODO: Implement actual database query
    // Mock data for development
    return {
      currentMonthSpend: 2500, // $25.00 in cents
      totalCost: 2500,
      currentTier: 'starter' as SubscriptionTier,
      modelBreakdown: {
        openai: {
          'gpt-4o': 1500,
          'gpt-4o-mini': 500
        },
        anthropic: {
          'claude-3-haiku-20240307': 500
        }
      },
      averageAnalysisSize: 5000
    }
  }
}

// Export singleton instance
export const analysisCostTracker = new AnalysisCostTracker()
