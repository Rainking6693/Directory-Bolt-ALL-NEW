/**
 * 🧪 A/B TESTING FRAMEWORK FOR SUBMISSION APPROACHES
 * 
 * Systematically tests different submission strategies to optimize success rates.
 * Features:
 * - Multi-variant submission testing
 * - Statistical significance analysis
 * - Adaptive experiment design
 * - Performance tracking and reporting
 * - Automated winner selection
 * - Continuous optimization cycles
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

class ABTestingFramework {
  constructor(config = {}) {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.config = {
      minSampleSize: config.minSampleSize || 20,
      maxVariants: config.maxVariants || 4,
      confidenceLevel: config.confidenceLevel || 0.95,
      minEffectSize: config.minEffectSize || 0.05, // 5% improvement
      testDurationDays: config.testDurationDays || 14,
      autoPromoteWinner: config.autoPromoteWinner || true,
      splitTrafficEvenly: config.splitTrafficEvenly || true,
      ...config
    };
    
    // Active experiments tracking
    this.activeExperiments = new Map();
    this.experimentResults = new Map();
    this.trafficAllocation = new Map();
    
    // Submission strategy variants
    this.strategyVariants = {
      DESCRIPTION_STYLES: {
        name: 'Description Writing Styles',
        variants: ['professional', 'friendly', 'technical', 'benefit-focused']
      },
      SUBMISSION_TIMING: {
        name: 'Submission Timing',
        variants: ['morning', 'afternoon', 'evening', 'optimal-ai']
      },
      CONTENT_LENGTH: {
        name: 'Description Length',
        variants: ['short', 'medium', 'long', 'adaptive']
      },
      KEYWORD_DENSITY: {
        name: 'Keyword Optimization',
        variants: ['light', 'moderate', 'heavy', 'semantic']
      },
      CATEGORY_SELECTION: {
        name: 'Category Strategy',
        variants: ['primary-only', 'multi-category', 'ai-suggested', 'broad-match']
      },
      CONTACT_INFO: {
        name: 'Contact Information Strategy',
        variants: ['minimal', 'complete', 'progressive', 'social-focused']
      }
    };
    
    this.initializeFramework();
  }
  
  async initializeFramework() {
    console.log('🧪 Initializing A/B Testing Framework...');
    
    try {
      await this.loadActiveExperiments();
      await this.initializeTrafficAllocation();
      this.startExperimentMonitoring();
      
      console.log('✅ A/B Testing Framework initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize A/B testing framework:', error);
      throw error;
    }
  }
  
  /**
   * Create a new A/B test experiment
   */
  async createExperiment(experimentConfig) {
    const requestId = this.generateRequestId();
    
    try {
      console.log(`🧪 [${requestId}] Creating new A/B test: ${experimentConfig.name}`);
      
      // Validate experiment configuration
      this.validateExperimentConfig(experimentConfig);
      
      // Generate experiment ID
      const experimentId = this.generateExperimentId(experimentConfig);
      
      // Check for conflicts with existing experiments
      await this.checkExperimentConflicts(experimentConfig, experimentId);
      
      // Create experiment record
      const experiment = await this.setupExperiment(experimentId, experimentConfig);
      
      // Initialize traffic allocation
      await this.setupTrafficAllocation(experimentId, experiment);
      
      // Store in database
      await this.saveExperimentToDatabase(experiment);
      
      // Add to active experiments
      this.activeExperiments.set(experimentId, experiment);
      
      console.log(`✅ [${requestId}] Created experiment: ${experimentId}`);
      
      return {
        experimentId,
        experiment,
        requestId
      };
      
    } catch (error) {
      console.error(`❌ [${requestId}] Failed to create experiment:`, error);
      throw error;
    }
  }
  
  /**
   * Assign a submission to an experiment variant
   */
  async assignSubmissionToVariant(submissionData, experimentTypes = []) {
    const requestId = this.generateRequestId();
    
    try {
      console.log(`🎯 [${requestId}] Assigning submission to experiment variants`);
      
      const assignments = {};
      
      // Get applicable experiments
      const applicableExperiments = await this.getApplicableExperiments(
        submissionData,
        experimentTypes
      );
      
      if (applicableExperiments.length === 0) {
        console.log(`📋 [${requestId}] No applicable experiments, using control`);
        return { assignments: {}, experimentCount: 0 };
      }
      
      // Assign to each applicable experiment
      for (const experiment of applicableExperiments) {
        const variant = await this.assignToVariant(
          experiment,
          submissionData,
          requestId
        );
        
        assignments[experiment.id] = {
          experimentName: experiment.name,
          variant: variant,
          assignedAt: new Date().toISOString()
        };
      }
      
      // Log assignments for tracking
      await this.logAssignments(submissionData.submissionId, assignments);
      
      console.log(`✅ [${requestId}] Assigned to ${Object.keys(assignments).length} experiments`);
      
      return {
        assignments,
        experimentCount: Object.keys(assignments).length,
        requestId
      };
      
    } catch (error) {
      console.error(`❌ [${requestId}] Assignment failed:`, error);
      return { assignments: {}, experimentCount: 0, error: error.message };
    }
  }
  
  /**
   * Record experiment results from submission outcome
   */
  async recordExperimentResult(submissionId, outcome, metadata = {}) {
    const requestId = this.generateRequestId();
    
    try {
      console.log(`📊 [${requestId}] Recording experiment results for: ${submissionId}`);
      
      // Get submission assignments
      const assignments = await this.getSubmissionAssignments(submissionId);
      
      if (!assignments || Object.keys(assignments).length === 0) {
        console.log(`📋 [${requestId}] No experiment assignments found`);
        return;
      }
      
      // Record results for each experiment
      for (const [experimentId, assignment] of Object.entries(assignments)) {
        await this.recordVariantResult(
          experimentId,
          assignment.variant,
          outcome,
          metadata,
          requestId
        );
      }
      
      // Check for experiment completion
      await this.checkExperimentCompletions();
      
      console.log(`✅ [${requestId}] Recorded results for ${Object.keys(assignments).length} experiments`);
      
    } catch (error) {
      console.error(`❌ [${requestId}] Failed to record results:`, error);
    }
  }
  
  /**
   * Analyze experiment results and determine winners
   */
  async analyzeExperimentResults(experimentId) {
    const requestId = this.generateRequestId();
    
    try {
      console.log(`📈 [${requestId}] Analyzing experiment results: ${experimentId}`);
      
      const experiment = this.activeExperiments.get(experimentId);
      if (!experiment) {
        throw new Error(`Experiment ${experimentId} not found`);
      }
      
      // Get current results
      const results = await this.getExperimentResults(experimentId);
      
      // Check if we have enough data
      const readyForAnalysis = this.isReadyForAnalysis(results, experiment);
      if (!readyForAnalysis.ready) {
        return {
          ready: false,
          reason: readyForAnalysis.reason,
          currentSamples: readyForAnalysis.samples,
          requiredSamples: this.config.minSampleSize
        };
      }
      
      // Perform statistical analysis
      const statisticalResults = await this.performStatisticalAnalysis(
        results,
        experiment
      );
      
      // Determine winner
      const winner = this.determineWinner(statisticalResults, experiment);
      
      // Generate insights and recommendations
      const insights = await this.generateExperimentInsights(
        statisticalResults,
        winner,
        experiment
      );
      
      const analysis = {
        experimentId,
        results: statisticalResults,
        winner,
        insights,
        confidence: statisticalResults.confidence,
        significance: statisticalResults.significance,
        analyzedAt: new Date().toISOString(),
        requestId
      };
      
      // Store analysis results
      await this.saveAnalysisResults(experimentId, analysis);
      
      // Auto-promote winner if configured
      if (winner.hasWinner && this.config.autoPromoteWinner) {
        await this.promoteWinner(experimentId, winner);
      }
      
      console.log(`✅ [${requestId}] Analysis complete. Winner: ${winner.hasWinner ? winner.variant : 'No clear winner'}`);
      
      return analysis;
      
    } catch (error) {
      console.error(`❌ [${requestId}] Analysis failed:`, error);
      throw error;
    }
  }
  
  /**
   * Generate comprehensive experiment report
   */
  async generateExperimentReport(experimentId, includeRawData = false) {
    const requestId = this.generateRequestId();
    
    try {
      console.log(`📋 [${requestId}] Generating experiment report: ${experimentId}`);
      
      const experiment = this.activeExperiments.get(experimentId) || 
                        await this.loadExperimentFromDatabase(experimentId);
      
      if (!experiment) {
        throw new Error(`Experiment ${experimentId} not found`);
      }
      
      // Get comprehensive results
      const results = await this.getExperimentResults(experimentId);
      const analysis = await this.analyzeExperimentResults(experimentId);
      const timeline = await this.getExperimentTimeline(experimentId);
      
      // Calculate performance metrics
      const metrics = this.calculatePerformanceMetrics(results);
      
      // Generate visualizations data
      const charts = this.generateChartData(results, timeline);
      
      const report = {
        experiment: {
          id: experimentId,
          name: experiment.name,
          description: experiment.description,
          status: experiment.status,
          startDate: experiment.startDate,
          endDate: experiment.endDate,
          duration: this.calculateDuration(experiment.startDate, experiment.endDate)
        },
        results: {
          totalParticipants: metrics.totalParticipants,
          conversionRates: metrics.conversionRates,
          statisticalSignificance: analysis?.significance || null,
          confidence: analysis?.confidence || null,
          winner: analysis?.winner || null
        },
        variants: results.variantResults,
        timeline: timeline,
        insights: analysis?.insights || [],
        recommendations: this.generateRecommendations(results, analysis),
        charts: charts,
        rawData: includeRawData ? results.rawData : null,
        generatedAt: new Date().toISOString(),
        requestId
      };
      
      console.log(`✅ [${requestId}] Report generated successfully`);
      
      return report;
      
    } catch (error) {
      console.error(`❌ [${requestId}] Report generation failed:`, error);
      throw error;
    }
  }
  
  /**
   * Setup experiment configuration
   */
  async setupExperiment(experimentId, config) {
    return {
      id: experimentId,
      name: config.name,
      description: config.description,
      type: config.type,
      variants: this.validateVariants(config.variants),
      targetCriteria: config.targetCriteria || {},
      successMetrics: config.successMetrics || ['approval_rate'],
      trafficAllocation: config.trafficAllocation || this.generateEvenSplit(config.variants.length),
      startDate: new Date().toISOString(),
      endDate: config.endDate || this.calculateEndDate(config.durationDays || this.config.testDurationDays),
      status: 'active',
      createdAt: new Date().toISOString(),
      settings: {
        minSampleSize: config.minSampleSize || this.config.minSampleSize,
        confidenceLevel: config.confidenceLevel || this.config.confidenceLevel,
        autoStop: config.autoStop !== false
      }
    };
  }
  
  /**
   * Assign submission to specific variant
   */
  async assignToVariant(experiment, submissionData, requestId) {
    // Use consistent hashing for deterministic assignment
    const hashInput = `${submissionData.businessId || submissionData.submissionId}_${experiment.id}`;
    const hash = crypto.createHash('md5').update(hashInput).digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16);
    
    // Determine assignment based on traffic allocation
    let cumulativeWeight = 0;
    const randomValue = (hashValue % 10000) / 10000; // 0-1
    
    for (const variant of experiment.variants) {
      const allocation = experiment.trafficAllocation[variant.name] || 0;
      cumulativeWeight += allocation;
      
      if (randomValue <= cumulativeWeight) {
        console.log(`🎯 [${requestId}] Assigned to variant: ${variant.name} (${experiment.name})`);
        return variant.name;
      }
    }
    
    // Fallback to first variant
    return experiment.variants[0].name;
  }
  
  /**
   * Record result for specific variant
   */
  async recordVariantResult(experimentId, variantName, outcome, metadata, requestId) {
    try {
      const resultRecord = {
        experiment_id: experimentId,
        variant: variantName,
        outcome: outcome.status, // 'approved', 'rejected', 'pending'
        success: outcome.status === 'approved',
        submission_id: outcome.submissionId,
        directory_id: outcome.directoryId,
        business_category: metadata.businessCategory,
        submission_date: outcome.submissionDate || new Date().toISOString(),
        processing_time: outcome.processingTime || null,
        metadata: JSON.stringify(metadata)
      };
      
      const { error } = await this.supabase
        .from('ab_test_results')
        .insert([resultRecord]);
      
      if (error) throw error;
      
      console.log(`📊 [${requestId}] Recorded result: ${variantName} -> ${outcome.status}`);
      
    } catch (error) {
      console.error(`Failed to record variant result:`, error);
    }
  }
  
  /**
   * Perform statistical analysis on experiment results
   */
  async performStatisticalAnalysis(results, experiment) {
    const variants = Object.keys(results.variantResults);
    
    if (variants.length < 2) {
      return {
        significance: false,
        confidence: 0,
        pValue: 1,
        reason: 'Insufficient variants for comparison'
      };
    }
    
    // Calculate conversion rates
    const conversionRates = {};
    const sampleSizes = {};
    
    variants.forEach(variant => {
      const data = results.variantResults[variant];
      sampleSizes[variant] = data.total;
      conversionRates[variant] = data.total > 0 ? data.successful / data.total : 0;
    });
    
    // Find control and best performing variant
    const control = variants[0]; // Assume first variant is control
    const bestVariant = variants.reduce((best, current) => 
      conversionRates[current] > conversionRates[best] ? current : best
    );
    
    if (control === bestVariant) {
      return {
        significance: false,
        confidence: 0.5,
        pValue: 1,
        controlRate: conversionRates[control],
        bestRate: conversionRates[bestVariant],
        improvement: 0,
        reason: 'Control is best performing'
      };
    }
    
    // Calculate statistical significance (simplified chi-square test)
    const significance = this.calculateChiSquareTest(
      conversionRates[control],
      sampleSizes[control],
      conversionRates[bestVariant],
      sampleSizes[bestVariant]
    );
    
    const improvement = (conversionRates[bestVariant] - conversionRates[control]) / conversionRates[control];
    
    return {
      significance: significance.significant,
      confidence: significance.confidence,
      pValue: significance.pValue,
      controlRate: conversionRates[control],
      bestRate: conversionRates[bestVariant],
      improvement: improvement,
      effectSize: Math.abs(improvement),
      variants: conversionRates,
      sampleSizes: sampleSizes
    };
  }
  
  /**
   * Simplified chi-square test for A/B testing
   */
  calculateChiSquareTest(rate1, n1, rate2, n2) {
    const successes1 = Math.round(rate1 * n1);
    const failures1 = n1 - successes1;
    const successes2 = Math.round(rate2 * n2);
    const failures2 = n2 - successes2;
    
    const totalSuccesses = successes1 + successes2;
    const totalFailures = failures1 + failures2;
    const totalSample = n1 + n2;
    
    if (totalSample === 0 || totalSuccesses === 0 || totalFailures === 0) {
      return { significant: false, confidence: 0, pValue: 1 };
    }
    
    const expected1Success = (totalSuccesses * n1) / totalSample;
    const expected1Failure = (totalFailures * n1) / totalSample;
    const expected2Success = (totalSuccesses * n2) / totalSample;
    const expected2Failure = (totalFailures * n2) / totalSample;
    
    if (expected1Success === 0 || expected1Failure === 0 || expected2Success === 0 || expected2Failure === 0) {
      return { significant: false, confidence: 0, pValue: 1 };
    }
    
    const chiSquare = 
      Math.pow(successes1 - expected1Success, 2) / expected1Success +
      Math.pow(failures1 - expected1Failure, 2) / expected1Failure +
      Math.pow(successes2 - expected2Success, 2) / expected2Success +
      Math.pow(failures2 - expected2Failure, 2) / expected2Failure;
    
    // Simplified p-value approximation (degrees of freedom = 1)
    const pValue = Math.exp(-chiSquare / 2);
    const significant = pValue < (1 - this.config.confidenceLevel);
    const confidence = 1 - pValue;
    
    return { significant, confidence, pValue, chiSquare };
  }
  
  /**
   * Determine experiment winner
   */
  determineWinner(statisticalResults, experiment) {
    if (!statisticalResults.significance) {
      return {
        hasWinner: false,
        reason: 'No statistically significant difference found',
        recommendation: 'Continue test or increase sample size'
      };
    }
    
    if (statisticalResults.effectSize < this.config.minEffectSize) {
      return {
        hasWinner: false,
        reason: 'Effect size too small to be practically significant',
        effectSize: statisticalResults.effectSize,
        minRequired: this.config.minEffectSize,
        recommendation: 'Consider practical significance requirements'
      };
    }
    
    const bestVariant = Object.keys(statisticalResults.variants).reduce((best, current) => 
      statisticalResults.variants[current] > statisticalResults.variants[best] ? current : best
    );
    
    return {
      hasWinner: true,
      variant: bestVariant,
      improvement: statisticalResults.improvement,
      confidence: statisticalResults.confidence,
      conversionRate: statisticalResults.variants[bestVariant],
      recommendation: `Implement ${bestVariant} as the new default`
    };
  }
  
  // Helper methods
  async getApplicableExperiments(submissionData, experimentTypes) {
    const applicable = [];
    
    for (const [expId, experiment] of this.activeExperiments.entries()) {
      if (experimentTypes.length > 0 && !experimentTypes.includes(experiment.type)) {
        continue;
      }
      
      if (await this.matchesTargetCriteria(submissionData, experiment.targetCriteria)) {
        applicable.push(experiment);
      }
    }
    
    return applicable;
  }
  
  async matchesTargetCriteria(submissionData, criteria) {
    if (!criteria || Object.keys(criteria).length === 0) {
      return true; // No criteria means all submissions match
    }
    
    // Check directory criteria
    if (criteria.directories && !criteria.directories.includes(submissionData.directoryId)) {
      return false;
    }
    
    // Check business category criteria
    if (criteria.categories && !criteria.categories.includes(submissionData.businessCategory)) {
      return false;
    }
    
    // Check business size criteria
    if (criteria.businessSize && submissionData.businessSize !== criteria.businessSize) {
      return false;
    }
    
    return true;
  }
  
  async getExperimentResults(experimentId) {
    const { data: results, error } = await this.supabase
      .from('ab_test_results')
      .select('*')
      .eq('experiment_id', experimentId);
    
    if (error) throw error;
    
    const variantResults = {};
    let totalParticipants = 0;
    
    (results || []).forEach(result => {
      if (!variantResults[result.variant]) {
        variantResults[result.variant] = {
          total: 0,
          successful: 0,
          failed: 0,
          pending: 0
        };
      }
      
      variantResults[result.variant].total++;
      totalParticipants++;
      
      if (result.success) {
        variantResults[result.variant].successful++;
      } else if (result.outcome === 'rejected') {
        variantResults[result.variant].failed++;
      } else {
        variantResults[result.variant].pending++;
      }
    });
    
    return {
      variantResults,
      totalParticipants,
      rawData: results || []
    };
  }
  
  isReadyForAnalysis(results, experiment) {
    const variants = Object.keys(results.variantResults);
    
    if (variants.length < 2) {
      return {
        ready: false,
        reason: 'Need at least 2 variants with data',
        samples: variants.length
      };
    }
    
    // Check minimum sample size per variant
    for (const variant of variants) {
      const total = results.variantResults[variant].total;
      if (total < this.config.minSampleSize) {
        return {
          ready: false,
          reason: `Variant ${variant} has insufficient sample size (${total}/${this.config.minSampleSize})`,
          samples: total
        };
      }
    }
    
    return { ready: true, samples: results.totalParticipants };
  }
  
  generateEvenSplit(variantCount) {
    const allocation = {};
    const splitPercent = 1 / variantCount;
    
    for (let i = 0; i < variantCount; i++) {
      allocation[`variant_${i}`] = splitPercent;
    }
    
    return allocation;
  }
  
  validateVariants(variants) {
    if (!Array.isArray(variants) || variants.length < 2) {
      throw new Error('At least 2 variants required');
    }
    
    if (variants.length > this.config.maxVariants) {
      throw new Error(`Maximum ${this.config.maxVariants} variants allowed`);
    }
    
    return variants.map((variant, index) => ({
      name: variant.name || `variant_${index}`,
      description: variant.description || `Variant ${index + 1}`,
      configuration: variant.configuration || {}
    }));
  }
  
  calculateEndDate(durationDays) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);
    return endDate.toISOString();
  }
  
  validateExperimentConfig(config) {
    if (!config.name) {
      throw new Error('Experiment name is required');
    }
    
    if (!config.type) {
      throw new Error('Experiment type is required');
    }
    
    if (!config.variants || config.variants.length < 2) {
      throw new Error('At least 2 variants required');
    }
  }
  
  generateExperimentId(config) {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5')
      .update(`${config.name}_${config.type}_${timestamp}`)
      .digest('hex')
      .substring(0, 8);
    
    return `exp_${hash}_${timestamp}`;
  }
  
  generateRequestId() {
    return `ab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Placeholder methods for database operations
  async loadActiveExperiments() {
    console.log('📊 Loading active experiments from database...');
    // Implementation would load from database
  }
  
  async initializeTrafficAllocation() {
    console.log('🚦 Initializing traffic allocation...');
    // Implementation would set up traffic splitting logic
  }
  
  startExperimentMonitoring() {
    console.log('👀 Starting experiment monitoring...');
    // Implementation would start monitoring for auto-completion
  }
  
  async checkExperimentConflicts(config, experimentId) {
    // Implementation would check for conflicting experiments
  }
  
  async setupTrafficAllocation(experimentId, experiment) {
    // Implementation would configure traffic routing
  }
  
  async saveExperimentToDatabase(experiment) {
    // Implementation would save experiment configuration
  }
  
  async logAssignments(submissionId, assignments) {
    // Implementation would log assignment for tracking
  }
  
  async getSubmissionAssignments(submissionId) {
    // Implementation would retrieve assignments from database
    return {}; // Placeholder
  }
  
  async checkExperimentCompletions() {
    // Implementation would check if experiments are ready to conclude
  }
  
  async saveAnalysisResults(experimentId, analysis) {
    // Implementation would save analysis results
  }
  
  async promoteWinner(experimentId, winner) {
    console.log(`🏆 Auto-promoting winner: ${winner.variant} for experiment: ${experimentId}`);
    // Implementation would promote winning variant to production
  }
  
  async loadExperimentFromDatabase(experimentId) {
    // Implementation would load experiment from database
    return null;
  }
  
  async getExperimentTimeline(experimentId) {
    // Implementation would get experiment timeline data
    return [];
  }
  
  calculatePerformanceMetrics(results) {
    const metrics = {
      totalParticipants: results.totalParticipants,
      conversionRates: {}
    };
    
    Object.entries(results.variantResults).forEach(([variant, data]) => {
      metrics.conversionRates[variant] = data.total > 0 ? data.successful / data.total : 0;
    });
    
    return metrics;
  }
  
  generateChartData(results, timeline) {
    // Implementation would generate visualization data
    return {
      conversionRates: results.variantResults,
      timeline: timeline
    };
  }
  
  calculateDuration(startDate, endDate) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
  }
  
  generateRecommendations(results, analysis) {
    const recommendations = [];
    
    if (analysis?.winner?.hasWinner) {
      recommendations.push(`Implement ${analysis.winner.variant} as the new standard approach`);
      recommendations.push(`Expected improvement: ${(analysis.winner.improvement * 100).toFixed(1)}%`);
    } else {
      recommendations.push('Continue testing or increase sample size for conclusive results');
      recommendations.push('Consider testing with different variants or metrics');
    }
    
    return recommendations;
  }
  
  async generateExperimentInsights(statisticalResults, winner, experiment) {
    // Implementation would generate AI-powered insights
    const insights = [];
    
    if (winner.hasWinner) {
      insights.push(`${winner.variant} shows ${(winner.improvement * 100).toFixed(1)}% improvement`);
    }
    
    insights.push(`Confidence level: ${(statisticalResults.confidence * 100).toFixed(1)}%`);
    
    return insights;
  }
  
  getStats() {
    return {
      activeExperiments: this.activeExperiments.size,
      availableStrategyTypes: Object.keys(this.strategyVariants).length,
      minSampleSize: this.config.minSampleSize,
      maxVariants: this.config.maxVariants
    };
  }
}

module.exports = ABTestingFramework;