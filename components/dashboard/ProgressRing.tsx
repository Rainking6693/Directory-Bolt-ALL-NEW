'use client'
import { useMemo } from 'react'

interface ProgressRingProps {
  progress: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  label?: string
  className?: string
  strokeWidth?: number
  color?: 'volt' | 'success' | 'warning' | 'danger'
}

export function ProgressRing({
  progress,
  size = 'md',
  showLabel = true,
  label = 'Progress',
  className = '',
  strokeWidth = 8,
  color = 'volt'
}: ProgressRingProps) {
  const dimensions = useMemo(() => {
    switch (size) {
      case 'sm':
        return { width: 80, height: 80, radius: 32, fontSize: 'text-sm' }
      case 'md':
        return { width: 120, height: 120, radius: 48, fontSize: 'text-base' }
      case 'lg':
        return { width: 160, height: 160, radius: 64, fontSize: 'text-lg' }
      default:
        return { width: 120, height: 120, radius: 48, fontSize: 'text-base' }
    }
  }, [size])

  const colorClasses = useMemo(() => {
    switch (color) {
      case 'volt':
        return {
          ring: 'stroke-volt-500',
          background: 'stroke-secondary-700',
          text: 'text-volt-400'
        }
      case 'success':
        return {
          ring: 'stroke-success-500',
          background: 'stroke-secondary-700',
          text: 'text-success-400'
        }
      case 'warning':
        return {
          ring: 'stroke-yellow-500',
          background: 'stroke-secondary-700',
          text: 'text-volt-400'
        }
      case 'danger':
        return {
          ring: 'stroke-danger-500',
          background: 'stroke-secondary-700',
          text: 'text-danger-400'
        }
      default:
        return {
          ring: 'stroke-volt-500',
          background: 'stroke-secondary-700',
          text: 'text-volt-400'
        }
    }
  }, [color])

  const { width, height, radius } = dimensions
  const circumference = 2 * Math.PI * radius
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="transform -rotate-90"
          aria-hidden="true"
        >
          {/* Background circle */}
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill="transparent"
            className={colorClasses.background}
            strokeWidth={strokeWidth}
          />
          
          {/* Progress circle */}
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill="transparent"
            className={`${colorClasses.ring} transition-all duration-1000 ease-out`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            style={{
              filter: color === 'volt' ? 'drop-shadow(0 0 6px rgba(179, 255, 0, 0.5))' : undefined
            }}
          />
        </svg>
        
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${dimensions.fontSize} ${colorClasses.text}`}>
            {Math.round(progress)}%
          </span>
          {size !== 'sm' && (
            <span className="text-xs text-secondary-400 mt-1">complete</span>
          )}
        </div>
      </div>
      
      {showLabel && (
        <span className="text-sm text-secondary-300 text-center font-medium">
          {label}
        </span>
      )}
    </div>
  )
}

export default ProgressRing