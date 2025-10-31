import React from 'react'
import { Wifi, WifiOff } from 'lucide-react'

export interface RealTimeIndicatorProps {
  isConnected: boolean
  lastUpdate?: string
  onToggle: () => void
}

export function RealTimeIndicator({
  isConnected,
  lastUpdate,
  onToggle
}: RealTimeIndicatorProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1 px-2 py-1 rounded ${
          isConnected 
            ? 'text-green-400 bg-green-900/20' 
            : 'text-red-400 bg-red-900/20'
        }`}
      >
        {isConnected ? (
          <Wifi size={16} />
        ) : (
          <WifiOff size={16} />
        )}
        {isConnected ? 'Live' : 'Offline'}
      </button>
      {lastUpdate && (
        <span className="text-gray-400">
          Updated {new Date(lastUpdate).toLocaleTimeString()}
        </span>
      )}
    </div>
  )
}

export default RealTimeIndicator