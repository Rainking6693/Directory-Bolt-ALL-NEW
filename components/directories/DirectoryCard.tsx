'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Directory } from '../../lib/types/directory'

interface DirectoryCardProps {
  directory: Directory
  isSelected: boolean
  onToggle: () => void
  viewMode?: 'grid' | 'list'
  animationDelay?: number
  showRecommendationBadge?: boolean
}

export function DirectoryCard({
  directory,
  isSelected,
  onToggle,
  viewMode = 'grid',
  animationDelay = 0,
  showRecommendationBadge = false
}: DirectoryCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageError, setImageError] = useState(false)

  // Calculate success rate based on difficulty and approval requirements
  const getSuccessRate = () => {
    let baseRate = 85
    if (directory.difficulty === 'Medium') baseRate -= 15
    if (directory.difficulty === 'Hard') baseRate -= 35
    if (directory.requires_approval) baseRate -= 10
    return Math.max(baseRate, 45)
  }

  // Get DA color coding
  const getDaColor = (da: number) => {
    if (da >= 80) return 'text-green-400 bg-green-900/30 border-green-500/50'
    if (da >= 60) return 'text-volt-400 bg-volt-900/30 border-volt-500/50'
    return 'text-orange-400 bg-orange-900/30 border-orange-500/50'
  }

  // Get difficulty stars
  const getDifficultyStars = (difficulty: string) => {
    const levels = { Easy: 1, Medium: 2, Hard: 3 }
    const level = levels[difficulty as keyof typeof levels] || 1
    return Array.from({ length: 5 }).map((_, i) => (
      <span
        key={i}
        className={`text-sm ${
          i < level ? 'text-volt-400' : 'text-secondary-600'
        }`}
      >
        ★
      </span>
    ))
  }

  // Format price display
  const getPriceDisplay = () => {
    if (!directory.submission_fee || directory.submission_fee === 0) {
      return { text: 'FREE', color: 'text-green-400' }
    }
    const price = directory.submission_fee / 100 // Convert cents to dollars
    return { 
      text: `$${price.toLocaleString()}`, 
      color: price > 100 ? 'text-orange-400' : 'text-volt-400' 
    }
  }

  // Format traffic numbers
  const formatTraffic = (traffic: number) => {
    if (traffic >= 1000000) return `${(traffic / 1000000).toFixed(1)}M`
    if (traffic >= 1000) return `${(traffic / 1000).toFixed(0)}K`
    return traffic.toString()
  }

  // Get favicon URL with fallback
  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    } catch {
      return '/icons/default-favicon.png'
    }
  }

  const successRate = getSuccessRate()
  const priceDisplay = getPriceDisplay()
  const daColor = getDaColor(directory.domain_authority)

  if (viewMode === 'list') {
    return (
      <div 
        className={`relative flex items-center p-4 rounded-xl border backdrop-blur-sm cursor-pointer transition-all duration-300 hover:scale-[1.02] animate-slide-up ${
          isSelected
            ? 'bg-gradient-to-r from-volt-900/30 to-volt-800/20 border-volt-500/50 shadow-lg shadow-volt-500/20'
            : 'bg-secondary-800/50 border-secondary-700 hover:border-secondary-600 hover:bg-secondary-800/70'
        }`}
        onClick={onToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {/* Selection Checkbox */}
        <div className={`w-5 h-5 rounded border-2 mr-4 flex items-center justify-center transition-colors ${
          isSelected ? 'bg-volt-500 border-volt-500' : 'border-secondary-500 hover:border-volt-400'
        }`}>
          {isSelected && (
            <svg className="w-3 h-3 text-secondary-900" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        {/* Favicon */}
        <div className="w-8 h-8 mr-4 flex-shrink-0">
          <Image
            src={imageError ? '/icons/default-favicon.png' : getFaviconUrl(directory.url)}
            alt={`${directory.name} favicon`}
            width={32}
            height={32}
            className="w-full h-full rounded"
            onError={() => setImageError(true)}
            unoptimized
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-white truncate">{directory.name}</h3>
              <p className="text-secondary-400 text-sm truncate">{directory.category.replace(/_/g, ' ')}</p>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 ml-4">
              {showRecommendationBadge && (
                <span className="px-2 py-1 bg-volt-500 text-secondary-900 text-xs font-bold rounded">
                  RECOMMENDED
                </span>
              )}
              
              <div className={`px-2 py-1 text-xs font-bold rounded border ${daColor}`}>
                DA {directory.domain_authority}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 ml-4 text-sm">
          <div className="text-center">
            <div className="font-bold text-success-400">{successRate}%</div>
            <div className="text-secondary-500">Success</div>
          </div>
          
          <div className="text-center">
            <div className="font-bold text-white">
              {formatTraffic(directory.monthly_traffic || 0)}
            </div>
            <div className="text-secondary-500">Traffic</div>
          </div>
          
          <div className="text-center">
            <div className={`font-bold ${priceDisplay.color}`}>
              {priceDisplay.text}
            </div>
            <div className="text-secondary-500">Fee</div>
          </div>
          
          <div className="text-center">
            <div className="flex">{getDifficultyStars(directory.difficulty)}</div>
            <div className="text-secondary-500">Difficulty</div>
          </div>
        </div>
      </div>
    )
  }

  // Grid view (default)
  return (
    <div 
      className={`relative p-6 rounded-xl border backdrop-blur-sm cursor-pointer transition-all duration-300 hover:scale-105 animate-slide-up group ${
        isSelected
          ? 'bg-gradient-to-br from-volt-900/30 to-volt-800/20 border-volt-500/50 shadow-lg shadow-volt-500/20'
          : 'bg-secondary-800/50 border-secondary-700 hover:border-secondary-600 hover:bg-secondary-800/70'
      }`}
      onClick={onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Selection Indicator */}
      <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 transition-all duration-300 z-10 ${
        isSelected 
          ? 'bg-volt-500 border-volt-500' 
          : 'border-secondary-500 group-hover:border-volt-400'
      }`}>
        {isSelected && (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-3 h-3 text-secondary-900" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {/* Header with Favicon and Badges */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex-shrink-0">
            <Image
              src={imageError ? '/icons/default-favicon.png' : getFaviconUrl(directory.url)}
              alt={`${directory.name} favicon`}
              width={32}
              height={32}
              className="w-full h-full rounded"
              onError={() => setImageError(true)}
              unoptimized
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-bold text-white mb-1">{directory.name}</h3>
            <p className="text-secondary-400 text-sm capitalize">
              {directory.category.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      </div>

      {/* Badges Row */}
      <div className="flex flex-wrap gap-2 mb-4">
        {showRecommendationBadge && (
          <span className="px-2 py-1 bg-volt-500 text-secondary-900 text-xs font-bold rounded">
            ⭐ RECOMMENDED
          </span>
        )}
        
        {directory.submission_fee === 0 && (
          <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
            FREE
          </span>
        )}
        
        {directory.domain_authority >= 80 && (
          <span className="px-2 py-1 bg-success-600 text-white text-xs font-bold rounded">
            HIGH AUTHORITY
          </span>
        )}
        
        {directory.difficulty === 'Easy' && (
          <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
            EASY SUBMIT
          </span>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className={`text-lg font-bold rounded px-2 py-1 border ${daColor}`}>
            {directory.domain_authority}
          </div>
          <div className="text-xs text-secondary-500 mt-1">Domain Authority</div>
        </div>
        
        <div className="text-center">
          <div className="text-lg font-bold text-success-400">
            {successRate}%
          </div>
          <div className="text-xs text-secondary-500 mt-1">Success Rate</div>
        </div>
        
        <div className="text-center">
          <div className="text-lg font-bold text-white">
            {formatTraffic(directory.monthly_traffic || 0)}
          </div>
          <div className="text-xs text-secondary-500 mt-1">Monthly Traffic</div>
        </div>
        
        <div className="text-center">
          <div className={`text-lg font-bold ${priceDisplay.color}`}>
            {priceDisplay.text}
          </div>
          <div className="text-xs text-secondary-500 mt-1">Submission Fee</div>
        </div>
      </div>

      {/* Features List */}
      {directory.features && directory.features.length > 0 && (
        <div className="space-y-2 mb-4">
          {directory.features.slice(0, 3).map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-secondary-300">
              <div className="w-1.5 h-1.5 bg-volt-500 rounded-full flex-shrink-0"></div>
              <span className="truncate">{feature}</span>
            </div>
          ))}
          {directory.features.length > 3 && (
            <div className="text-xs text-secondary-500">
              +{directory.features.length - 3} more features
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-secondary-700">
        <div className="flex items-center gap-1">
          <span className="text-xs text-secondary-500">Difficulty:</span>
          <div className="flex">{getDifficultyStars(directory.difficulty)}</div>
        </div>
        
        <div className="text-right">
          <div className="text-sm font-semibold text-white">
            {directory.time_to_approval}
          </div>
          <div className="text-xs text-secondary-500">Approval Time</div>
        </div>
      </div>

      {/* Hover Overlay */}
      {isHovered && (
        <div className="absolute inset-0 bg-volt-500/5 rounded-xl pointer-events-none transition-opacity duration-300" />
      )}

      {/* Quick Actions on Hover */}
      {isHovered && (
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={(e) => {
              e.stopPropagation()
              window.open(directory.url, '_blank')
            }}
            className="px-3 py-1 bg-secondary-700 text-white text-xs rounded hover:bg-secondary-600 transition-colors"
          >
            Visit Site
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              // Open submission requirements modal
            }}
            className="px-3 py-1 bg-volt-500 text-secondary-900 text-xs rounded hover:bg-volt-400 transition-colors"
          >
            View Requirements
          </button>
        </div>
      )}
    </div>
  )
}