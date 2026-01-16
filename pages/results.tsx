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
                <div className="flex gap-4 justify-center">
                  <Link
                    href="/analyze"
                    className="inline-block bg-volt-500 hover:bg-volt-600 text-secondary-900 font-bold py-3 px-6 rounded-xl transition-all duration-300"
                  >
                    Try Another Analysis
                  </Link>
                  <button
                    onClick={() => router.push('/pricing')}
                    className="inline-block border border-volt-500 text-volt-400 hover:bg-volt-500/10 font-bold py-3 px-6 rounded-xl transition-all duration-300"
                  >
                    Go Back
                  </button>
                </div>

// ... (in the upgrade prompt section)

                {/* Free Tier Upgrade Prompt */}
                {isFreeAnalysis && analysisData.upgradePrompts && (
                  <div className="mb-16 bg-gradient-to-r from-volt-500/20 via-secondary-800/50 to-secondary-800/50 border border-volt-500/40 rounded-2xl p-8 md:p-12">
                    <div className="max-w-3xl mx-auto">
                      <div className="text-center mb-8">
                        <div className="text-5xl mb-4 animate-bounce">🚀</div>
                        <h2 className="text-3xl font-black text-role-text-primary mb-4">
                          {analysisData.upgradePrompts.title}
                        </h2>
                        <p className="text-xl text-role-text-secondary mb-6">
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
                                  className="flex items-center gap-3 text-role-text-primary bg-white/10 rounded-lg p-3"
                                >
                                  <span className="text-volt-600 font-bold">✓</span>
                                  <span className="font-medium text-white">{benefit}</span>
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
                        <p className="text-role-text-secondary text-sm mt-4">
                          Get 5 additional directory recommendations and detailed submission insights
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Email Capture Section - Save Full Report */}
                <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-volt-500/30 p-8 mb-16">
                  <h2 className="text-2xl font-bold text-white mb-2 text-center">
                    Save Your Full Report
                  </h2>
                  <p className="text-secondary-200 text-center mb-6">
                    Enter your email to save this report and get access to additional insights
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement)?.value
                      if (email) {
                        // TODO: Implement email capture backend
                        alert('Thank you! We\'ll send your full report to: ' + email)
                      }
                    }}
                    className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
                  >
                    <input
                      type="email"
                      name="email"
                      placeholder="your@email.com"
                      required
                      className="flex-1 px-4 py-3 bg-secondary-900/50 border border-volt-500/30 text-white placeholder-secondary-400 rounded-lg focus:outline-none focus:border-volt-500 focus:ring-2 focus:ring-volt-500/20"
                    />
                    <button
                      type="submit"
                      className="bg-volt-500 hover:bg-volt-600 text-secondary-900 font-bold py-3 px-6 rounded-lg transition-all duration-300 whitespace-nowrap"
                    >
                      Get Report
                    </button>
                  </form>
                </div>

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
