'use client'
import { useMemo, useCallback } from 'react'

const TIER_REQUIREMENTS = {
  starter: ['easy'],
  growth: ['easy', 'medium'],
  professional: ['easy', 'medium', 'hard'],
  enterprise: ['easy', 'medium', 'hard']
}

const CATEGORIES = [
  'Search Engines',
  'Review Sites', 
  'Business Directories',
  'Local Listings',
  'Industry-specific',
  'Social Media',
  'Professional Networks'
]

export default function BulkSelectControls({
  directories = [],
  selectedDirectories = [],
  userTier = 'starter',
  onBulkSelect = () => {},
  onTierUpgrade = () => {}
}) {
  const allowedDifficulties = useMemo(() => TIER_REQUIREMENTS[userTier] || [], [userTier])
  
  const stats = useMemo(() => {
    const available = directories.filter(dir => allowedDifficulties.includes(dir.difficulty))
    const locked = directories.filter(dir => !allowedDifficulties.includes(dir.difficulty))
    const selectedCount = selectedDirectories.length
    const availableCount = available.length
    const lockedCount = locked.length
    
    // Category breakdown
    const categoryStats = CATEGORIES.map(category => {
      const inCategory = directories.filter(dir => dir.category === category)
      const availableInCategory = inCategory.filter(dir => allowedDifficulties.includes(dir.difficulty))
      const selectedInCategory = selectedDirectories.filter(dir => dir.category === category)
      
      return {
        category,
        total: inCategory.length,
        available: availableInCategory.length,
        selected: selectedInCategory.length,
        locked: inCategory.length - availableInCategory.length
      }
    }).filter(stat => stat.total > 0)

    return {
      total: directories.length,
      available: availableCount,
      locked: lockedCount,
      selected: selectedCount,
      categoryStats
    }
  }, [directories, selectedDirectories, allowedDifficulties])

  const handleSelectAll = () => {
    const available = directories.filter(dir => allowedDifficulties.includes(dir.difficulty))
    onBulkSelect([...selectedDirectories, ...available.filter(dir => 
      !selectedDirectories.some(selected => selected.id === dir.id)
    )])
  }

  const handleDeselectAll = () => {
    onBulkSelect([])
  }

  const handleSelectByCategory = (category) => {
    const categoryDirectories = directories.filter(dir => 
      dir.category === category && allowedDifficulties.includes(dir.difficulty)
    )
    
    const newSelections = categoryDirectories.filter(dir =>
      !selectedDirectories.some(selected => selected.id === dir.id)
    )
    
    onBulkSelect([...selectedDirectories, ...newSelections])
  }

  const handleDeselectByCategory = (category) => {
    const filtered = selectedDirectories.filter(dir => dir.category !== category)
    onBulkSelect(filtered)
  }

  const allAvailableSelected = stats.available > 0 && stats.selected === stats.available

  return (
    <div className="bg-secondary-800/50 rounded-xl p-6 mb-8 border border-secondary-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Bulk Selection</h3>
          <p className="text-secondary-300 text-sm">
            {stats.selected} selected • {stats.available} available • {stats.locked} locked
          </p>
        </div>

        {/* Main Action Buttons */}
        <div className="flex items-center gap-3">
          {stats.selected > 0 && (
            <button
              onClick={handleDeselectAll}
              className="px-4 py-2 border border-secondary-600 text-secondary-300 rounded-lg hover:border-secondary-500 hover:text-white transition-all duration-200 text-sm font-medium"
            >
              Clear All ({stats.selected})
            </button>
          )}
          
          <button
            onClick={handleSelectAll}
            disabled={allAvailableSelected}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
              allAvailableSelected
                ? 'bg-secondary-700 text-secondary-400 cursor-not-allowed'
                : 'bg-volt-500 text-secondary-900 hover:bg-volt-400 transform hover:scale-105'
            }`}
          >
            {allAvailableSelected ? '✓ All Selected' : `Select All Available (${stats.available})`}
          </button>

          {stats.locked > 0 && (
            <button
              onClick={onTierUpgrade}
              className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-volt-500/20 border border-volt-500/50 text-volt-400 rounded-lg hover:from-purple-500/30 hover:to-volt-500/30 transition-all duration-200 text-sm font-bold transform hover:scale-105"
            >
              🔓 Unlock {stats.locked} Premium
            </button>
          )}
        </div>
      </div>

      {/* Category Quick Select */}
      {stats.categoryStats.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-white mb-3">Quick Select by Category</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {stats.categoryStats.map((categoryData) => {
              const isFullySelected = categoryData.available > 0 && categoryData.selected === categoryData.available
              const hasSelections = categoryData.selected > 0
              const hasAvailable = categoryData.available > 0

              return (
                <div
                  key={categoryData.category}
                  className="bg-secondary-900/50 rounded-lg p-4 border border-secondary-700/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-medium text-white truncate">
                      {categoryData.category}
                    </h5>
                    
                    {/* Category stats */}
                    <div className="text-xs text-secondary-400">
                      {categoryData.selected}/{categoryData.available}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs space-y-1">
                      <div className="text-secondary-400">
                        {categoryData.available} available
                      </div>
                      {categoryData.locked > 0 && (
                        <div className="text-orange-400">
                          {categoryData.locked} locked 🔒
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {hasSelections && (
                        <button
                          onClick={() => handleDeselectByCategory(categoryData.category)}
                          className="text-xs px-2 py-1 text-danger-400 hover:bg-danger-400/10 rounded border border-danger-400/30 hover:border-danger-400/50 transition-all duration-200"
                        >
                          Clear
                        </button>
                      )}
                      
                      {hasAvailable && !isFullySelected && (
                        <button
                          onClick={() => handleSelectByCategory(categoryData.category)}
                          className="text-xs px-2 py-1 bg-volt-500/20 text-volt-400 hover:bg-volt-500/30 rounded border border-volt-500/30 hover:border-volt-500/50 transition-all duration-200 font-medium"
                        >
                          Select All
                        </button>
                      )}

                      {isFullySelected && (
                        <div className="text-xs px-2 py-1 bg-success-500/20 text-success-400 rounded border border-success-500/30 font-medium">
                          ✓ All
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 w-full bg-secondary-700 rounded-full h-1">
                    <div
                      className="bg-gradient-to-r from-volt-500 to-volt-600 h-1 rounded-full transition-all duration-500"
                      style={{
                        width: categoryData.available > 0 ? `${(categoryData.selected / categoryData.available) * 100}%` : '0%'
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pro Tip */}
      {stats.selected > 0 && (
        <div className="mt-6 p-4 bg-volt-500/5 border border-volt-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-volt-400 text-lg">💡</div>
            <div>
              <div className="text-sm font-bold text-volt-400 mb-1">Pro Tip</div>
              <div className="text-xs text-secondary-300">
                You've selected {stats.selected} directories. Consider starting with high-authority directories 
                (DA 80+) for maximum impact, then work your way down. This approach typically yields 
                better results faster.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}