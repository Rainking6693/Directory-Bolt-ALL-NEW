/**
 * 🔍 DIRECTORY DISCOVERY API - Intelligent Directory Research
 * 
 * POST /api/directories/discover
 * 
 * Discovers new high-authority business directories using multiple strategies:
 * - Competitor backlink analysis
 * - Industry-specific research
 * - AI-powered recommendations
 * - Community research
 * - Search engine discovery
 * 
 * Request Body:
 * {
 *   "industry": "tech_startups", // Optional: target industry
 *   "location": "united_states", // Optional: geographic focus
 *   "businessType": "saas", // Optional: business model
 *   "minDomainAuthority": 30, // Optional: minimum DA threshold
 *   "maxResults": 50, // Optional: limit results
 *   "strategies": ["ai", "competitor", "industry"], // Optional: specific strategies
 *   "options": {
 *     "includeAnalysis": true,
 *     "validateDirectories": true,
 *     "checkSubmissionForms": true
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "directories": [
 *     {
 *       "name": "TechCrunch Startups",
 *       "url": "https://techcrunch.com/startups",
 *       "domainAuthority": 92,
 *       "category": "tech_startups",
 *       "discoveryMethod": "ai_recommendation",
 *       "qualityScore": 95,
 *       "hasSubmissionForm": true,
 *       "submissionComplexity": "medium",
 *       "estimatedApprovalTime": 7
 *     }
 *   ],
 *   "stats": {
 *     "discovered": 127,
 *     "filtered": 23,
 *     "analyzed": 104,
 *     "finalCount": 45
 *   }
 * }
 */

import { DirectoryDiscoveryEngine } from '../../../lib/discovery/DirectoryDiscoveryEngine';
import { handleApiError, Errors } from '../../../lib/utils/errors';

// Initialize the discovery engine
let discoveryEngine = null;

function getDiscoveryEngine() {
  if (!discoveryEngine) {
    discoveryEngine = new DirectoryDiscoveryEngine({
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      qualityThreshold: 25, // Lower threshold for more discoveries
      maxConcurrentResearch: 3
    });
  }
  return discoveryEngine;
}

export default async function handler(req, res) {
  const requestId = `discovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    return await handleGetDiscoveryStatus(req, res, requestId);
  }
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).json(handleApiError(
      new Error('Method not allowed'),
      requestId
    ));
  }

  try {
    const {
      industry,
      location,
      businessType,
      minDomainAuthority = 25,
      maxResults = 50,
      strategies = ['ai', 'competitor', 'industry', 'search', 'community'],
      options = {}
    } = req.body;
    
    console.log(`🔍 [${requestId}] Starting directory discovery with criteria:`, {
      industry, location, businessType, minDomainAuthority, maxResults
    });
    
    // Validate industry if provided
    const validIndustries = [
      'tech_startups', 'saas', 'ecommerce', 'healthcare', 'legal', 
      'real_estate', 'local_business', 'professional_services', 
      'business_general', 'automotive', 'food_beverage', 'travel_hospitality'
    ];
    
    if (industry && !validIndustries.includes(industry)) {
      throw Errors.invalid('industry', `Must be one of: ${validIndustries.join(', ')}`);
    }
    
    // Validate strategies
    const validStrategies = ['ai', 'competitor', 'industry', 'search', 'community'];
    const invalidStrategies = strategies.filter(s => !validStrategies.includes(s));
    
    if (invalidStrategies.length > 0) {
      throw Errors.invalid('strategies', `Invalid strategies: ${invalidStrategies.join(', ')}`);
    }
    
    // Prepare search criteria
    const searchCriteria = {
      industry,
      location,
      businessType,
      minDomainAuthority,
      maxResults,
      strategies,
      targetAudience: options.targetAudience || 'B2B and B2C'
    };
    
    // Get discovery engine
    const engine = getDiscoveryEngine();
    
    // Update quality threshold if specified
    if (minDomainAuthority) {
      engine.qualityThreshold = minDomainAuthority;
    }
    
    // Start discovery process
    const discoveryResult = await engine.discoverDirectories(searchCriteria);
    
    if (!discoveryResult.success) {
      throw new Error(discoveryResult.error);
    }
    
    let directories = discoveryResult.directories;
    
    // Apply additional filtering
    if (maxResults && directories.length > maxResults) {
      // Sort by quality score and domain authority, then take top results
      directories = directories
        .sort((a, b) => {
          const scoreA = (a.qualityScore || 0) + a.domainAuthority;
          const scoreB = (b.qualityScore || 0) + b.domainAuthority;
          return scoreB - scoreA;
        })
        .slice(0, maxResults);
    }
    
    // Add additional analysis if requested
    if (options.includeAnalysis) {
      directories = await enhanceDirectoryAnalysis(directories, requestId);
    }
    
    console.log(`✅ [${requestId}] Discovery completed: ${directories.length} directories found`);
    
    // Return successful result
    return res.status(200).json({
      success: true,
      directories,
      stats: {
        ...discoveryResult.stats,
        finalCount: directories.length,
        criteriaUsed: searchCriteria
      },
      requestId: discoveryResult.requestId,
      meta: {
        discoveredAt: new Date().toISOString(),
        version: '1.0.0',
        engineStats: engine.getStats()
      }
    });
    
  } catch (error) {
    console.error(`❌ [${requestId}] Directory discovery error:`, error);
    
    const errorResponse = handleApiError(error, requestId);
    return res.status(errorResponse.error.statusCode).json(errorResponse);
  }
}

async function handleGetDiscoveryStatus(req, res, requestId) {
  try {
    const engine = getDiscoveryEngine();
    const stats = engine.getStats();
    const discoveredDirectories = engine.getDiscoveredDirectories();
    
    return res.status(200).json({
      success: true,
      stats: {
        ...stats,
        recentDiscoveries: discoveredDirectories.slice(0, 10) // Last 10 discoveries
      },
      requestId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const errorResponse = handleApiError(error, requestId);
    return res.status(errorResponse.error.statusCode).json(errorResponse);
  }
}

async function enhanceDirectoryAnalysis(directories, requestId) {
  console.log(`📊 [${requestId}] Enhancing analysis for ${directories.length} directories`);
  
  // Add enhanced analysis fields
  return directories.map(directory => ({
    ...directory,
    // SEO Value Calculation
    seoValue: calculateSEOValue(directory),
    
    // Submission Priority
    submissionPriority: calculateSubmissionPriority(directory),
    
    // Expected Traffic Benefit
    trafficPotential: estimateTrafficPotential(directory),
    
    // Cost-Benefit Analysis
    costBenefitScore: calculateCostBenefit(directory),
    
    // Success Probability
    successProbability: estimateSuccessProbability(directory)
  }));
}

function calculateSEOValue(directory) {
  let score = 0;
  
  // Domain Authority weight (40%)
  score += (directory.domainAuthority / 100) * 40;
  
  // Quality Score weight (30%)
  score += ((directory.qualityScore || 50) / 100) * 30;
  
  // Industry Relevance weight (20%)
  const isRelevant = directory.category !== 'business_general';
  score += isRelevant ? 20 : 10;
  
  // Discovery Method weight (10%)
  const methodScores = {
    'ai_recommendation': 10,
    'competitor_analysis': 9,
    'industry_research': 8,
    'search_engine': 6,
    'community_research': 7
  };
  score += methodScores[directory.discoveryMethod] || 5;
  
  return Math.round(score);
}

function calculateSubmissionPriority(directory) {
  const factors = {
    domainAuthority: directory.domainAuthority,
    qualityScore: directory.qualityScore || 50,
    complexity: getComplexityScore(directory.submissionComplexity),
    cost: directory.requiresPayment ? -10 : 10,
    approval: getApprovalScore(directory.estimatedApprovalTime)
  };
  
  // Weighted priority calculation
  const priority = (
    factors.domainAuthority * 0.3 +
    factors.qualityScore * 0.2 +
    factors.complexity * 0.2 +
    factors.cost * 0.15 +
    factors.approval * 0.15
  );
  
  if (priority >= 70) return 'high';
  if (priority >= 50) return 'medium';
  return 'low';
}

function getComplexityScore(complexity) {
  const scores = { 'easy': 20, 'medium': 15, 'hard': 5 };
  return scores[complexity] || 10;
}

function getApprovalScore(approvalTime) {
  if (approvalTime <= 1) return 20; // Same day
  if (approvalTime <= 3) return 15; // 1-3 days
  if (approvalTime <= 7) return 10; // 1 week
  if (approvalTime <= 14) return 5; // 2 weeks
  return 2; // More than 2 weeks
}

function estimateTrafficPotential(directory) {
  // Base traffic on domain authority
  let baseTraffic = Math.pow(directory.domainAuthority, 1.5) * 100;
  
  // Adjust for industry specificity
  if (directory.category !== 'business_general') {
    baseTraffic *= 0.7; // Industry directories typically have less but more targeted traffic
  }
  
  // Adjust for discovery method
  const methodMultipliers = {
    'ai_recommendation': 1.0,
    'competitor_analysis': 1.2,
    'industry_research': 0.9,
    'search_engine': 0.8,
    'community_research': 0.7
  };
  
  baseTraffic *= methodMultipliers[directory.discoveryMethod] || 0.8;
  
  return Math.round(baseTraffic);
}

function calculateCostBenefit(directory) {
  const benefit = directory.domainAuthority + (directory.qualityScore || 50);
  const cost = directory.requiresPayment ? 50 : 10; // Estimate submission cost
  
  return Math.round((benefit / cost) * 10);
}

function estimateSuccessProbability(directory) {
  let probability = 70; // Base 70% success rate
  
  // Adjust based on complexity
  const complexityAdjustments = {
    'easy': +15,
    'medium': 0,
    'hard': -25
  };
  probability += complexityAdjustments[directory.submissionComplexity] || 0;
  
  // Adjust based on approval requirements
  if (directory.requiresApproval) {
    probability -= 20;
  }
  
  // Adjust based on payment requirement
  if (directory.requiresPayment) {
    probability += 10; // Paid submissions often have higher acceptance
  }
  
  // Ensure probability is within reasonable bounds
  return Math.max(10, Math.min(95, probability));
}