'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useDirectoryData } from '../../hooks/useDirectoryData'
import { useBatchSelection } from '../../hooks/useBatchSelection'
import { DirectoryCard } from './DirectoryCard'
import { DirectoryFilters } from './DirectoryFilters'
import { BatchSelector } from './BatchSelector'
import { RecommendationEngine } from './RecommendationEngine'
import type { Directory, DirectoryFilters as FilterTypes } from '../../lib/types/directory'

interface DirectoryBrowserProps {
  onDirectorySelect?: (directoryId: string) => void
  onBatchSelect?: (directoryIds: string[]) => void
  selectedDirectories?: string[]
  businessAnalysis?: any
  showRecommendations?: boolean
  itemHeight?: number
  maxDisplayedItems?: number
}

export function DirectoryBrowser({
  onDirectorySelect,
  onBatchSelect,
  selectedDirectories = [],
  businessAnalysis,
  showRecommendations = true,
  itemHeight = 280,
  maxDisplayedItems = 50
}: DirectoryBrowserProps) {
  const [filters, setFilters] = useState<FilterTypes>({
    category: undefined,
    minDomainAuthority: undefined,
    maxPrice: undefined,
    difficulty: undefined,
    requiresApproval: undefined,
    search: '',
    sortBy: 'domain_authority',
    sortOrder: 'desc'
  })

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Fetch directory data with React Query
  const { 
    directories, 
    loading, 
    error,
    totalCount,
    hasNextPage,
    fetchNextPage
  } = useDirectoryData(filters)

  // Batch selection management
  const {
    selectedIds,
    toggleDirectory,
    selectAll,
    clearAll,
    isAllSelected,
    getSelectionStats
  } = useBatchSelection(directories, selectedDirectories, onBatchSelect)

  // Virtual scrolling implementation
  const { visibleItems, startIndex, endIndex } = useMemo(() => {
    if (!directories.length || !containerRef.current) {
      return { visibleItems: directories.slice(0, maxDisplayedItems), startIndex: 0, endIndex: maxDisplayedItems }
    }

    const containerHeight = containerRef.current.clientHeight
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 5 // Buffer items
    const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - 2)
    const endIdx = Math.min(directories.length, startIdx + visibleCount)

    return {
      visibleItems: directories.slice(startIdx, endIdx),
      startIndex: startIdx,
      endIndex: endIdx
    }
  }, [directories, scrollTop, itemHeight, maxDisplayedItems])

  // Handle scroll for virtual scrolling
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop
    setScrollTop(scrollTop)

    // Infinite loading - fetch more when near bottom
    const scrollHeight = e.currentTarget.scrollHeight
    const clientHeight = e.currentTarget.clientHeight
    const scrollPercent = (scrollTop + clientHeight) / scrollHeight

    if (scrollPercent > 0.8 && hasNextPage && !loading) {
      fetchNextPage()
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'a':
          e.preventDefault()
          if (isAllSelected) {
            clearAll()
          } else {
            selectAll()
          }
          break
      }
    }
  }

  // Calculate virtual scroll styles
  const totalHeight = directories.length * itemHeight
  const offsetY = startIndex * itemHeight

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8 bg-red-900/20 border border-red-500/30 rounded-xl">
          <div className="text-red-400 text-xl font-bold mb-4">Failed to Load Directories</div>
          <div className="text-secondary-300 mb-4">{error.message}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header Section */}
      <div className="sticky top-0 z-50 bg-secondary-900/95 backdrop-blur-sm border-b border-secondary-700">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600">
                Directory Catalog
              </h1>
              <p className="text-secondary-300 text-lg">
                {totalCount.toLocaleString()} high-authority directories • {selectedIds.length} selected
              </p>
            </div>

            {/* View Toggle & Quick Actions */}
            <div className="flex items-center gap-4">
              <div className="flex bg-secondary-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-volt-500 text-secondary-900' 
                      : 'text-secondary-300 hover:text-white'
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-volt-500 text-secondary-900' 
                      : 'text-secondary-300 hover:text-white'
                  }`}
                >
                  List
                </button>
              </div>

              <BatchSelector
                selectedCount={selectedIds.length}
                totalCount={directories.length}
                isAllSelected={isAllSelected}
                onSelectAll={selectAll}
                onClearAll={clearAll}
                selectionStats={getSelectionStats()}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="sticky top-32">
              <DirectoryFilters
                filters={filters}
                onFiltersChange={setFilters}
                directoryStats={{
                  totalDirectories: totalCount,
                  averageDA: Math.round(directories.reduce((sum, d) => sum + d.domain_authority, 0) / directories.length) || 0,
                  freeDirectories: directories.filter(d => (d.submission_fee || 0) === 0).length,
                  categoryCounts: directories.reduce((acc, d) => {
                    acc[d.category] = (acc[d.category] || 0) + 1
                    return acc
                  }, {} as Record<string, number>)
                }}
              />

              {showRecommendations && businessAnalysis && (
                <div className="mt-6">
                  <RecommendationEngine
                    businessAnalysis={businessAnalysis}
                    directories={directories}
                    selectedDirectories={selectedIds}
                    onRecommendationSelect={toggleDirectory}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-h-0">
            {loading && directories.length === 0 ? (
              /* Loading Skeleton */
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="h-64 bg-secondary-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              </div>
            ) : directories.length === 0 ? (
              /* No Results */
              <div className="text-center py-16">
                <div className="text-secondary-400 text-xl mb-4">No directories found</div>
                <p className="text-secondary-500">Try adjusting your filters or search terms</p>
                <button
                  onClick={() => setFilters({
                    category: undefined,
                    minDomainAuthority: undefined,
                    maxPrice: undefined,
                    difficulty: undefined,
                    requiresApproval: undefined,
                    search: '',
                    sortBy: 'domain_authority',
                    sortOrder: 'desc'
                  })}
                  className="mt-4 px-6 py-2 bg-volt-500 text-secondary-900 rounded-lg hover:bg-volt-400 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              /* Virtual Scrolled Directory Grid */
              <div
                ref={containerRef}
                className="relative h-[calc(100vh-280px)] overflow-auto"
                onScroll={handleScroll}
              >
                <div 
                  style={{ height: totalHeight }}
                  className="relative"
                >
                  <div
                    style={{ 
                      transform: `translateY(${offsetY}px)`,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0
                    }}
                  >
                    <div className={
                      viewMode === 'grid' 
                        ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' 
                        : 'space-y-4'
                    }>
                      {visibleItems.map((directory, index) => (
                        <DirectoryCard
                          key={directory.id}
                          directory={directory}
                          isSelected={selectedIds.includes(directory.id)}
                          onToggle={() => {
                            toggleDirectory(directory.id)
                            onDirectorySelect?.(directory.id)
                          }}
                          viewMode={viewMode}
                          animationDelay={index * 50}
                          showRecommendationBadge={businessAnalysis && directory.recommended}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Loading more indicator */}
                {loading && directories.length > 0 && (
                  <div className="flex justify-center py-8">
                    <div className="flex items-center gap-3 text-volt-400">
                      <div className="w-5 h-5 border-2 border-volt-400 border-t-transparent rounded-full animate-spin" />
                      Loading more directories...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selection Summary Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-secondary-900/95 backdrop-blur-sm border-t border-secondary-700 p-4 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-volt-400 font-bold">
                {selectedIds.length} directories selected
              </div>
              <div className="text-secondary-300 text-sm">
                Est. {getSelectionStats().totalTraffic.toLocaleString()} monthly visitors
              </div>
              <div className="text-secondary-300 text-sm">
                ${getSelectionStats().totalCost.toLocaleString()} total fees
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={clearAll}
                className="px-4 py-2 text-secondary-300 hover:text-white transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => onBatchSelect?.(selectedIds)}
                className="px-6 py-2 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold rounded-lg hover:from-volt-400 hover:to-volt-500 transition-colors"
              >
                Proceed with Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}