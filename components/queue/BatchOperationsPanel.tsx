import React from 'react'

export interface BatchOperationsPanelProps {
  selectedItems?: string[]
  batches?: any[]
  onBatchProcess?: (customerIds: string[]) => void
  onBatchCancel?: (customerIds: string[]) => void
  onBatchRetry?: (customerIds: string[]) => void
  onClose?: () => void
  onCancelBatch?: (batchId: string) => Promise<any>
}

export function BatchOperationsPanel({
  selectedItems = [],
  batches = [],
  onBatchProcess,
  onBatchCancel,
  onBatchRetry,
  onClose,
  onCancelBatch
}: BatchOperationsPanelProps) {
  if (selectedItems.length === 0 && batches.length === 0) {
    return null
  }

  return (
    <div className="bg-secondary-800 p-4 rounded-lg mb-6">
      <div className="flex items-center justify-between">
        <span className="text-white">
          {selectedItems.length} items selected
        </span>
        <div className="flex gap-2">
          {onBatchProcess && (
            <button
              onClick={() => onBatchProcess(selectedItems)}
              className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Process Selected
            </button>
          )}
          {onBatchRetry && (
            <button
              onClick={() => onBatchRetry(selectedItems)}
              className="px-4 py-2 bg-volt-600 text-white rounded hover:bg-volt-700"
            >
              Retry Selected
            </button>
          )}
          {onBatchCancel && (
            <button
              onClick={() => onBatchCancel(selectedItems)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Cancel Selected
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default BatchOperationsPanel