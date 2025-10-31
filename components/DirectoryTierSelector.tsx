'use client'
import { useState, useEffect } from 'react'
import { DirectoryTierManager, TierConfig, DirectoryTierData } from '../lib/database/directory-tiers'

interface DirectoryTierSelectorProps {
  userTier: number
  onUpgrade?: (targetTier: number) => void
  showUpgradePrompts?: boolean
}

export default function DirectoryTierSelector({ 
  userTier, 
  onUpgrade,
  showUpgradePrompts = true 
}: DirectoryTierSelectorProps) {
  const [selectedTier, setSelectedTier] = useState(userTier)
  const [directories, setDirectories] = useState<DirectoryTierData[]>([])
  const [tierConfig, setTierConfig] = useState<TierConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTierData(selectedTier)
  }, [selectedTier])

  const loadTierData = async (tier: number) => {
    setLoading(true)
    try {
      const tierDirectories = DirectoryTierManager.getDirectoriesForTier(tier)
      const config = DirectoryTierManager.getTierConfig(tier)
      
      setDirectories(tierDirectories)
      setTierConfig(config)
    } catch (error) {
      // Error loading tier data - handled gracefully
    } finally {
      setLoading(false)
    }
  }

  const handleTierChange = (newTier: number) => {
    setSelectedTier(newTier)
  }

  const getUpgradeValue = (targetTier: number) => {
    if (targetTier <= userTier) return null
    return DirectoryTierManager.getUpgradeValue(userTier, targetTier)
  }

  const getTierStats = (tier: number) => {
    return DirectoryTierManager.getTierStats(tier)
  }

  if (loading || !tierConfig) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-volt-500"></div>
      </div>
    )
  }

  const stats = getTierStats(selectedTier)
  const isUpgrade = selectedTier > userTier
  const upgradeValue = isUpgrade ? getUpgradeValue(selectedTier) : null

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Tier Navigation */}
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-black mb-6 text-center">
          Directory Access by Tier
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600">
            Choose Your Level
          </span>
        </h2>
        
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          {[1, 2, 3, 4].map(tier => {
            const config = DirectoryTierManager.getTierConfig(tier)
            if (!config) return null
            
            const isUserTier = tier === userTier
            const isSelected = tier === selectedTier
            const isLocked = tier > userTier && showUpgradePrompts
            
            return (
              <button
                key={tier}
                onClick={() => handleTierChange(tier)}
                disabled={loading}
                className={`px-6 py-3 rounded-lg font-bold transition-all duration-300 relative ${
                  isSelected
                    ? 'bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 shadow-lg'
                    : isUserTier
                    ? 'bg-success-600 text-white'
                    : isLocked
                    ? 'bg-secondary-700 text-secondary-400 border border-secondary-600'
                    : 'bg-secondary-600 text-white hover:bg-secondary-500'
                }`}
              >
                {config.name}
                <div className="text-xs opacity-80">${config.price}/mo</div>
                {isUserTier && (
                  <div className="absolute -top-2 -right-2 bg-success-500 text-white text-xs px-2 py-1 rounded-full">
                    Current
                  </div>
                )}
                {isLocked && (
                  <div className="absolute -top-2 -right-2 bg-volt-500 text-secondary-900 text-xs px-2 py-1 rounded-full">
                    🔒
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tier Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Tier Stats */}
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-secondary-800/80 to-secondary-900/60 p-6 rounded-2xl border border-secondary-600 backdrop-blur-sm h-full">
            <h3 className="text-xl font-bold mb-4 text-volt-400">
              {tierConfig.name} Plan Overview
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-secondary-300">Total Directories:</span>
                <span className="text-volt-400 font-bold">{stats.totalDirectories}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-secondary-300">Average DA:</span>
                <span className="text-volt-400 font-bold">{stats.averageDA}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-secondary-300">Premium Sites:</span>
                <span className="text-volt-400 font-bold">{stats.premiumDirectories}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-secondary-300">Traffic Value:</span>
                <span className="text-volt-400 font-bold">
                  {stats.estimatedTrafficValue.toLocaleString()}
                </span>
              </div>

              <div className="border-t border-secondary-600 pt-4 mt-4">
                <div className="text-sm text-secondary-300 mb-2">Submission Time:</div>
                <div className="text-volt-400 font-bold">{tierConfig.submissionTimeEstimate}</div>
              </div>

              <div className="text-sm text-secondary-300 mb-2">DA Range:</div>
              <div className="text-volt-400 font-bold">
                {tierConfig.averageDARange[0]}-{tierConfig.averageDARange[1]}
              </div>
            </div>

            {/* Upgrade CTA */}
            {isUpgrade && upgradeValue && showUpgradePrompts && (
              <div className="mt-6 p-4 bg-volt-500/20 border border-volt-500/30 rounded-lg">
                <div className="text-volt-400 font-bold mb-2">Upgrade Benefits:</div>
                <div className="text-sm text-secondary-300 space-y-1">
                  <div>• +{upgradeValue.additionalDirectories} more directories</div>
                  <div>• {upgradeValue.trafficIncrease} traffic increase</div>
                  <div>• {upgradeValue.roiImprovement} ROI improvement</div>
                </div>
                
                <button
                  onClick={() => onUpgrade?.(selectedTier)}
                  className="w-full mt-4 py-2 bg-volt-500 text-secondary-900 font-bold rounded-lg hover:bg-volt-400 transition-colors"
                >
                  Upgrade to {tierConfig.name}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-secondary-800/80 to-secondary-900/60 p-6 rounded-2xl border border-secondary-600 backdrop-blur-sm h-full">
            <h3 className="text-xl font-bold mb-4 text-volt-400">Directory Categories</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {Object.entries(stats.categoryBreakdown).map(([category, count]) => (
                <div
                  key={category}
                  className="bg-secondary-700/50 p-3 rounded-lg border border-secondary-600/30"
                >
                  <div className="text-sm font-bold text-white">{category}</div>
                  <div className="text-volt-400 font-bold">{count} sites</div>
                </div>
              ))}
            </div>

            {/* Special Features */}
            <div className="border-t border-secondary-600 pt-4">
              <div className="text-sm font-bold text-secondary-300 mb-2">Special Features:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {tierConfig.specialFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-secondary-200">
                    <span className="text-volt-400">✓</span>
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Directory List */}
      <div className="bg-gradient-to-br from-secondary-800/80 to-secondary-900/60 p-6 rounded-2xl border border-secondary-600 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-volt-400">
            Available Directories ({directories.length})
          </h3>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-secondary-300">
              Sort by: Domain Authority (High to Low)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {directories.map((directory) => {
            const isAccessible = directory.tier <= userTier
            const isHighValue = directory.domainAuthority >= 70 || directory.competitivePriority >= 8
            
            return (
              <div
                key={directory.id}
                className={`p-4 rounded-lg border transition-all duration-300 ${
                  isAccessible
                    ? 'bg-secondary-700/50 border-secondary-600/50 hover:border-volt-500/50'
                    : 'bg-secondary-800/30 border-secondary-700/30 opacity-60'
                } ${
                  isHighValue ? 'ring-1 ring-volt-500/30' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className={`font-bold ${isAccessible ? 'text-white' : 'text-secondary-400'}`}>
                    {directory.name}
                  </h4>
                  
                  <div className="flex items-center gap-1">
                    {isHighValue && <span className="text-volt-400 text-xs">🔥</span>}
                    {!isAccessible && <span className="text-secondary-500 text-xs">🔒</span>}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-secondary-300">DA:</span>
                    <span className={`font-bold ${
                      directory.domainAuthority >= 80 ? 'text-success-400' :
                      directory.domainAuthority >= 60 ? 'text-volt-400' :
                      'text-secondary-300'
                    }`}>
                      {directory.domainAuthority}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-secondary-300">Traffic:</span>
                    <span className="text-volt-400 font-bold capitalize">
                      {directory.trafficPotential}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-secondary-300">Difficulty:</span>
                    <span className={`font-bold capitalize ${
                      directory.difficulty === 'easy' ? 'text-success-400' :
                      directory.difficulty === 'medium' ? 'text-volt-400' :
                      'text-orange-400'
                    }`}>
                      {directory.difficulty}
                    </span>
                  </div>

                  <div className="text-xs text-secondary-400 mt-2">
                    {directory.category}
                  </div>

                  {directory.specialRequirements && (
                    <div className="text-xs text-orange-400 mt-2">
                      ⚠️ {directory.specialRequirements[0]}
                    </div>
                  )}
                </div>

                {!isAccessible && (
                  <div className="mt-3 text-xs text-secondary-500 italic">
                    Unlock with {DirectoryTierManager.getTierConfig(directory.tier)?.name} plan
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {directories.length === 0 && (
          <div className="text-center py-8 text-secondary-400">
            No directories available for this tier.
          </div>
        )}
      </div>
    </div>
  )
}