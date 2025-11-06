'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/layout/Footer'
import { StartTrialButton } from '../components/CheckoutButton'
import type { BusinessIntelligenceResponse, DirectoryOpportunity } from '../lib/types/ai.types'

interface StoredAnalysisResult {
  url: string
  data: BusinessIntelligenceResponse
  timestamp: number
}

// Disable static generation to avoid NextRouter SSG errors
export async function getServerSideProps() {
  return {
    props: {}
  }
}

export default function ResultsPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [analysisData, setAnalysisData] = useState<BusinessIntelligenceResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    try {
      // Retrieve analysis data from sessionStorage
      const storedData = sessionStorage.getItem('analysisResults')

      if (storedData) {
        const parsed: StoredAnalysisResult = JSON.parse(storedData)
        setAnalysisData(parsed.data)
        setError('')
      } else {
        // Fallback: try to get URL from query params
        const { url } = router.query
        if (!url) {
          setError('No analysis data found. Please run an analysis first.')
          setLoading(false)
          setTimeout(() => {
            router.push('/analyze')
          }, 2000)
          return
        }
        setError('Analysis data expired. Please run the analysis again.')
      }
      setLoading(false)
    } catch (err) {
      setError('Failed to load analysis results. Please try again.')
      setLoading(false)
    }
  }, [mounted, router])

  if (!mounted || loading) {
    return (
      <>
        <Head>
          <title>Loading Results - DirectoryBolt</title>
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-bounce">⚡</div>
            <p className="text-secondary-200 text-lg">Loading your analysis results...</p>
          </div>
        </div>
      </>
    )
  }

  if (error || !analysisData) {
    return (
      <>
        <Head>
          <title>Error - DirectoryBolt</title>
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
          <Header showBackButton={true} />
          <div className="max-w-4xl mx-auto px-4 py-16">
            <div className="bg-danger-500/20 border border-danger-500/40 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-danger-200 mb-2">Oops!</h1>
              <p className="text-danger-100 mb-6">{error}</p>
              <div className="flex gap-4 justify-center">
                <Link
                  href="/analyze"
                  className="inline-block bg-volt-500 hover:bg-volt-600 text-secondary-900 font-bold py-3 px-6 rounded-xl transition-all duration-300"
                >
                  Try Another Analysis
                </Link>
                <button
                  onClick={() => router.back()}
                  className="inline-block border border-volt-500 text-volt-400 hover:bg-volt-500/10 font-bold py-3 px-6 rounded-xl transition-all duration-300"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </>
    )
  }

  const isFreeAnalysis = analysisData.tier === 'Free Analysis'
  const directoriesToShow = isFreeAnalysis ? analysisData.directoryOpportunities.slice(0, 5) : analysisData.directoryOpportunities

  return (
    <>
      <Head>
        <title>{`${analysisData.title} - Analysis Results`} | DirectoryBolt</title>
        <meta name="description" content={analysisData.description} />
        <meta name="robots" content="noindex, follow" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
        <Header showBackButton={true} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Hero Section */}
          <div className="text-center mb-16 animate-slide-up">
            <div className="inline-block mb-4 px-4 py-2 bg-volt-500/20 border border-volt-500/40 rounded-full">
              <span className="text-volt-400 font-bold text-sm">{analysisData.tier}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
              {analysisData.title}
            </h1>
            <p className="text-xl text-secondary-200 max-w-3xl mx-auto mb-8">
              {analysisData.description}
            </p>
            <div className="inline-block px-6 py-2 bg-secondary-800/50 border border-volt-500/30 rounded-lg">
              <p className="text-secondary-300">
                <span className="text-volt-400 font-bold">Website:</span> {analysisData.url}
              </p>
            </div>
          </div>

          {/* Core Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {/* Visibility Score */}
            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-volt-500/30 p-8 hover:border-volt-500/50 transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Visibility Score</h3>
                <span className="text-3xl">👁️</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-end gap-4">
                  <div className="text-5xl font-black text-volt-400">
                    {analysisData.visibility}
                  </div>
                  <span className="text-secondary-400 mb-2">/ 100</span>
                </div>
                <div className="w-full bg-secondary-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-volt-400 to-volt-600 h-3 rounded-full transition-all duration-1000"
                    style={{ width: `${analysisData.visibility}%` }}
                  />
                </div>
                <p className="text-sm text-secondary-300">
                  {analysisData.visibility >= 75
                    ? 'Excellent online visibility across directories'
                    : analysisData.visibility >= 50
                    ? 'Good visibility, room for improvement'
                    : 'Limited visibility - opportunity for growth'}
                </p>
              </div>
            </div>

            {/* SEO Score */}
            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-volt-500/30 p-8 hover:border-volt-500/50 transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">SEO Score</h3>
                <span className="text-3xl">🔍</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-end gap-4">
                  <div className="text-5xl font-black text-success-400">
                    {analysisData.seoScore}
                  </div>
                  <span className="text-secondary-400 mb-2">/ 100</span>
                </div>
                <div className="w-full bg-secondary-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-success-400 to-success-600 h-3 rounded-full transition-all duration-1000"
                    style={{ width: `${analysisData.seoScore}%` }}
                  />
                </div>
                <p className="text-sm text-secondary-300">
                  {analysisData.seoScore >= 75
                    ? 'Strong SEO foundation'
                    : analysisData.seoScore >= 50
                    ? 'Moderate SEO health'
                    : 'SEO optimization recommended'}
                </p>
              </div>
            </div>

            {/* Potential Leads */}
            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-volt-500/30 p-8 hover:border-volt-500/50 transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Potential Leads</h3>
                <span className="text-3xl">📊</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-end gap-2">
                  <div className="text-5xl font-black text-info-400">
                    {analysisData.potentialLeads}
                  </div>
                </div>
                <p className="text-sm text-secondary-300">
                  Estimated monthly leads from strategic directory placements
                </p>
                <div className="pt-4 border-t border-secondary-700">
                  <p className="text-xs text-secondary-400">
                    Based on directory authority and relevance to your industry
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Directory Opportunities Section */}
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-black text-white mb-2">
                  Directory Opportunities
                </h2>
                <p className="text-secondary-300">
                  {isFreeAnalysis
                    ? `Top 5 of ${analysisData.directoryOpportunities.length} recommended directories`
                    : `All ${analysisData.directoryOpportunities.length} recommended directories`}
                </p>
              </div>
              {isFreeAnalysis && (
                <div className="hidden sm:block px-4 py-2 bg-volt-500/20 border border-volt-500/40 rounded-lg">
                  <span className="text-volt-400 font-bold text-sm">Showing Free Preview</span>
                </div>
              )}
            </div>

            {directoriesToShow.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {directoriesToShow.map((opportunity: DirectoryOpportunity, index: number) => (
                  <div
                    key={index}
                    className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-volt-500/20 hover:border-volt-500/50 p-6 transition-all duration-300 hover:shadow-lg hover:shadow-volt-500/20"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-1">{opportunity.name}</h3>
                        <p className="text-sm text-secondary-400 mb-2">{opportunity.category}</p>
                      </div>
                      <div className="text-3xl">{getDifficultyEmoji(opportunity.submissionDifficulty)}</div>
                    </div>

                    <div className="space-y-4">
                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-secondary-900/50 rounded-lg p-3">
                          <p className="text-xs text-secondary-400 mb-1">Authority</p>
                          <p className="text-lg font-bold text-volt-400">{opportunity.authority}</p>
                        </div>
                        <div className="bg-secondary-900/50 rounded-lg p-3">
                          <p className="text-xs text-secondary-400 mb-1">Est. Traffic</p>
                          <p className="text-lg font-bold text-info-400">
                            {formatTraffic(opportunity.estimatedTraffic)}
                          </p>
                        </div>
                      </div>

                      {/* Success Probability */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm text-secondary-300">Success Probability</p>
                          <span className="font-bold text-success-400">{opportunity.successProbability}%</span>
                        </div>
                        <div className="w-full bg-secondary-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              opportunity.successProbability >= 75
                                ? 'bg-success-500'
                                : opportunity.successProbability >= 50
                                ? 'bg-warning-500'
                                : 'bg-danger-500'
                            }`}
                            style={{ width: `${opportunity.successProbability}%` }}
                          />
                        </div>
                      </div>

                      {/* Key Details */}
                      <div className="border-t border-secondary-700 pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-secondary-400">Difficulty:</span>
                          <span className="text-white font-semibold">{opportunity.submissionDifficulty}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-secondary-400">Cost:</span>
                          <span className="text-white font-semibold">
                            {opportunity.cost === 0 ? 'Free' : `$${opportunity.cost}`}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-secondary-400">Approval Time:</span>
                          <span className="text-white font-semibold">{opportunity.estimatedTimeToApproval}</span>
                        </div>
                      </div>

                      {/* Reasoning */}
                      <p className="text-sm text-secondary-300 bg-volt-500/10 border border-volt-500/20 rounded-lg p-3">
                        {opportunity.reasoning}
                      </p>

                      {/* Benefits */}
                      {opportunity.benefits && opportunity.benefits.length > 0 && (
                        <div>
                          <p className="text-xs text-secondary-400 font-semibold mb-2">Key Benefits:</p>
                          <ul className="space-y-1">
                            {opportunity.benefits.slice(0, 2).map((benefit, i) => (
                              <li key={i} className="text-xs text-secondary-300 flex items-start gap-2">
                                <span className="text-volt-400 mt-1">✓</span>
                                <span>{benefit}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-secondary-800/50 rounded-2xl border border-volt-500/20 p-12 text-center">
                <p className="text-secondary-300 text-lg">No directory opportunities found for this analysis.</p>
              </div>
            )}
          </div>

          {/* Free Tier Upgrade Prompt */}
          {isFreeAnalysis && analysisData.upgradePrompts && (
            <div className="mb-16 bg-gradient-to-r from-volt-500/20 via-secondary-800/50 to-secondary-800/50 border border-volt-500/40 rounded-2xl p-8 md:p-12">
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                  <div className="text-5xl mb-4 animate-bounce">🚀</div>
                  <h2 className="text-3xl font-black text-white mb-4">
                    {analysisData.upgradePrompts.title}
                  </h2>
                  <p className="text-xl text-secondary-200 mb-6">
                    {analysisData.upgradePrompts.description}
                  </p>
                </div>

                {/* Benefits List */}
                {analysisData.upgradePrompts.benefits &&
                  analysisData.upgradePrompts.benefits.length > 0 && (
                    <div className="mb-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analysisData.upgradePrompts.benefits.map((benefit: string, index: number) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 text-white bg-secondary-900/50 rounded-lg p-3"
                          >
                            <span className="text-volt-400 font-bold">✓</span>
                            <span className="font-medium">{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* CTA Button */}
                <div className="text-center">
                  <StartTrialButton plan="growth" size="lg" className="px-12">
                    Unlock Full Analysis
                  </StartTrialButton>
                  <p className="text-secondary-300 text-sm mt-4">
                    Get 5 additional directory recommendations and detailed submission insights
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Additional CTA Section */}
          {!isFreeAnalysis && (
            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-volt-500/30 p-8 text-center mb-16">
              <h2 className="text-2xl font-bold text-white mb-4">
                Ready to Boost Your Online Visibility?
              </h2>
              <p className="text-secondary-200 mb-6">
                Leverage these directory opportunities with our automated submission system
              </p>
              <Link
                href="/pricing"
                className="inline-block bg-volt-500 hover:bg-volt-600 text-secondary-900 font-bold py-3 px-8 rounded-xl transition-all duration-300"
              >
                View Submission Plans
              </Link>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Link
              href="/analyze"
              className="bg-secondary-800/50 hover:bg-secondary-800 border border-volt-500/30 hover:border-volt-500/50 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 text-center"
            >
              Analyze Another Website
            </Link>
            <Link
              href="/pricing"
              className="bg-secondary-800/50 hover:bg-secondary-800 border border-volt-500/30 hover:border-volt-500/50 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 text-center"
            >
              View Pricing Plans
            </Link>
            <Link
              href="/"
              className="bg-volt-500 hover:bg-volt-600 text-secondary-900 font-bold py-4 px-6 rounded-xl transition-all duration-300 text-center"
            >
              Back to Home
            </Link>
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}

// Helper function to get emoji based on difficulty
function getDifficultyEmoji(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return '🟢'
    case 'medium':
      return '🟡'
    case 'hard':
      return '🔴'
    default:
      return '⭐'
  }
}

// Helper function to format traffic numbers
function formatTraffic(traffic: number): string {
  if (traffic >= 1000000) {
    return `${(traffic / 1000000).toFixed(1)}M`
  }
  if (traffic >= 1000) {
    return `${(traffic / 1000).toFixed(1)}K`
  }
  return traffic.toString()
}
