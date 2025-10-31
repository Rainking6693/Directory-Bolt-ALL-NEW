// 📊 ENHANCED ANALYSIS RESULTS COMPONENT
// Complete business intelligence dashboard with AI insights

// Note: This component is dynamically imported to reduce initial bundle size.
// See components/analysis/EnhancedAnalysisResults.dynamic.tsx for wrapper.
'use client'
import { useState, useEffect } from 'react'
import CheckoutButton from '../CheckoutButton'
import type { BusinessIntelligenceResponse, AIInsights, DirectoryOpportunity } from '../../lib/types/ai.types'

interface EnhancedAnalysisResultsProps {
  results?: BusinessIntelligenceResponse
  data?: any
  onExportPDF?: () => void
  onExportCSV?: () => void
  onUpgrade?: () => void
  onExport?: (format: 'csv' | 'pdf') => void
}

export function EnhancedAnalysisResults({ 
  results, 
  data,
  onExportPDF, 
  onExportCSV,
  onUpgrade,
  onExport
}: EnhancedAnalysisResultsProps) {
  // Use either results or data prop
  const analysisData = results || data
  const [activeTab, setActiveTab] = useState<'overview' | 'competitive' | 'seo' | 'market' | 'revenue'>('overview')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const isFreeTier = analysisData?.tier === 'Free Analysis' || analysisData?.tier === 'free'
  const hasAIAnalysis = analysisData?.aiAnalysis && !isFreeTier

  // Success URL for checkout
  const getSuccessUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}&plan=growth&source=analysis`
    }
    return '/success'
  }

  const getCancelUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/pricing?cancelled=true&plan=growth&source=analysis`
    }
    return '/pricing'
  }

  return (
    <div className="min-h-screen bg-secondary-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-secondary-800 to-secondary-900 border-b border-secondary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <h1 className="text-3xl lg:text-4xl font-black text-white mb-2">
                {hasAIAnalysis ? '🤖 AI Business Intelligence Report' : '📊 Website Analysis Results'}
              </h1>
              <p className="text-lg text-secondary-300 mb-4">
                {hasAIAnalysis 
                  ? `Complete AI analysis for ${analysisData?.title || analysisData?.businessProfile?.name || 'Your Business'}` 
                  : `Basic analysis for ${analysisData?.title || analysisData?.businessProfile?.name || 'Your Business'} - Upgrade for full AI insights`
                }
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span className="bg-volt-500/20 text-volt-300 px-3 py-1 rounded-full font-semibold">
                  {analysisData?.tier || 'Free'}
                </span>
                <span className="text-secondary-400">
                  Generated: {new Date(analysisData?.timestamp || Date.now()).toLocaleDateString()}
                </span>
                {analysisData?.usage && (
                  <span className="text-secondary-400">
                    Processing: {analysisData?.usage?.processingTime}ms
                  </span>
                )}
              </div>
            </div>
            
            {/* Export Actions */}
            <div className="mt-6 lg:mt-0 flex flex-col sm:flex-row gap-3">
              {onExportPDF && (
                <button
                  onClick={onExportPDF}
                  className="bg-secondary-700 hover:bg-secondary-600 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 flex items-center gap-2"
                >
                  📄 Export PDF
                </button>
              )}
              {onExportCSV && (
                <button
                  onClick={onExportCSV}
                  className="bg-secondary-700 hover:bg-secondary-600 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 flex items-center gap-2"
                >
                  📊 Export CSV
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Free Tier Upgrade Banner */}
      {isFreeTier && (
        <div className="bg-gradient-to-r from-volt-500/20 to-volt-600/10 border-b border-volt-500/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-volt-400 mb-2">
                  🔓 You're Seeing Limited Results
                </h3>
                <p className="text-secondary-200 mb-4 lg:mb-0">
                  Upgrade to unlock the complete $4,300 worth of AI business intelligence, 
                  competitive analysis, and revenue projections.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <CheckoutButton
                  plan="growth"
                  className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-6 py-3 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300"
                  successUrl={getSuccessUrl()}
                  cancelUrl={getCancelUrl()}
                >
                  🚀 Unlock Full Analysis - $299
                </CheckoutButton>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="border-2 border-volt-500 text-volt-500 font-semibold px-6 py-3 rounded-xl hover:bg-volt-500 hover:text-secondary-900 transition-all duration-300"
                >
                  See What You're Missing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-secondary-800 border-b border-secondary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'overview', label: '📊 Overview', available: true },
              { id: 'competitive', label: '🏆 Competitive', available: hasAIAnalysis },
              { id: 'seo', label: '🔍 SEO Analysis', available: hasAIAnalysis },
              { id: 'market', label: '📈 Market Insights', available: hasAIAnalysis },
              { id: 'revenue', label: '💰 Revenue Impact', available: hasAIAnalysis }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.available && setActiveTab(tab.id as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'border-volt-500 text-volt-400'
                    : tab.available
                    ? 'border-transparent text-secondary-300 hover:text-secondary-200 hover:border-secondary-300'
                    : 'border-transparent text-secondary-500 cursor-not-allowed opacity-50'
                }`}
                disabled={!tab.available}
              >
                {tab.label}
                {!tab.available && (
                  <span className="ml-2 text-xs bg-volt-500/20 text-volt-400 px-2 py-1 rounded-full">
                    PRO
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <OverviewTab results={analysisData} isFreeTier={isFreeTier} />
        )}
        
        {activeTab === 'competitive' && hasAIAnalysis && analysisData?.aiAnalysis && (
          <CompetitiveTab analysis={analysisData.aiAnalysis.competitiveAnalysis} />
        )}
        
        {activeTab === 'seo' && hasAIAnalysis && analysisData?.aiAnalysis && (
          <SEOTab analysis={analysisData.aiAnalysis.seoAnalysis} />
        )}
        
        {activeTab === 'market' && hasAIAnalysis && analysisData?.aiAnalysis && (
          <MarketTab insights={analysisData.aiAnalysis.marketInsights} />
        )}
        
        {activeTab === 'revenue' && hasAIAnalysis && analysisData?.aiAnalysis && (
          <RevenueTab projections={analysisData.aiAnalysis.revenueProjections} />
        )}
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradeModal 
          onClose={() => setShowUpgradeModal(false)}
          upgradePrompts={analysisData?.upgradePrompts}
        />
      )}
    </div>
  )
}

// Overview Tab Component
function OverviewTab({ results, isFreeTier }: { results: BusinessIntelligenceResponse, isFreeTier: boolean }) {
  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">
          📊 Key Performance Metrics
          {isFreeTier && <span className="text-volt-400 text-lg ml-2">(Limited Preview)</span>}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <MetricCard
            title="Visibility Score"
            value={`${results.visibility}%`}
            description="Current online presence"
            color="volt"
            locked={isFreeTier}
          />
          <MetricCard
            title="SEO Score"
            value={`${results.seoScore}%`}
            description="Search optimization level"
            color="success"
            locked={isFreeTier}
          />
          <MetricCard
            title="Potential Leads"
            value={results.potentialLeads.toLocaleString()}
            description="Monthly lead potential"
            color="volt"
            locked={isFreeTier}
          />
          <MetricCard
            title="Directory Opportunities"
            value={results.directoryOpportunities.length.toString()}
            description={isFreeTier ? "Preview of 500+" : "Total opportunities"}
            color="volt"
            locked={false}
          />
        </div>
      </div>

      {/* Business Profile */}
      {results.aiAnalysis?.businessProfile && (
        <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6">
          <h3 className="text-xl font-bold text-volt-400 mb-4">🎯 AI Business Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <span className="text-secondary-400 text-sm">Industry:</span>
              <div className="text-white font-semibold">{results.aiAnalysis.businessProfile.industry}</div>
            </div>
            <div>
              <span className="text-secondary-400 text-sm">Category:</span>
              <div className="text-white font-semibold">{results.aiAnalysis.businessProfile.category}</div>
            </div>
            <div>
              <span className="text-secondary-400 text-sm">Business Model:</span>
              <div className="text-white font-semibold">{results.aiAnalysis.businessProfile.businessModel}</div>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-secondary-400 text-sm">Description:</span>
            <div className="text-white mt-1">{results.aiAnalysis.businessProfile.description}</div>
          </div>
        </div>
      )}

      {/* Directory Opportunities */}
      <div>
        <h3 className="text-xl font-bold text-white mb-6">
          🎯 Directory Opportunities
          {isFreeTier && (
            <span className="text-sm font-normal text-volt-400 block mt-1">
              Showing {results.directoryOpportunities.length} of 500+ available
            </span>
          )}
        </h3>
        <div className="space-y-4">
          {results.directoryOpportunities.slice(0, isFreeTier ? 5 : 10).map((directory, index) => (
            <DirectoryCard key={index} directory={directory} isPreview={isFreeTier} />
          ))}
        </div>
        
        {isFreeTier && (
          <div className="mt-6 text-center">
            <div className="bg-gradient-to-r from-volt-500/10 to-volt-600/10 border border-volt-500/30 rounded-xl p-6">
              <h4 className="text-lg font-bold text-volt-400 mb-2">
                + {500 - results.directoryOpportunities.length} More Premium Opportunities
              </h4>
              <p className="text-secondary-300 mb-4">
                Unlock access to 500+ high-authority directories with AI-optimized success probabilities
              </p>
              <CheckoutButton
                plan="growth"
                className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-6 py-3 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300"
                successUrl="/success?session_id={CHECKOUT_SESSION_ID}&plan=growth&source=directory-preview"
                cancelUrl="/pricing?cancelled=true&plan=growth&source=directory-preview"
              >
                🚀 Unlock All Directories - $299
              </CheckoutButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Metric Card Component
function MetricCard({ 
  title, 
  value, 
  description, 
  color, 
  locked 
}: { 
  title: string
  value: string
  description: string
  color: 'volt' | 'success' | 'danger'
  locked: boolean
}) {
  const colorClasses = {
    volt: 'border-volt-500/30 text-volt-400',
    success: 'border-success-500/30 text-success-400',
    danger: 'border-danger-500/30 text-danger-400'
  }

  return (
    <div className={`bg-secondary-800/50 rounded-xl border ${colorClasses[color]} p-6 text-center relative`}>
      {locked && (
        <div className="absolute inset-0 bg-secondary-900/80 rounded-xl flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl mb-2">🔒</div>
            <div className="text-sm text-volt-400 font-semibold">Upgrade to Unlock</div>
          </div>
        </div>
      )}
      <div className={`text-3xl font-black ${colorClasses[color]} mb-2`}>
        {locked ? '••' : value}
      </div>
      <div className="text-sm text-secondary-300 font-medium">{title}</div>
      <div className="text-xs text-secondary-400 mt-1">{description}</div>
    </div>
  )
}

// Directory Card Component
function DirectoryCard({ 
  directory, 
  isPreview 
}: { 
  directory: DirectoryOpportunity
  isPreview: boolean
}) {
  return (
    <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h4 className="text-lg font-bold text-white">{directory.name}</h4>
            <span className="px-2 py-1 bg-success-500/20 text-success-300 rounded-full text-xs font-bold">
              {directory.submissionDifficulty}
            </span>
            <span className="px-2 py-1 bg-volt-500/20 text-volt-300 rounded-full text-xs font-bold">
              DA {directory.authority}
            </span>
            {directory.cost === 0 && (
              <span className="px-2 py-1 bg-secondary-700/50 text-secondary-300 rounded-full text-xs font-bold">
                FREE
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div className="bg-secondary-900/30 rounded-lg p-3">
              <span className="text-xs text-secondary-400">Monthly Traffic:</span>
              <div className="text-white font-semibold">
                {isPreview ? '•••' : directory.estimatedTraffic.toLocaleString()}
              </div>
            </div>
            <div className="bg-secondary-900/30 rounded-lg p-3">
              <span className="text-xs text-secondary-400">Success Rate:</span>
              <div className="text-success-400 font-semibold">
                {isPreview ? '••%' : `${directory.successProbability}%`}
              </div>
            </div>
            <div className="bg-secondary-900/30 rounded-lg p-3">
              <span className="text-xs text-secondary-400">Authority:</span>
              <div className="text-volt-400 font-semibold">{directory.authority}/100</div>
            </div>
          </div>
          
          {!isPreview && directory.reasoning && (
            <div className="bg-gradient-to-r from-volt-500/10 to-volt-600/10 rounded-lg p-3 border border-volt-500/20">
              <h5 className="text-sm font-bold text-volt-400 mb-1">🤖 AI Insight:</h5>
              <p className="text-sm text-secondary-200">{directory.reasoning}</p>
            </div>
          )}
          
          {isPreview && (
            <div className="bg-secondary-900/50 rounded-lg p-3 border border-volt-500/20">
              <div className="flex items-center gap-2">
                <span className="text-volt-400">🔒</span>
                <span className="text-sm text-volt-400 font-semibold">
                  AI insights available in full version
                </span>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-center gap-2 lg:w-32">
          <div className="w-12 h-12 rounded-full bg-success-500/20 text-success-400 border border-success-500/30 flex items-center justify-center text-xl">
            🎯
          </div>
          <span className="text-success-400 font-bold text-sm text-center">
            {isPreview ? 'PREVIEW' : 'HIGH PRIORITY'}
          </span>
        </div>
      </div>
    </div>
  )
}

// Placeholder components for other tabs
function CompetitiveTab({ analysis }: { analysis: any }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">🏆 Competitive Analysis</h2>
      <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6">
        <p className="text-secondary-300">Competitive analysis content will be displayed here.</p>
      </div>
    </div>
  )
}

function SEOTab({ analysis }: { analysis: any }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">🔍 SEO Analysis</h2>
      <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6">
        <p className="text-secondary-300">SEO analysis content will be displayed here.</p>
      </div>
    </div>
  )
}

function MarketTab({ insights }: { insights: any }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">📈 Market Insights</h2>
      <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6">
        <p className="text-secondary-300">Market insights content will be displayed here.</p>
      </div>
    </div>
  )
}

function RevenueTab({ projections }: { projections: any }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">💰 Revenue Projections</h2>
      <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-6">
        <p className="text-secondary-300">Revenue projections content will be displayed here.</p>
      </div>
    </div>
  )
}

// Upgrade Modal Component
function UpgradeModal({ 
  onClose, 
  upgradePrompts 
}: { 
  onClose: () => void
  upgradePrompts?: any
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-secondary-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-volt-500/30">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-2xl font-bold text-white">🚀 Unlock Complete AI Analysis</h3>
            <button
              onClick={onClose}
              className="text-secondary-400 hover:text-secondary-200 p-2"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-4">
            <p className="text-secondary-300">
              You're currently seeing a limited preview. Upgrade to unlock the complete 
              $4,300 worth of AI business intelligence.
            </p>
            
            {upgradePrompts?.benefits && (
              <ul className="space-y-2">
                {upgradePrompts.benefits.map((benefit: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-success-400 mt-1">✓</span>
                    <span className="text-secondary-200">{benefit}</span>
                  </li>
                ))}
              </ul>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <CheckoutButton
                plan="growth"
                className="flex-1 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-3 px-6 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 text-center"
                successUrl="/success?session_id={CHECKOUT_SESSION_ID}&plan=growth&source=upgrade-modal"
                cancelUrl="/pricing?cancelled=true&plan=growth&source=upgrade-modal"
              >
                🚀 Upgrade Now - $299
              </CheckoutButton>
              <button
                onClick={onClose}
                className="flex-1 border-2 border-secondary-600 text-secondary-300 font-semibold py-3 px-6 rounded-xl hover:bg-secondary-700 transition-all duration-300"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnhancedAnalysisResults