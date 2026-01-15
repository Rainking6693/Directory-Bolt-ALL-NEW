import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '../components/Header.v2'
import { Button } from '../redesign-v2/components/ui/Button'
import { Card } from '../redesign-v2/components/ui/Card'
import { ProgressStepper } from '../redesign-v2/components/proof/ProgressStepper'

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
    { id: '1', label: 'Fetching', completed: false, active: false },
    { id: '2', label: 'Analyzing', completed: false, active: false },
    { id: '3', label: 'Categorizing', completed: false, active: false },
    { id: '4', label: 'Finding', completed: false, active: false },
    { id: '5', label: 'Generating', completed: false, active: false },
  ]

  const stepMessages = [
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
    for (let i = 0; i < stepMessages.length; i++) {
      setProgress({
        step: i + 1,
        total: stepMessages.length,
        message: stepMessages[i],
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

  // Create progress steps for stepper
  const progressSteps = analysisSteps.map((step, index) => ({
    id: step.id,
    label: step.label,
    completed: index < progress.step,
    active: index === progress.step - 1 && !progress.completed,
  }))

  return (
    <>
      <Head>
        <title>Free Website Analysis - DirectoryBolt | AI-Powered Directory Recommendations</title>
        <meta name="description" content="Get AI-powered directory recommendations for your website. Analyze your business profile and discover the best directories for maximum visibility. Free analysis in 30 seconds." />
        <meta name="robots" content="index, follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="canonical" href="https://directorybolt.com/analyze" />
      </Head>

      <div className="min-h-screen bg-role-bg-primary">
        <Header showBackButton={true} />

        <div className="max-w-4xl mx-auto px-4 py-16">
          {!isAnalyzing ? (
            // Analysis Form
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-role-text-primary mb-6 leading-tight tracking-tight">
                Analyze Your Website
              </h1>
              <p className="text-xl md:text-2xl text-role-text-secondary mb-12 max-w-3xl mx-auto">
                Get AI-powered recommendations for the best directories to boost your online visibility
              </p>

              <Card variant="artifact" className="max-w-2xl mx-auto">
                <form onSubmit={handleAnalyze} className="space-y-6">
                  <div>
                    <label htmlFor="url" className="block text-left text-sm font-medium text-role-text-primary mb-2">
                      Website URL
                    </label>
                    <input
                      type="text"
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://your-website.com"
                      className="w-full px-4 py-3 border border-role-border-default rounded-md focus:outline-none focus:ring-3 focus:ring-volt-500 focus:ring-offset-2 focus:border-volt-500 text-role-text-primary bg-role-bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isAnalyzing}
                    />
                  </div>

                  {error && (
                    <div className="bg-error-50 border border-error-500 rounded-md p-4 text-error-700">
                      <span className="font-medium">{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isAnalyzing}
                    className="w-full"
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Generate Free Report'}
                  </Button>
                </form>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="flex flex-col items-center p-3">
                    <span className="font-semibold text-role-text-primary mb-1">AI-Powered</span>
                    <span className="text-role-text-tertiary text-xs">Advanced Analysis</span>
                  </div>
                  <div className="flex flex-col items-center p-3">
                    <span className="font-semibold text-role-text-primary mb-1">30-Second</span>
                    <span className="text-role-text-tertiary text-xs">Quick Results</span>
                  </div>
                  <div className="flex flex-col items-center p-3">
                    <span className="font-semibold text-role-text-primary mb-1">Personalized</span>
                    <span className="text-role-text-tertiary text-xs">Custom Recommendations</span>
                  </div>
                </div>
              </Card>

              {/* Proof Snippet - First Page Preview */}
              <div className="mt-12 text-center">
                <Card variant="subtle" className="max-w-md mx-auto">
                  <div className="aspect-[4/3] bg-neutral-100 rounded-artifactSm mb-4 flex items-center justify-center">
                    <span className="text-role-text-muted text-xs font-mono">[FIRST PAGE PREVIEW]</span>
                  </div>
                  <p className="text-role-text-secondary text-sm">
                    Preview of your free analysis first page
                  </p>
                </Card>
              </div>
            </div>
          ) : (
            // Progress Indicator
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-role-text-primary mb-6 leading-tight tracking-tight">
                Analyzing Your Website
              </h1>
              <p className="text-xl md:text-2xl text-role-text-secondary mb-12 max-w-3xl mx-auto">
                Our AI is working to find the perfect directories for your business
              </p>

              <Card variant="artifact" className="max-w-2xl mx-auto mb-8">
                <h2 className="text-2xl font-bold text-role-text-primary mb-6 text-center">
                  Analysis Progress
                </h2>
                <ProgressStepper steps={progressSteps} />
                <div className="mt-8 text-center">
                  <p className="text-role-text-secondary font-medium">
                    {progress.message || 'Initializing analysis...'}
                  </p>
                </div>
              </Card>

              {progress.completed && (
                <Card variant="subtle" className="max-w-md mx-auto bg-success-50 border-success-500">
                  <p className="text-success-700 font-semibold">Analysis complete! Redirecting to results...</p>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
