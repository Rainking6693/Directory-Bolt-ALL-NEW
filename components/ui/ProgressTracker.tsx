'use client'
import { useEffect, useState } from 'react'

interface ProgressStep {
  id: string
  name: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress?: number
  duration?: number
  error?: string
}

interface ProgressTrackerProps {
  requestId: string
  steps: ProgressStep[]
  onComplete?: (data: any) => void
  onError?: (error: any) => void
  pollInterval?: number
  timeout?: number
  className?: string
}

export function ProgressTracker({
  requestId,
  steps: initialSteps,
  onComplete,
  onError,
  pollInterval = 2000,
  timeout = 120000, // 2 minutes
  className = ''
}: ProgressTrackerProps) {
  const [steps, setSteps] = useState<ProgressStep[]>(initialSteps)
  const [isComplete, setIsComplete] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null)

  useEffect(() => {
    let pollTimer: NodeJS.Timeout
    let elapsedTimer: NodeJS.Timeout
    let timeoutTimer: NodeJS.Timeout

    const pollProgress = async () => {
      try {
        const response = await fetch(`/api/analyze/progress?requestId=${requestId}`)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        
        if (data.success) {
          const progressData = data.data
          
          // Update steps based on server response
          setSteps(currentSteps => 
            currentSteps.map(step => {
              const serverStep = progressData.steps.find((s: any) => s.id === step.id)
              return serverStep ? { ...step, ...serverStep } : step
            })
          )

          // Check if complete
          if (progressData.status === 'completed') {
            setIsComplete(true)
            clearInterval(pollTimer)
            clearInterval(elapsedTimer)
            clearTimeout(timeoutTimer)
            onComplete?.(progressData.result)
          } else if (progressData.status === 'failed') {
            setHasError(true)
            clearInterval(pollTimer)
            clearInterval(elapsedTimer)
            clearTimeout(timeoutTimer)
            onError?.(progressData.error)
          } else {
            // Update estimated time remaining
            if (progressData.estimatedTimeRemaining) {
              setEstimatedTimeRemaining(progressData.estimatedTimeRemaining)
            }
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error)
        // Continue polling on error - might be temporary network issue
      }
    }

    // Start polling
    pollTimer = setInterval(pollProgress, pollInterval)
    
    // Start elapsed time counter
    elapsedTimer = setInterval(() => {
      setTimeElapsed(prev => prev + 1)
    }, 1000)

    // Set timeout
    timeoutTimer = setTimeout(() => {
      setHasError(true)
      clearInterval(pollTimer)
      clearInterval(elapsedTimer)
      onError?.(new Error('Analysis timeout - please try again'))
    }, timeout)

    // Initial poll
    pollProgress()

    return () => {
      clearInterval(pollTimer)
      clearInterval(elapsedTimer)
      clearTimeout(timeoutTimer)
    }
  }, [requestId, pollInterval, timeout, onComplete, onError])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  const getOverallProgress = () => {
    const completedSteps = steps.filter(step => step.status === 'completed').length
    const totalSteps = steps.length
    return totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0
  }

  const getCurrentStep = () => {
    return steps.find(step => step.status === 'in_progress') || 
           steps.find(step => step.status === 'pending')
  }

  if (hasError) {
    return (
      <div className={`bg-danger-900/20 border border-danger-500/30 rounded-xl p-6 ${className}`}>
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold text-danger-400 mb-2">Analysis Failed</h3>
          <p className="text-secondary-300 mb-4">
            The analysis could not be completed. This might be due to the website being unavailable or taking too long to respond.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (isComplete) {
    return (
      <div className={`bg-success-900/20 border border-success-500/30 rounded-xl p-6 ${className}`}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🎉</div>
          <h3 className="text-xl font-bold text-success-400 mb-2">Analysis Complete!</h3>
          <p className="text-secondary-300">
            Your website analysis is ready. Completed in {formatTime(timeElapsed)}.
          </p>
        </div>
      </div>
    )
  }

  const currentStep = getCurrentStep()
  const overallProgress = getOverallProgress()

  return (
    <div className={`bg-secondary-800 border border-secondary-700 rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-volt-400 mb-2">
          Analyzing Your Website
        </h3>
        <p className="text-secondary-300 text-sm">
          We're checking hundreds of directories to give you comprehensive results
        </p>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-secondary-400">Overall Progress</span>
          <span className="text-sm font-bold text-volt-400">{Math.round(overallProgress)}%</span>
        </div>
        <div className="bg-secondary-700 rounded-full h-3 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-volt-500 to-volt-600 transition-all duration-500 rounded-full"
            style={{ width: `${overallProgress}%` }}
          ></div>
        </div>
      </div>

      {/* Current Step */}
      {currentStep && (
        <div className="mb-6 p-4 bg-volt-500/20 border border-volt-500/30 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-volt-500 border-t-transparent"></div>
            <span className="font-bold text-volt-400">{currentStep.name}</span>
          </div>
          {currentStep.description && (
            <p className="text-sm text-secondary-300 ml-7">
              {currentStep.description}
            </p>
          )}
          {currentStep.progress !== undefined && (
            <div className="ml-7 mt-2">
              <div className="bg-secondary-700 rounded-full h-1 overflow-hidden">
                <div 
                  className="h-full bg-volt-500 transition-all duration-300 rounded-full"
                  style={{ width: `${currentStep.progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step List */}
      <div className="space-y-2 mb-6">
        {steps.map((step, index) => {
          const isCompleted = step.status === 'completed'
          const isCurrent = step.status === 'in_progress'
          const isFailed = step.status === 'failed'
          const isPending = step.status === 'pending'
          
          return (
            <div key={step.id} className={`flex items-center gap-3 p-2 rounded transition-all duration-300 ${
              isCurrent ? 'bg-volt-500/10' : ''
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                isCompleted 
                  ? 'bg-success-500 text-white' 
                  : isCurrent 
                    ? 'bg-volt-500 text-secondary-900' 
                    : isFailed
                      ? 'bg-danger-500 text-white'
                      : 'bg-secondary-600 text-secondary-400'
              }`}>
                {isCompleted ? '✓' : isFailed ? '✗' : index + 1}
              </div>
              <span className={`text-sm transition-all duration-300 flex-1 ${
                isCompleted 
                  ? 'text-success-400' 
                  : isCurrent 
                    ? 'text-volt-400 font-medium' 
                    : isFailed
                      ? 'text-danger-400'
                      : 'text-secondary-400'
              }`}>
                {step.name}
              </span>
              {step.duration && (
                <span className="text-xs text-secondary-500">
                  {step.duration}s
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Time Information */}
      <div className="text-center space-y-1 border-t border-secondary-700 pt-4">
        <p className="text-xs text-secondary-400">
          Time elapsed: {formatTime(timeElapsed)}
        </p>
        {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
          <p className="text-xs text-volt-400">
            Estimated time remaining: {formatTime(Math.ceil(estimatedTimeRemaining / 1000))}
          </p>
        )}
        {timeElapsed > 30 && !estimatedTimeRemaining && (
          <p className="text-xs text-secondary-500">
            Analysis is taking longer than usual...
          </p>
        )}
      </div>

      {/* Tips */}
      {timeElapsed > 45 && (
        <div className="mt-4 p-3 bg-secondary-900/50 border border-secondary-600/30 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-sm">💡</span>
            <div>
              <p className="text-xs text-secondary-400">
                <strong className="text-secondary-300">Taking a while?</strong> Complex websites can take up to 2 minutes to analyze. 
                We're checking hundreds of directories to give you the most accurate results.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProgressTracker