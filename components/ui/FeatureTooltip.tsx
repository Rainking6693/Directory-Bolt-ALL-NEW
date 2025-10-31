'use client'
import { useState } from 'react'

interface FeatureTooltipProps {
  children: React.ReactNode
  content: string
  title?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function FeatureTooltip({ 
  children, 
  content, 
  title, 
  position = 'top' 
}: FeatureTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  }

  const arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-t-secondary-800 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-b-secondary-800 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-l-secondary-800 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-r-secondary-800 border-t-transparent border-b-transparent border-l-transparent'
  }

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      tabIndex={0}
    >
      {children}
      
      {isVisible && (
        <div
          className={`absolute z-50 px-4 py-3 bg-secondary-800 text-white text-sm rounded-lg shadow-xl border border-secondary-600 max-w-xs ${positionClasses[position]} animate-fade-in`}
          style={{ minWidth: '200px' }}
        >
          {title && (
            <div className="font-bold text-volt-400 mb-1 text-xs uppercase tracking-wide">
              {title}
            </div>
          )}
          <div className="text-secondary-200 leading-relaxed">
            {content}
          </div>
          
          {/* Arrow */}
          <div
            className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
            style={{ borderWidth: '6px' }}
          />
        </div>
      )}
    </div>
  )
}