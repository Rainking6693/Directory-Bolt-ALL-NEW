import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '../components/Header'
import { StartTrialButton } from '../components/CheckoutButton'

interface AnalysisProgress {
  step: number
  total: number
  message: string
  completed: boolean
}

// Disable static generation to avoid NextRouter SSG errors
export async function getServerSideProps() {
  return {
    props: {}
  }
}

export default function AnalyzePage() {
  const [url, setUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState<AnalysisProgress>({
    step: 0,
    total: 5,
    message: '',
    completed: false
  })
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  const analysisSteps = [
    'Fetching website content...',
    'Analyzing business profile...',
    'AI-powered industry categorization...',
    'Finding optimal directories...',
    'Generating recommendations...'
  ]

  const validateUrl = (inputUrl: string): boolean => {
    try {
      const url = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  const simulateProgress = async () => {
    for (let i = 0; i < analysisSteps.length; i++) {
      setProgress({
        step: i + 1,
        total: analysisSteps.length,
        message: analysisSteps[i],
        completed: false
      })
      // Realistic timing for each step
      const delays = [2000, 3000, 2500, 2000, 1500]
      await new Promise(resolve => setTimeout(resolve, delays[i]))
    }
    
    setProgress(prev => ({ ...prev, completed: true, message: 'Analysis complete!' }))
    
    // Redirect to results after brief delay
    setTimeout(() => {
      if (mounted) {
        router.push(`/results?url=${encodeURIComponent(url)}`)
      }
    }, 1000)
  }

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Enhanced validation
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setError('Please enter a website URL')
      return
    }

    if (!validateUrl(trimmedUrl)) {
      setError('Please enter a valid website URL (e.g., https://example.com or example.com)')
      return
    }

    setIsAnalyzing(true)
    
    try {
      // Start API call and progress simulation in parallel
      const [analysisResult] = await Promise.all([
        // Real API call
        fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            url: trimmedUrl,
            tier: 'free'
          }),
        }).then(async response => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
          }
          return response.json()
        }),
        // Visual progress simulation
        simulateProgress()
      ])

      // Store analysis results in sessionStorage for the results page
      if (analysisResult && analysisResult.success && analysisResult.data) {
        sessionStorage.setItem('analysisResults', JSON.stringify({
          url: trimmedUrl,
          data: analysisResult.data,
          timestamp: Date.now()
        }))
        // Analysis successful - progress will complete and redirect
      } else {
        // Handle API error response
        const errorMsg = analysisResult?.error || 'Analysis failed. Please try again.'
        throw new Error(errorMsg)
      }

    } catch (err) {
      // Simple error handling - just show the error message
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed. Please try again.'
      setError(errorMessage)
      
      setIsAnalyzing(false)
      setProgress({ step: 0, total: 5, message: '', completed: false })
    }
  }

  // Don't show loading state - render the form immediately for SSR
  // The mounted state is only used to prevent router.push during SSR

  return (
    <>
      <Head>
        <title>Free Website Analysis - DirectoryBolt | AI-Powered Directory Recommendations</title>
        <meta name="description" content="Get AI-powered directory recommendations for your website. Analyze your business profile and discover the best directories for maximum visibility. Free analysis in 30 seconds." />
        <meta name="robots" content="index, follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="canonical" href="https://directoryboltpython.netlify.app/analyze" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900 relative overflow-hidden">
        <Header showBackButton={true} />

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-16">
          {!isAnalyzing ? (
            // Analysis Form
            <div className="text-center animate-slide-up">
              <h1 className="text-4xl md:text-6xl font-black text-white mb-6">
                Analyze Your Website
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600 animate-glow">
                  For FREE
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-secondary-200 mb-12 max-w-3xl mx-auto font-medium">
                Get AI-powered recommendations for the best directories to <span className="text-volt-400 font-bold">boost your online visibility</span>
              </p>

              <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-volt-500/30 p-8 max-w-2xl mx-auto shadow-2xl hover:shadow-volt-500/20 transition-all duration-500">
                <form onSubmit={handleAnalyze} className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-volt-400 mb-6 text-center">
                      Enter Your Website Details
                    </h2>
                    <label htmlFor="url" className="block text-left text-lg font-bold text-volt-400 mb-3">
                      🌐 Website URL
                    </label>
                    <input
                      type="text"
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://your-website.com"
                      className="w-full px-6 py-4 text-lg bg-secondary-900/70 border border-volt-500/30 rounded-xl text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-volt-400/70 focus:border-volt-400 transition-all hover:border-volt-500/50"
                      disabled={isAnalyzing}
                    />
                  </div>

                  {error && (
                    <div className="bg-danger-500/20 border border-danger-500/40 rounded-xl p-4 text-danger-200 animate-shake">
                      <span className="font-bold">⚠️ {error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isAnalyzing}
                    className="group relative w-full bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black py-4 px-8 text-xl rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none shadow-2xl hover:shadow-volt-500/50 animate-glow"
                  >
                    <span className="relative z-10">🚀 Analyze Website</span>
                  </button>
                </form>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-secondary-300">
                  <div className="flex flex-col items-center p-3 bg-secondary-900/30 rounded-lg border border-volt-500/20">
                    <span className="text-volt-400 text-xl mb-1">🤖</span>
                    <span className="font-bold text-volt-400">AI-Powered</span>
                    <span className="text-xs">Advanced Analysis</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-secondary-900/30 rounded-lg border border-volt-500/20">
                    <span className="text-volt-400 text-xl mb-1">⚡</span>
                    <span className="font-bold text-volt-400">30-Second</span>
                    <span className="text-xs">Quick Results</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-secondary-900/30 rounded-lg border border-volt-500/20">
                    <span className="text-volt-400 text-xl mb-1">🎯</span>
                    <span className="font-bold text-volt-400">Personalized</span>
                    <span className="text-xs">Custom Recommendations</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Progress Indicator
            <div className="text-center animate-fade-in">
              <h1 className="text-4xl md:text-6xl font-black text-white mb-6">
                <span className="animate-glow">🤖</span> Analyzing Your Website
              </h1>
              <p className="text-xl md:text-2xl text-secondary-200 mb-12 max-w-3xl mx-auto font-medium">
                Our AI is working hard to find the <span className="text-volt-400 font-bold">perfect directories</span> for your business
              </p>

              <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-volt-500/30 p-8 max-w-2xl mx-auto shadow-2xl">
                <h2 className="text-2xl font-bold text-volt-400 mb-6 text-center">
                  Analysis Progress
                </h2>
                <div className="mb-8">
                  <div className="flex justify-between text-sm text-secondary-300 mb-3">
                    <span className="font-bold">Progress</span>
                    <span className="font-bold text-volt-400">{progress.step}/{progress.total} ({Math.round((progress.step / progress.total) * 100)}%)</span>
                  </div>
                  <div className="relative w-full bg-secondary-700 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-volt-500 to-volt-600 h-4 rounded-full transition-all duration-1000 ease-out relative animate-glow"
                      style={{ width: `${(progress.step / progress.total) * 100}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                    </div>
                  </div>
                </div>

                <div className="text-center mb-8 p-4 bg-volt-500/10 rounded-xl border border-volt-500/20">
                  <div className="text-4xl mb-3 animate-bounce">
                    {progress.completed ? '🎉' : '⚡'}
                  </div>
                  <p className="text-lg text-white font-bold animate-pulse">
                    {progress.message || 'Initializing analysis...'}
                  </p>
                </div>

                <div className="space-y-3">
                  {analysisSteps.map((step, index) => (
                    <div
                      key={index}
                      className={`flex items-center space-x-3 p-4 rounded-xl border transition-all duration-500 ${
                        index < progress.step
                          ? 'bg-success-500/20 border-success-500/40 text-success-200'
                          : index === progress.step - 1
                          ? 'bg-volt-500/20 border-volt-500/40 text-volt-200 animate-pulse'
                          : 'bg-secondary-800/30 border-secondary-600/30 text-secondary-500'
                      }`}
                    >
                      <div className="w-8 h-8 flex items-center justify-center">
                        {index < progress.step ? (
                          <span className="text-success-400 text-xl">✅</span>
                        ) : index === progress.step - 1 ? (
                          <div className="w-5 h-5 border-3 border-volt-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="text-secondary-600 text-lg">⏳</span>
                        )}
                      </div>
                      <span className="font-medium">{step}</span>
                    </div>
                  ))}
                </div>

                {progress.completed && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-success-500/20 to-volt-500/20 border border-success-500/30 rounded-xl text-success-200">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-2xl animate-bounce">🚀</span>
                      <p className="font-bold">Analysis complete! Redirecting to results...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

