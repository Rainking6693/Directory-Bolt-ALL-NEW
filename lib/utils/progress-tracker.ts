// 🚀 ANALYSIS PROGRESS TRACKER - Real-time status updates for website analysis
// Comprehensive progress tracking with WebSocket support for live updates

import { logger } from './logger'

export interface ProgressStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress: number // 0-100
  startTime?: number
  endTime?: number
  duration?: number
  error?: string
  metadata?: Record<string, any>
}

export interface AnalysisProgress {
  requestId: string
  status: 'initializing' | 'analyzing' | 'completed' | 'failed'
  overallProgress: number
  currentStep: string
  steps: ProgressStep[]
  startTime: number
  endTime?: number
  totalDuration?: number
  url: string
  options: any
  result?: any
  error?: string
}

// In-memory store for progress tracking (use Redis in production)
const progressStore = new Map<string, AnalysisProgress>()

export class ProgressTracker {
  private progress: AnalysisProgress
  private stepIndex: Map<string, number> = new Map()

  constructor(requestId: string, url: string, options: any = {}) {
    this.progress = {
      requestId,
      status: 'initializing',
      overallProgress: 0,
      currentStep: 'initializing',
      steps: this.initializeSteps(options),
      startTime: Date.now(),
      url,
      options
    }

    // Map step IDs to their indices for quick lookup
    this.progress.steps.forEach((step, index) => {
      this.stepIndex.set(step.id, index)
    })

    // Store in global store
    progressStore.set(requestId, this.progress)

    logger.info('Analysis progress tracking started', {
      requestId,
      metadata: { url, totalSteps: this.progress.steps.length }
    })
  }

  private initializeSteps(options: any): ProgressStep[] {
    const steps: ProgressStep[] = [
      {
        id: 'validation',
        title: 'Input Validation',
        description: 'Validating and sanitizing website URL',
        status: 'pending',
        progress: 0
      },
      {
        id: 'fetch',
        title: 'Website Fetching',
        description: 'Downloading website content and assets',
        status: 'pending',
        progress: 0
      },
      {
        id: 'parse',
        title: 'Content Analysis',
        description: 'Parsing HTML structure and extracting metadata',
        status: 'pending',
        progress: 0
      },
      {
        id: 'seo_analysis',
        title: 'SEO Analysis',
        description: 'Analyzing SEO factors and optimization opportunities',
        status: 'pending',
        progress: 0
      },
      {
        id: 'directory_check',
        title: 'Directory Listings',
        description: 'Checking current directory presence and listings',
        status: 'pending',
        progress: 0
      },
      {
        id: 'opportunity_discovery',
        title: 'Opportunity Discovery',
        description: 'Finding relevant directory submission opportunities',
        status: 'pending',
        progress: 0
      },
      {
        id: 'metrics_calculation',
        title: 'Metrics Calculation',
        description: 'Computing visibility scores and potential impact',
        status: 'pending',
        progress: 0
      },
      {
        id: 'recommendations',
        title: 'Recommendations',
        description: 'Generating actionable improvement recommendations',
        status: 'pending',
        progress: 0
      }
    ]

    // Add AI analysis step if enabled
    if (options.includeAI !== false) {
      steps.push({
        id: 'ai_analysis',
        title: 'AI Analysis',
        description: 'Running AI-powered business profiling and insights',
        status: 'pending',
        progress: 0
      })
    }

    // Add competitor analysis if requested
    if (options.includeCompetitors) {
      steps.push({
        id: 'competitor_analysis',
        title: 'Competitor Analysis',
        description: 'Analyzing competitor directory presence and strategies',
        status: 'pending',
        progress: 0
      })
    }

    steps.push({
      id: 'finalization',
      title: 'Report Generation',
      description: 'Compiling final analysis report and recommendations',
      status: 'pending',
      progress: 0
    })

    return steps
  }

  startStep(stepId: string, metadata?: Record<string, any>): void {
    const stepIndex = this.stepIndex.get(stepId)
    if (stepIndex === undefined) {
      logger.warn('Attempted to start unknown step', { requestId: this.progress.requestId })
      return
    }

    const step = this.progress.steps[stepIndex]
    step.status = 'in_progress'
    step.startTime = Date.now()
    step.progress = 0
    if (metadata) step.metadata = metadata

    this.progress.currentStep = stepId
    this.progress.status = 'analyzing'
    this.updateOverallProgress()

    logger.info('Analysis step started', {
      requestId: this.progress.requestId,
      metadata: { stepId, stepTitle: step.title }
    })

    this.updateStore()
  }

  updateStepProgress(stepId: string, progress: number, description?: string): void {
    const stepIndex = this.stepIndex.get(stepId)
    if (stepIndex === undefined) return

    const step = this.progress.steps[stepIndex]
    step.progress = Math.min(100, Math.max(0, progress))
    if (description) step.description = description

    this.updateOverallProgress()
    this.updateStore()
  }

  completeStep(stepId: string, result?: any, metadata?: Record<string, any>): void {
    const stepIndex = this.stepIndex.get(stepId)
    if (stepIndex === undefined) return

    const step = this.progress.steps[stepIndex]
    step.status = 'completed'
    step.progress = 100
    step.endTime = Date.now()
    if (step.startTime) {
      step.duration = step.endTime - step.startTime
    }
    if (metadata) step.metadata = { ...step.metadata, ...metadata }

    this.updateOverallProgress()

    logger.info('Analysis step completed', {
      requestId: this.progress.requestId,
      metadata: { 
        stepId, 
        stepTitle: step.title, 
        duration: step.duration,
        progress: this.progress.overallProgress 
      }
    })

    this.updateStore()
  }

  failStep(stepId: string, error: string | Error, metadata?: Record<string, any>): void {
    const stepIndex = this.stepIndex.get(stepId)
    if (stepIndex === undefined) return

    const step = this.progress.steps[stepIndex]
    step.status = 'failed'
    step.endTime = Date.now()
    step.error = error instanceof Error ? error.message : error
    if (step.startTime) {
      step.duration = step.endTime - step.startTime
    }
    if (metadata) step.metadata = { ...step.metadata, ...metadata }

    this.progress.status = 'failed'
    this.progress.error = step.error

    logger.error('Analysis step failed', {
      requestId: this.progress.requestId,
      metadata: { stepId, stepTitle: step.title, error: step.error }
    }, error instanceof Error ? error : new Error(error))

    this.updateStore()
  }

  complete(result: any): void {
    this.progress.status = 'completed'
    this.progress.overallProgress = 100
    this.progress.endTime = Date.now()
    this.progress.totalDuration = this.progress.endTime - this.progress.startTime
    this.progress.result = result

    // Ensure all steps are marked as completed
    this.progress.steps.forEach(step => {
      if (step.status === 'in_progress' || step.status === 'pending') {
        step.status = 'completed'
        step.progress = 100
        step.endTime = this.progress.endTime
      }
    })

    logger.info('Analysis completed successfully', {
      requestId: this.progress.requestId,
      metadata: {
        url: this.progress.url,
        totalDuration: this.progress.totalDuration,
        totalSteps: this.progress.steps.length,
        completedSteps: this.progress.steps.filter(s => s.status === 'completed').length
      }
    })

    this.updateStore()
  }

  fail(error: string | Error): void {
    this.progress.status = 'failed'
    this.progress.endTime = Date.now()
    this.progress.totalDuration = this.progress.endTime - this.progress.startTime
    this.progress.error = error instanceof Error ? error.message : error

    // Mark current step as failed
    const currentStepIndex = this.stepIndex.get(this.progress.currentStep)
    if (currentStepIndex !== undefined) {
      const step = this.progress.steps[currentStepIndex]
      if (step.status === 'in_progress') {
        this.failStep(this.progress.currentStep, error)
      }
    }

    logger.error('Analysis failed', {
      requestId: this.progress.requestId,
      metadata: {
        url: this.progress.url,
        currentStep: this.progress.currentStep,
        totalDuration: this.progress.totalDuration,
        error: this.progress.error
      }
    }, error instanceof Error ? error : new Error(error))

    this.updateStore()
  }

  private updateOverallProgress(): void {
    const completedSteps = this.progress.steps.filter(step => step.status === 'completed').length
    const inProgressSteps = this.progress.steps.filter(step => step.status === 'in_progress')
    const totalSteps = this.progress.steps.length

    // Base progress from completed steps
    let overallProgress = (completedSteps / totalSteps) * 100

    // Add partial progress from in-progress steps
    if (inProgressSteps.length > 0) {
      const inProgressContribution = inProgressSteps.reduce((sum, step) => 
        sum + step.progress, 0) / inProgressSteps.length
      overallProgress += (inProgressContribution / totalSteps)
    }

    this.progress.overallProgress = Math.min(100, Math.max(0, overallProgress))
  }

  private updateStore(): void {
    progressStore.set(this.progress.requestId, this.progress)
  }

  getProgress(): AnalysisProgress {
    return { ...this.progress }
  }

  // Static methods for retrieving progress
  static getProgress(requestId: string): AnalysisProgress | null {
    return progressStore.get(requestId) || null
  }

  static getAllActiveProgress(): AnalysisProgress[] {
    return Array.from(progressStore.values()).filter(
      p => p.status === 'initializing' || p.status === 'analyzing'
    )
  }

  static cleanupOldProgress(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs
    let cleaned = 0

    for (const [requestId, progress] of Array.from(progressStore.entries())) {
      if (progress.startTime < cutoff) {
        progressStore.delete(requestId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old progress entries', { metadata: { cleaned } })
    }

    return cleaned
  }

  static getProgressSummary(): {
    total: number
    active: number
    completed: number
    failed: number
    averageDuration: number
  } {
    const all = Array.from(progressStore.values())
    const completed = all.filter(p => p.status === 'completed')
    const failed = all.filter(p => p.status === 'failed')
    const active = all.filter(p => p.status === 'analyzing' || p.status === 'initializing')

    const avgDuration = completed.length > 0 ? 
      completed.reduce((sum, p) => sum + (p.totalDuration || 0), 0) / completed.length : 0

    return {
      total: all.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      averageDuration: avgDuration
    }
  }
}

// Auto-cleanup old progress entries every hour
setInterval(() => {
  ProgressTracker.cleanupOldProgress()
}, 60 * 60 * 1000)

export { progressStore }