// @ts-nocheck
// 🚀 AI BUSINESS INTELLIGENCE ENGINE - USAGE EXAMPLES
// Complete examples showing how to use the $299+ AI-powered analysis platform

import { 
  BusinessIntelligence,
  AnalysisRequest,
  AnalysisProgress,
  createBusinessIntelligenceEngine
} from '../services/ai-business-intelligence-engine'

// Example 1: Basic Business Analysis
export const basicAnalysisExample = async () => {
  console.log('🚀 Running Basic Business Analysis Example')

  const request: AnalysisRequest = {
    url: 'https://example-saas.com',
    userInput: {
      businessGoals: ['lead_generation', 'brand_awareness'],
      targetAudience: 'B2B software companies',
      budget: 1000,
      timeline: '3 months'
    }
  }

  try {
    const result = await BusinessIntelligence.analyze(request)
    
    if (result.success && result.data) {
      console.log('✅ Analysis completed successfully!')
      console.log(`Business: ${result.data.profile.name}`)
      console.log(`Category: ${result.data.profile.primaryCategory}`)
      console.log(`Confidence: ${result.data.confidence}%`)
      console.log(`Directory Opportunities: ${result.data.directoryOpportunities.totalDirectories}`)
      console.log(`Processing Time: ${result.processingTime}ms`)
      console.log(`Cost: $${result.usage.cost}`)
    } else {
      console.error('❌ Analysis failed:', result.error)
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Example 2: Advanced Analysis with Custom Configuration
export const advancedAnalysisExample = async () => {
  console.log('🚀 Running Advanced Business Analysis Example')

  const engine = createBusinessIntelligenceEngine({
    aiAnalysis: {
      model: 'gpt-4',
      temperature: 0.2,
      maxTokens: 3000,
      enableRevenueProjections: true,
      enableCompetitorAnalysis: true,
      analysisDepth: 'comprehensive',
      enableScreenshots: true
    },
    directoryMatching: {
      maxDirectoryCount: 75,
      enablePremiumDirectories: true,
      focusOnHighAuthority: true,
      includeNicheDirectories: true
    },
    websiteAnalysis: {
      timeout: 45000,
      maxRetries: 3,
      userAgent: 'DirectoryBolt AI Analyzer/2.0',
      enableScreenshots: true,
      enableSocialAnalysis: true,
      enableTechStackAnalysis: true,
      screenshotOptions: {
        fullPage: true,
        width: 1920,
        height: 1080,
        quality: 90,
        format: 'png'
      }
    },
    enableProgressTracking: true,
    cacheResults: true,
    maxProcessingTime: 400000
  })

  const request: AnalysisRequest = {
    url: 'https://stripe.com',
    userInput: {
      businessGoals: ['lead_generation', 'competitive_analysis', 'market_expansion'],
      targetAudience: 'Fintech startups and enterprises',
      budget: 2000,
      timeline: '6 months',
      industryFocus: ['FinTech', 'Payments', 'SaaS']
    }
  }

  // Set up progress tracking
  engine.onProgress((progress) => {
    console.log(`📊 Progress: ${progress.progress}% - ${progress.stage}`)
    console.log(`⏱️ ETA: ${progress.estimatedTimeRemaining} seconds`)
  })

  try {
    const result = await engine.analyzeBusinessIntelligence(request)

    if (result.success && result.data) {
      console.log('\n✅ COMPREHENSIVE ANALYSIS COMPLETED!')
      
      // Business Profile
      console.log('\n📋 BUSINESS PROFILE:')
      console.log(`Name: ${result.data.profile.name}`)
      console.log(`Industry: ${result.data.profile.industryVertical}`)
      console.log(`Business Model: ${result.data.profile.businessModel.type}`)
      console.log(`Market Reach: ${result.data.profile.marketReach}`)
      console.log(`Stage: ${result.data.profile.stage}`)

      // Industry Analysis
      console.log('\n🏭 INDUSTRY ANALYSIS:')
      console.log(`Market Size: $${result.data.industryAnalysis.marketSize}B`)
      console.log(`Growth Rate: ${result.data.industryAnalysis.growthRate}%`)
      console.log(`Competition Level: ${result.data.industryAnalysis.competitionLevel}`)

      // Competitive Analysis
      console.log('\n🥊 COMPETITIVE LANDSCAPE:')
      console.log(`Direct Competitors: ${result.data.competitiveAnalysis.directCompetitors.length}`)
      console.log(`Market Gaps: ${result.data.competitiveAnalysis.marketGaps.length}`)
      console.log(`Competitive Advantages:`, result.data.competitiveAnalysis.competitiveAdvantages)

      // SEO Analysis
      console.log('\n🔍 SEO ANALYSIS:')
      console.log(`Current Score: ${result.data.seoAnalysis.currentScore}/100`)
      console.log(`Technical SEO: ${result.data.seoAnalysis.technicalSEO.pageSpeed}/100`)
      console.log(`Content SEO: ${result.data.seoAnalysis.contentSEO.titleOptimization}/100`)

      // Directory Opportunities
      console.log('\n📁 DIRECTORY OPPORTUNITIES:')
      console.log(`Total Directories: ${result.data.directoryOpportunities.totalDirectories}`)
      console.log(`High Authority: ${result.data.directoryOpportunities.categorizedOpportunities.highAuthority.length}`)
      console.log(`Industry Specific: ${result.data.directoryOpportunities.categorizedOpportunities.industrySpecific.length}`)
      
      // Top 5 Directory Recommendations
      console.log('\n🏆 TOP DIRECTORY RECOMMENDATIONS:')
      result.data.directoryOpportunities.prioritizedSubmissions.slice(0, 5).forEach((dir, index) => {
        console.log(`${index + 1}. ${dir.directoryName}`)
        console.log(`   Priority: ${dir.priority}/100`)
        console.log(`   Success Probability: ${dir.successProbability}%`)
        console.log(`   Expected ROI: ${dir.expectedROI}%`)
        console.log(`   Cost: $${dir.cost}`)
        console.log(`   Timeline: ${dir.timeline?.totalTime || 'N/A'} days`)
        console.log('')
      })

      // Revenue Projections
      if (result.data.revenueProjections) {
        console.log('💰 REVENUE PROJECTIONS:')
        console.log(`Baseline (1 year): $${result.data.revenueProjections.baseline.projectedRevenue.toLocaleString()}`)
        console.log(`Conservative: $${result.data.revenueProjections.conservative.projectedRevenue.toLocaleString()}`)
        console.log(`Optimistic: $${result.data.revenueProjections.optimistic.projectedRevenue.toLocaleString()}`)
        console.log(`Payback Period: ${result.data.revenueProjections.paybackPeriod} months`)
      }

      // Success Metrics
      console.log('\n📈 SUCCESS METRICS:')
      console.log(`Visibility Score: ${result.data.successMetrics.visibilityScore}/100`)
      console.log(`Authority Score: ${result.data.successMetrics.authorityScore}/100`)
      console.log(`Traffic Potential: +${result.data.successMetrics.trafficPotential}%`)
      console.log(`Lead Generation Potential: +${result.data.successMetrics.leadGenPotential}%`)
      console.log(`Time to Results: ${result.data.successMetrics.timeToResults} days`)

      // Analysis Quality
      console.log('\n🎯 ANALYSIS QUALITY:')
      console.log(`Confidence: ${result.data.confidence}/100`)
      console.log(`Quality Score: ${result.data.qualityScore}/100`)
      console.log(`Processing Time: ${result.processingTime}ms`)
      console.log(`Tokens Used: ${result.usage.tokensUsed}`)
      console.log(`Analysis Cost: $${result.usage.cost}`)

    } else {
      console.error('❌ Advanced analysis failed:', result.error)
    }
  } catch (error) {
    console.error('❌ Error in advanced analysis:', error)
  }
}

// Example 3: Health Check and Monitoring
export const healthCheckExample = async () => {
  console.log('🚀 Running Health Check Example')

  try {
    const healthStatus = await BusinessIntelligence.healthCheck()

    console.log('\n🏥 HEALTH CHECK RESULTS:')
    console.log(`Overall Status: ${healthStatus.status.toUpperCase()}`)
    console.log('\n📡 Component Status:')
    
    Object.entries(healthStatus.components).forEach(([component, status]) => {
      const icon = status ? '✅' : '❌'
      console.log(`${icon} ${component}: ${status ? 'HEALTHY' : 'UNHEALTHY'}`)
    })

  } catch (error) {
    console.error('❌ Health check failed:', error)
  }
}

// Example 4: Error Handling and Recovery
export const errorHandlingExample = async () => {
  console.log('🚀 Running Error Handling Example')

  const request: AnalysisRequest = {
    url: 'https://invalid-domain-that-does-not-exist.com',
    userInput: {
      budget: 500
    }
  }

  try {
    const result = await BusinessIntelligence.analyze(request)

    if (!result.success) {
      console.log('❌ Analysis failed as expected')
      console.log(`Error: ${result.error}`)
      console.log(`Processing Time: ${result.processingTime}ms`)
      
      // Handle specific error types
      if (result.error?.includes('timeout')) {
        console.log('🔄 Suggestion: Try again with a simpler website or increase timeout')
      } else if (result.error?.includes('rate limit')) {
        console.log('⏰ Suggestion: Wait before making another request')
      } else if (result.error?.includes('OpenAI')) {
        console.log('🤖 Suggestion: Check AI service configuration')
      }
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Example 5: Batch Analysis (Multiple URLs)
export const batchAnalysisExample = async () => {
  console.log('🚀 Running Batch Analysis Example')

  const urls = [
    'https://stripe.com',
    'https://shopify.com', 
    'https://salesforce.com'
  ]

  const engine = createBusinessIntelligenceEngine({
    aiAnalysis: {
      model: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 2000,
      enableRevenueProjections: false, // Faster analysis
      enableCompetitorAnalysis: false,
      analysisDepth: 'standard',
      enableScreenshots: false
    },
    directoryMatching: {
      maxDirectoryCount: 25,
      enablePremiumDirectories: false,
      focusOnHighAuthority: true,
      includeNicheDirectories: false
    }
  })

  const results = []

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    console.log(`\n📊 Analyzing ${i + 1}/${urls.length}: ${url}`)

    try {
      const result = await engine.analyzeBusinessIntelligence({ url })
      
      if (result.success && result.data) {
        results.push({
          url,
          business: result.data.profile.name,
          category: result.data.profile.primaryCategory,
          confidence: result.data.confidence,
          directories: result.data.directoryOpportunities.totalDirectories,
          processingTime: result.processingTime
        })
        
        console.log(`✅ ${result.data.profile.name} - ${result.data.confidence}% confidence`)
      } else {
        console.log(`❌ Failed: ${result.error}`)
      }

      // Rate limiting - wait 2 seconds between requests
      if (i < urls.length - 1) {
        console.log('⏱️ Waiting 2 seconds...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

    } catch (error) {
      console.error(`❌ Error analyzing ${url}:`, error)
    }
  }

  // Summary
  console.log('\n📋 BATCH ANALYSIS SUMMARY:')
  console.log('='.repeat(50))
  
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.business}`)
    console.log(`   URL: ${result.url}`)
    console.log(`   Category: ${result.category}`)
    console.log(`   Confidence: ${result.confidence}%`)
    console.log(`   Directories: ${result.directories}`)
    console.log(`   Processing Time: ${result.processingTime}ms`)
    console.log('')
  })

  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length
  const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0)
  
  console.log(`📈 Average Confidence: ${avgConfidence.toFixed(1)}%`)
  console.log(`⏱️ Total Processing Time: ${totalProcessingTime}ms`)
  console.log(`✅ Successful Analyses: ${results.length}/${urls.length}`)
}

// Example 6: Custom Configuration for Different Business Types
export const businessTypeExamples = async () => {
  console.log('🚀 Running Business Type Specific Examples')

  // E-commerce Configuration
  const ecommerceConfig = {
    aiAnalysis: {
      model: 'gpt-4' as const,
      temperature: 0.3,
      maxTokens: 3000,
      enableScreenshots: true,
      enableRevenueProjections: true,
      enableCompetitorAnalysis: true,
      analysisDepth: 'comprehensive' as const
    },
    directoryMatching: {
      maxDirectoryCount: 60,
      enablePremiumDirectories: true,
      focusOnHighAuthority: true,
      includeNicheDirectories: true
    }
  }

  // SaaS Configuration
  const saasConfig = {
    aiAnalysis: {
      model: 'gpt-4o' as const,
      temperature: 0.2,
      maxTokens: 4000,
      enableScreenshots: true,
      enableRevenueProjections: true,
      enableCompetitorAnalysis: true,
      analysisDepth: 'comprehensive' as const
    },
    directoryMatching: {
      maxDirectoryCount: 50,
      enablePremiumDirectories: true,
      focusOnHighAuthority: true,
      includeNicheDirectories: true
    }
  }

  // Local Business Configuration
  const localConfig = {
    aiAnalysis: {
      model: 'gpt-4o' as const,
      temperature: 0.4,
      maxTokens: 2000,
      enableScreenshots: false,
      enableRevenueProjections: false,
      enableCompetitorAnalysis: true,
      analysisDepth: 'standard' as const
    },
    directoryMatching: {
      maxDirectoryCount: 30,
      enablePremiumDirectories: false,
      focusOnHighAuthority: true,
      includeNicheDirectories: false
    }
  }

  const examples = [
    { url: 'https://shopify.com', config: ecommerceConfig, type: 'E-commerce' },
    { url: 'https://slack.com', config: saasConfig, type: 'SaaS' },
    { url: 'https://example-restaurant.com', config: localConfig, type: 'Local Business' }
  ]

  for (const example of examples) {
    console.log(`\n🏢 Analyzing ${example.type}: ${example.url}`)
    
    try {
      const engine = createBusinessIntelligenceEngine(example.config)
      const result = await engine.analyzeBusinessIntelligence({ 
        url: example.url,
        userInput: {
          businessGoals: example.type === 'E-commerce' 
            ? ['sales_growth', 'customer_acquisition']
            : example.type === 'SaaS'
            ? ['lead_generation', 'market_expansion'] 
            : ['local_visibility', 'reputation_management']
        }
      })

      if (result.success && result.data) {
        console.log(`✅ ${result.data.profile.name}`)
        console.log(`   Category: ${result.data.profile.primaryCategory}`)
        console.log(`   Best Directories: ${result.data.directoryOpportunities.prioritizedSubmissions.slice(0, 3).map(d => d.directoryName).join(', ')}`)
      }
    } catch (error) {
      console.log(`❌ Failed to analyze ${example.type} example`)
    }
  }
}

// Run all examples
export async function runAllExamples() {
  console.log('🚀🚀🚀 RUNNING ALL AI BUSINESS INTELLIGENCE EXAMPLES 🚀🚀🚀')
  console.log('='.repeat(70))

  try {
    await basicAnalysisExample()
    console.log('\n' + '='.repeat(70))
    
    await healthCheckExample()
    console.log('\n' + '='.repeat(70))
    
    await errorHandlingExample()
    console.log('\n' + '='.repeat(70))
    
    // Uncomment for full demonstration (takes longer)
    // await advancedAnalysisExample()
    // console.log('\n' + '='.repeat(70))
    
    // await batchAnalysisExample()
    // console.log('\n' + '='.repeat(70))
    
    // await businessTypeExamples()

    console.log('\n🎉 ALL EXAMPLES COMPLETED!')
    
  } catch (error) {
    console.error('❌ Error running examples:', error)
  }
}

// Export for use in other files
// All functions are already exported individually above