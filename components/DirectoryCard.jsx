'use client'
import { useState } from 'react'
import TierLockModal from './TierLockModal'

const TIER_REQUIREMENTS = {
  starter: ['easy'],
  growth: ['easy', 'medium'],
  professional: ['easy', 'medium', 'hard'],
  enterprise: ['easy', 'medium', 'hard']
}

// TIER_COLORS removed as it's not used in this component

const DIFFICULTY_CONFIG = {
  easy: {
    color: 'text-success-400 bg-success-400/10 border-success-400/30',
    icon: '🟢',
    label: 'Easy',
    description: 'Quick approval, basic requirements'
  },
  medium: {
    color: 'text-volt-400 bg-volt-400/10 border-volt-400/30',
    icon: '🟡', 
    label: 'Medium',
    description: 'Moderate review process'
  },
  hard: {
    color: 'text-danger-400 bg-danger-400/10 border-danger-400/30',
    icon: '🔴',
    label: 'Hard',
    description: 'Strict requirements, longer approval'
  }
}

function getRequiredTier(difficulty) {
  switch(difficulty) {
    case 'easy': return 'starter'
    case 'medium': return 'growth' 
    case 'hard': return 'professional'
    default: return 'starter'
  }
}

export default function DirectoryCard({
  directory,
  userTier = 'starter',
  isSelected = false,
  onSelect = () => {},
  onTierUpgrade = () => {}
}) {
  const [showTierModal, setShowTierModal] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const allowedDifficulties = TIER_REQUIREMENTS[userTier] || []
  const isLocked = !allowedDifficulties.includes(directory.difficulty)
  const requiredTier = getRequiredTier(directory.difficulty)
  const difficultyConfig = DIFFICULTY_CONFIG[directory.difficulty] || DIFFICULTY_CONFIG.easy

  const handleCardClick = () => {
    if (isLocked) {
      setShowTierModal(true)
    } else {
      onSelect()
    }
  }

  const getAuthorityBadgeColor = (authority) => {
    if (authority >= 90) return 'bg-success-500 text-white'
    if (authority >= 70) return 'bg-volt-500 text-secondary-900' 
    if (authority >= 50) return 'bg-orange-500 text-white'
    return 'bg-secondary-600 text-secondary-300'
  }

  return (
    <>
      <div
        className={`relative card cursor-pointer transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 ${
          isSelected ? 'ring-2 ring-volt-500 bg-volt-500/5' : ''
        } ${
          isLocked ? 'opacity-75 hover:opacity-90' : 'hover:shadow-2xl hover:shadow-volt-500/10'
        }`}
        onClick={handleCardClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Lock Overlay for Locked Directories */}
        {isLocked && (
          <div className="absolute inset-0 bg-secondary-900/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
            <div className="text-center p-4">
              <div className="text-4xl mb-2">🔒</div>
              <div className="text-sm font-bold text-volt-400 mb-1">
                {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)} Plan Required
              </div>
              <div className="text-xs text-secondary-400">
                Click to upgrade
              </div>
            </div>
          </div>
        )}

        {/* Selection Checkbox */}
        <div className="absolute top-4 left-4 z-20">
          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all duration-200 ${
            isSelected ? 
              'bg-volt-500 border-volt-500' : 
              'border-secondary-500 bg-secondary-800 hover:border-volt-500'
          }`}>
            {isSelected && (
              <svg className="w-4 h-4 text-secondary-900" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>

        {/* Authority Score Badge */}
        <div className="absolute top-4 right-4">
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${getAuthorityBadgeColor(directory.authority)}`}>
            DA {directory.authority}
          </div>
        </div>

        {/* Directory Content */}
        <div className="pt-12 pb-4">
          {/* Directory Name */}
          <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">
            {directory.name}
          </h3>

          {/* Category Tag */}
          <div className="inline-block px-3 py-1 bg-secondary-700 text-secondary-300 rounded-full text-xs font-medium mb-3">
            {directory.category}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center p-2 bg-secondary-900/50 rounded-lg">
              <div className="text-volt-400 text-sm font-bold">
                {directory.estimatedTraffic >= 1000 ? 
                  `${Math.floor(directory.estimatedTraffic / 1000)}K` : 
                  directory.estimatedTraffic}
              </div>
              <div className="text-xs text-secondary-400">Traffic/mo</div>
            </div>
            <div className="text-center p-2 bg-secondary-900/50 rounded-lg">
              <div className="text-volt-400 text-sm font-bold">{directory.timeToApproval}</div>
              <div className="text-xs text-secondary-400">Approval</div>
            </div>
          </div>

          {/* Difficulty Badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${difficultyConfig.color} mb-4`}>
            <span>{difficultyConfig.icon}</span>
            <span>{difficultyConfig.label}</span>
          </div>

          {/* Features List */}
          {directory.features && directory.features.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-secondary-400 mb-2">Features:</div>
              <div className="flex flex-wrap gap-1">
                {directory.features.slice(0, 3).map((feature, index) => (
                  <span key={index} className="px-2 py-1 bg-secondary-700/50 text-secondary-300 rounded text-xs">
                    {feature}
                  </span>
                ))}
                {directory.features.length > 3 && (
                  <span className="px-2 py-1 bg-secondary-700/50 text-secondary-400 rounded text-xs">
                    +{directory.features.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Price Display */}
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {directory.price === 0 ? (
                <span className="text-success-400 font-bold">FREE</span>
              ) : (
                <span className="text-secondary-300">
                  ${directory.price} <span className="text-secondary-500">fee</span>
                </span>
              )}
            </div>
            
            {/* Approval Required Indicator */}
            {directory.requiresApproval && (
              <div className="text-xs text-secondary-400 flex items-center gap-1">
                <span>⏳</span> Review req.
              </div>
            )}
          </div>
        </div>

        {/* Hover Effect Overlay */}
        {isHovered && !isLocked && (
          <div className="absolute inset-0 bg-volt-500/5 rounded-xl pointer-events-none transition-opacity duration-300" />
        )}

        {/* Selection Action Button */}
        {!isLocked && (
          <div className="absolute bottom-4 left-4 right-4 opacity-0 transform translate-y-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSelect()
              }}
              className={`w-full py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                isSelected ?
                  'bg-success-500 text-white hover:bg-success-600' :
                  'bg-volt-500/20 text-volt-400 hover:bg-volt-500 hover:text-secondary-900 border border-volt-500/50'
              }`}
            >
              {isSelected ? '✓ Selected' : '+ Select Directory'}
            </button>
          </div>
        )}
      </div>

      {/* Tier Lock Modal */}
      <TierLockModal
        isOpen={showTierModal}
        onClose={() => setShowTierModal(false)}
        directory={directory}
        currentTier={userTier}
        requiredTier={requiredTier}
        onUpgrade={() => {
          setShowTierModal(false)
          onTierUpgrade()
        }}
      />
    </>
  )
}