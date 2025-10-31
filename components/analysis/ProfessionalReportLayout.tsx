'use client'
import { useState, useRef } from 'react'
import { motion } from 'framer-motion'

interface ReportData {
  executiveSummary: {
    businessName: string
    analysisDate: string
    totalOpportunities: number
    estimatedValue: number
    confidenceScore: number
    keyFindings: string[]
    recommendations: string[]
  }
  businessProfile: {
    industry: string
    businessType: string
    targetMarket: string
    businessSize: string
    geographicFocus: string
    establishedYear?: number
  }
  opportunityAnalysis: {
    highPriority: number
    mediumPriority: number
    lowPriority: number
    totalEstimatedValue: number
    averageROI: number
    timeToROI: string
  }
  competitiveIntelligence: {
    marketPosition: string
    competitiveAdvantages: string[]
    marketGaps: string[]
    differentiationScore: number
    marketSaturation: number
  }
  financialProjections: {
    conservative: { monthly: number; annual: number }
    realistic: { monthly: number; annual: number }
    optimistic: { monthly: number; annual: number }
    assumptions: string[]
  }
  actionPlan: {
    phase1: { title: string; timeline: string; actions: string[] }
    phase2: { title: string; timeline: string; actions: string[] }
    phase3: { title: string; timeline: string; actions: string[] }
  }
  appendices: {
    methodology: string
    dataSource: string
    limitations: string[]
  }
}

interface ProfessionalReportLayoutProps {
  reportData: ReportData
  userTier: 'free' | 'starter' | 'growth' | 'professional'
  onUpgrade: () => void
  onDownloadPDF: () => void
  onShare: () => void
}

export default function ProfessionalReportLayout({
  reportData,
  userTier,
  onUpgrade,
  onDownloadPDF,
  onShare
}: ProfessionalReportLayoutProps) {
  const [activeSection, setActiveSection] = useState('executive-summary')
  const [isExporting, setIsExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const lockedSections: Record<
    ProfessionalReportLayoutProps['userTier'],
    string[]
  > = {
    free: ['competitive-intelligence', 'financial-projections', 'action-plan', 'appendices'],
    starter: ['financial-projections', 'action-plan', 'appendices'],
    growth: ['appendices'],
    professional: []
  }

  const isLocked = (section: string) => {
    const sectionsForTier = lockedSections[userTier]
    return sectionsForTier ? sectionsForTier.includes(section) : false
  }

  const sections = [
    { id: 'executive-summary', title: 'Executive Summary', icon: '📋' },
    { id: 'business-profile', title: 'Business Profile', icon: '🏢' },
    { id: 'opportunity-analysis', title: 'Opportunity Analysis', icon: '🎯' },
    { id: 'competitive-intelligence', title: 'Competitive Intelligence', icon: '⚔️' },
    { id: 'financial-projections', title: 'Financial Projections', icon: '📈' },
    { id: 'action-plan', title: 'Action Plan', icon: '🚀' },
    { id: 'appendices', title: 'Appendices', icon: '📚' }
  ]

  const ReportHeader = () => (
    <div className="bg-gradient-to-r from-secondary-800 to-secondary-900 border-b border-secondary-700 p-8 print:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-white mb-2 print:text-black">
            Business Intelligence Analysis Report
          </h1>
          <div className="text-secondary-300 print:text-gray-600">
            <div className="text-lg font-semibold">{reportData.executiveSummary.businessName}</div>
            <div className="text-sm">Analysis Date: {reportData.executiveSummary.analysisDate}</div>
          </div>
        </div>
        <div className="text-right print:hidden">
          <div className="bg-volt-500/20 border border-volt-500/40 rounded-xl p-4">
            <div className="text-2xl font-black text-volt-400 mb-1">
              {reportData.executiveSummary.confidenceScore}%
            </div>
            <div className="text-volt-300 text-sm">Confidence Score</div>
          </div>
        </div>
      </div>

      {/* Report Controls */}
      <div className="flex flex-wrap justify-between items-center gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-secondary-400 text-sm">Report ID:</span>
          <span className="text-white font-mono text-sm">{Date.now().toString(36).toUpperCase()}</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={onShare}
            className="flex items-center gap-2 px-4 py-2 bg-secondary-700 hover:bg-secondary-600 text-secondary-300 hover:text-white rounded-lg transition-all duration-300"
          >
            <span>📤</span>
            <span>Share</span>
          </button>
          <button
            onClick={onDownloadPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-volt-500 hover:bg-volt-400 text-secondary-900 font-semibold rounded-lg transition-all duration-300 disabled:opacity-50"
          >
            <span>{isExporting ? '⏳' : '📄'}</span>
            <span>{isExporting ? 'Generating...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  )

  const SectionNavigation = () => (
    <div className="bg-secondary-800/50 border-b border-secondary-700 p-4 print:hidden">
      <div className="flex flex-wrap gap-2 justify-center">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => !isLocked(section.id) && setActiveSection(section.id)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
              activeSection === section.id
                ? 'bg-volt-500 text-secondary-900'
                : isLocked(section.id)
                  ? 'bg-secondary-700 text-secondary-500 cursor-not-allowed'
                  : 'bg-secondary-700 text-secondary-300 hover:bg-secondary-600 hover:text-white'
            }`}
          >
            {isLocked(section.id) && (
              <span className="absolute -top-1 -right-1 text-xs">🔒</span>
            )}
            <span>{section.icon}</span>
            <span>{section.title}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const ExecutiveSummary = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-success-500/10 border border-success-500/30 rounded-xl p-6 text-center print:border-gray-300">
          <div className="text-3xl font-black text-success-400 mb-2 print:text-black">
            {reportData.executiveSummary.totalOpportunities}
          </div>
          <div className="text-success-300 font-medium print:text-gray-700">
            Total Opportunities
          </div>
        </div>
        <div className="bg-volt-500/10 border border-volt-500/30 rounded-xl p-6 text-center print:border-gray-300">
          <div className="text-3xl font-black text-volt-400 mb-2 print:text-black">
            ${reportData.executiveSummary.estimatedValue.toLocaleString()}
          </div>
          <div className="text-volt-300 font-medium print:text-gray-700">
            Monthly Value Potential
          </div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-6 text-center print:border-gray-300">
          <div className="text-3xl font-black text-orange-400 mb-2 print:text-black">
            {reportData.executiveSummary.confidenceScore}%
          </div>
          <div className="text-orange-300 font-medium print:text-gray-700">
            Analysis Confidence
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-secondary-800/50 rounded-xl border border-secondary-700 p-6 print:border print:border-gray-300 print:bg-white">
          <h3 className="text-xl font-bold text-white mb-4 print:text-black flex items-center gap-2">
            <span>🔍</span>
            Key Findings
          </h3>
          <div className="space-y-3">
            {reportData.executiveSummary.keyFindings.map((finding, index) => (
              <div key={index} className="flex items-start gap-3 text-sm">
                <span className="text-success-400 flex-shrink-0 mt-1 print:text-black">✓</span>
                <span className="text-secondary-200 print:text-gray-800">{finding}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-secondary-800/50 rounded-xl border border-secondary-700 p-6 print:border print:border-gray-300 print:bg-white">
          <h3 className="text-xl font-bold text-white mb-4 print:text-black flex items-center gap-2">
            <span>💡</span>
            Strategic Recommendations
          </h3>
          <div className="space-y-3">
            {reportData.executiveSummary.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start gap-3 text-sm">
                <span className="text-volt-400 flex-shrink-0 mt-1 print:text-black">→</span>
                <span className="text-secondary-200 print:text-gray-800">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const BusinessProfile = () => (
    <div className="space-y-8">
      <div className="bg-secondary-800/50 rounded-xl border border-secondary-700 p-8 print:border print:border-gray-300 print:bg-white">
        <h3 className="text-2xl font-bold text-white mb-6 print:text-black flex items-center gap-3">
          <span>🏢</span>
          Business Profile Analysis
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-semibold text-volt-400 mb-4 print:text-black">
                Company Information
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary-400 print:text-gray-600">Industry:</span>
                  <span className="text-white font-medium print:text-black">
                    {reportData.businessProfile.industry}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-400 print:text-gray-600">Business Type:</span>
                  <span className="text-white font-medium print:text-black">
                    {reportData.businessProfile.businessType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-400 print:text-gray-600">Size Category:</span>
                  <span className="text-white font-medium print:text-black">
                    {reportData.businessProfile.businessSize}
                  </span>
                </div>
                {reportData.businessProfile.establishedYear && (
                  <div className="flex justify-between">
                    <span className="text-secondary-400 print:text-gray-600">Established:</span>
                    <span className="text-white font-medium print:text-black">
                      {reportData.businessProfile.establishedYear}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-semibold text-volt-400 mb-4 print:text-black">
                Market Information
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary-400 print:text-gray-600">Target Market:</span>
                  <span className="text-white font-medium print:text-black">
                    {reportData.businessProfile.targetMarket}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-400 print:text-gray-600">Geographic Focus:</span>
                  <span className="text-white font-medium print:text-black">
                    {reportData.businessProfile.geographicFocus}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const OpportunityAnalysis = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-success-500/10 border border-success-500/30 rounded-xl p-6 text-center print:border-gray-300">
          <div className="text-4xl font-black text-success-400 mb-2 print:text-black">
            {reportData.opportunityAnalysis.highPriority}
          </div>
          <div className="text-success-300 font-medium print:text-gray-700">High Priority</div>
          <div className="text-success-200 text-sm print:text-gray-600">90%+ Success Rate</div>
        </div>
        <div className="bg-volt-500/10 border border-volt-500/30 rounded-xl p-6 text-center print:border-gray-300">
          <div className="text-4xl font-black text-volt-400 mb-2 print:text-black">
            {reportData.opportunityAnalysis.mediumPriority}
          </div>
          <div className="text-volt-300 font-medium print:text-gray-700">Medium Priority</div>
          <div className="text-volt-200 text-sm print:text-gray-600">75-85% Success Rate</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-6 text-center print:border-gray-300">
          <div className="text-4xl font-black text-orange-400 mb-2 print:text-black">
            {reportData.opportunityAnalysis.lowPriority}
          </div>
          <div className="text-orange-300 font-medium print:text-gray-700">Strategic</div>
          <div className="text-orange-200 text-sm print:text-gray-600">60-75% Success Rate</div>
        </div>
      </div>

      <div className="bg-secondary-800/50 rounded-xl border border-secondary-700 p-8 print:border print:border-gray-300 print:bg-white">
        <h3 className="text-2xl font-bold text-white mb-6 print:text-black flex items-center gap-3">
          <span>📊</span>
          Financial Impact Analysis
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="text-3xl font-black text-success-400 mb-2 print:text-black">
              ${reportData.opportunityAnalysis.totalEstimatedValue.toLocaleString()}
            </div>
            <div className="text-secondary-300 print:text-gray-700 mb-4">
              Total Monthly Value Potential
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary-400 print:text-gray-600">Average ROI:</span>
                <span className="text-white font-medium print:text-black">
                  {reportData.opportunityAnalysis.averageROI}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-400 print:text-gray-600">Time to ROI:</span>
                <span className="text-success-400 font-medium print:text-black">
                  {reportData.opportunityAnalysis.timeToROI}
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-volt-500/10 rounded-xl border border-volt-500/30 p-6 print:border-gray-300">
            <h4 className="text-lg font-semibold text-volt-400 mb-4 print:text-black">
              Success Factors
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-success-400 print:text-black">✓</span>
                <span className="text-secondary-200 print:text-gray-800">
                  High-authority directory selection
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-success-400 print:text-black">✓</span>
                <span className="text-secondary-200 print:text-gray-800">
                  Industry-specific targeting
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-success-400 print:text-black">✓</span>
                <span className="text-secondary-200 print:text-gray-800">
                  Geographic relevance matching
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-success-400 print:text-black">✓</span>
                <span className="text-secondary-200 print:text-gray-800">
                  Low competition directories prioritized
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const LockedSection = ({ title, description }: { title: string; description: string }) => (
    <div className="bg-gradient-to-r from-danger-500/10 to-volt-500/10 rounded-xl border-2 border-volt-500/50 p-8 text-center print:hidden">
      <div className="text-6xl mb-4">🔒</div>
      <h3 className="text-2xl font-bold text-white mb-4">
        {title} - Premium Feature
      </h3>
      <p className="text-secondary-300 text-lg mb-6 max-w-2xl mx-auto">
        {description}
      </p>
      <button
        onClick={onUpgrade}
        className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black py-4 px-8 text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-volt-500/50"
      >
        🚀 Upgrade to Access Full Report
      </button>
    </div>
  )

  const renderSection = () => {
    switch (activeSection) {
      case 'executive-summary':
        return <ExecutiveSummary />
      case 'business-profile':
        return <BusinessProfile />
      case 'opportunity-analysis':
        return <OpportunityAnalysis />
      case 'competitive-intelligence':
        return isLocked('competitive-intelligence') ? (
          <LockedSection 
            title="Competitive Intelligence"
            description="Unlock detailed competitor analysis, market positioning insights, and strategic advantages that give you the edge in your industry."
          />
        ) : (
          <div>Competitive Intelligence content would go here</div>
        )
      case 'financial-projections':
        return isLocked('financial-projections') ? (
          <LockedSection 
            title="Financial Projections"
            description="Access detailed revenue forecasts, ROI calculations, and financial modeling based on your directory opportunities."
          />
        ) : (
          <div>Financial Projections content would go here</div>
        )
      case 'action-plan':
        return isLocked('action-plan') ? (
          <LockedSection 
            title="Strategic Action Plan"
            description="Get a step-by-step implementation roadmap with timelines, priorities, and specific actions to maximize your directory success."
          />
        ) : (
          <div>Action Plan content would go here</div>
        )
      case 'appendices':
        return isLocked('appendices') ? (
          <LockedSection 
            title="Technical Appendices"
            description="Access detailed methodology, data sources, technical specifications, and additional research supporting this analysis."
          />
        ) : (
          <div>Appendices content would go here</div>
        )
      default:
        return <ExecutiveSummary />
    }
  }

  return (
    <div className="bg-secondary-900 min-h-screen print:bg-white print:text-black">
      <div ref={reportRef} className="max-w-7xl mx-auto">
        <ReportHeader />
        <SectionNavigation />
        
        <div className="p-8 print:p-6">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {renderSection()}
          </motion.div>
        </div>

        {/* Report Footer */}
        <div className="bg-secondary-800 border-t border-secondary-700 p-6 text-center text-secondary-400 print:bg-white print:border-gray-300 print:text-gray-600">
          <div className="text-sm">
            <div className="mb-2">
              This analysis was generated using DirectoryBolt's proprietary AI technology
            </div>
            <div>
              Report generated on {reportData.executiveSummary.analysisDate} • 
              Confidential and Proprietary
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}