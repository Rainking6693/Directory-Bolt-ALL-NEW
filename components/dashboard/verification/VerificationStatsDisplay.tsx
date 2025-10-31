'use client'
import { VerificationStats } from '../../../types/dashboard'

interface VerificationStatsDisplayProps {
  stats: VerificationStats
  className?: string
}

export function VerificationStatsDisplay({ 
  stats, 
  className = '' 
}: VerificationStatsDisplayProps) {
  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`
    } else if (minutes < 1440) { // Less than 24 hours
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = Math.round(minutes % 60)
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
    } else {
      const days = Math.floor(minutes / 1440)
      return `${days}d`
    }
  }

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 80) return 'text-success-400'
    if (rate >= 60) return 'text-volt-400'
    return 'text-danger-400'
  }

  const getCompletionRateBg = (rate: number) => {
    if (rate >= 80) return 'bg-success-500/10'
    if (rate >= 60) return 'bg-volt-500/10'
    return 'bg-danger-500/10'
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {/* Total Actions */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6 hover:scale-105 transition-transform duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-secondary-400 text-sm font-medium">Total Actions</p>
            <p className="text-3xl font-black text-white mt-1">{stats.totalActions}</p>
            <p className="text-secondary-400 text-xs mt-1">
              {stats.completedActions} completed
            </p>
          </div>
          <div className="text-4xl opacity-80">🎯</div>
        </div>
      </div>

      {/* Completion Rate */}
      <div className={`rounded-xl border border-secondary-700 p-6 hover:scale-105 transition-transform duration-300 ${getCompletionRateBg(stats.completionRate)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-secondary-400 text-sm font-medium">Completion Rate</p>
            <p className={`text-3xl font-black mt-1 ${getCompletionRateColor(stats.completionRate)}`}>
              {Math.round(stats.completionRate)}%
            </p>
            <div className="mt-2 w-full bg-secondary-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  stats.completionRate >= 80 ? 'bg-success-500' :
                  stats.completionRate >= 60 ? 'bg-volt-500' : 'bg-danger-500'
                }`}
                style={{ width: `${Math.min(stats.completionRate, 100)}%` }}
              />
            </div>
          </div>
          <div className="text-4xl opacity-80">📊</div>
        </div>
      </div>

      {/* Pending Actions */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6 hover:scale-105 transition-transform duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-secondary-400 text-sm font-medium">Pending Actions</p>
            <p className="text-3xl font-black text-volt-400 mt-1">{stats.pendingActions}</p>
            {stats.urgentActions > 0 && (
              <p className="text-danger-400 text-xs mt-1 font-medium">
                {stats.urgentActions} urgent
              </p>
            )}
          </div>
          <div className="text-4xl opacity-80">⏳</div>
        </div>
      </div>

      {/* Average Completion Time */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6 hover:scale-105 transition-transform duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-secondary-400 text-sm font-medium">Avg. Completion</p>
            <p className="text-3xl font-black text-white mt-1">
              {formatTime(stats.averageCompletionTime)}
            </p>
            <p className="text-secondary-400 text-xs mt-1">
              per verification
            </p>
          </div>
          <div className="text-4xl opacity-80">⏱️</div>
        </div>
      </div>
    </div>
  )
}

export { VerificationStatsDisplay as VerificationStats }
export default VerificationStatsDisplay