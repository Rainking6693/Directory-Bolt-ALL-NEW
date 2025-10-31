'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Directory, DirectoryFilters, DirectoryListResponse, ApiError } from '../lib/types/directory'

interface UseDirectoryDataReturn {
  directories: Directory[]
  loading: boolean
  error: ApiError | null
  totalCount: number
  hasNextPage: boolean
  fetchNextPage: () => Promise<void>
  refetch: () => Promise<void>
  isValidating: boolean
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const ITEMS_PER_PAGE = 50

// Simple in-memory cache
const cache = new Map<string, { data: DirectoryListResponse; timestamp: number }>()

export function useDirectoryData(filters: DirectoryFilters): UseDirectoryDataReturn {
  const [directories, setDirectories] = useState<Directory[]>([])
  const [loading, setLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)

  // Generate cache key from filters
  const cacheKey = useMemo(() => {
    return JSON.stringify({
      ...filters,
      page: currentPage,
      limit: ITEMS_PER_PAGE
    })
  }, [filters, currentPage])

  // Check cache for existing data
  const getCachedData = useCallback((key: string): DirectoryListResponse | null => {
    const cached = cache.get(key)
    if (!cached) return null
    
    const isExpired = Date.now() - cached.timestamp > CACHE_DURATION
    if (isExpired) {
      cache.delete(key)
      return null
    }
    
    return cached.data
  }, [])

  // Fetch directories from API
  const fetchDirectories = useCallback(async (
    page: number = 1,
    append: boolean = false
  ): Promise<DirectoryListResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: ITEMS_PER_PAGE.toString(),
      ...(filters.category && { category: filters.category }),
      ...(filters.minDomainAuthority && { minAuthorityScore: filters.minDomainAuthority.toString() }),
      ...(filters.maxPrice !== undefined && { maxPrice: filters.maxPrice.toString() }),
      ...(filters.difficulty && { difficulty: filters.difficulty }),
      ...(filters.requiresApproval !== undefined && { requiresApproval: filters.requiresApproval.toString() }),
      ...(filters.search && { search: filters.search }),
      ...(filters.country && { country: filters.country }),
      ...(filters.language && { language: filters.language }),
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder
    })

    const response = await fetch(`/api/directories?${params.toString()}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage: string
      
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error?.message || errorData.message || 'Failed to fetch directories'
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }
      
      throw new Error(errorMessage)
    }

    const data = await response.json()
    
    // Transform API response to match our interface
    const transformed: DirectoryListResponse = {
      directories: data.data.directories.map((dir: any) => ({
        ...dir,
        last_checked_at: new Date(dir.last_checked_at),
        created_at: new Date(dir.created_at),
        updated_at: new Date(dir.updated_at),
        features: dir.features || [],
        submission_fee: dir.submission_fee || 0,
        turnaround_time_days: dir.turnaround_time_days || 7,
        time_to_approval: dir.time_to_approval || '1-3 days',
        difficulty: dir.difficulty || 'Medium',
        requires_approval: dir.requires_approval !== false,
        tier_required: dir.tier_required || 1,
        impact_level: dir.impact_level || 'Medium'
      })),
      total: data.data.pagination.total,
      page: data.data.pagination.page,
      limit: data.data.pagination.limit,
      hasNextPage: data.data.pagination.page < data.data.pagination.totalPages
    }

    // Cache the result
    cache.set(cacheKey, { data: transformed, timestamp: Date.now() })
    
    return transformed
  }, [filters, cacheKey])

  // Load data effect
  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null)
        setIsValidating(true)

        // Check cache first
        const cachedData = getCachedData(cacheKey)
        if (cachedData) {
          setDirectories(cachedData.directories)
          setTotalCount(cachedData.total)
          setHasNextPage(cachedData.hasNextPage)
          setLoading(false)
          setIsValidating(false)
          return
        }

        // Fetch fresh data
        setLoading(true)
        setCurrentPage(1) // Reset to first page when filters change
        
        const data = await fetchDirectories(1, false)
        setDirectories(data.directories)
        setTotalCount(data.total)
        setHasNextPage(data.hasNextPage)
        
      } catch (err) {
        console.error('Error fetching directories:', err)
        setError({
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          code: 'FETCH_ERROR'
        })
      } finally {
        setLoading(false)
        setIsValidating(false)
      }
    }

    loadData()
  }, [filters, cacheKey, getCachedData, fetchDirectories])

  // Fetch next page for infinite loading
  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || loading || isValidating) return

    try {
      setIsValidating(true)
      const nextPage = currentPage + 1
      const data = await fetchDirectories(nextPage, true)
      
      // Append new directories to existing list
      setDirectories(prev => [...prev, ...data.directories])
      setCurrentPage(nextPage)
      setHasNextPage(data.hasNextPage)
      
    } catch (err) {
      console.error('Error fetching next page:', err)
      setError({
        message: err instanceof Error ? err.message : 'Failed to load more directories',
        code: 'PAGINATION_ERROR'
      })
    } finally {
      setIsValidating(false)
    }
  }, [hasNextPage, loading, isValidating, currentPage, fetchDirectories])

  // Refetch current data
  const refetch = useCallback(async () => {
    // Clear cache for current filters
    cache.delete(cacheKey)
    
    try {
      setError(null)
      setIsValidating(true)
      setCurrentPage(1)
      
      const data = await fetchDirectories(1, false)
      setDirectories(data.directories)
      setTotalCount(data.total)
      setHasNextPage(data.hasNextPage)
      
    } catch (err) {
      console.error('Error refetching directories:', err)
      setError({
        message: err instanceof Error ? err.message : 'Failed to refresh directories',
        code: 'REFETCH_ERROR'
      })
    } finally {
      setIsValidating(false)
    }
  }, [cacheKey, fetchDirectories])

  return {
    directories,
    loading,
    error,
    totalCount,
    hasNextPage,
    fetchNextPage,
    refetch,
    isValidating
  }
}