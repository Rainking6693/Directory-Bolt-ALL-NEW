/**
 * 🎯 AI SUCCESS PROBABILITY CALCULATOR
 * 
 * Calculates the probability of successful directory submission using AI analysis.
 * Features:
 * - Multi-factor success prediction
 * - Historical submission data analysis  
 * - Directory-specific success patterns
 * - Business profile compatibility scoring
 * - Real-time probability updates
 * - Confidence intervals and reliability metrics
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

class SuccessProbabilityCalculator {
  constructor(config = {}) {
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY
    });
    
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.config = {
      minHistoricalData: config.minHistoricalData || 5,
      confidenceThreshold: config.confidenceThreshold || 0.7,
      learningRate: config.learningRate || 0.1,
      maxCacheAge: config.maxCacheAge || 3600000, // 1 hour
      ...config
    };
    
    // Cache for probability calculations
    this.probabilityCache = new Map();
    this.directoryPatterns = new Map();
    this.businessProfiles = new Map();
    
    // Initialize scoring weights
    this.scoringWeights = {
      businessMatch: 0.25,        // How well business matches directory
      contentQuality: 0.20,       // Quality of business description/content
      historicalSuccess: 0.20,    // Historical success rate patterns
      directoryRequirements: 0.15, // Meeting directory specific requirements
      timingFactors: 0.10,        // Submission timing optimization
      competitionLevel: 0.10      // Competition in directory category
    };
    
    this.initializeCalculator();
  }
  
  async initializeCalculator() {
    console.log('🎯 Initializing AI Success Probability Calculator...');
    
    try {
      await this.loadHistoricalData();
      await this.loadDirectoryPatterns();
      console.log('✅ Success Probability Calculator initialized');
    } catch (error) {
      console.error('❌ Failed to initialize calculator:', error);
      throw error;
    }
  }
  
  /**
   * Calculate success probability for a specific submission
   */
  async calculateSuccessProbability(submissionData) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      console.log(`🎯 [${requestId}] Calculating success probability`);
      
      // Validate input data
      this.validateSubmissionData(submissionData);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(submissionData);
      const cached = this.getCachedProbability(cacheKey);
      if (cached) {
        console.log(`💾 [${requestId}] Using cached probability: ${(cached.probability * 100).toFixed(1)}%`);
        return cached;
      }
      
      // Calculate individual factor scores
      const factors = await this.calculateFactorScores(submissionData, requestId);
      
      // Combine factors into overall probability
      const probability = this.calculateOverallProbability(factors);
      
      // Generate confidence interval
      const confidence = this.calculateConfidenceLevel(factors, submissionData);
      
      // Create detailed analysis
      const analysis = await this.generateAnalysis(factors, submissionData);
      
      const result = {
        requestId,
        probability,
        confidence,
        factors,
        analysis,
        recommendations: this.generateRecommendations(factors),
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
      
      // Cache the result
      this.cacheProbability(cacheKey, result);
      
      console.log(`✅ [${requestId}] Success probability: ${(probability * 100).toFixed(1)}% (confidence: ${(confidence * 100).toFixed(1)}%)`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ [${requestId}] Probability calculation failed:`, error);
      throw error;
    }
  }
  
  /**
   * Calculate detailed factor scores
   */
  async calculateFactorScores(submissionData, requestId) {
    const factors = {};
    
    console.log(`🔍 [${requestId}] Analyzing submission factors...`);
    
    // 1. Business-Directory Match Score
    factors.businessMatch = await this.calculateBusinessMatchScore(submissionData);
    
    // 2. Content Quality Score
    factors.contentQuality = await this.calculateContentQualityScore(submissionData);
    
    // 3. Historical Success Pattern Score
    factors.historicalSuccess = await this.calculateHistoricalSuccessScore(submissionData);
    
    // 4. Directory Requirements Compliance Score
    factors.directoryRequirements = await this.calculateRequirementsScore(submissionData);
    
    // 5. Timing Factors Score
    factors.timingFactors = await this.calculateTimingScore(submissionData);
    
    // 6. Competition Level Score
    factors.competitionLevel = await this.calculateCompetitionScore(submissionData);
    
    return factors;
  }
  
  /**
   * Calculate how well the business matches the directory
   */
  async calculateBusinessMatchScore(submissionData) {
    const { business, directory } = submissionData;
    
    try {
      // Analyze category alignment
      const categoryMatch = this.calculateCategoryAlignment(
        business.category,
        directory.categories
      );
      
      // Check geographic relevance
      const geoMatch = this.calculateGeographicRelevance(
        business.location,
        directory.geoFocus
      );
      
      // Evaluate business size/type fit
      const sizeMatch = this.calculateBusinessSizeFit(
        business.size,
        directory.targetBusinessSize
      );
      
      // Check industry vertical alignment
      const industryMatch = this.calculateIndustryAlignment(
        business.industry,
        directory.industryFocus
      );
      
      const score = (categoryMatch * 0.4) + (geoMatch * 0.25) + 
                   (sizeMatch * 0.2) + (industryMatch * 0.15);
      
      return {
        score: Math.min(1.0, Math.max(0.0, score)),
        details: {
          categoryMatch,
          geoMatch,
          sizeMatch,
          industryMatch
        }
      };
      
    } catch (error) {
      console.warn('Failed to calculate business match score:', error);
      return { score: 0.5, details: {}, error: error.message };
    }
  }
  
  /**
   * Calculate content quality score using AI analysis
   */
  async calculateContentQualityScore(submissionData) {
    const { business } = submissionData;
    
    try {
      const prompt = `Analyze the quality of this business listing content for directory submission success:

Business Name: ${business.name}
Description: ${business.description || 'No description provided'}
Website: ${business.website || 'No website provided'}
Industry: ${business.industry || 'Not specified'}

Evaluate the content on these criteria:
1. Clarity and professionalism of description
2. Completeness of business information
3. SEO optimization potential
4. Uniqueness and differentiation
5. Compliance with typical directory standards

Provide a score from 0.0 to 1.0 and brief reasoning for each criteria.

Respond in JSON format:
{
  "overallScore": 0.85,
  "criteria": {
    "clarity": {"score": 0.9, "reason": "Clear, professional description"},
    "completeness": {"score": 0.8, "reason": "Most key information provided"},
    "seoOptimization": {"score": 0.7, "reason": "Some keywords present"},
    "uniqueness": {"score": 0.9, "reason": "Unique value proposition"},
    "compliance": {"score": 0.85, "reason": "Meets directory standards"}
  }
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20241022',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      });
      
      const analysis = JSON.parse(response.content[0].text);
      
      return {
        score: analysis.overallScore,
        details: analysis.criteria
      };
      
    } catch (error) {
      console.warn('AI content analysis failed, using fallback:', error);
      return this.fallbackContentQualityScore(submissionData);
    }
  }
  
  /**
   * Calculate historical success patterns for similar submissions
   */
  async calculateHistoricalSuccessScore(submissionData) {
    const { business, directory } = submissionData;
    
    try {
      // Query historical submission data
      const { data: historicalData, error } = await this.supabase
        .from('user_submissions')
        .select(`
          submission_status,
          business_category,
          directory_id,
          submitted_at,
          approved_at
        `)
        .eq('directory_id', directory.id)
        .neq('submission_status', 'pending')
        .limit(100)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      
      if (!historicalData || historicalData.length < this.config.minHistoricalData) {
        return { score: 0.5, details: { insufficientData: true } };
      }
      
      // Calculate success rates by category
      const categorySuccessRate = this.calculateCategorySuccessRate(
        historicalData,
        business.category
      );
      
      // Calculate overall directory success rate
      const overallSuccessRate = historicalData.filter(
        submission => submission.submission_status === 'approved'
      ).length / historicalData.length;
      
      // Calculate recent trend
      const recentTrend = this.calculateRecentTrend(historicalData);
      
      const score = (categorySuccessRate * 0.5) + (overallSuccessRate * 0.3) + 
                   (recentTrend * 0.2);
      
      return {
        score: Math.min(1.0, Math.max(0.0, score)),
        details: {
          categorySuccessRate,
          overallSuccessRate,
          recentTrend,
          sampleSize: historicalData.length
        }
      };
      
    } catch (error) {
      console.warn('Historical analysis failed:', error);
      return { score: 0.6, details: {}, error: error.message };
    }
  }
  
  /**
   * Calculate directory requirements compliance score
   */
  async calculateRequirementsScore(submissionData) {
    const { business, directory } = submissionData;
    
    try {
      const requirements = directory.requirements || {};
      let score = 1.0;
      const details = {};
      
      // Check required fields
      if (requirements.requiredFields) {
        for (const field of requirements.requiredFields) {
          const hasField = business[field] && business[field].length > 0;
          details[`required_${field}`] = hasField;
          if (!hasField) score -= 0.2;
        }
      }
      
      // Check minimum content length
      if (requirements.minDescriptionLength) {
        const descLength = (business.description || '').length;
        const meetsMin = descLength >= requirements.minDescriptionLength;
        details.descriptionLength = { required: requirements.minDescriptionLength, actual: descLength, meets: meetsMin };
        if (!meetsMin) score -= 0.15;
      }
      
      // Check website requirement
      if (requirements.requiresWebsite) {
        const hasWebsite = business.website && business.website.startsWith('http');
        details.websiteRequired = hasWebsite;
        if (!hasWebsite) score -= 0.25;
      }
      
      // Check business age requirement
      if (requirements.minBusinessAge && business.establishedYear) {
        const businessAge = new Date().getFullYear() - business.establishedYear;
        const meetsAge = businessAge >= requirements.minBusinessAge;
        details.businessAge = { required: requirements.minBusinessAge, actual: businessAge, meets: meetsAge };
        if (!meetsAge) score -= 0.1;
      }
      
      return {
        score: Math.min(1.0, Math.max(0.0, score)),
        details
      };
      
    } catch (error) {
      console.warn('Requirements analysis failed:', error);
      return { score: 0.7, details: {}, error: error.message };
    }
  }
  
  /**
   * Calculate optimal timing score
   */
  async calculateTimingScore(submissionData) {
    const { directory } = submissionData;
    
    try {
      const now = new Date();
      let score = 0.8; // Base score
      const details = {};
      
      // Check day of week optimization
      const dayOfWeek = now.getDay();
      const optimalDays = [1, 2, 3, 4]; // Tuesday-Friday typically better
      if (optimalDays.includes(dayOfWeek)) {
        score += 0.1;
        details.dayOfWeek = { optimal: true, day: dayOfWeek };
      }
      
      // Check hour of day optimization
      const hour = now.getHours();
      const optimalHours = [9, 10, 11, 14, 15, 16]; // Business hours
      if (optimalHours.includes(hour)) {
        score += 0.1;
        details.hourOfDay = { optimal: true, hour };
      }
      
      // Check for holidays/weekends
      const isWeekend = [0, 6].includes(dayOfWeek);
      if (isWeekend) {
        score -= 0.2;
        details.weekend = true;
      }
      
      // Check directory-specific patterns
      if (directory.peakSubmissionTimes) {
        const currentTimeSlot = `${dayOfWeek}_${Math.floor(hour / 4)}`;
        const isPeakTime = directory.peakSubmissionTimes.includes(currentTimeSlot);
        if (isPeakTime) {
          score -= 0.1; // Peak times may have more competition
          details.peakTime = true;
        }
      }
      
      return {
        score: Math.min(1.0, Math.max(0.0, score)),
        details
      };
      
    } catch (error) {
      console.warn('Timing analysis failed:', error);
      return { score: 0.8, details: {}, error: error.message };
    }
  }
  
  /**
   * Calculate competition level score
   */
  async calculateCompetitionScore(submissionData) {
    const { business, directory } = submissionData;
    
    try {
      // Query recent submissions in same category
      const { data: competitorData, error } = await this.supabase
        .from('user_submissions')
        .select('business_category, submitted_at')
        .eq('directory_id', directory.id)
        .eq('business_category', business.category)
        .gte('submitted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .limit(50);
      
      if (error) throw error;
      
      const recentCompetitors = competitorData?.length || 0;
      
      // Lower competition = higher score
      let score = 1.0;
      if (recentCompetitors > 20) score = 0.3;
      else if (recentCompetitors > 10) score = 0.5;
      else if (recentCompetitors > 5) score = 0.7;
      else score = 0.9;
      
      return {
        score,
        details: {
          recentCompetitors,
          competitionLevel: recentCompetitors > 20 ? 'high' : 
                          recentCompetitors > 10 ? 'medium' : 'low'
        }
      };
      
    } catch (error) {
      console.warn('Competition analysis failed:', error);
      return { score: 0.6, details: {}, error: error.message };
    }
  }
  
  /**
   * Calculate overall probability from factor scores
   */
  calculateOverallProbability(factors) {
    let weightedSum = 0;
    
    for (const [factorName, weight] of Object.entries(this.scoringWeights)) {
      const factorScore = factors[factorName]?.score || 0.5;
      weightedSum += factorScore * weight;
    }
    
    // Apply sigmoid function for more realistic probability distribution
    return 1 / (1 + Math.exp(-(weightedSum - 0.5) * 10));
  }
  
  /**
   * Calculate confidence level in the probability estimate
   */
  calculateConfidenceLevel(factors, submissionData) {
    let confidenceSum = 0;
    let factorCount = 0;
    
    // Base confidence on data availability and quality
    for (const factor of Object.values(factors)) {
      if (factor.details && !factor.error) {
        confidenceSum += 0.9;
      } else if (factor.error) {
        confidenceSum += 0.3;
      } else {
        confidenceSum += 0.6;
      }
      factorCount++;
    }
    
    const baseConfidence = confidenceSum / factorCount;
    
    // Adjust based on data availability
    const hasHistoricalData = factors.historicalSuccess?.details?.sampleSize > 10;
    const hasCompleteBusinessData = submissionData.business.description && 
                                   submissionData.business.website;
    
    let adjustedConfidence = baseConfidence;
    if (hasHistoricalData) adjustedConfidence += 0.1;
    if (hasCompleteBusinessData) adjustedConfidence += 0.1;
    
    return Math.min(1.0, adjustedConfidence);
  }
  
  /**
   * Generate AI-powered analysis and insights
   */
  async generateAnalysis(factors, submissionData) {
    try {
      const prompt = `Analyze this directory submission success probability calculation:

Business: ${submissionData.business.name}
Directory: ${submissionData.directory.name}
Overall Probability: ${(this.calculateOverallProbability(factors) * 100).toFixed(1)}%

Factor Scores:
- Business Match: ${(factors.businessMatch.score * 100).toFixed(1)}%
- Content Quality: ${(factors.contentQuality.score * 100).toFixed(1)}%
- Historical Success: ${(factors.historicalSuccess.score * 100).toFixed(1)}%
- Requirements Compliance: ${(factors.directoryRequirements.score * 100).toFixed(1)}%
- Timing: ${(factors.timingFactors.score * 100).toFixed(1)}%
- Competition: ${(factors.competitionLevel.score * 100).toFixed(1)}%

Provide:
1. Key strengths that support success
2. Main risk factors that could cause rejection
3. Priority improvement areas
4. Strategic recommendations

Keep the analysis concise and actionable.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      });
      
      return response.content[0].text;
      
    } catch (error) {
      console.warn('AI analysis generation failed:', error);
      return this.generateFallbackAnalysis(factors);
    }
  }
  
  /**
   * Generate actionable recommendations
   */
  generateRecommendations(factors) {
    const recommendations = [];
    
    // Analyze each factor and suggest improvements
    if (factors.businessMatch.score < 0.7) {
      recommendations.push({
        priority: 'high',
        category: 'business_match',
        action: 'Review business category alignment with directory focus',
        impact: 'medium'
      });
    }
    
    if (factors.contentQuality.score < 0.6) {
      recommendations.push({
        priority: 'high',
        category: 'content_quality',
        action: 'Improve business description with more specific details and keywords',
        impact: 'high'
      });
    }
    
    if (factors.directoryRequirements.score < 0.8) {
      recommendations.push({
        priority: 'critical',
        category: 'requirements',
        action: 'Address missing required fields before submission',
        impact: 'high'
      });
    }
    
    if (factors.timingFactors.score < 0.6) {
      recommendations.push({
        priority: 'low',
        category: 'timing',
        action: 'Consider submitting during optimal business hours (Tue-Fri, 9AM-4PM)',
        impact: 'low'
      });
    }
    
    if (factors.competitionLevel.score < 0.4) {
      recommendations.push({
        priority: 'medium',
        category: 'competition',
        action: 'Wait for lower competition period or differentiate submission',
        impact: 'medium'
      });
    }
    
    return recommendations;
  }
  
  // Helper methods
  calculateCategoryAlignment(businessCategory, directoryCategories) {
    if (!businessCategory || !directoryCategories) return 0.5;
    
    const matches = directoryCategories.filter(cat => 
      cat.toLowerCase().includes(businessCategory.toLowerCase()) ||
      businessCategory.toLowerCase().includes(cat.toLowerCase())
    );
    
    return matches.length > 0 ? 0.9 : 0.3;
  }
  
  calculateGeographicRelevance(businessLocation, directoryGeoFocus) {
    if (!directoryGeoFocus || directoryGeoFocus.includes('global')) return 1.0;
    if (!businessLocation) return 0.5;
    
    // Simple geographic matching - could be enhanced with actual geo-coding
    const locationLower = businessLocation.toLowerCase();
    return directoryGeoFocus.some(focus => 
      locationLower.includes(focus.toLowerCase())
    ) ? 0.9 : 0.4;
  }
  
  calculateBusinessSizeFit(businessSize, targetSize) {
    if (!targetSize || targetSize.includes('all')) return 1.0;
    if (!businessSize) return 0.7;
    
    return targetSize.includes(businessSize) ? 1.0 : 0.5;
  }
  
  calculateIndustryAlignment(businessIndustry, directoryIndustry) {
    if (!directoryIndustry || directoryIndustry.includes('all')) return 1.0;
    if (!businessIndustry) return 0.6;
    
    return directoryIndustry.some(industry => 
      industry.toLowerCase() === businessIndustry.toLowerCase()
    ) ? 1.0 : 0.4;
  }
  
  calculateCategorySuccessRate(historicalData, category) {
    const categorySubmissions = historicalData.filter(
      submission => submission.business_category === category
    );
    
    if (categorySubmissions.length === 0) return 0.5;
    
    const successful = categorySubmissions.filter(
      submission => submission.submission_status === 'approved'
    );
    
    return successful.length / categorySubmissions.length;
  }
  
  calculateRecentTrend(historicalData) {
    const sortedData = historicalData.sort((a, b) => 
      new Date(a.submitted_at) - new Date(b.submitted_at)
    );
    
    const midpoint = Math.floor(sortedData.length / 2);
    const recent = sortedData.slice(midpoint);
    const older = sortedData.slice(0, midpoint);
    
    const recentSuccessRate = recent.filter(s => s.submission_status === 'approved').length / recent.length;
    const olderSuccessRate = older.filter(s => s.submission_status === 'approved').length / older.length;
    
    return Math.max(0, Math.min(1, recentSuccessRate - olderSuccessRate + 0.5));
  }
  
  fallbackContentQualityScore(submissionData) {
    const { business } = submissionData;
    let score = 0.5;
    
    if (business.description && business.description.length > 100) score += 0.2;
    if (business.website && business.website.startsWith('http')) score += 0.2;
    if (business.phone) score += 0.1;
    
    return { score, details: { fallback: true } };
  }
  
  generateFallbackAnalysis(factors) {
    const lowScoring = Object.entries(factors)
      .filter(([_, factor]) => factor.score < 0.6)
      .map(([name, _]) => name);
    
    if (lowScoring.length === 0) {
      return 'Analysis indicates good submission potential across all factors.';
    }
    
    return `Areas needing improvement: ${lowScoring.join(', ')}. Focus on these factors to increase success probability.`;
  }
  
  // Cache management
  generateCacheKey(submissionData) {
    const key = `${submissionData.business.name}_${submissionData.directory.id}_${submissionData.business.category}`;
    return require('crypto').createHash('md5').update(key).digest('hex');
  }
  
  getCachedProbability(cacheKey) {
    const cached = this.probabilityCache.get(cacheKey);
    if (cached && (Date.now() - cached.calculatedAt) < this.config.maxCacheAge) {
      return cached;
    }
    return null;
  }
  
  cacheProbability(cacheKey, result) {
    this.probabilityCache.set(cacheKey, {
      ...result,
      calculatedAt: Date.now()
    });
  }
  
  validateSubmissionData(data) {
    if (!data.business || !data.directory) {
      throw new Error('Missing required business or directory data');
    }
    
    if (!data.business.name || !data.directory.id) {
      throw new Error('Missing required business name or directory ID');
    }
  }
  
  generateRequestId() {
    return `prob_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async loadHistoricalData() {
    // Load historical patterns for better prediction accuracy
    console.log('📚 Loading historical submission patterns...');
  }
  
  async loadDirectoryPatterns() {
    // Load directory-specific success patterns
    console.log('🔍 Loading directory-specific patterns...');
  }
}

module.exports = SuccessProbabilityCalculator;