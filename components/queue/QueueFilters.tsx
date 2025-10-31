/**
 * Queue Filters Component
 * Search and filter controls for queue management
 * Phase 2.2 Implementation
 */

'use client'

import React from 'react'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface QueueFiltersProps {
  filters: {
    status: string
    packageType: string
    sortBy: string
    sortOrder: string
    searchQuery: string
  }
  onFiltersChange: (filters: any) => void
  packageTypes?: string[]
  className?: string
}

const QueueFilters: React.FC<QueueFiltersProps> = ({
  filters,
  onFiltersChange,
  packageTypes = ['starter', 'growth', 'pro', 'subscription'],
  className = ''
}) => {
  const updateFilter = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const clearFilters = () => {
    onFiltersChange({
      status: 'all',
      packageType: 'all',
      sortBy: 'priority',
      sortOrder: 'desc',
      searchQuery: ''
    })
  }

  const hasActiveFilters = 
    filters.status !== 'all' || 
    filters.packageType !== 'all' || 
    filters.searchQuery !== '' ||
    filters.sortBy !== 'priority' ||
    filters.sortOrder !== 'desc'

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <FunnelIcon className="h-5 w-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <XMarkIcon className="h-4 w-4 mr-1" />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => updateFilter('searchQuery', e.target.value)}
              placeholder="Search by business name, customer ID, or email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        {/* Package Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Package Type
          </label>
          <select
            value={filters.packageType}
            onChange={(e) => updateFilter('packageType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">All Packages</option>
            {packageTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sort By
          </label>
          <div className="flex space-x-1">
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilter('sortBy', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="priority">Priority</option>
              <option value="createdAt">Created Date</option>
              <option value="packageType">Package Type</option>
            </select>
            <select
              value={filters.sortOrder}
              onChange={(e) => updateFilter('sortOrder', e.target.value)}
              className="px-2 py-2 border border-gray-300 rounded-r-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50"
            >
              <option value="desc">↓</option>
              <option value="asc">↑</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-600 font-medium">Active filters:</span>
          
          {filters.status !== 'all' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Status: {filters.status}
              <button
                onClick={() => updateFilter('status', 'all')}
                className="ml-1 hover:text-blue-600"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          )}

          {filters.packageType !== 'all' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Package: {filters.packageType}
              <button
                onClick={() => updateFilter('packageType', 'all')}
                className="ml-1 hover:text-purple-600"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          )}

          {filters.searchQuery && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Search: "{filters.searchQuery}"
              <button
                onClick={() => updateFilter('searchQuery', '')}
                className="ml-1 hover:text-green-600"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          )}

          {(filters.sortBy !== 'priority' || filters.sortOrder !== 'desc') && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              Sort: {filters.sortBy} {filters.sortOrder === 'desc' ? '↓' : '↑'}
              <button
                onClick={() => {
                  updateFilter('sortBy', 'priority')
                  updateFilter('sortOrder', 'desc')
                }}
                className="ml-1 hover:text-gray-600"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default QueueFilters