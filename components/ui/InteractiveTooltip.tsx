'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'

export interface TooltipContent {
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  learnMore?: {
    label: string
    href: string
  }
  badge?: string
  icon?: string
}

interface InteractiveTooltipProps {
  content: TooltipContent
  trigger: 'hover' | 'click' | 'manual'
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  delay?: number
  showOnce?: boolean
  persistKey?: string
  className?: string
  children: React.ReactNode
}

export default function InteractiveTooltip({
  content,
  trigger = 'hover',
  position = 'auto',
  delay = 0,
  showOnce = false,
  persistKey,
  className = '',
  children
}: InteractiveTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0, placement: 'top' })
  const [hasBeenShown, setHasBeenShown] = useState(false)
  
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  // Check if tooltip has been shown before (for showOnce feature)
  useEffect(() => {
    if (showOnce && persistKey) {
      const shown = localStorage.getItem(`tooltip-shown-${persistKey}`)
      if (shown) {
        setHasBeenShown(true)
      }
    }
  }, [showOnce, persistKey])

  // Position calculation
  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    let placement = position
    let x = 0
    let y = 0

    // Auto-position logic
    if (position === 'auto') {
      const spaceTop = triggerRect.top
      const spaceBottom = viewport.height - triggerRect.bottom
      const spaceLeft = triggerRect.left
      const spaceRight = viewport.width - triggerRect.right

      if (spaceBottom >= tooltipRect.height + 10) {
        placement = 'bottom'
      } else if (spaceTop >= tooltipRect.height + 10) {
        placement = 'top'
      } else if (spaceRight >= tooltipRect.width + 10) {
        placement = 'right'
      } else {
        placement = 'left'
      }
    }

    // Calculate coordinates
    switch (placement) {
      case 'top':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
        y = triggerRect.top - tooltipRect.height - 10
        break
      case 'bottom':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
        y = triggerRect.bottom + 10
        break
      case 'left':
        x = triggerRect.left - tooltipRect.width - 10
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
        break
      case 'right':
        x = triggerRect.right + 10
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
        break
    }

    // Keep within viewport
    x = Math.max(10, Math.min(x, viewport.width - tooltipRect.width - 10))
    y = Math.max(10, Math.min(y, viewport.height - tooltipRect.height - 10))

    setTooltipPosition({ x, y, placement })
  }

  // Show tooltip
  const showTooltip = () => {
    if (showOnce && hasBeenShown) return

    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true)
      }, delay)
    } else {
      setIsVisible(true)
    }

    // Mark as shown for persistence
    if (showOnce && persistKey && !hasBeenShown) {
      localStorage.setItem(`tooltip-shown-${persistKey}`, 'true')
      setHasBeenShown(true)
    }
  }

  // Hide tooltip
  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  // Update position when visible
  useEffect(() => {
    if (isVisible) {
      calculatePosition()
    }

    return () => {}
  }, [isVisible, calculatePosition])

  // Event handlers
  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      showTooltip()
    }
  }

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      hideTooltip()
    }
  }

  const handleClick = () => {
    if (trigger === 'click') {
      if (isVisible) {
        hideTooltip()
      } else {
        showTooltip()
      }
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const tooltip = (
    <AnimatePresence>
      {isVisible && (
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
          transition={{ duration: 0.15 }}
          className="fixed z-50 bg-secondary-800 border border-secondary-700 rounded-lg shadow-xl max-w-xs"
          style={{ left: 0, top: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Arrow */}
          <div 
            className={`absolute w-2 h-2 bg-secondary-800 border transform rotate-45 ${
              tooltipPosition.placement === 'top' ? '-bottom-1 left-1/2 -translate-x-1/2 border-b border-r border-secondary-700' :
              tooltipPosition.placement === 'bottom' ? '-top-1 left-1/2 -translate-x-1/2 border-t border-l border-secondary-700' :
              tooltipPosition.placement === 'left' ? '-right-1 top-1/2 -translate-y-1/2 border-t border-r border-secondary-700' :
              tooltipPosition.placement === 'right' ? '-left-1 top-1/2 -translate-y-1/2 border-b border-l border-secondary-700' :
              'hidden'
            }`}
          />

          {/* Content */}
          <div className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {content.icon && (
                  <span className="text-lg">{content.icon}</span>
                )}
                <h3 className="font-semibold text-white text-sm">
                  {content.title}
                </h3>
                {content.badge && (
                  <span className="bg-volt-500/20 text-volt-400 text-xs px-2 py-0.5 rounded-full">
                    {content.badge}
                  </span>
                )}
              </div>
              
              <button
                onClick={hideTooltip}
                className="text-secondary-400 hover:text-secondary-300 text-xs"
              >
                ✕
              </button>
            </div>

            {/* Description */}
            <p className="text-secondary-300 text-sm leading-relaxed mb-4">
              {content.description}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {content.action && (
                <button
                  onClick={() => {
                    content.action!.onClick()
                    hideTooltip()
                  }}
                  className="bg-volt-500 hover:bg-volt-400 text-secondary-900 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                >
                  {content.action.label}
                </button>
              )}
              
              {content.learnMore && (
                <a
                  href={content.learnMore.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-volt-400 hover:text-volt-300 text-xs font-medium transition-colors"
                >
                  {content.learnMore.label} →
                </a>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <div
        ref={triggerRef}
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children}
      </div>
      
      {typeof window !== 'undefined' && createPortal(tooltip, document.body)}
    </>
  )
}

// Higher-order component for easy feature highlighting
export function withFeatureTooltip(
  content: TooltipContent,
  options: Partial<InteractiveTooltipProps> = {}
) {
  return function FeatureHighlight({ children, ...props }: { children: React.ReactNode }) {
    return (
      <InteractiveTooltip
        content={content}
        trigger="hover"
        position="auto"
        {...options}
        {...props}
      >
        {children}
      </InteractiveTooltip>
    )
  }
}

// Feature discovery banner component
export function FeatureDiscoveryBanner({
  title,
  description,
  features,
  onDismiss,
  className = ''
}: {
  title: string
  description: string
  features: Array<{
    icon: string
    name: string
    description: string
    action?: () => void
  }>
  onDismiss: () => void
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`bg-gradient-to-r from-volt-500/20 to-blue-500/20 border border-volt-500/30 rounded-xl p-6 ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            🚀 {title}
          </h3>
          <p className="text-secondary-300 text-sm">
            {description}
          </p>
        </div>
        
        <button
          onClick={onDismiss}
          className="text-secondary-400 hover:text-secondary-300"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <div
            key={index}
            className="bg-secondary-800/50 rounded-lg p-4 hover:bg-secondary-800/80 transition-colors cursor-pointer"
            onClick={feature.action}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{feature.icon}</span>
              <div>
                <h4 className="font-semibold text-white text-sm mb-1">
                  {feature.name}
                </h4>
                <p className="text-secondary-400 text-xs">
                  {feature.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}