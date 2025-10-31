'use client'
import { useState, useMemo } from 'react'
import DirectoryCard from './DirectoryCard'
import BulkSelectControls from './BulkSelectControls'

const CATEGORIES = [
  'All Categories',
  'Search Engines',
  'Review Sites', 
  'Business Directories',
  'Local Listings',
  'Industry-specific',
  'Social Media',
  'Professional Networks'
]

const DIFFICULTY_LEVELS = [
  'All Difficulties',
  'easy',
  'medium', 
  'hard'
]

const TIER_REQUIREMENTS = {
  starter: ['easy'],
  growth: ['easy', 'medium'],
  professional: ['easy', 'medium', 'hard'],
  enterprise: ['easy', 'medium', 'hard']
}

export default function DirectoryGrid({ 
  directories = [],
  isLoading = false,
  userTier = 'starter',
  selectedDirectories = [],
  onDirectorySelect = () => {},
  onBulkSelect = () => {},
  onTierUpgrade = () => {}
}) {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [selectedDifficulty, setSelectedDifficulty] = useState('All Difficulties')
  const [sortBy, setSortBy] = useState('authority') // authority, name, difficulty
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false)

  // Filtered and sorted directories
  const filteredDirectories = useMemo(() => {
    let filtered = directories

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(dir => 
        dir.name.toLowerCase().includes(query) ||
        dir.category.toLowerCase().includes(query) ||
        dir.features.some(feature => feature.toLowerCase().includes(query))
      )
    }

    // Apply category filter
    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter(dir => dir.category === selectedCategory)
    }

    // Apply difficulty filter
    if (selectedDifficulty !== 'All Difficulties') {
      filtered = filtered.filter(dir => dir.difficulty === selectedDifficulty)
    }

    // Apply tier availability filter
    if (showOnlyAvailable) {
      const allowedDifficulties = TIER_REQUIREMENTS[userTier] || []
      filtered = filtered.filter(dir => allowedDifficulties.includes(dir.difficulty))
    }

    // Sort directories
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'authority':
          return b.authority - a.authority
        case 'name':
          return a.name.localeCompare(b.name)
        case 'difficulty':
          const difficultyOrder = { easy: 1, medium: 2, hard: 3 }
          return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
        default:
          return 0
      }
    })

    return filtered
  }, [directories, searchQuery, selectedCategory, selectedDifficulty, sortBy, showOnlyAvailable, userTier])

  // Stats for display
  const stats = useMemo(() => {
    const total = directories.length
    const available = directories.filter(dir => 
      TIER_REQUIREMENTS[userTier]?.includes(dir.difficulty)
    ).length
    const selected = selectedDirectories.length
    const filtered = filteredDirectories.length

    return { total, available, selected, filtered }
  }, [directories, userTier, selectedDirectories, filteredDirectories])

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-8 bg-secondary-700 rounded-lg mb-4 animate-pulse shimmer"></div>
          <div className="h-12 bg-secondary-700 rounded-xl mb-6 animate-pulse shimmer"></div>
          <div className="flex gap-4 mb-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 w-32 bg-secondary-700 rounded-lg animate-pulse shimmer"></div>
            ))}
          </div>
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="card h-80 animate-pulse shimmer"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header Section */}
      <div className="mb-8 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-black text-white mb-2">
              Choose Your Directories
            </h2>
            <p className="text-secondary-300">
              {stats.filtered} directories found • {stats.selected} selected • {stats.available} available on your plan
            </p>
          </div>
          
          {/* Tier upgrade hint for locked directories */}
          {stats.total > stats.available && (
            <button
              onClick={onTierUpgrade}
              className="px-4 py-2 bg-volt-500/20 border border-volt-500/50 rounded-lg text-volt-400 hover:bg-volt-500/30 transition-all duration-300 transform hover:scale-105 text-sm"
            >
              🔓 Unlock {stats.total - stats.available} Premium Directories
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search directories by name, category, or features..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-12 pr-4 text-lg"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-secondary-400 hover:text-white transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input-field w-auto min-w-[180px] py-2"
          >
            {CATEGORIES.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          {/* Difficulty Filter */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="input-field w-auto min-w-[160px] py-2"
          >
            {DIFFICULTY_LEVELS.map(difficulty => (
              <option key={difficulty} value={difficulty}>
                {difficulty === 'All Difficulties' ? difficulty : `${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)} Difficulty`}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-field w-auto min-w-[140px] py-2"
          >
            <option value="authority">Sort by Authority</option>
            <option value="name">Sort by Name</option>
            <option value="difficulty">Sort by Difficulty</option>
          </select>

          {/* Show Only Available Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyAvailable}
              onChange={(e) => setShowOnlyAvailable(e.target.checked)}
              className="w-5 h-5 text-volt-500 rounded border-2 border-secondary-600 focus:ring-volt-500 focus:ring-2"
            />
            <span className="text-sm text-secondary-300 select-none">
              Show only available on my tier
            </span>
          </label>
        </div>

        {/* Bulk Selection Controls */}
        <BulkSelectControls
          directories={filteredDirectories}
          selectedDirectories={selectedDirectories}
          userTier={userTier}
          onBulkSelect={onBulkSelect}
          onTierUpgrade={onTierUpgrade}
        />
      </div>

      {/* Directory Grid */}
      {filteredDirectories.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-2xl font-bold text-white mb-2">No directories found</h3>
          <p className="text-secondary-300 mb-6">
            {searchQuery ? 
              'Try adjusting your search terms or filters.' : 
              'No directories match your current filters.'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('')
              setSelectedCategory('All Categories')
              setSelectedDifficulty('All Difficulties')
              setShowOnlyAvailable(false)
            }}
            className="btn-secondary"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDirectories.map((directory, index) => (
            <div
              key={directory.id}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <DirectoryCard
                directory={directory}
                userTier={userTier}
                isSelected={selectedDirectories.some(d => d.id === directory.id)}
                onSelect={() => onDirectorySelect(directory)}
                onTierUpgrade={onTierUpgrade}
              />
            </div>
          ))}
        </div>
      )}

      {/* Load More / Pagination could go here */}
      {filteredDirectories.length > 0 && (
        <div className="mt-12 text-center">
          <p className="text-secondary-400 text-sm">
            Showing {filteredDirectories.length} of {stats.total} directories
          </p>
        </div>
      )}
    </div>
  )
}