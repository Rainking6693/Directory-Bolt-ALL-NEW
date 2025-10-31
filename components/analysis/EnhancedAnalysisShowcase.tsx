'use client'
import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { LoadingSpinner } from '../ui/LoadingStates'

const EnhancedAnalysisResults = dynamic(() => import('./EnhancedAnalysisResults'), {
  ssr: false,
  loading: () => (
    <div className="py-16">
      <div className="flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    </div>
  ),
})
import { PremiumUpgradePrompt } from './PremiumUpgradePrompt'
import { AnalysisExporter } from './AnalysisExporter'
import { CompetitiveAnalysisVisualization } from './CompetitiveAnalysisVisualization'

// Enhanced Analysis Showcase - Phase 2.3 DirectoryBolt AI-Enhanced plan
// Integrated demonstration of the complete $2,600+ AI analysis system

interface EnhancedAnalysisShowcaseProps {
  userTier: 'free' | 'professional' | 'enterprise'
  onUpgrade?: () => void
}

// Sample data demonstrating the enhanced analysis capabilities
const sampleAnalysisData = {
  url: 'https://example-business.com',
  businessProfile: {
    name: 'TechFlow Solutions',
    description: 'AI-powered workflow automation platform helping businesses streamline operations and increase productivity.',
    category: 'SaaS',
    subcategory: 'Workflow Automation',
    industry: 'Enterprise Software',
    location: {
      city: 'San Francisco',
      country: 'United States',
      region: 'North America'
    },
    targetAudience: [
      'Small to medium businesses',
      'Operations managers',
      'HR departments',
      'Project managers'
    ],
    keywords: [
      'workflow automation',
      'business process',
      'productivity software',
      'enterprise solutions',
      'AI automation'
    ],
    businessModel: 'B2B SaaS',
    size: 'small' as const,
    stage: 'growth' as const
  },
  directoryOpportunities: [
    {
      id: '1',
      name: 'G2 Crowd',
      category: 'Software Reviews',
      authority: 95,
      estimatedTraffic: 45000,
      submissionDifficulty: 'medium',
      cost: 0,
      relevanceScore: 98,
      successProbability: 87,
      priority: 'high' as const,
      reasoning: 'G2 is the leading software review platform where your target audience actively researches workflow automation tools. Your product profile matches perfectly with their enterprise software category.',
      optimizedDescription: 'TechFlow Solutions transforms business operations with AI-powered workflow automation. Trusted by 500+ companies to reduce manual tasks by 70% and boost team productivity. Free trial available.',
      tags: ['workflow-automation', 'ai-powered', 'productivity', 'enterprise'],
      submissionTips: [
        'Include customer testimonials and case studies',
        'Highlight AI automation features prominently',
        'Upload high-quality product screenshots',
        'Encourage satisfied customers to leave reviews'
      ],
      isPremium: false
    },
    {
      id: '2',
      name: 'Capterra',
      category: 'Software Directory',
      authority: 93,
      estimatedTraffic: 38000,
      submissionDifficulty: 'easy',
      cost: 0,
      relevanceScore: 95,
      successProbability: 92,
      priority: 'high' as const,
      reasoning: 'Capterra is where SMBs discover workflow automation software. High approval rate and strong SEO benefits for enterprise software companies.',
      optimizedDescription: 'Automate repetitive workflows with TechFlow\'s intuitive AI platform. Join 500+ businesses saving 20+ hours weekly. Start your free trial today.',
      tags: ['workflow', 'automation', 'smb', 'free-trial'],
      submissionTips: [
        'Focus on SMB benefits in description',
        'Include pricing information clearly',
        'Add integration capabilities',
        'Highlight free trial offer'
      ]
    },
    {
      id: '3',
      name: 'Product Hunt',
      category: 'Product Discovery',
      authority: 88,
      estimatedTraffic: 25000,
      submissionDifficulty: 'medium',
      cost: 0,
      relevanceScore: 85,
      successProbability: 75,
      priority: 'high' as const,
      reasoning: 'Perfect platform for SaaS launches and building early community. High visibility potential if launched strategically.',
      optimizedDescription: 'AI-first workflow automation that learns your business processes and suggests optimizations. Built for modern teams who value efficiency.',
      tags: ['ai', 'saas', 'productivity', 'automation'],
      submissionTips: [
        'Plan launch for Tuesday-Thursday',
        'Build hunter network in advance',
        'Create engaging visual assets',
        'Engage with community day-of-launch'
      ]
    },
    {
      id: '4',
      name: 'Software Suggest',
      category: 'B2B Software',
      authority: 82,
      estimatedTraffic: 15000,
      submissionDifficulty: 'easy',
      cost: 0,
      relevanceScore: 90,
      successProbability: 88,
      priority: 'medium' as const,
      reasoning: 'Specialized B2B software directory with high conversion rates. Less competitive than major platforms but good ROI.',
      optimizedDescription: 'Enterprise workflow automation powered by AI. Reduce operational overhead by 40% with smart process optimization.',
      tags: ['enterprise', 'b2b', 'operations', 'ai'],
      submissionTips: ['Include ROI statistics', 'Highlight enterprise features']
    },
    {
      id: '5',
      name: 'AlternativeTo',
      category: 'Software Alternatives',
      authority: 85,
      estimatedTraffic: 22000,
      submissionDifficulty: 'medium',
      cost: 0,
      relevanceScore: 80,
      successProbability: 70,
      priority: 'medium' as const,
      reasoning: 'Users actively seeking alternatives to existing workflow tools. Position as modern alternative to legacy systems.',
      optimizedDescription: 'Modern alternative to outdated workflow tools. AI-powered automation with intuitive interface and powerful integrations.',
      tags: ['alternative', 'modern', 'integrations'],
      submissionTips: ['Position against specific competitors', 'Highlight modern features']
    },
    // Premium opportunities (shown only for paid tiers)
    {
      id: '6',
      name: 'TrustRadius',
      category: 'Enterprise Reviews',
      authority: 91,
      estimatedTraffic: 35000,
      submissionDifficulty: 'hard',
      cost: 299,
      relevanceScore: 93,
      successProbability: 82,
      priority: 'high' as const,
      reasoning: 'Premium enterprise review platform with high-value prospects. Longer approval process but excellent ROI for B2B SaaS.',
      optimizedDescription: 'Enterprise-grade workflow automation trusted by Fortune 500 companies. Advanced AI capabilities with enterprise security.',
      tags: ['enterprise', 'fortune-500', 'security'],
      submissionTips: ['Emphasize enterprise features', 'Include security certifications'],
      isPremium: true
    }
    // ... more premium opportunities would be included
  ],
  competitorAnalysis: {
    competitors: [
      {
        name: 'Zapier',
        similarities: [
          'Workflow automation focus',
          'Integration-heavy platform',
          'SMB target market'
        ],
        directoryPresence: [
          'G2 Crowd',
          'Capterra',
          'Product Hunt',
          'Software Advice'
        ],
        marketAdvantages: [
          'Established brand recognition',
          '5000+ app integrations',
          'Large community and resources'
        ],
        estimatedDirectoryCount: 47,
        marketShare: 35,
        strengthScore: 92
      },
      {
        name: 'Microsoft Power Automate',
        similarities: [
          'Business process automation',
          'Enterprise focus',
          'AI capabilities'
        ],
        directoryPresence: [
          'G2 Crowd',
          'TrustRadius',
          'Capterra'
        ],
        marketAdvantages: [
          'Microsoft ecosystem integration',
          'Enterprise sales channels',
          'Established customer base'
        ],
        estimatedDirectoryCount: 23,
        marketShare: 28,
        strengthScore: 89
      }
    ],
    marketGaps: [
      {
        opportunity: 'AI-First Workflow Design',
        impact: 'high' as const,
        difficulty: 'medium' as const,
        estimatedValue: 50000,
        description: 'Most competitors offer basic automation. Your AI-first approach to workflow design is a unique differentiator.'
      },
      {
        opportunity: 'SMB-Focused Enterprise Features',
        impact: 'high' as const,
        difficulty: 'easy' as const,
        estimatedValue: 35000,
        description: 'Gap between simple automation tools and complex enterprise platforms. Your solution bridges this perfectly.'
      }
    ],
    positioningAdvice: 'Position TechFlow as the intelligent middle ground - more sophisticated than basic automation tools like IFTTT, but more accessible than complex enterprise platforms like ServiceNow.'
  },
  insights: {
    marketPosition: 'TechFlow Solutions occupies a unique position in the workflow automation market, bridging the gap between simple task automation and complex enterprise BPM systems. Your AI-first approach differentiates you from traditional rule-based competitors.',
    competitiveAdvantages: [
      'AI-powered workflow optimization and suggestions',
      'Intuitive interface that reduces learning curve',
      'SMB-friendly pricing with enterprise-level capabilities',
      'Modern API-first architecture for better integrations'
    ],
    improvementSuggestions: [
      'Expand integration ecosystem to compete with Zapier',
      'Develop industry-specific workflow templates',
      'Build stronger content marketing presence',
      'Establish partnership channels for distribution'
    ],
    successFactors: [
      'Emphasize AI capabilities in all directory submissions',
      'Highlight ROI and productivity metrics prominently',
      'Build case studies from different industries',
      'Focus on directories where competitors are less active'
    ]
  },
  aiMetrics: {
    confidence: 94,
    opportunitiesFound: 127,
    potentialMonthlyLeads: 15420,
    estimatedROI: 340,
    marketPenetration: 23
  },
  tier: 'free' as const
}

const competitiveAnalysisData = {
  competitors: sampleAnalysisData.competitorAnalysis.competitors,
  marketGaps: sampleAnalysisData.competitorAnalysis.marketGaps,
  positioningAdvice: sampleAnalysisData.competitorAnalysis.positioningAdvice,
  marketSize: 2800000,
  yourPosition: {
    rank: 3,
    score: 78,
    advantages: sampleAnalysisData.insights.competitiveAdvantages,
    weaknesses: [
      'Limited brand recognition compared to established players',
      'Smaller integration ecosystem than Zapier',
      'Less enterprise sales infrastructure than Microsoft'
    ]
  },
  directoryLandscape: {
    totalDirectories: 147,
    competitorCoverage: 35,
    yourCoverage: 12,
    untappedOpportunities: 89
  }
}

export function EnhancedAnalysisShowcase({ userTier, onUpgrade }: EnhancedAnalysisShowcaseProps) {
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)

  // Adjust data based on user tier
  const adjustedData = {
    ...sampleAnalysisData,
    tier: userTier,
    directoryOpportunities: userTier === 'free' 
      ? sampleAnalysisData.directoryOpportunities.filter(opp => !opp.isPremium).slice(0, 5)
      : sampleAnalysisData.directoryOpportunities
  }

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade()
    } else {
      setShowUpgradePrompt(true)
    }
  }

  const handleExport = (format: 'csv' | 'pdf') => {
    // Simulate successful export
    setExportSuccess(`Successfully exported ${format}`)
    setTimeout(() => setExportSuccess(null), 3000)
  }

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl md:text-6xl font-black text-white mb-6">
          Enhanced Analysis Results
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600 animate-glow">
            AI-Powered Intelligence
          </span>
        </h1>
        <p className="text-xl md:text-2xl text-secondary-200 mb-8 max-w-4xl mx-auto">
          Experience the complete $2,600+ AI analysis system that drives real business results.
          This demonstration shows how our enhanced interface displays comprehensive business intelligence.
        </p>
        
        {/* Tier Indicator */}
        <div className="inline-flex items-center gap-3 bg-secondary-800/50 rounded-full px-6 py-3 border border-volt-500/30">
          <div className={`w-3 h-3 rounded-full ${
            userTier === 'free' ? 'bg-secondary-400' :
            userTier === 'professional' ? 'bg-volt-400' :
            'bg-success-400'
          }`}></div>
          <span className="text-white font-semibold capitalize">{userTier} Tier Experience</span>
        </div>
      </div>

      {/* Export Success Message */}
      {exportSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-success-500 text-white px-6 py-3 rounded-lg shadow-lg animate-slide-up">
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span>{exportSuccess}</span>
          </div>
        </div>
      )}

      {/* Enhanced Analysis Results */}
      <EnhancedAnalysisResults
        data={adjustedData}
        onUpgrade={handleUpgrade}
        onExport={handleExport}
      />

      {/* Analysis Export Component */}
      <AnalysisExporter
        data={adjustedData}
        userTier={userTier}
        onExport={handleExport}
      />

      {/* Competitive Analysis Visualization */}
      <CompetitiveAnalysisVisualization
        data={competitiveAnalysisData}
        userTier={userTier}
        onUpgrade={handleUpgrade}
      />

      {/* Premium Upgrade Prompt for Free Tier */}
      {(userTier === 'free' || showUpgradePrompt) && (
        <PremiumUpgradePrompt
          currentTier={userTier}
          totalOpportunities={sampleAnalysisData.directoryOpportunities.length}
          shownOpportunities={adjustedData.directoryOpportunities.length}
          estimatedValue={sampleAnalysisData.aiMetrics.potentialMonthlyLeads}
          onUpgrade={onUpgrade}
          onDismiss={() => setShowUpgradePrompt(false)}
          context="results"
        />
      )}

      {/* Value Demonstration Section */}
      <div className="bg-gradient-to-r from-volt-500/10 to-volt-600/10 rounded-2xl border border-volt-500/30 p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Why This Analysis Is Worth $2,600+
          </h2>
          <p className="text-lg text-secondary-200 max-w-3xl mx-auto">
            Our enhanced analysis system provides comprehensive business intelligence that typically costs thousands when done manually.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-5xl mb-4">🤖</div>
            <h3 className="text-xl font-bold text-white mb-3">AI-Powered Intelligence</h3>
            <ul className="text-secondary-300 space-y-2 text-sm">
              <li>• Advanced business profiling</li>
              <li>• Success probability scoring</li>
              <li>• Competitive positioning analysis</li>
              <li>• Market gap identification</li>
            </ul>
          </div>

          <div className="text-center">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-white mb-3">Comprehensive Data</h3>
            <ul className="text-secondary-300 space-y-2 text-sm">
              <li>• 100+ directory opportunities</li>
              <li>• Detailed competitor analysis</li>
              <li>• ROI projections and metrics</li>
              <li>• Strategic recommendations</li>
            </ul>
          </div>

          <div className="text-center">
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-xl font-bold text-white mb-3">Actionable Results</h3>
            <ul className="text-secondary-300 space-y-2 text-sm">
              <li>• Ready-to-use descriptions</li>
              <li>• Submission priorities</li>
              <li>• Professional reports</li>
              <li>• White-label options</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      {userTier === 'free' && (
        <div className="text-center">
          <div className="inline-flex items-center gap-4 bg-secondary-800/50 rounded-xl p-6 border border-volt-500/30">
            <div className="text-4xl">💡</div>
            <div className="text-left">
              <h3 className="text-xl font-bold text-white">Ready to unlock your full analysis?</h3>
              <p className="text-secondary-300">Get access to all {sampleAnalysisData.directoryOpportunities.length} opportunities and premium features.</p>
            </div>
            <button
              onClick={handleUpgrade}
              className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-3 px-6 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 whitespace-nowrap"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      )}
    </div>
  )
}