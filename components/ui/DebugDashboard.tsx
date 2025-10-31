'use client'
import { useState, useEffect } from 'react'
import { useDebugMode } from '../../lib/hooks/useDebugMode'
import { apiDebugger } from '../../lib/utils/api-debugger'

interface DebugDashboardProps {
  className?: string
  compact?: boolean
  autoHide?: boolean
}

export function DebugDashboard({ 
  className = '', 
  compact = false,
  autoHide = false 
}: DebugDashboardProps) {
  const {
    isDebugMode,
    toggleDebugMode,
    environmentValidation,
    apiLogs,
    clearApiLogs,
    exportDebugData,
    validatePaymentEnvironment
  } = useDebugMode()

  const [expanded, setExpanded] = useState(!compact)
  const [activeTab, setActiveTab] = useState<'overview' | 'api' | 'environment' | 'payments'>('overview')
  const [paymentValidation, setPaymentValidation] = useState<any>(null)

  // Auto-hide in production if specified
  useEffect(() => {
    if (autoHide && environmentValidation.environment === 'production' && !isDebugMode) {
      return
    }
  }, [autoHide, environmentValidation.environment, isDebugMode])

  // Update payment validation when needed
  useEffect(() => {
    if (activeTab === 'payments') {
      setPaymentValidation(validatePaymentEnvironment())
    }
  }, [activeTab, validatePaymentEnvironment])

  // Don't render in production unless debug mode is explicitly enabled
  if (autoHide && environmentValidation.environment === 'production' && !isDebugMode) {
    return null
  }

  const debugSummary = apiDebugger.getSummary()

  return (
    <div className={`bg-secondary-800/95 border border-secondary-600/50 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-secondary-600/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-secondary-300 hover:text-secondary-200"
            >
              <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
            </button>
            <h3 className="font-medium text-secondary-200 flex items-center gap-2">
              🔍 Debug Dashboard
              <span className={`text-xs px-2 py-1 rounded ${
                isDebugMode 
                  ? 'bg-volt-500/20 text-volt-400' 
                  : 'bg-secondary-600/20 text-secondary-400'
              }`}>
                {isDebugMode ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDebugMode}
              className={`text-xs px-3 py-1 rounded font-bold transition-colors ${
                isDebugMode
                  ? 'bg-danger-500/20 text-danger-400 hover:bg-danger-500/30'
                  : 'bg-volt-500/20 text-volt-400 hover:bg-volt-500/30'
              }`}
            >
              {isDebugMode ? 'Disable' : 'Enable'} Debug
            </button>
            
            {isDebugMode && (
              <button
                onClick={exportDebugData}
                className="text-xs px-2 py-1 bg-info-500/20 text-info-400 rounded hover:bg-info-500/30 transition-colors"
                title="Export debug data for support"
              >
                📥
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-3">
          {/* Tab Navigation */}
          <div className="flex gap-1 mb-3 bg-secondary-700/50 p-1 rounded">
            {[
              { key: 'overview', label: 'Overview', icon: '📊' },
              { key: 'api', label: 'API Calls', icon: '🌐' },
              { key: 'environment', label: 'Environment', icon: '🌍' },
              { key: 'payments', label: 'Payments', icon: '💳' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`text-xs px-3 py-2 rounded font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-volt-500/20 text-volt-400'
                    : 'text-secondary-400 hover:text-secondary-300 hover:bg-secondary-600/30'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <OverviewTab 
              debugSummary={debugSummary}
              environmentValidation={environmentValidation}
              isDebugMode={isDebugMode}
            />
          )}

          {activeTab === 'api' && (
            <ApiTab 
              apiLogs={apiLogs}
              debugSummary={debugSummary}
              onClearLogs={clearApiLogs}
            />
          )}

          {activeTab === 'environment' && (
            <EnvironmentTab 
              validation={environmentValidation}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsTab 
              validation={paymentValidation}
            />
          )}
        </div>
      )}
    </div>
  )
}

function OverviewTab({ debugSummary, environmentValidation, isDebugMode }: any) {
  return (
    <div className="space-y-3">
      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-secondary-700/30 p-3 rounded">
          <div className="text-xs text-secondary-400 mb-1">API Calls</div>
          <div className="text-lg font-bold text-secondary-200">{debugSummary.totalRequests}</div>
        </div>
        
        <div className="bg-secondary-700/30 p-3 rounded">
          <div className="text-xs text-secondary-400 mb-1">Success Rate</div>
          <div className={`text-lg font-bold ${
            debugSummary.successRate >= 90 ? 'text-success-400' :
            debugSummary.successRate >= 70 ? 'text-warning-400' : 'text-danger-400'
          }`}>
            {debugSummary.successRate.toFixed(1)}%
          </div>
        </div>
        
        <div className="bg-secondary-700/30 p-3 rounded">
          <div className="text-xs text-secondary-400 mb-1">Avg Response</div>
          <div className="text-lg font-bold text-secondary-200">
            {debugSummary.averageResponseTime.toFixed(0)}ms
          </div>
        </div>
        
        <div className="bg-secondary-700/30 p-3 rounded">
          <div className="text-xs text-secondary-400 mb-1">Environment</div>
          <div className={`text-sm font-bold ${
            environmentValidation.environment === 'development' ? 'text-warning-400' : 'text-success-400'
          }`}>
            {environmentValidation.environment}
          </div>
        </div>
      </div>

      {/* Issues & Warnings */}
      {(environmentValidation.issues.length > 0 || environmentValidation.warnings.length > 0) && (
        <div className="space-y-2">
          {environmentValidation.issues.length > 0 && (
            <div className="bg-danger-900/20 border border-danger-500/30 p-3 rounded">
              <h4 className="text-danger-400 font-medium mb-2 text-sm">🚨 Issues</h4>
              <ul className="space-y-1">
                {environmentValidation.issues.map((issue: string, index: number) => (
                  <li key={index} className="text-danger-300 text-xs flex items-start gap-2">
                    <span>•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {environmentValidation.warnings.length > 0 && (
            <div className="bg-warning-900/20 border border-warning-500/30 p-3 rounded">
              <h4 className="text-warning-400 font-medium mb-2 text-sm">⚠️ Warnings</h4>
              <ul className="space-y-1">
                {environmentValidation.warnings.map((warning: string, index: number) => (
                  <li key={index} className="text-warning-300 text-xs flex items-start gap-2">
                    <span>•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Debug Mode Status */}
      {!isDebugMode && (
        <div className="bg-info-900/20 border border-info-500/30 p-3 rounded">
          <h4 className="text-info-400 font-medium mb-2 text-sm">💡 Debug Mode Disabled</h4>
          <p className="text-info-300 text-xs">
            Enable debug mode to see detailed API logging, request/response data, and enhanced error information.
          </p>
        </div>
      )}
    </div>
  )
}

function ApiTab({ apiLogs, debugSummary, onClearLogs }: any) {
  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <h4 className="text-secondary-300 font-medium">Recent API Calls</h4>
        <button
          onClick={onClearLogs}
          className="text-xs px-2 py-1 bg-danger-500/20 text-danger-400 rounded hover:bg-danger-500/30 transition-colors"
        >
          Clear Logs
        </button>
      </div>

      {/* API Logs */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {apiLogs.length === 0 ? (
          <div className="text-secondary-400 text-xs text-center py-4">
            No API calls recorded. Enable debug mode and make some requests.
          </div>
        ) : (
          apiLogs.map((log: any, index: number) => (
            <div key={index} className="bg-secondary-700/30 p-3 rounded">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    log.error ? 'bg-danger-500/20 text-danger-400' :
                    log.responseStatus >= 400 ? 'bg-warning-500/20 text-warning-400' :
                    log.responseStatus >= 200 ? 'bg-success-500/20 text-success-400' :
                    'bg-secondary-500/20 text-secondary-400'
                  }`}>
                    {log.method}
                  </span>
                  <span className="text-xs text-secondary-300 font-mono">
                    {log.url}
                  </span>
                </div>
                <div className="text-xs text-secondary-400">
                  {log.timing.duration ? `${log.timing.duration.toFixed(2)}ms` : 'Pending'}
                </div>
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <span className="text-secondary-400">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`${
                  log.error ? 'text-danger-400' :
                  log.responseStatus >= 400 ? 'text-warning-400' :
                  log.responseStatus >= 200 ? 'text-success-400' :
                  'text-secondary-400'
                }`}>
                  {log.responseStatus || (log.error ? 'ERROR' : 'PENDING')}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function EnvironmentTab({ validation }: any) {
  return (
    <div className="space-y-3">
      {/* Environment Info */}
      <div className="bg-secondary-700/30 p-3 rounded">
        <h4 className="text-secondary-300 font-medium mb-3">Environment Information</h4>
        
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-secondary-400">Environment:</span>
            <span className={`ml-2 font-bold ${
              validation.environment === 'development' ? 'text-warning-400' : 'text-success-400'
            }`}>
              {validation.environment}
            </span>
          </div>
          
          <div>
            <span className="text-secondary-400">Protocol:</span>
            <span className={`ml-2 font-bold ${
              validation.protocolCheck ? 'text-success-400' : 'text-danger-400'
            }`}>
              {typeof window !== 'undefined' ? window.location.protocol : 'Unknown'}
            </span>
          </div>
          
          <div>
            <span className="text-secondary-400">Hostname:</span>
            <span className={`ml-2 font-bold ${
              validation.hostnameCheck ? 'text-success-400' : 'text-danger-400'
            }`}>
              {typeof window !== 'undefined' ? window.location.hostname : 'Unknown'}
            </span>
          </div>
          
          <div>
            <span className="text-secondary-400">Debug Mode:</span>
            <span className={`ml-2 font-bold ${
              validation.debugModeEnabled ? 'text-warning-400' : 'text-secondary-400'
            }`}>
              {validation.debugModeEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* Browser Features */}
      <div className="bg-secondary-700/30 p-3 rounded">
        <h4 className="text-secondary-300 font-medium mb-3">Browser Compatibility</h4>
        
        <div className="space-y-2 text-xs">
          {[
            { name: 'Fetch API', supported: typeof fetch !== 'undefined' },
            { name: 'Local Storage', supported: typeof window !== 'undefined' && !!window.localStorage },
            { name: 'Performance API', supported: typeof window !== 'undefined' && !!window.performance },
            { name: 'Promises', supported: typeof Promise !== 'undefined' },
            { name: 'URL API', supported: typeof URL !== 'undefined' }
          ].map((feature, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-secondary-400">{feature.name}:</span>
              <span className={`font-bold ${
                feature.supported ? 'text-success-400' : 'text-danger-400'
              }`}>
                {feature.supported ? '✅ Supported' : '❌ Not Available'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PaymentsTab({ validation }: any) {
  if (!validation) {
    return <div className="text-secondary-400 text-xs">Loading payment validation...</div>
  }

  return (
    <div className="space-y-3">
      {/* Payment Environment Status */}
      <div className={`p-3 rounded border ${
        validation.isValid 
          ? 'bg-success-900/20 border-success-500/30' 
          : 'bg-danger-900/20 border-danger-500/30'
      }`}>
        <h4 className={`font-medium mb-2 ${
          validation.isValid ? 'text-success-400' : 'text-danger-400'
        }`}>
          {validation.isValid ? '✅ Payment Environment Ready' : '❌ Payment Environment Issues'}
        </h4>
      </div>

      {/* Payment Checks */}
      <div className="bg-secondary-700/30 p-3 rounded">
        <h4 className="text-secondary-300 font-medium mb-3">Payment Checks</h4>
        
        <div className="space-y-2 text-xs">
          {Object.entries(validation.checks).map(([check, passed]) => (
            <div key={check} className="flex justify-between items-center">
              <span className="text-secondary-400 capitalize">
                {check.replace(/([A-Z])/g, ' $1').trim()}:
              </span>
              <span className={`font-bold ${
                passed ? 'text-success-400' : 'text-danger-400'
              }`}>
                {passed ? '✅ Pass' : '❌ Fail'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Issues & Warnings */}
      {validation.issues.length > 0 && (
        <div className="bg-danger-900/20 border border-danger-500/30 p-3 rounded">
          <h4 className="text-danger-400 font-medium mb-2">🚨 Payment Issues</h4>
          <ul className="space-y-1">
            {validation.issues.map((issue: string, index: number) => (
              <li key={index} className="text-danger-300 text-xs flex items-start gap-2">
                <span>•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {validation.warnings.length > 0 && (
        <div className="bg-warning-900/20 border border-warning-500/30 p-3 rounded">
          <h4 className="text-warning-400 font-medium mb-2">⚠️ Payment Warnings</h4>
          <ul className="space-y-1">
            {validation.warnings.map((warning: string, index: number) => (
              <li key={index} className="text-warning-300 text-xs flex items-start gap-2">
                <span>•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default DebugDashboard