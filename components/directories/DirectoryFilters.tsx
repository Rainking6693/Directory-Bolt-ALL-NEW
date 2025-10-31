'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { DirectoryFilters as FilterTypes } from '../../lib/types/directory'

interface DirectoryFiltersProps {
  filters: FilterTypes
  onFiltersChange: (filters: FilterTypes) => void
  directoryStats?: {
    totalDirectories: number
    averageDA: number
    freeDirectories: number
    categoryCounts: Record<string, number>
  }
}

const CATEGORIES = [
  { value: 'business_general', label: 'Business General', icon: '🏢' },
  { value: 'local_business', label: 'Local Business', icon: '📍' },
  { value: 'tech_startups', label: 'Tech Startups', icon: '🚀' },
  { value: 'saas', label: 'SaaS', icon: '💻' },
  { value: 'ecommerce', label: 'E-commerce', icon: '🛒' },
  { value: 'healthcare', label: 'Healthcare', icon: '⚕️' },
  { value: 'education', label: 'Education', icon: '🎓' },
  { value: 'finance', label: 'Finance', icon: '💰' },
  { value: 'legal', label: 'Legal', icon: '⚖️' },
  { value: 'real_estate', label: 'Real Estate', icon: '🏠' },
  { value: 'professional_services', label: 'Professional Services', icon: '💼' },
  { value: 'restaurants', label: 'Restaurants', icon: '🍽️' },
  { value: 'automotive', label: 'Automotive', icon: '🚗' },
  { value: 'review_platforms', label: 'Review Platforms', icon: '⭐' },
  { value: 'social_media', label: 'Social Media', icon: '📱' },
  { value: 'content_media', label: 'Content & Media', icon: '📺' },
  { value: 'ai_tools', label: 'AI Tools', icon: '🤖' },
  { value: 'non_profit', label: 'Non-Profit', icon: '🤝' },
]

const DIFFICULTY_OPTIONS = [
  { value: 'Easy', label: 'Easy', icon: '🟢', description: 'Simple form submission' },
  { value: 'Medium', label: 'Medium', icon: '🟡', description: 'Moderate requirements' },
  { value: 'Hard', label: 'Hard', icon: '🔴', description: 'Complex approval process' }
]

const SORT_OPTIONS = [
  { value: 'domain_authority', label: 'Domain Authority', icon: '📊' },
  { value: 'monthly_traffic', label: 'Traffic Volume', icon: '📈' },
  { value: 'submission_fee', label: 'Price', icon: '💲' },
  { value: 'name', label: 'Name A-Z', icon: '🔤' },
  { value: 'time_to_approval', label: 'Approval Time', icon: '⏱️' }
]

export function DirectoryFilters({ 
  filters, 
  onFiltersChange, 
  directoryStats 
}: DirectoryFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchInput, setSearchInput] = useState(filters.search || '')
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  
  // Memoize the callback to prevent infinite re-renders
  const handleFiltersChange = useCallback((newFilters: FilterTypes) => {
    onFiltersChange(newFilters)
  }, [onFiltersChange])

  // Debounced search with stable reference to filters
  const stableFilters = useCallback(() => filters, [filters])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      const currentFilters = stableFilters()
      if (currentFilters.search !== searchInput) {
        handleFiltersChange({ ...currentFilters, search: searchInput })
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchInput, stableFilters, handleFiltersChange])

  const updateFilter = useCallback((key: keyof FilterTypes, value: any) => {
    handleFiltersChange({ ...filters, [key]: value })
  }, [filters, handleFiltersChange])

  const clearAllFilters = useCallback(() => {
    setSearchInput('')
    handleFiltersChange({
      category: undefined,
      minDomainAuthority: undefined,
      maxPrice: undefined,
      difficulty: undefined,
      requiresApproval: undefined,
      search: '',
      sortBy: 'domain_authority',
      sortOrder: 'desc'
    })
  }, [handleFiltersChange])

  const hasActiveFilters = !!(
    filters.category ||
    filters.minDomainAuthority ||
    filters.maxPrice !== undefined ||
    filters.difficulty ||
    filters.requiresApproval !== undefined ||
    filters.search
  )

  return (
    <div className="bg-secondary-800/50 rounded-xl p-6 border border-secondary-700 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-volt-400">Filter Directories</h3>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-secondary-400 hover:text-white text-sm transition-colors"
            >
              Clear All
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="lg:hidden text-volt-400 hover:text-volt-300 transition-colors"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      <div className={`space-y-6 ${isExpanded ? 'block' : 'hidden lg:block'}`}>
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-secondary-300 mb-2">
            Search Directories
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, website, or features..."
              className="w-full px-4 py-3 pl-10 bg-secondary-900 border border-secondary-600 rounded-lg text-white placeholder-secondary-400 focus:outline-none focus:border-volt-500 focus:ring-1 focus:ring-volt-500 transition-colors"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-secondary-400 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div>
          <label className="block text-sm font-medium text-secondary-300 mb-3">
            Quick Filters
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateFilter('minDomainAuthority', filters.minDomainAuthority === 80 ? undefined : 80)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filters.minDomainAuthority === 80
                  ? 'bg-volt-500 text-secondary-900'
                  : 'bg-secondary-700 text-secondary-300 hover:bg-secondary-600'
              }`}
            >
              High DA (80+)
            </button>
            
            <button
              onClick={() => updateFilter('maxPrice', filters.maxPrice === 0 ? undefined : 0)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filters.maxPrice === 0
                  ? 'bg-green-600 text-white'
                  : 'bg-secondary-700 text-secondary-300 hover:bg-secondary-600'
              }`}
            >
              Free Only
            </button>
            
            <button
              onClick={() => updateFilter('difficulty', filters.difficulty === 'Easy' ? undefined : 'Easy')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filters.difficulty === 'Easy'
                  ? 'bg-blue-600 text-white'
                  : 'bg-secondary-700 text-secondary-300 hover:bg-secondary-600'
              }`}
            >
              Easy Submit
            </button>
            
            <button
              onClick={() => updateFilter('requiresApproval', filters.requiresApproval === false ? undefined : false)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filters.requiresApproval === false
                  ? 'bg-purple-600 text-white'
                  : 'bg-secondary-700 text-secondary-300 hover:bg-secondary-600'
              }`}
            >
              No Approval
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-secondary-300 mb-3">
            Category ({Object.keys(directoryStats?.categoryCounts || {}).length} categories)
          </label>
          <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
            {CATEGORIES.map((category) => (
              <button
                key={category.value}
                onClick={() => updateFilter('category', 
                  filters.category === category.value ? undefined : category.value
                )}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  filters.category === category.value
                    ? 'bg-volt-500 text-secondary-900'
                    : 'bg-secondary-700/50 text-secondary-300 hover:bg-secondary-600/50 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                </div>
                <span className="text-xs">
                  {directoryStats?.categoryCounts[category.value] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Domain Authority Range */}
        <div>
          <label className="block text-sm font-medium text-secondary-300 mb-3">
            Minimum Domain Authority
          </label>
          <div className="space-y-3">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={filters.minDomainAuthority || 0}
              onChange={(e) => updateFilter('minDomainAuthority', 
                parseInt(e.target.value) || undefined
              )}
              className="w-full h-2 bg-secondary-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary-400">
                DA {filters.minDomainAuthority || 0}+
              </span>
              <span className="text-secondary-500">
                Avg: {directoryStats?.averageDA || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Price Range */}
        <div>
          <label className="block text-sm font-medium text-secondary-300 mb-3">
            Maximum Price
          </label>
          <div className="space-y-3">
            <select
              value={filters.maxPrice !== undefined ? filters.maxPrice.toString() : ''}
              onChange={(e) => updateFilter('maxPrice', 
                e.target.value === '' ? undefined : parseInt(e.target.value)
              )}
              className="w-full px-3 py-2 bg-secondary-900 border border-secondary-600 rounded-lg text-white focus:outline-none focus:border-volt-500 focus:ring-1 focus:ring-volt-500"
            >
              <option value="">Any Price</option>
              <option value="0">Free Only</option>
              <option value="2500">Up to $25</option>
              <option value="5000">Up to $50</option>
              <option value="10000">Up to $100</option>
              <option value="25000">Up to $250</option>
              <option value="50000">Up to $500</option>
            </select>
            <div className="text-sm text-secondary-500">
              {directoryStats?.freeDirectories || 0} free directories available
            </div>
          </div>
        </div>

        {/* Difficulty Filter */}
        <div>
          <label className="block text-sm font-medium text-secondary-300 mb-3">
            Submission Difficulty
          </label>
          <div className="grid grid-cols-1 gap-2">
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => updateFilter('difficulty', 
                  filters.difficulty === option.value ? undefined : option.value
                )}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  filters.difficulty === option.value
                    ? 'bg-volt-500 text-secondary-900'
                    : 'bg-secondary-700/50 text-secondary-300 hover:bg-secondary-600/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{option.icon}</span>
                  <span>{option.label}</span>
                </div>
                <span className="text-xs opacity-70">
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Approval Requirement */}
        <div>
          <label className="block text-sm font-medium text-secondary-300 mb-3">
            Approval Process
          </label>
          <div className="space-y-2">
            <button
              onClick={() => updateFilter('requiresApproval', 
                filters.requiresApproval === false ? undefined : false
              )}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                filters.requiresApproval === false
                  ? 'bg-green-600 text-white'
                  : 'bg-secondary-700/50 text-secondary-300 hover:bg-secondary-600/50'
              }`}
            >
              <span>No Approval Required</span>
              <span>⚡</span>
            </button>
            
            <button
              onClick={() => updateFilter('requiresApproval', 
                filters.requiresApproval === true ? undefined : true
              )}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                filters.requiresApproval === true
                  ? 'bg-orange-600 text-white'
                  : 'bg-secondary-700/50 text-secondary-300 hover:bg-secondary-600/50'
              }`}
            >
              <span>Requires Approval</span>
              <span>🔍</span>
            </button>
          </div>
        </div>

        {/* Sort Options */}
        <div>
          <label className="block text-sm font-medium text-secondary-300 mb-3">
            Sort By
          </label>
          <div className="space-y-2">
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilter('sortBy', e.target.value)}
              className="w-full px-3 py-2 bg-secondary-900 border border-secondary-600 rounded-lg text-white focus:outline-none focus:border-volt-500 focus:ring-1 focus:ring-volt-500"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.icon} {option.label}
                </option>
              ))}
            </select>
            
            <div className="flex bg-secondary-700 rounded-lg p-1">
              <button
                onClick={() => updateFilter('sortOrder', 'desc')}
                className={`flex-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
                  filters.sortOrder === 'desc'
                    ? 'bg-volt-500 text-secondary-900'
                    : 'text-secondary-300 hover:text-white'
                }`}
              >
                ↓ High to Low
              </button>
              <button
                onClick={() => updateFilter('sortOrder', 'asc')}
                className={`flex-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
                  filters.sortOrder === 'asc'
                    ? 'bg-volt-500 text-secondary-900'
                    : 'text-secondary-300 hover:text-white'
                }`}
              >
                ↑ Low to High
              </button>
            </div>
          </div>
        </div>

        {/* Filter Summary */}
        {hasActiveFilters && (
          <div className="pt-4 border-t border-secondary-600">
            <div className="text-sm text-secondary-300 mb-2">Active Filters:</div>
            <div className="space-y-1">
              {filters.category && (
                <div className="text-xs text-volt-400">
                  Category: {CATEGORIES.find(c => c.value === filters.category)?.label}
                </div>
              )}
              {filters.minDomainAuthority && (
                <div className="text-xs text-volt-400">
                  Min DA: {filters.minDomainAuthority}+
                </div>
              )}
              {filters.maxPrice !== undefined && (
                <div className="text-xs text-volt-400">
                  Max Price: {filters.maxPrice === 0 ? 'Free' : `$${filters.maxPrice / 100}`}
                </div>
              )}
              {filters.difficulty && (
                <div className="text-xs text-volt-400">
                  Difficulty: {filters.difficulty}
                </div>
              )}
              {filters.search && (
                <div className="text-xs text-volt-400">
                  Search: "{filters.search}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #FFD700;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #FFD700;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  )
}