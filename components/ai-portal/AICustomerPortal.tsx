'use client'

import { useState, useEffect, useMemo } from 'react'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { LoadingState } from '../ui/LoadingState'
import { BusinessIntelligenceInsights } from './BusinessIntelligenceInsights'
import { CompetitivePositioningTracker } from './CompetitivePositioningTracker'
import { DirectoryPerformanceAnalytics } from './DirectoryPerformanceAnalytics'
import { SEOImprovementMonitor } from './SEOImprovementMonitor'
import { PredictiveAnalyticsDashboard } from './PredictiveAnalyticsDashboard'
import { ActionableInsightsSystem } from './ActionableInsightsSystem'
import { getBusinessIntelligenceEngine } from '../../lib/services/ai-business-intelligence-engine'
import { BusinessIntelligence, AnalysisProgress } from '../../lib/types/business-intelligence'

interface AIPortalData {
  businessIntelligence: BusinessIntelligence | null
  lastAnalysisUpdate: string
  realTimeMetrics: RealTimeMetrics
  competitiveData: CompetitiveData
  performanceMetrics: PerformanceMetrics
  insights: AIGeneratedInsight[]
}

interface RealTimeMetrics {
  directoryVisibility: number
  searchRankings: { keyword: string; position: number; change: number }[]
  trafficGrowth: number
  leadGeneration: number
  brandMentions: number
}

interface CompetitiveData {
  marketPosition: number
  competitorMovement: { competitor: string; change: number }[]
  marketGapOpportunities: string[]
  competitiveAdvantages: string[]
}

interface PerformanceMetrics {
  submissionSuccessRate: number
  averageApprovalTime: number
  directoryTrafficContribution: number
  conversionRateImprovement: number
  seoScoreImprovement: number
}

interface AIGeneratedInsight {
  id: string
  type: 'opportunity' | 'alert' | 'recommendation' | 'trend'
  title: string
  description: string
  actionItems: string[]
  priority: 'high' | 'medium' | 'low'
  category: 'seo' | 'competitive' | 'directory' | 'market'
  impact: number
  confidence: number
  generatedAt: string
  expiresAt?: string
}

interface AICustomerPortalProps {
  userId: string
  businessUrl: string
  onInsightAction?: (insight: AIGeneratedInsight, action: string) => void
  className?: string
}

// Generate comprehensive mock data for the AI portal
const generateMockAIPortalData = (userId: string): AIPortalData => {
  const mockBusinessIntelligence: BusinessIntelligence = {
    profile: {
      name: 'Acme Corp',
      domain: 'acme-corp.com',
      description: 'Leading provider of innovative business solutions',
      primaryCategory: 'Business Services',
      secondaryCategories: ['Consulting', 'Technology'],
      industryVertical: 'B2B Software',
      businessModel: {
        type: 'B2B',
        revenueStreams: ['Software Licenses', 'Consulting Services'],
        pricingModel: 'subscription',
        customerAcquisitionModel: ['Direct Sales', 'Partner Channel']
      },
      targetMarket: {
        primaryAudience: 'Enterprise Decision Makers',
        secondaryAudiences: ['IT Directors', 'Business Analysts'],
        demographics: {
          ageRanges: ['35-55'],
          genders: ['All'],
          incomes: ['$100k+'],
          educations: ['Bachelor+'],
          locations: ['North America', 'Europe'],
          occupations: ['C-Suite', 'Director', 'Manager']
        },
        psychographics: {
          values: ['Innovation', 'Efficiency', 'Growth'],
          interests: ['Technology', 'Business Strategy'],
          lifestyle: ['Professional', 'Tech-Savvy'],
          personality: ['Analytical', 'Results-Driven'],
          attitudes: ['Forward-Thinking', 'Quality-Focused']
        },
        painPoints: ['Manual Processes', 'Data Silos', 'Inefficiency'],
        buyingBehavior: {
          decisionFactors: ['ROI', 'Features', 'Support'],
          purchaseFrequency: 'Annual',
          averageOrderValue: 50000,
          seasonality: 'Q4 Heavy',
          channels: ['Direct Sales', 'Online']
        }
      },
      location: {
        headquarters: {
          city: 'San Francisco',
          state: 'CA',
          country: 'USA',
          postalCode: '94105'
        },
        offices: [],
        serviceAreas: [],
        timeZones: ['PST']
      },
      size: 'medium',
      stage: 'growth',
      marketReach: 'national',
      serviceAreas: ['United States', 'Canada'],
      contactInfo: {
        email: 'info@acme-corp.com',
        website: 'https://acme-corp.com',
        socialLinks: []
      },
      socialPresence: {
        platforms: [],
        totalFollowers: 5000,
        engagementRate: 3.2,
        contentStrategy: 'Thought Leadership',
        influenceScore: 72
      },
      techStack: {
        website: {
          ssl: true,
          mobileOptimized: true,
          pageSpeed: 85,
          analytics: ['Google Analytics'],
          hosting: 'AWS'
        },
        analytics: ['Google Analytics', 'HubSpot'],
        marketing: ['HubSpot', 'Salesforce'],
        hosting: ['AWS']
      },
      contentAnalysis: {
        readabilityScore: 78,
        sentimentScore: 82,
        keyThemes: ['Innovation', 'Efficiency', 'Growth'],
        contentGaps: ['Case Studies', 'Technical Docs'],
        expertiseIndicators: ['Industry Awards', 'Certifications'],
        trustSignals: ['Customer Reviews', 'Security Badges']
      }
    },
    industryAnalysis: {
      primaryIndustry: 'Business Software',
      subIndustries: ['CRM', 'Analytics', 'Automation'],
      marketSize: 425.3,
      growthRate: 12.8,
      competitionLevel: 'high',
      marketTrends: ['AI Integration', 'Cloud Migration', 'Remote Work Tools'],
      seasonality: [],
      regulatoryFactors: ['Data Privacy', 'Security Compliance'],
      keySuccessFactors: ['Product Quality', 'Customer Support', 'Innovation'],
      industryBenchmarks: {
        averageCAC: 2500,
        averageLTV: 15000,
        averageConversion: 2.8,
        averageTrafficGrowth: 15.2,
        typicalDirectoryROI: 320
      }
    },
    competitiveAnalysis: {
      directCompetitors: [],
      indirectCompetitors: [],
      marketGaps: [],
      competitiveAdvantages: ['Advanced Analytics', 'Superior UX'],
      weaknesses: ['Limited Brand Awareness'],
      differentiationOpportunities: ['AI-Powered Features'],
      competitorDirectoryPresence: {
        competitor: 'Main Competitor',
        directories: [],
        totalPresence: 85,
        gapOpportunities: ['G2', 'Capterra', 'TrustPilot']
      },
      marketShare: {
        totalMarketSize: 100000000,
        currentMarketShare: 0.5,
        targetMarketShare: 2.0,
        topCompetitors: []
      }
    },
    seoAnalysis: {
      currentScore: 78,
      technicalSEO: {
        pageSpeed: 85,
        mobileOptimized: true,
        sslCertificate: true,
        xmlSitemap: true,
        robotsTxt: true,
        schemaMarkup: 65,
        canonicalTags: 90,
        metaTags: {
          titleTags: 85,
          metaDescriptions: 78,
          ogTags: 82,
          schemaMarkup: 65,
          canonicalTags: 90
        }
      },
      contentSEO: {
        titleOptimization: 82,
        metaDescriptions: 78,
        headingStructure: 88,
        keywordDensity: 75,
        contentLength: 850,
        duplicateContent: 5,
        imageOptimization: 70
      },
      localSEO: {
        googleMyBusiness: true,
        napConsistency: 95,
        localCitations: 45,
        reviewCount: 127,
        averageRating: 4.6,
        localKeywordRankings: 72
      },
      competitorSEOGap: 15,
      improvementOpportunities: [],
      keywordAnalysis: {
        primaryKeywords: [],
        secondaryKeywords: [],
        longTailOpportunities: [],
        competitorKeywords: [],
        keywordGaps: [],
        seasonalKeywords: []
      },
      backlinkAnalysis: {
        totalBacklinks: 1250,
        domainAuthority: 68,
        linkQuality: 82,
        competitorGap: 12,
        linkBuildingOpportunities: []
      }
    },
    directoryOpportunities: {
      totalDirectories: 127,
      categorizedOpportunities: {
        highAuthority: [],
        industrySpecific: [],
        localDirectories: [],
        nicheDirectories: [],
        freeDirectories: [],
        premiumDirectories: []
      },
      prioritizedSubmissions: [],
      estimatedResults: {
        totalTrafficIncrease: 35000,
        leadIncrease: 450,
        brandExposureIncrease: 125,
        timeToResults: {
          immediate: 7,
          shortTerm: 30,
          mediumTerm: 90,
          longTerm: 180
        },
        riskFactors: []
      },
      submissionStrategy: {
        totalDirectories: 127,
        submissionPaces: [],
        budgetAllocation: [],
        timeline: [],
        successMetrics: []
      }
    },
    marketPositioning: {
      currentPosition: 'Emerging Innovator',
      recommendedPosition: 'Industry Leader',
      valueProposition: {
        primary: 'Transform your business with AI-powered solutions',
        secondary: [],
        differentiators: [],
        benefits: [],
        proofPoints: []
      },
      messagingFramework: {
        coreMessage: 'Accelerate growth through intelligent automation',
        audienceMessages: [],
        channelMessages: [],
        brandVoice: 'Professional, Innovative, Trustworthy',
        keyThemes: ['Innovation', 'Results', 'Partnership']
      },
      brandingRecommendations: [],
      audienceSegmentation: []
    },
    revenueProjections: {
      baseline: {
        timeframe: '1year',
        projectedRevenue: 2500000,
        trafficIncrease: 45,
        leadIncrease: 35,
        conversionRate: 2.8,
        customerLifetimeValue: 15000,
        assumptions: ['Market conditions remain stable']
      },
      conservative: {
        timeframe: '1year',
        projectedRevenue: 2200000,
        trafficIncrease: 35,
        leadIncrease: 25,
        conversionRate: 2.5,
        customerLifetimeValue: 14000,
        assumptions: ['Conservative market growth']
      },
      optimistic: {
        timeframe: '1year',
        projectedRevenue: 3200000,
        trafficIncrease: 65,
        leadIncrease: 55,
        conversionRate: 3.2,
        customerLifetimeValue: 18000,
        assumptions: ['Strong market adoption']
      },
      directoryROI: [],
      paybackPeriod: 8,
      lifetimeValue: 15000
    },
    successMetrics: {
      visibilityScore: 78,
      authorityScore: 72,
      trafficPotential: 85000,
      leadGenPotential: 650,
      brandExposure: 156,
      timeToResults: 45,
      competitiveAdvantage: 68
    },
    confidence: 87,
    qualityScore: 91,
    analysisTimestamp: new Date()
  }

  return {
    businessIntelligence: mockBusinessIntelligence,
    lastAnalysisUpdate: new Date().toISOString(),
    realTimeMetrics: {
      directoryVisibility: 78,
      searchRankings: [
        { keyword: 'business automation', position: 12, change: 3 },
        { keyword: 'enterprise software', position: 8, change: -1 },
        { keyword: 'workflow optimization', position: 15, change: 5 },
        { keyword: 'business intelligence', position: 22, change: 2 }
      ],
      trafficGrowth: 23.5,
      leadGeneration: 127,
      brandMentions: 45
    },
    competitiveData: {
      marketPosition: 4,
      competitorMovement: [
        { competitor: 'CompetitorA', change: -2 },
        { competitor: 'CompetitorB', change: 1 },
        { competitor: 'CompetitorC', change: 0 }
      ],
      marketGapOpportunities: [
        'Small business segment underserved',
        'Mobile-first solutions lacking',
        'Industry-specific features needed'
      ],
      competitiveAdvantages: [
        'Superior AI integration',
        'Faster implementation time',
        'Better customer support'
      ]
    },
    performanceMetrics: {
      submissionSuccessRate: 85.2,
      averageApprovalTime: 12.5,
      directoryTrafficContribution: 34.7,
      conversionRateImprovement: 18.3,
      seoScoreImprovement: 15.8
    },
    insights: [
      {
        id: '1',
        type: 'opportunity',
        title: 'High-Value Directory Opportunity Identified',
        description: 'G2 and Capterra show optimal timing for submission based on seasonal trends and competitor analysis.',
        actionItems: [
          'Submit to G2 within next 2 weeks',
          'Prepare customer testimonials',
          'Optimize product descriptions'
        ],
        priority: 'high',
        category: 'directory',
        impact: 85,
        confidence: 92,
        generatedAt: new Date().toISOString()
      },
      {
        id: '2',
        type: 'alert',
        title: 'Competitor Moving Up in Rankings',
        description: 'CompetitorA has improved their search rankings for 3 key terms. Immediate action recommended.',
        actionItems: [
          'Review competitor content strategy',
          'Optimize underperforming keywords',
          'Increase content marketing efforts'
        ],
        priority: 'high',
        category: 'competitive',
        impact: 72,
        confidence: 88,
        generatedAt: new Date().toISOString()
      },
      {
        id: '3',
        type: 'recommendation',
        title: 'SEO Content Gap Opportunity',
        description: 'Analysis shows 12 high-value keywords with low competition and high search volume.',
        actionItems: [
          'Create content for target keywords',
          'Optimize existing pages',
          'Build internal linking strategy'
        ],
        priority: 'medium',
        category: 'seo',
        impact: 68,
        confidence: 85,
        generatedAt: new Date().toISOString()
      },
      {
        id: '4',
        type: 'trend',
        title: 'Industry Trend Analysis',
        description: 'AI automation tools seeing 45% increase in search volume. Market positioning opportunity.',
        actionItems: [
          'Update value proposition messaging',
          'Create AI-focused content',
          'Target AI-related keywords'
        ],
        priority: 'medium',
        category: 'market',
        impact: 78,
        confidence: 90,
        generatedAt: new Date().toISOString()
      }
    ]
  }
}

export function AICustomerPortal({
  userId,
  businessUrl,
  onInsightAction,
  className = ''
}: AICustomerPortalProps) {
  const [data, setData] = useState<AIPortalData>(generateMockAIPortalData(userId))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'overview' | 'analytics' | 'competitive' | 'insights'>('overview')
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null)

  // Auto-refresh intelligence data every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      refreshIntelligenceData()
    }, 300000) // 5 minutes

    return () => clearInterval(interval)
  }, [])

  const refreshIntelligenceData = async () => {
    try {
      setIsLoading(true)
      
      // In a real implementation, this would call the AI Business Intelligence Engine
      const engine = getBusinessIntelligenceEngine()
      
      engine.onProgress((progress: AnalysisProgress) => {
        setAnalysisProgress(progress)
      })

      // Mock refresh for demo - in reality this would fetch fresh data
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setData(prev => ({
        ...prev,
        lastAnalysisUpdate: new Date().toISOString(),
        // Update some metrics to show real-time changes
        realTimeMetrics: {
          ...prev.realTimeMetrics,
          trafficGrowth: prev.realTimeMetrics.trafficGrowth + (Math.random() * 2 - 1),
          leadGeneration: prev.realTimeMetrics.leadGeneration + Math.floor(Math.random() * 10 - 5),
          brandMentions: prev.realTimeMetrics.brandMentions + Math.floor(Math.random() * 5 - 2)
        }
      }))

      setAnalysisProgress(null)
    } catch (err) {
      setError('Failed to refresh intelligence data')
      console.error('Intelligence refresh error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInsightAction = (insight: AIGeneratedInsight, action: string) => {
    // Mark insight as acted upon
    setData(prev => ({
      ...prev,
      insights: prev.insights.map(i => 
        i.id === insight.id 
          ? { ...i, actionTaken: action, actionedAt: new Date().toISOString() }
          : i
      )
    }))
    
    onInsightAction?.(insight, action)
  }

  const criticalInsights = useMemo(() => 
    data.insights.filter(i => i.priority === 'high').slice(0, 3)
  , [data.insights])

  if (error && !data) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${className}`}>
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-6 max-w-md text-center">
          <span className="text-4xl mb-4 block">⚠️</span>
          <h3 className="text-lg font-bold text-white mb-2">AI Portal Error</h3>
          <p className="text-danger-400 mb-4">{error}</p>
          <button 
            onClick={refreshIntelligenceData}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen bg-secondary-900 ${className}`}>
        {/* Header with AI Status */}
        <header className="bg-secondary-800 border-b border-secondary-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-r from-volt-500 to-volt-400 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">🧠</span>
                  </div>
                  {!isLoading && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-success-500 rounded-full border-2 border-secondary-800 animate-pulse" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-black text-white">
                    AI Customer Portal
                  </h1>
                  <p className="text-secondary-400">
                    {data.businessIntelligence?.profile.name} • Last updated {new Date(data.lastAnalysisUpdate).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Real-time Status */}
              <div className="flex items-center gap-4">
                {isLoading && analysisProgress && (
                  <div className="bg-secondary-700 rounded-lg px-3 py-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-volt-400 rounded-full animate-pulse" />
                    <span className="text-sm text-secondary-300">{analysisProgress.stage}</span>
                    <span className="text-xs text-volt-400">{analysisProgress.progress}%</span>
                  </div>
                )}
                <button
                  onClick={refreshIntelligenceData}
                  disabled={isLoading}
                  className="btn-secondary flex items-center gap-2"
                >
                  {isLoading ? '🔄' : '⚡'} Refresh AI Analysis
                </button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex gap-2 mt-6">
              {[
                { key: 'overview', label: 'Overview', icon: '📊' },
                { key: 'analytics', label: 'Analytics', icon: '📈' },
                { key: 'competitive', label: 'Competitive', icon: '🎯' },
                { key: 'insights', label: 'AI Insights', icon: '💡' }
              ].map((view) => (
                <button
                  key={view.key}
                  onClick={() => setActiveView(view.key as typeof activeView)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    activeView === view.key
                      ? 'bg-volt-500 text-secondary-900'
                      : 'text-secondary-400 hover:text-secondary-300 hover:bg-secondary-700/50'
                  }`}
                >
                  <span>{view.icon}</span>
                  <span className="hidden sm:inline">{view.label}</span>
                  {view.key === 'insights' && criticalInsights.length > 0 && (
                    <span className="bg-danger-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {criticalInsights.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeView === 'overview' && (
            <div className="space-y-8">
              {/* Critical Alerts */}
              {criticalInsights.length > 0 && (
                <div className="bg-gradient-to-r from-danger-500/10 to-warning-500/10 border border-danger-500/30 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    🚨 Critical AI Insights
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {criticalInsights.map((insight) => (
                      <div key={insight.id} className="bg-secondary-800 rounded-lg p-4">
                        <h3 className="font-semibold text-white mb-2">{insight.title}</h3>
                        <p className="text-sm text-secondary-300 mb-3">{insight.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-volt-400">Impact: {insight.impact}%</span>
                          <button 
                            onClick={() => handleInsightAction(insight, 'viewed')}
                            className="text-xs bg-volt-500 text-secondary-900 px-2 py-1 rounded"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Business Intelligence Insights */}
              <BusinessIntelligenceInsights 
                data={data}
                onRefresh={refreshIntelligenceData}
                isLoading={isLoading}
              />
              
              {/* Performance Overview Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <DirectoryPerformanceAnalytics 
                  performanceMetrics={data.performanceMetrics}
                  realTimeMetrics={data.realTimeMetrics}
                />
                <SEOImprovementMonitor 
                  seoData={data.businessIntelligence?.seoAnalysis}
                  improvements={data.realTimeMetrics.searchRankings}
                />
              </div>
            </div>
          )}

          {activeView === 'analytics' && (
            <PredictiveAnalyticsDashboard 
              businessIntelligence={data.businessIntelligence}
              performanceMetrics={data.performanceMetrics}
              onDataUpdate={setData}
            />
          )}

          {activeView === 'competitive' && (
            <CompetitivePositioningTracker 
              competitiveData={data.competitiveData}
              businessIntelligence={data.businessIntelligence}
              onRefresh={refreshIntelligenceData}
            />
          )}

          {activeView === 'insights' && (
            <ActionableInsightsSystem 
              insights={data.insights}
              onInsightAction={handleInsightAction}
              onGenerateReport={() => {
                // Generate new AI report
                console.log('Generating new AI report...')
              }}
            />
          )}
        </main>

        {/* Loading Overlay */}
        {isLoading && !analysisProgress && (
          <div className="fixed inset-0 bg-secondary-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <LoadingState 
              message="Refreshing AI Analysis..."
              variant="spinner"
              size="lg"
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default AICustomerPortal