/**
 * Queue Dashboard Component
 * Main dashboard for queue management and monitoring
 * Phase 2.2 Implementation
 */

'use client'

import React, { useState, useMemo } from 'react'
import { 
  ClockIcon, 
  PlayIcon, 
  PauseIcon, 
  StopIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  FunnelIcon
} from '@heroicons/react/24/outline'
import { useQueue, useQueueUpdates, useBatchOperations } from '../../lib/hooks/useQueue'
import { QueueItem, QueueDashboardProps } from '../../lib/types/queue.types'
import QueueStats from './QueueStats'
import QueueItemCard from './QueueItemCard'
import QueueFilters from './QueueFilters'
import BatchOperationsPanel from './BatchOperationsPanel'
import RealTimeIndicator from './RealTimeIndicator'

const QueueDashboard: React.FC<QueueDashboardProps> = ({
  showStats = true,
  showFilters = true,
  enableBatchOperations = true,
  enableRealTimeUpdates = true,
  customerId,
  packageTypes,
  onItemClick,
  onBatchComplete
}) => {
  const [filters, setFilters] = useState({
    status: 'all' as string,
    packageType: 'all' as string,
    sortBy: 'priority' as string,
    sortOrder: 'desc' as string,
    searchQuery: ''
  })
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [showBatchPanel, setShowBatchPanel] = useState(false)

  // Queue data and operations
  const queueParams = useMemo(() => ({
    status: filters.status !== 'all' ? filters.status as any : undefined,
    packageType: filters.packageType !== 'all' ? [filters.packageType] : packageTypes,
    sortBy: filters.sortBy as any,
    sortOrder: filters.sortOrder as any,
    limit: 50
  }), [filters, packageTypes])

  const {
    queue,
    stats,
    isLoading,
    error,
    refetch,
    processCustomer,
    pauseCustomer,
    resumeCustomer,
    cancelCustomer
  } = useQueue(queueParams, {
    enableRealTime: enableRealTimeUpdates
  })

  const { 
    updates, 
    isConnected, 
    connectionError,
    connect,
    disconnect
  } = useQueueUpdates()

  const {
    batches,
    createBatch,
    cancelBatch
  } = useBatchOperations()

  // Filter queue items based on search query and custom filters
  const filteredQueue = useMemo(() => {
    let filtered = queue

    // Apply customer ID filter if provided
    if (customerId) {
      filtered = filtered.filter(item => item.customerId === customerId)
    }

    // Apply search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      filtered = filtered.filter(item => 
        item.businessName.toLowerCase().includes(query) ||
        item.customerId.toLowerCase().includes(query) ||
        item.businessData.businessEmail.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [queue, customerId, filters.searchQuery])

  // Handle item selection for batch operations
  const handleItemSelection = (customerId: string, selected: boolean) => {
    setSelectedItems(prev => 
      selected 
        ? [...prev, customerId]
        : prev.filter(id => id !== customerId)
    )
  }

  const handleSelectAll = () => {
    if (selectedItems.length === filteredQueue.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredQueue.map(item => item.customerId))
    }
  }

  // Handle individual queue operations
  const handleProcessCustomer = async (customerId: string) => {
    try {
      await processCustomer(customerId)
    } catch (error) {
      console.error('Failed to process customer:', error)
    }
  }

  const handlePauseCustomer = async (customerId: string) => {
    try {
      await pauseCustomer(customerId)
    } catch (error) {
      console.error('Failed to pause customer:', error)
    }
  }

  const handleResumeCustomer = async (customerId: string) => {
    try {
      await resumeCustomer(customerId)
    } catch (error) {
      console.error('Failed to resume customer:', error)
    }
  }

  const handleCancelCustomer = async (customerId: string) => {
    try {
      await cancelCustomer(customerId)
    } catch (error) {
      console.error('Failed to cancel customer:', error)
    }
  }

  // Handle batch operations
  const handleBatchOperation = async (operation: 'process' | 'retry' | 'cancel') => {
    if (selectedItems.length === 0) return

    try {
      const batch = await createBatch(selectedItems, operation)
      setSelectedItems([])
      setShowBatchPanel(false)
      
      if (onBatchComplete) {
        onBatchComplete(batch)
      }
    } catch (error) {
      console.error('Failed to create batch:', error)
    }
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
          <h3 className="text-lg font-medium text-red-800">Queue Error</h3>
        </div>
        <p className="mt-2 text-red-700">{error.message}</p>
        <button
          onClick={refetch}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Queue Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage and monitor submission processing queue</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {enableRealTimeUpdates && (
            <RealTimeIndicator 
              isConnected={isConnected} 
              lastUpdate={updates[0]?.timestamp}
              onToggle={() => isConnected ? disconnect() : connect()}
            />
          )}
          
          <button
            onClick={refetch}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Section */}
      {showStats && stats && (
        <QueueStats stats={stats} />
      )}

      {/* Filters and Search */}
      {showFilters && (
        <QueueFilters
          filters={filters}
          onFiltersChange={setFilters}
          packageTypes={packageTypes}
        />
      )}

      {/* Batch Operations Panel */}
      {enableBatchOperations && selectedItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-blue-600 mr-2" />
              <span className="font-medium text-blue-900">
                {selectedItems.length} items selected
              </span>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => handleBatchOperation('process')}
                className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm flex items-center"
              >
                <PlayIcon className="h-4 w-4 mr-1" />
                Process All
              </button>
              
              <button
                onClick={() => handleBatchOperation('retry')}
                className="px-3 py-1 bg-volt-600 text-white rounded-md hover:bg-volt-700 transition-colors text-sm flex items-center"
              >
                <ArrowPathIcon className="h-4 w-4 mr-1" />
                Retry All
              </button>
              
              <button
                onClick={() => handleBatchOperation('cancel')}
                className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm flex items-center"
              >
                <XCircleIcon className="h-4 w-4 mr-1" />
                Cancel All
              </button>
              
              <button
                onClick={() => setSelectedItems([])}
                className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue Items */}
      <div className="space-y-4">
        {/* Select All Header */}
        {enableBatchOperations && filteredQueue.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedItems.length === filteredQueue.length && filteredQueue.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">
                Select All ({filteredQueue.length} items)
              </label>
            </div>
            
            <div className="text-sm text-gray-500">
              {selectedItems.length > 0 && `${selectedItems.length} selected`}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-white bg-blue-500">
              <ArrowPathIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Loading queue...
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredQueue.length === 0 && (
          <div className="text-center py-12">
            <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No queue items</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filters.status !== 'all' || filters.searchQuery
                ? 'No items match your current filters'
                : 'The queue is empty'}
            </p>
          </div>
        )}

        {/* Queue Items List */}
        {!isLoading && filteredQueue.map((item, index) => (
          <QueueItemCard
            key={item.customerId}
            item={item}
            showActions={true}
            showProgress={true}
            selected={selectedItems.includes(item.customerId)}
            onSelect={enableBatchOperations ? 
              (selected) => handleItemSelection(item.customerId, selected) : 
              undefined
            }
            onProcess={() => handleProcessCustomer(item.customerId)}
            onPause={() => handlePauseCustomer(item.customerId)}
            onResume={() => handleResumeCustomer(item.customerId)}
            onCancel={() => handleCancelCustomer(item.customerId)}
            onViewDetails={onItemClick ? () => onItemClick(item) : undefined}
          />
        ))}
      </div>

      {/* Batch Operations Panel Modal */}
      {enableBatchOperations && showBatchPanel && (
        <BatchOperationsPanel
          batches={batches}
          onClose={() => setShowBatchPanel(false)}
          onCancelBatch={cancelBatch}
        />
      )}
    </div>
  )
}

export default QueueDashboard