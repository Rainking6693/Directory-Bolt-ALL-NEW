'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'

export interface TourStep {
  id: string
  target: string // CSS selector
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  action?: 'click' | 'hover' | 'none'
  optional?: boolean
  highlight?: boolean
}

export interface Tour {
  id: string
  name: string
  description: string
  steps: TourStep[]
  trigger?: 'auto' | 'manual' | 'first-visit'
  userTier?: string[]
  category?: 'onboarding' | 'feature' | 'advanced'
}

interface FeatureTourProps {
  tour: Tour
  isActive: boolean
  onComplete: (tourId: string) => void
  onSkip: (tourId: string) => void
  onStepChange?: (stepIndex: number) => void
  autoStart?: boolean
  className?: string
}

interface TooltipPosition {
  x: number
  y: number
  position: 'top' | 'bottom' | 'left' | 'right'
}

export default function FeatureTour({
  tour,
  isActive,
  onComplete,
  onSkip,
  onStepChange,
  autoStart = false,
  className = ''
}: FeatureTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ x: 0, y: 0, position: 'top' })
  const [isAnimating, setIsAnimating] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const step = tour.steps[currentStep]

  // Start tour when active
  useEffect(() => {
    if (isActive && autoStart) {
      startTour()
    }
  }, [isActive, autoStart])

  // Find target element and position tooltip
  useEffect(() => {
    if (!isVisible || !step) return

    const findAndPositionTarget = () => {
      const element = document.querySelector(step.target) as HTMLElement
      if (!element) {
        console.warn(`Tour step target not found: ${step.target}`)
        return
      }

      setTargetElement(element)
      positionTooltip(element, step.position || 'auto')
      
      // Highlight element
      if (step.highlight !== false) {
        highlightElement(element)
      }
    }

    // Try immediately and with a slight delay for dynamic content
    findAndPositionTarget()
    const timeout = setTimeout(findAndPositionTarget, 100)

    return () => clearTimeout(timeout)
  }, [isVisible, step])

  // Handle window resize
  useEffect(() => {
    if (!isVisible || !targetElement) return

    const handleResize = () => {
      positionTooltip(targetElement, step?.position || 'auto')
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isVisible, targetElement, step])

  const startTour = () => {
    setCurrentStep(0)
    setIsVisible(true)
    document.body.style.overflow = 'hidden' // Prevent scrolling during tour
  }

  const stopTour = () => {
    setIsVisible(false)
    setCurrentStep(0)
    removeHighlights()
    document.body.style.overflow = '' // Restore scrolling
  }

  const positionTooltip = (element: HTMLElement, preferredPosition: string) => {
    if (!tooltipRef.current) return

    const rect = element.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    let position: 'top' | 'bottom' | 'left' | 'right' = 'top'
    let x = 0
    let y = 0

    // Calculate position based on preference and available space
    if (preferredPosition === 'auto') {
      // Choose best position based on available space
      const spaceTop = rect.top
      const spaceBottom = viewport.height - rect.bottom
      const spaceLeft = rect.left
      const spaceRight = viewport.width - rect.right

      if (spaceBottom > tooltipRect.height + 20) {
        position = 'bottom'
      } else if (spaceTop > tooltipRect.height + 20) {
        position = 'top'
      } else if (spaceRight > tooltipRect.width + 20) {
        position = 'right'
      } else {
        position = 'left'
      }
    } else {
      position = preferredPosition as any
    }

    // Calculate coordinates based on position
    switch (position) {
      case 'top':
        x = rect.left + rect.width / 2 - tooltipRect.width / 2
        y = rect.top - tooltipRect.height - 15
        break
      case 'bottom':
        x = rect.left + rect.width / 2 - tooltipRect.width / 2
        y = rect.bottom + 15
        break
      case 'left':
        x = rect.left - tooltipRect.width - 15
        y = rect.top + rect.height / 2 - tooltipRect.height / 2
        break
      case 'right':
        x = rect.right + 15
        y = rect.top + rect.height / 2 - tooltipRect.height / 2
        break
    }

    // Keep tooltip within viewport
    x = Math.max(10, Math.min(x, viewport.width - tooltipRect.width - 10))
    y = Math.max(10, Math.min(y, viewport.height - tooltipRect.height - 10))

    setTooltipPosition({ x, y, position })
  }

  const highlightElement = (element: HTMLElement) => {
    // Remove existing highlights
    removeHighlights()

    // Add highlight class
    element.classList.add('tour-highlight')
    element.style.position = 'relative'
    element.style.zIndex = '10001'
    element.style.boxShadow = '0 0 0 4px rgba(255, 193, 7, 0.5), 0 0 0 8px rgba(255, 193, 7, 0.2)'
    element.style.borderRadius = '4px'

    // Scroll element into view
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'center'
    })
  }

  const removeHighlights = () => {
    document.querySelectorAll('.tour-highlight').forEach(el => {
      el.classList.remove('tour-highlight')
      ;(el as HTMLElement).style.position = ''
      ;(el as HTMLElement).style.zIndex = ''
      ;(el as HTMLElement).style.boxShadow = ''
      ;(el as HTMLElement).style.borderRadius = ''
    })
  }

  const handleNext = () => {
    if (isAnimating) return

    setIsAnimating(true)
    removeHighlights()

    if (currentStep < tour.steps.length - 1) {
      const nextStep = currentStep + 1
      setCurrentStep(nextStep)
      onStepChange?.(nextStep)
    } else {
      handleComplete()
    }

    setTimeout(() => setIsAnimating(false), 300)
  }

  const handlePrev = () => {
    if (isAnimating || currentStep === 0) return

    setIsAnimating(true)
    removeHighlights()

    const prevStep = currentStep - 1
    setCurrentStep(prevStep)
    onStepChange?.(prevStep)

    setTimeout(() => setIsAnimating(false), 300)
  }

  const handleSkip = () => {
    stopTour()
    onSkip(tour.id)
  }

  const handleComplete = () => {
    stopTour()
    onComplete(tour.id)
  }

  const handleStepClick = (stepIndex: number) => {
    if (isAnimating) return

    setIsAnimating(true)
    removeHighlights()
    setCurrentStep(stepIndex)
    onStepChange?.(stepIndex)
    setTimeout(() => setIsAnimating(false), 300)
  }

  // Don't render if not active or visible
  if (!isActive || !isVisible) return null

  return createPortal(
    <div className={`fixed inset-0 z-50 ${className}`}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Tooltip */}
      <AnimatePresence>
        {step && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              x: tooltipPosition.x,
              y: tooltipPosition.y
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute bg-white rounded-xl shadow-2xl border border-gray-200 max-w-sm z-[10002]"
            style={{
              left: 0,
              top: 0
            }}
          >
            {/* Arrow */}
            <div 
              className={`absolute w-3 h-3 bg-white border transform rotate-45 ${
                tooltipPosition.position === 'top' ? '-bottom-1.5 left-1/2 -translate-x-1/2 border-b border-r' :
                tooltipPosition.position === 'bottom' ? '-top-1.5 left-1/2 -translate-x-1/2 border-t border-l' :
                tooltipPosition.position === 'left' ? '-right-1.5 top-1/2 -translate-y-1/2 border-t border-r' :
                tooltipPosition.position === 'right' ? '-left-1.5 top-1/2 -translate-y-1/2 border-b border-l' :
                'hidden'
              }`}
            />

            {/* Content */}
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {step.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Step {currentStep + 1} of {tour.steps.length}</span>
                    <span>•</span>
                    <span>{tour.name}</span>
                  </div>
                </div>
                
                <button
                  onClick={handleSkip}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  ✕
                </button>
              </div>

              {/* Step Content */}
              <div className="mb-6">
                <p className="text-gray-700 leading-relaxed">
                  {step.content}
                </p>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handlePrev}
                  disabled={currentStep === 0 || isAnimating}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentStep === 0 || isAnimating
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  ← Previous
                </button>

                <div className="flex items-center gap-1">
                  {tour.steps.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => handleStepClick(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentStep 
                          ? 'bg-blue-500' 
                          : index < currentStep 
                          ? 'bg-green-500' 
                          : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {step.optional && (
                    <button
                      onClick={handleNext}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Skip
                    </button>
                  )}
                  
                  <button
                    onClick={handleNext}
                    disabled={isAnimating}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isAnimating
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {currentStep === tour.steps.length - 1 ? 'Finish' : 'Next'} →
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  )
}