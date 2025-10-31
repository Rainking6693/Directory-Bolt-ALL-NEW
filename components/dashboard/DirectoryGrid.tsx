'use client'
import { useState, useMemo } from 'react'
import { DirectoryStatus } from '../../types/dashboard'

interface DirectoryGridProps {
  directories: DirectoryStatus[]
  className?: string
  showFilters?: boolean
}

interface FilterState {
  status: 'all' | DirectoryStatus['status']
  tier: 'all' | DirectoryStatus['tier']
  category: 'all' | string
}

export function DirectoryGrid({ 
  directories, 
  className = '', 
  showFilters = true 
}: DirectoryGridProps) {
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    tier: 'all',
    category: 'all'
  })

  const [sortBy, setSortBy] = useState<'name' | 'status' | 'submittedAt' | 'domainAuthority'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const filteredAndSortedDirectories = useMemo(() => {
    let filtered = directories

    if (filters.status !== 'all') {
      filtered = filtered.filter(dir => dir.status === filters.status)
    }
    
    if (filters.tier !== 'all') {
      filtered = filtered.filter(dir => dir.tier === filters.tier)
    }
    
    if (filters.category !== 'all') {
      filtered = filtered.filter(dir => dir.category === filters.category)
    }

    // Sort directories
    return filtered.sort((a, b) => {
      let aValue: string | number | Date
      let bValue: string | number | Date

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'status':
          const statusOrder = { pending: 1, processing: 2, submitted: 3, live: 4, rejected: 5 }
          aValue = statusOrder[a.status as keyof typeof statusOrder] || 0
          bValue = statusOrder[b.status as keyof typeof statusOrder] || 0
          break
        case 'submittedAt':
          aValue = a.submittedAt ? new Date(a.submittedAt) : new Date(0)
          bValue = b.submittedAt ? new Date(b.submittedAt) : new Date(0)
          break
        case 'domainAuthority':
          aValue = a.domainAuthority || 0
          bValue = b.domainAuthority || 0
          break
        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })
  }, [directories, filters, sortBy, sortOrder])

  const getStatusIcon = (status: DirectoryStatus['status']) => {
    switch (status) {
      case 'pending': return '⏳'
      case 'processing': return '🔄'
      case 'submitted': return '📤'
      case 'live': return '✅'
      case 'rejected': return '❌'
      default: return '📋'
    }
  }

  const getStatusStyles = (status: DirectoryStatus['status']) => {
    switch (status) {
      case 'pending':
        return {
          bg: 'bg-volt-500/10',
          border: 'border-volt-500/30',
          text: 'text-volt-400',
          badge: 'bg-volt-500/20 text-volt-300 border-volt-500/30'
        }
      case 'processing':
        return {
          bg: 'bg-volt-500/10',
          border: 'border-volt-500/30',
          text: 'text-volt-400',
          badge: 'bg-volt-500/20 text-volt-300 border-volt-500/30'
        }
      case 'submitted':
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30',
          text: 'text-blue-400',
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
        }
      case 'live':
        return {
          bg: 'bg-success-500/10',
          border: 'border-success-500/30',
          text: 'text-success-400',
          badge: 'bg-success-500/20 text-success-300 border-success-500/30'
        }
      case 'rejected':
        return {
          bg: 'bg-danger-500/10',
          border: 'border-danger-500/30',
          text: 'text-danger-400',
          badge: 'bg-danger-500/20 text-danger-300 border-danger-500/30'
        }
      default:
        return {
          bg: 'bg-secondary-700/50',
          border: 'border-secondary-600',
          text: 'text-secondary-300',
          badge: 'bg-secondary-600/50 text-secondary-300 border-secondary-500/30'
        }
    }
  }

  const getTierStyles = (tier: DirectoryStatus['tier']) => {
    switch (tier) {
      case 'premium':
        return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
      case 'standard':
        return 'bg-volt-500/20 text-volt-300 border border-volt-500/30'
      case 'local':
        return 'bg-secondary-600/50 text-secondary-300 border border-secondary-500/30'
      default:
        return 'bg-secondary-600/50 text-secondary-300 border border-secondary-500/30'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(directories.map(dir => dir.category)))
  }, [directories])

  return (
    <div className={`bg-secondary-800 rounded-xl border border-secondary-700 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-secondary-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            📁 Directory Status
            <span className="text-sm text-secondary-400 font-normal">
              ({filteredAndSortedDirectories.length} of {directories.length})
            </span>
          </h3>

          {showFilters && (
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Status Filter */}
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as FilterState['status'] }))}
                className="bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-volt-500 focus:border-volt-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="submitted">Submitted</option>
                <option value="live">Live</option>
                <option value="rejected">Rejected</option>
              </select>

              {/* Tier Filter */}
              <select
                value={filters.tier}
                onChange={(e) => setFilters(prev => ({ ...prev, tier: e.target.value as FilterState['tier'] }))}
                className="bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-volt-500 focus:border-volt-500"
              >
                <option value="all">All Tiers</option>
                <option value="premium">Premium</option>
                <option value="standard">Standard</option>
                <option value="local">Local</option>
              </select>

              {/* Sort */}
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder]
                  setSortBy(newSortBy)
                  setSortOrder(newSortOrder)
                }}
                className="bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-volt-500 focus:border-volt-500"
              >
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="status-asc">Status</option>
                <option value="submittedAt-desc">Latest First</option>
                <option value="domainAuthority-desc">Highest DA</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="p-6">
        {filteredAndSortedDirectories.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">📂</span>
            <h4 className="text-lg font-bold text-white mb-2">No directories found</h4>
            <p className="text-secondary-400">
              {directories.length === 0 
                ? "No directories have been submitted yet."
                : "No directories match the current filters."
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAndSortedDirectories.map((directory) => {
              const statusStyles = getStatusStyles(directory.status)
              
              return (
                <div
                  key={directory.id}
                  className={`rounded-lg border p-4 transition-all duration-300 hover:scale-[1.02] ${statusStyles.bg} ${statusStyles.border}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getStatusIcon(directory.status)}</span>
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${getTierStyles(directory.tier)}`}>
                        {directory.tier.toUpperCase()}
                      </span>
                    </div>
                    
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${statusStyles.badge}`}>
                      {directory.status.toUpperCase()}
                    </span>
                  </div>

                  <h4 className="font-semibold text-white text-sm mb-2 leading-tight">
                    {directory.name}
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-secondary-400">Category:</span>
                      <span className="text-secondary-300 font-medium">
                        {directory.category}
                      </span>
                    </div>

                    {directory.domainAuthority && (
                      <div className="flex items-center justify-between">
                        <span className="text-secondary-400">DA:</span>
                        <span className="text-volt-400 font-bold">
                          {directory.domainAuthority}
                        </span>
                      </div>
                    )}

                    {directory.estimatedTraffic && (
                      <div className="flex items-center justify-between">
                        <span className="text-secondary-400">Traffic:</span>
                        <span className="text-secondary-300">
                          {directory.estimatedTraffic.toLocaleString()}/mo
                        </span>
                      </div>
                    )}

                    {directory.submittedAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-secondary-400">Submitted:</span>
                        <span className="text-secondary-300">
                          {formatDate(directory.submittedAt)}
                        </span>
                      </div>
                    )}

                    {directory.liveAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-secondary-400">Live:</span>
                        <span className="text-success-400 font-medium">
                          {formatDate(directory.liveAt)}
                        </span>
                      </div>
                    )}

                    {directory.rejectedReason && (
                      <div className="mt-3 p-2 bg-danger-500/10 border border-danger-500/20 rounded text-xs">
                        <span className="text-danger-400 font-medium">Reason:</span>
                        <p className="text-danger-300 mt-1">{directory.rejectedReason}</p>
                      </div>
                    )}
                  </div>

                  {directory.listingUrl && (
                    <div className="mt-3 pt-3 border-t border-secondary-600">
                      <a
                        href={directory.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-volt-400 hover:text-volt-300 transition-colors"
                      >
                        View Listing →
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default DirectoryGrid