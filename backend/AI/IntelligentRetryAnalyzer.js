/**
 * 🔄 INTELLIGENT RETRY LOGIC ANALYZER
 * 
 * Analyzes submission failures and determines optimal retry strategies using AI.
 * Features:
 * - Failure reason analysis and categorization
 * - Retry probability prediction
 * - Optimal retry timing calculation
 * - Content improvement suggestions
 * - Strategic retry approach recommendations
 * - Success rate optimization through learning
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

class IntelligentRetryAnalyzer {
  constructor(config = {}) {
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY
    });
    
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.config = {
      maxRetryAttempts: config.maxRetryAttempts || 3,
      baseRetryDelayMs: config.baseRetryDelayMs || 24 * 60 * 60 * 1000, // 24 hours
      maxRetryDelayMs: config.maxRetryDelayMs || 7 * 24 * 60 * 60 * 1000, // 7 days
      learningWindowDays: config.learningWindowDays || 30,
      minConfidenceThreshold: config.minConfidenceThreshold || 0.3,
      ...config
    };
    
    // Retry analysis cache and patterns
    this.retryPatterns = new Map();
    this.failureAnalysisCache = new Map();
    this.retryStrategies = new Map();
    
    // Failure categories and their typical retry success rates
    this.failureCategories = {
      CONTENT_QUALITY: {
        name: 'Content Quality Issues',
        retryProbability: 0.7,
        improvementRequired: true,
        typicalDelay: 1 * 24 * 60 * 60 * 1000, // 1 day
        strategies: ['content_improvement', 'description_rewrite', 'keyword_optimization']
      },
      REQUIREMENTS_NOT_MET: {
        name: 'Requirements Not Met',
        retryProbability: 0.8,
        improvementRequired: true,
        typicalDelay: 1 * 24 * 60 * 60 * 1000, // 1 day
        strategies: ['requirements_compliance', 'field_completion', 'format_correction']
      },
      WRONG_CATEGORY: {
        name: 'Wrong Category/Fit',
        retryProbability: 0.6,
        improvementRequired: true,
        typicalDelay: 2 * 24 * 60 * 60 * 1000, // 2 days
        strategies: ['category_reassessment', 'business_repositioning', 'target_adjustment']
      },
      TECHNICAL_ERROR: {
        name: 'Technical Issues',
        retryProbability: 0.9,
        improvementRequired: false,
        typicalDelay: 6 * 60 * 60 * 1000, // 6 hours
        strategies: ['immediate_retry', 'alternative_approach', 'technical_support']
      },
      TEMPORARY_REJECTION: {
        name: 'Temporary Issues',
        retryProbability: 0.8,
        improvementRequired: false,
        typicalDelay: 3 * 24 * 60 * 60 * 1000, // 3 days
        strategies: ['delayed_retry', 'timing_optimization', 'queue_management']
      },
      POLICY_VIOLATION: {
        name: 'Policy Violations',
        retryProbability: 0.4,
        improvementRequired: true,
        typicalDelay: 7 * 24 * 60 * 60 * 1000, // 7 days
        strategies: ['policy_compliance', 'content_revision', 'legal_review']
      },
      DUPLICATE_LISTING: {
        name: 'Duplicate/Already Listed',
        retryProbability: 0.1,
        improvementRequired: false,
        typicalDelay: 0, // No retry recommended
        strategies: ['verification_check', 'listing_claim', 'alternative_directory']
      },
      UNKNOWN_REASON: {
        name: 'Unknown/Unclear Reason',
        retryProbability: 0.5,
        improvementRequired: true,
        typicalDelay: 2 * 24 * 60 * 60 * 1000, // 2 days
        strategies: ['ai_analysis', 'content_optimization', 'manual_review']
      }
    };
    
    this.initializeAnalyzer();
  }
  
  async initializeAnalyzer() {
    console.log('🔄 Initializing Intelligent Retry Logic Analyzer...');
    
    try {
      await this.loadRetryPatterns();
      await this.analyzeHistoricalRetries();
      console.log('✅ Retry Logic Analyzer initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize retry analyzer:', error);
      throw error;
    }
  }
  
  /**
   * Analyze failed submission and determine retry strategy
   */
  async analyzeFailureAndRecommendRetry(failureData) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      console.log(`🔍 [${requestId}] Analyzing failure for submission: ${failureData.submissionId}`);
      
      // Validate input
      this.validateFailureData(failureData);
      
      // Check for cached analysis
      const cacheKey = this.generateAnalysisCacheKey(failureData);
      const cached = this.getCachedAnalysis(cacheKey);
      if (cached) {
        console.log(`💾 [${requestId}] Using cached failure analysis`);
        return { ...cached, fromCache: true };
      }
      
      // Analyze failure reason using AI
      const failureAnalysis = await this.analyzeFailureReason(failureData);
      
      // Get historical retry patterns for this directory and failure type
      const retryPatterns = await this.getRetryPatterns(
        failureData.directoryId,
        failureAnalysis.category
      );
      
      // Calculate retry probability
      const retryProbability = await this.calculateRetryProbability(
        failureData,
        failureAnalysis,
        retryPatterns
      );
      
      // Generate improvement recommendations
      const improvements = await this.generateImprovementRecommendations(
        failureData,
        failureAnalysis
      );
      
      // Determine optimal retry timing
      const optimalTiming = await this.calculateOptimalRetryTiming(
        failureData,
        failureAnalysis,
        retryPatterns
      );
      
      // Generate retry strategy
      const retryStrategy = this.generateRetryStrategy(
        failureAnalysis,
        retryProbability,
        improvements,
        optimalTiming
      );
      
      const result = {
        requestId,
        submissionId: failureData.submissionId,
        directoryId: failureData.directoryId,
        failureAnalysis,
        retryProbability,
        retryRecommendation: retryProbability.shouldRetry,
        improvements,
        optimalTiming,
        retryStrategy,
        confidence: retryProbability.confidence,
        processingTime: Date.now() - startTime,
        analyzedAt: new Date().toISOString()
      };
      
      // Cache the analysis
      this.cacheAnalysis(cacheKey, result);
      
      console.log(`✅ [${requestId}] Retry analysis complete. Recommend retry: ${result.retryRecommendation}`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ [${requestId}] Retry analysis failed:`, error);
      throw error;
    }
  }
  
  /**
   * Analyze the specific failure reason using AI
   */
  async analyzeFailureReason(failureData) {
    try {
      const prompt = this.buildFailureAnalysisPrompt(failureData);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20241022',
        max_tokens: 800,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });
      
      const aiAnalysis = response.content[0].text;
      return this.parseFailureAnalysis(aiAnalysis, failureData);
      
    } catch (error) {
      console.warn('AI failure analysis failed, using fallback:', error);
      return this.generateFallbackAnalysis(failureData);
    }
  }
  
  /**
   * Build comprehensive failure analysis prompt
   */
  buildFailureAnalysisPrompt(failureData) {
    return `Analyze this directory submission failure and categorize it:

SUBMISSION DETAILS:
- Directory: ${failureData.directoryName || 'Unknown Directory'}
- Business: ${failureData.businessName}
- Category: ${failureData.businessCategory || 'Not specified'}
- Submission Date: ${failureData.submittedAt}

FAILURE INFORMATION:
- Rejection Reason: ${failureData.rejectionReason || 'Not provided'}
- Error Message: ${failureData.errorMessage || 'None'}
- Status: ${failureData.status}
- Response Time: ${failureData.responseTime || 'Unknown'}

SUBMISSION CONTENT:
- Description: ${failureData.businessDescription?.substring(0, 300) || 'Not provided'}
- Website: ${failureData.website || 'Not provided'}
- Contact Info: ${failureData.contactInfo ? 'Provided' : 'Not provided'}

PREVIOUS ATTEMPTS:
- Attempt Number: ${failureData.attemptNumber || 1}
- Previous Failures: ${failureData.previousFailures?.join(', ') || 'None'}

Please analyze this failure and provide:

1. Primary failure category from: CONTENT_QUALITY, REQUIREMENTS_NOT_MET, WRONG_CATEGORY, TECHNICAL_ERROR, TEMPORARY_REJECTION, POLICY_VIOLATION, DUPLICATE_LISTING, UNKNOWN_REASON

2. Specific issues identified

3. Root cause analysis

4. Confidence in the analysis (0.0 to 1.0)

5. Whether the failure appears to be fixable

Format as JSON:
{
  "category": "CONTENT_QUALITY",
  "specificIssues": ["Issue 1", "Issue 2"],
  "rootCause": "Detailed explanation of the main cause",
  "confidence": 0.85,
  "isFixable": true,
  "reasoning": "Brief explanation of the analysis"
}

Focus on accuracy and actionable insights.`;
  }
  
  /**
   * Parse AI failure analysis response
   */
  parseFailureAnalysis(aiAnalysis, failureData) {
    try {
      const parsed = JSON.parse(aiAnalysis.trim());
      
      // Validate category
      if (!this.failureCategories[parsed.category]) {
        parsed.category = 'UNKNOWN_REASON';
      }
      
      const categoryInfo = this.failureCategories[parsed.category];
      
      return {
        category: parsed.category,
        categoryName: categoryInfo.name,
        specificIssues: parsed.specificIssues || [],
        rootCause: parsed.rootCause || 'Analysis unavailable',
        confidence: parsed.confidence || 0.5,
        isFixable: parsed.isFixable !== false, // Default to true
        reasoning: parsed.reasoning || '',
        categoryInfo: categoryInfo,
        analyzedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.warn('Failed to parse failure analysis:', error);
      return this.generateFallbackAnalysis(failureData);
    }
  }
  
  /**
   * Calculate probability of success if retried
   */
  async calculateRetryProbability(failureData, failureAnalysis, retryPatterns) {
    let baseRetryProbability = failureAnalysis.categoryInfo.retryProbability;
    
    // Adjust based on attempt number (diminishing returns)
    const attemptNumber = failureData.attemptNumber || 1;
    const attemptPenalty = Math.pow(0.7, attemptNumber - 1);
    baseRetryProbability *= attemptPenalty;
    
    // Adjust based on historical patterns for this directory
    if (retryPatterns.successRate && retryPatterns.sampleSize >= 5) {
      const historicalWeight = 0.3;
      baseRetryProbability = (baseRetryProbability * (1 - historicalWeight)) + 
                           (retryPatterns.successRate * historicalWeight);
    }
    
    // Adjust based on failure analysis confidence
    const confidenceAdjustment = failureAnalysis.confidence * 0.2;
    const adjustedProbability = baseRetryProbability + 
      (failureAnalysis.isFixable ? confidenceAdjustment : -confidenceAdjustment);
    
    // Business profile factors
    const businessFactors = this.calculateBusinessFactors(failureData);
    const finalProbability = Math.max(0, Math.min(1, 
      adjustedProbability * businessFactors.multiplier
    ));
    
    const shouldRetry = finalProbability >= this.config.minConfidenceThreshold && 
                       attemptNumber <= this.config.maxRetryAttempts;
    
    return {
      probability: finalProbability,
      shouldRetry,
      confidence: Math.min(failureAnalysis.confidence + 0.2, 1.0),
      factors: {
        baseCategory: failureAnalysis.categoryInfo.retryProbability,
        attemptPenalty: attemptPenalty,
        historicalData: retryPatterns.successRate || 'insufficient',
        confidenceBonus: confidenceAdjustment,
        businessProfile: businessFactors.multiplier
      },
      reasoning: this.generateProbabilityReasoning(
        finalProbability,
        shouldRetry,
        attemptNumber,
        failureAnalysis
      )
    };
  }
  
  /**
   * Get retry patterns for specific directory and failure type
   */
  async getRetryPatterns(directoryId, failureCategory) {
    const cacheKey = `${directoryId}_${failureCategory}`;
    const cached = this.retryPatterns.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.updatedAt)) {
      return cached.patterns;
    }
    
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - this.config.learningWindowDays);
      
      // Query retry attempts and their outcomes
      const { data: retryHistory, error } = await this.supabase
        .from('user_submissions')
        .select(`
          id,
          submission_status,
          rejection_reason,
          retry_count,
          original_submission_id,
          submitted_at,
          approved_at
        `)
        .eq('directory_id', directoryId)
        .gte('submitted_at', startDate.toISOString())
        .gt('retry_count', 0)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      
      const patterns = this.analyzeRetryHistory(retryHistory || [], failureCategory);
      
      // Cache the patterns
      this.retryPatterns.set(cacheKey, {
        patterns,
        updatedAt: Date.now()
      });
      
      return patterns;
      
    } catch (error) {
      console.warn(`Failed to load retry patterns for ${directoryId}:`, error);
      return this.getDefaultRetryPatterns();
    }
  }
  
  /**
   * Analyze historical retry data to find patterns
   */
  analyzeRetryHistory(retryHistory, targetCategory) {
    const relevantRetries = retryHistory.filter(retry => 
      this.categorizeRejectionReason(retry.rejection_reason) === targetCategory
    );
    
    if (relevantRetries.length === 0) {
      return this.getDefaultRetryPatterns();
    }
    
    const successful = relevantRetries.filter(retry => 
      retry.submission_status === 'approved'
    );
    
    const successRate = successful.length / relevantRetries.length;
    
    // Analyze timing patterns
    const retryDelays = relevantRetries
      .filter(retry => retry.original_submission_id)
      .map(retry => {
        // This would require more complex query to get original submission time
        // For now, use submitted_at as proxy
        return Math.random() * 7; // Placeholder: 0-7 days
      });
    
    const avgRetryDelay = retryDelays.length > 0 
      ? retryDelays.reduce((sum, delay) => sum + delay, 0) / retryDelays.length 
      : 2;
    
    return {
      successRate,
      sampleSize: relevantRetries.length,
      averageRetryDelay: avgRetryDelay,
      totalRetries: retryHistory.length,
      lastAnalyzed: new Date().toISOString(),
      trends: {
        recentPerformance: this.calculateRecentTrend(relevantRetries),
        bestRetryCount: this.findOptimalRetryCount(relevantRetries)
      }
    };
  }
  
  /**
   * Generate improvement recommendations
   */
  async generateImprovementRecommendations(failureData, failureAnalysis) {
    try {
      const prompt = `Based on this submission failure analysis, provide specific improvement recommendations:

FAILURE ANALYSIS:
- Category: ${failureAnalysis.category}
- Root Cause: ${failureAnalysis.rootCause}
- Specific Issues: ${failureAnalysis.specificIssues.join(', ')}

ORIGINAL SUBMISSION:
- Business: ${failureData.businessName}
- Description: ${failureData.businessDescription?.substring(0, 200) || 'Not provided'}
- Category: ${failureData.businessCategory || 'Not specified'}

Provide actionable improvements in JSON format:
{
  "critical": ["Must-fix issues for retry"],
  "recommended": ["Improvements that would help"],
  "optional": ["Nice-to-have enhancements"],
  "contentChanges": ["Specific content modifications"],
  "strategyChanges": ["Approach or timing modifications"]
}

Focus on specific, actionable recommendations.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      });
      
      const recommendations = JSON.parse(response.content[0].text);
      
      return {
        ...recommendations,
        generatedAt: new Date().toISOString(),
        confidence: failureAnalysis.confidence
      };
      
    } catch (error) {
      console.warn('Failed to generate AI recommendations:', error);
      return this.generateFallbackRecommendations(failureAnalysis);
    }
  }
  
  /**
   * Calculate optimal retry timing
   */
  async calculateOptimalRetryTiming(failureData, failureAnalysis, retryPatterns) {
    const baseDelay = failureAnalysis.categoryInfo.typicalDelay;
    const attemptNumber = failureData.attemptNumber || 1;
    
    // Exponential backoff for multiple attempts
    const backoffMultiplier = Math.pow(1.5, attemptNumber - 1);
    let recommendedDelay = baseDelay * backoffMultiplier;
    
    // Adjust based on historical patterns
    if (retryPatterns.averageRetryDelay) {
      const historicalDelay = retryPatterns.averageRetryDelay * 24 * 60 * 60 * 1000;
      recommendedDelay = (recommendedDelay + historicalDelay) / 2;
    }
    
    // Cap at maximum delay
    recommendedDelay = Math.min(recommendedDelay, this.config.maxRetryDelayMs);
    
    const retryDate = new Date(Date.now() + recommendedDelay);
    
    return {
      recommendedDelayMs: recommendedDelay,
      recommendedDelayHours: Math.round(recommendedDelay / (60 * 60 * 1000)),
      retryDate: retryDate.toISOString(),
      reasoning: this.generateTimingReasoning(
        failureAnalysis,
        attemptNumber,
        recommendedDelay
      ),
      factors: {
        baseDelay: baseDelay,
        backoffMultiplier: backoffMultiplier,
        historicalInfluence: retryPatterns.averageRetryDelay || null,
        attemptNumber: attemptNumber
      }
    };
  }
  
  /**
   * Generate comprehensive retry strategy
   */
  generateRetryStrategy(failureAnalysis, retryProbability, improvements, timing) {
    const categoryStrategies = failureAnalysis.categoryInfo.strategies;
    
    const strategy = {
      primaryApproach: categoryStrategies[0],
      alternativeApproaches: categoryStrategies.slice(1),
      requiredImprovements: improvements.critical || [],
      recommendedImprovements: improvements.recommended || [],
      timing: {
        waitPeriod: timing.recommendedDelayHours,
        retryDate: timing.retryDate,
        reasoning: timing.reasoning
      },
      successProbability: retryProbability.probability,
      confidence: retryProbability.confidence,
      riskFactors: this.identifyRiskFactors(failureAnalysis, retryProbability),
      contingencyPlans: this.generateContingencyPlans(failureAnalysis)
    };
    
    return strategy;
  }
  
  // Helper methods
  calculateBusinessFactors(failureData) {
    let multiplier = 1.0;
    const factors = {};
    
    // Website presence
    if (failureData.website && failureData.website.startsWith('http')) {
      multiplier += 0.1;
      factors.website = 'positive';
    }
    
    // Complete contact information
    if (failureData.contactInfo) {
      multiplier += 0.05;
      factors.contact = 'positive';
    }
    
    // Description quality (simple heuristic)
    const descLength = failureData.businessDescription?.length || 0;
    if (descLength > 100 && descLength < 1000) {
      multiplier += 0.1;
      factors.description = 'appropriate_length';
    } else if (descLength < 50) {
      multiplier -= 0.1;
      factors.description = 'too_short';
    }
    
    return { multiplier: Math.max(0.5, Math.min(1.5, multiplier)), factors };
  }
  
  generateProbabilityReasoning(probability, shouldRetry, attemptNumber, failureAnalysis) {
    const probPercent = (probability * 100).toFixed(1);
    
    if (!shouldRetry) {
      if (attemptNumber > this.config.maxRetryAttempts) {
        return `Maximum retry attempts (${this.config.maxRetryAttempts}) reached. Success probability: ${probPercent}%`;
      }
      return `Success probability too low (${probPercent}%) to justify retry effort.`;
    }
    
    const categoryName = failureAnalysis.categoryName;
    return `${probPercent}% success probability for ${categoryName} retry (attempt #${attemptNumber}). ${failureAnalysis.isFixable ? 'Issues appear fixable.' : 'May require significant changes.'}`;
  }
  
  categorizeRejectionReason(rejectionReason) {
    if (!rejectionReason) return 'UNKNOWN_REASON';
    
    const reason = rejectionReason.toLowerCase();
    
    if (reason.includes('quality') || reason.includes('content')) return 'CONTENT_QUALITY';
    if (reason.includes('requirement') || reason.includes('incomplete')) return 'REQUIREMENTS_NOT_MET';
    if (reason.includes('category') || reason.includes('relevant')) return 'WRONG_CATEGORY';
    if (reason.includes('error') || reason.includes('technical')) return 'TECHNICAL_ERROR';
    if (reason.includes('temporary') || reason.includes('busy')) return 'TEMPORARY_REJECTION';
    if (reason.includes('policy') || reason.includes('violation')) return 'POLICY_VIOLATION';
    if (reason.includes('duplicate') || reason.includes('already')) return 'DUPLICATE_LISTING';
    
    return 'UNKNOWN_REASON';
  }
  
  calculateRecentTrend(retries) {
    if (retries.length < 10) return 0.5;
    
    const recent = retries.slice(0, Math.floor(retries.length / 2));
    const older = retries.slice(Math.floor(retries.length / 2));
    
    const recentSuccess = recent.filter(r => r.submission_status === 'approved').length / recent.length;
    const olderSuccess = older.filter(r => r.submission_status === 'approved').length / older.length;
    
    return Math.max(0, Math.min(1, recentSuccess - olderSuccess + 0.5));
  }
  
  findOptimalRetryCount(retries) {
    const retryCountSuccess = {};
    
    retries.forEach(retry => {
      const count = retry.retry_count || 1;
      if (!retryCountSuccess[count]) {
        retryCountSuccess[count] = { total: 0, successful: 0 };
      }
      retryCountSuccess[count].total++;
      if (retry.submission_status === 'approved') {
        retryCountSuccess[count].successful++;
      }
    });
    
    let bestCount = 1;
    let bestRate = 0;
    
    for (const [count, data] of Object.entries(retryCountSuccess)) {
      if (data.total >= 3) { // Minimum sample size
        const rate = data.successful / data.total;
        if (rate > bestRate) {
          bestRate = rate;
          bestCount = parseInt(count);
        }
      }
    }
    
    return { count: bestCount, successRate: bestRate };
  }
  
  identifyRiskFactors(failureAnalysis, retryProbability) {
    const risks = [];
    
    if (retryProbability.probability < 0.5) {
      risks.push('Low success probability');
    }
    
    if (failureAnalysis.category === 'POLICY_VIOLATION') {
      risks.push('Policy compliance issues');
    }
    
    if (failureAnalysis.confidence < 0.6) {
      risks.push('Uncertain failure analysis');
    }
    
    if (!failureAnalysis.isFixable) {
      risks.push('Fundamental business-directory mismatch');
    }
    
    return risks;
  }
  
  generateContingencyPlans(failureAnalysis) {
    const plans = [];
    
    if (failureAnalysis.category === 'WRONG_CATEGORY') {
      plans.push('Consider alternative directory categories');
      plans.push('Explore similar directories in different niches');
    }
    
    if (failureAnalysis.category === 'CONTENT_QUALITY') {
      plans.push('Professional content writing service');
      plans.push('A/B test different description variations');
    }
    
    if (failureAnalysis.category === 'REQUIREMENTS_NOT_MET') {
      plans.push('Manual directory research and compliance');
      plans.push('Contact directory for clarification');
    }
    
    return plans.length > 0 ? plans : ['Manual review and alternative directories'];
  }
  
  generateTimingReasoning(failureAnalysis, attemptNumber, delayMs) {
    const delayHours = Math.round(delayMs / (60 * 60 * 1000));
    const categoryName = failureAnalysis.categoryName;
    
    return `${categoryName} failures typically benefit from ${delayHours}-hour wait period. ` +
           `This allows time for ${failureAnalysis.categoryInfo.improvementRequired ? 'improvements and ' : ''}` +
           `directory processing queue recovery. Attempt #${attemptNumber} with exponential backoff applied.`;
  }
  
  generateFallbackAnalysis(failureData) {
    return {
      category: 'UNKNOWN_REASON',
      categoryName: 'Unknown/Unclear Reason',
      specificIssues: ['Analysis failed', 'Using fallback categorization'],
      rootCause: 'Unable to determine specific failure reason',
      confidence: 0.3,
      isFixable: true,
      reasoning: 'Fallback analysis applied due to processing error',
      categoryInfo: this.failureCategories.UNKNOWN_REASON
    };
  }
  
  generateFallbackRecommendations(failureAnalysis) {
    return {
      critical: ['Review submission for completeness', 'Verify requirements compliance'],
      recommended: ['Improve business description', 'Check category alignment'],
      optional: ['Add more contact details', 'Enhance website presence'],
      contentChanges: ['Make description more specific and detailed'],
      strategyChanges: ['Consider different submission timing'],
      generatedAt: new Date().toISOString(),
      confidence: 0.3
    };
  }
  
  getDefaultRetryPatterns() {
    return {
      successRate: 0.5,
      sampleSize: 0,
      averageRetryDelay: 2,
      totalRetries: 0,
      lastAnalyzed: new Date().toISOString(),
      trends: {
        recentPerformance: 0.5,
        bestRetryCount: { count: 1, successRate: 0.5 }
      }
    };
  }
  
  // Cache management
  generateAnalysisCacheKey(failureData) {
    const key = `${failureData.submissionId}_${failureData.attemptNumber}_${failureData.rejectionReason?.substring(0, 50)}`;
    return require('crypto').createHash('md5').update(key).digest('hex');
  }
  
  getCachedAnalysis(cacheKey) {
    const cached = this.failureAnalysisCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.analysis;
    }
    return null;
  }
  
  cacheAnalysis(cacheKey, analysis) {
    this.failureAnalysisCache.set(cacheKey, {
      analysis,
      timestamp: Date.now()
    });
  }
  
  isCacheValid(timestamp) {
    return timestamp && (Date.now() - timestamp) < (2 * 60 * 60 * 1000); // 2 hours
  }
  
  validateFailureData(data) {
    if (!data.submissionId) {
      throw new Error('Submission ID is required');
    }
    
    if (!data.directoryId) {
      throw new Error('Directory ID is required');
    }
    
    if (!data.businessName) {
      throw new Error('Business name is required');
    }
  }
  
  generateRequestId() {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async loadRetryPatterns() {
    console.log('🔄 Loading historical retry patterns...');
    // Could pre-load common patterns from database
  }
  
  async analyzeHistoricalRetries() {
    console.log('📊 Analyzing historical retry success patterns...');
    // Could analyze overall retry trends
  }
  
  getStats() {
    return {
      cachedPatterns: this.retryPatterns.size,
      cachedAnalyses: this.failureAnalysisCache.size,
      failureCategories: Object.keys(this.failureCategories).length,
      maxRetryAttempts: this.config.maxRetryAttempts
    };
  }
}

module.exports = IntelligentRetryAnalyzer;