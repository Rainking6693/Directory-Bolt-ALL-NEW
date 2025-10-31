'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Directory, SelectionStats } from '../lib/types/directory'

interface UseBatchSelectionReturn {
  selectedIds: string[]
  toggleDirectory: (directoryId: string) => void
  selectAll: () => void
  clearAll: () => void
  selectByCategory: (category: string) => void
  selectByPreset: (preset: SelectionPreset) => void
  isAllSelected: boolean
  getSelectionStats: () => SelectionStats
  selectedDirectories: Directory[]
}

export interface SelectionPreset {
  id: string
  name: string
  criteria: {
    categories?: string[]
    minDA?: number
    maxPrice?: number
    difficulty?: 'Easy' | 'Medium' | 'Hard'
    maxCount?: number
    requiresApproval?: boolean
  }
}

export function useBatchSelection(
  directories: Directory[],
  initialSelection: string[] = [],
  onSelectionChange?: (selectedIds: string[]) => void
): UseBatchSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelection)

  // Update selection when initialSelection changes
  useEffect(() => {
    setSelectedIds(initialSelection)
  }, [initialSelection])

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(selectedIds)
  }, [selectedIds, onSelectionChange])

  // Toggle single directory selection
  const toggleDirectory = useCallback((directoryId: string) => {
    setSelectedIds(prev => {
      if (prev.includes(directoryId)) {
        return prev.filter(id => id !== directoryId)
      } else {
        return [...prev, directoryId]
      }
    })
  }, [])

  // Select all visible directories
  const selectAll = useCallback(() => {
    const allIds = directories.map(dir => dir.id)
    setSelectedIds(allIds)
  }, [directories])

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedIds([])
  }, [])

  // Select directories by category
  const selectByCategory = useCallback((category: string) => {
    const categoryDirectories = directories
      .filter(dir => dir.category === category)
      .map(dir => dir.id)
    
    setSelectedIds(prev => {
      // Add all category directories that aren't already selected
      const newIds = categoryDirectories.filter(id => !prev.includes(id))
      return [...prev, ...newIds]
    })
  }, [directories])

  // Select directories by preset criteria
  const selectByPreset = useCallback((preset: SelectionPreset) => {
    let filteredDirectories = [...directories]

    // Apply category filter
    if (preset.criteria.categories) {
      filteredDirectories = filteredDirectories.filter(dir => 
        preset.criteria.categories!.includes(dir.category)
      )
    }

    // Apply minimum DA filter
    if (preset.criteria.minDA !== undefined) {
      filteredDirectories = filteredDirectories.filter(dir => 
        dir.domain_authority >= preset.criteria.minDA!
      )
    }

    // Apply maximum price filter
    if (preset.criteria.maxPrice !== undefined) {
      filteredDirectories = filteredDirectories.filter(dir => 
        (dir.submission_fee || 0) <= preset.criteria.maxPrice!
      )
    }

    // Apply difficulty filter
    if (preset.criteria.difficulty) {
      filteredDirectories = filteredDirectories.filter(dir => 
        dir.difficulty === preset.criteria.difficulty
      )
    }

    // Apply approval requirement filter
    if (preset.criteria.requiresApproval !== undefined) {
      filteredDirectories = filteredDirectories.filter(dir => 
        dir.requires_approval === preset.criteria.requiresApproval
      )
    }

    // Sort by domain authority (highest first) and limit count
    filteredDirectories.sort((a, b) => b.domain_authority - a.domain_authority)
    
    if (preset.criteria.maxCount) {
      filteredDirectories = filteredDirectories.slice(0, preset.criteria.maxCount)
    }

    const presetIds = filteredDirectories.map(dir => dir.id)
    setSelectedIds(presetIds)
  }, [directories])

  // Check if all directories are selected
  const isAllSelected = useMemo(() => {
    return directories.length > 0 && selectedIds.length === directories.length
  }, [directories.length, selectedIds.length])

  // Get selected directory objects
  const selectedDirectories = useMemo(() => {
    return directories.filter(dir => selectedIds.includes(dir.id))
  }, [directories, selectedIds])

  // Calculate selection statistics
  const getSelectionStats = useCallback((): SelectionStats => {
    const selected = directories.filter(dir => selectedIds.includes(dir.id))

    const stats: SelectionStats = {
      totalDirectories: selected.length,
      highDADirectories: selected.filter(dir => dir.domain_authority >= 80).length,
      freeDirectories: selected.filter(dir => (dir.submission_fee || 0) === 0).length,
      totalTraffic: selected.reduce((sum, dir) => sum + (dir.monthly_traffic || 0), 0),
      totalCost: selected.reduce((sum, dir) => sum + (dir.submission_fee || 0), 0),
      averageApprovalTime: selected.length > 0 
        ? selected.reduce((sum, dir) => sum + dir.turnaround_time_days, 0) / selected.length 
        : 0,
      categoryBreakdown: {} as Record<any, number>,
      difficultyBreakdown: { Easy: 0, Medium: 0, Hard: 0 }
    }

    // Calculate category breakdown
    selected.forEach(dir => {
      stats.categoryBreakdown[dir.category] = (stats.categoryBreakdown[dir.category] || 0) + 1
    })

    // Calculate difficulty breakdown
    selected.forEach(dir => {
      stats.difficultyBreakdown[dir.difficulty]++
    })

    return stats
  }, [directories, selectedIds])

  return {
    selectedIds,
    toggleDirectory,
    selectAll,
    clearAll,
    selectByCategory,
    selectByPreset,
    isAllSelected,
    getSelectionStats,
    selectedDirectories
  }
}