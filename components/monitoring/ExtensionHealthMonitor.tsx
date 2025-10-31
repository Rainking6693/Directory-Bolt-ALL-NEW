import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { ScrollArea } from '../ui/scroll-area'
import { Alert, AlertDescription } from '../ui/alert'

interface ExtensionHealth {
  extension_id: string
  status: 'healthy' | 'warning' | 'error' | 'offline'
  last_heartbeat: string
  version: string
  chrome_version: string
  os: string
  performance_metrics: {
    memory_usage_mb: number
    cpu_usage_percent: number
    active_tabs: number
    network_requests_per_minute: number
    average_response_time_ms: number
    error_rate_percent: number
  }
  directory_statistics: {
    total_processed: number
    successful_submissions: number
    failed_submissions: number
    success_rate_percent: number
    average_processing_time_seconds: number
  }
  current_activity: {
    is_processing: boolean
    current_customer_id?: string
    current_directory?: string
    started_at?: string
    estimated_completion?: string
  }
  recent_errors: ExtensionError[]
  health_checks: HealthCheck[]
  connectivity: {
    api_connection: boolean
    database_connection: boolean
    screenshot_service: boolean
    last_connectivity_check: string
  }
}

interface ExtensionError {
  error_id: string
  timestamp: string
  error_type: 'network' | 'dom' | 'captcha' | 'validation' | 'timeout' | 'unknown'
  error_message: string
  stack_trace?: string
  directory_name?: string
  customer_id?: string
  recovery_attempted: boolean
  resolution_status: 'pending' | 'resolved' | 'ignored'
}

interface HealthCheck {
  check_id: string
  check_name: string
  status: 'pass' | 'fail' | 'warning'
  last_run: string
  duration_ms: number
  details: string
  recommendations?: string[]
}

interface SystemAlert {
  alert_id: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  timestamp: string
  affected_extensions: string[]
  resolved: boolean
  resolution_notes?: string
}

export default function ExtensionHealthMonitor() {
  const [extensionHealth, setExtensionHealth] = useState<ExtensionHealth[]>([])
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([])
  const [selectedExtension, setSelectedExtension] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(10000) // 10 seconds
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchExtensionHealth()
    fetchSystemAlerts()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchExtensionHealth()
      fetchSystemAlerts()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval])

  const fetchExtensionHealth = async () => {
    try {
      const response = await fetch('/api/autobolt/extension-health', {
        headers: {
          'X-API-Key': process.env.NEXT_PUBLIC_AUTOBOLT_API_KEY || ''
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setExtensionHealth(data.extensions || [])
        }
      }
    } catch (error) {
      console.error('Failed to fetch extension health:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSystemAlerts = async () => {
    try {
      const response = await fetch('/api/autobolt/system-alerts', {
        headers: {
          'X-API-Key': process.env.NEXT_PUBLIC_AUTOBOLT_API_KEY || ''
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSystemAlerts(data.alerts || [])
        }
      }
    } catch (error) {
      console.error('Failed to fetch system alerts:', error)
    }
  }

  const restartExtension = async (extensionId: string) => {
    try {
      await fetch(`/api/autobolt/restart-extension/${extensionId}`, {
        method: 'POST',
        headers: {
          'X-API-Key': process.env.NEXT_PUBLIC_AUTOBOLT_API_KEY || ''
        }
      })
      
      setTimeout(fetchExtensionHealth, 2000) // Refresh after 2 seconds
    } catch (error) {
      console.error('Failed to restart extension:', error)
    }
  }

  const resolveAlert = async (alertId: string, resolutionNotes: string) => {
    try {
      await fetch(`/api/autobolt/resolve-alert/${alertId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_AUTOBOLT_API_KEY || ''
        },
        body: JSON.stringify({ resolution_notes: resolutionNotes })
      })
      
      fetchSystemAlerts()
    } catch (error) {
      console.error('Failed to resolve alert:', error)
    }
  }

  const runHealthChecks = async (extensionId: string) => {
    try {
      await fetch(`/api/autobolt/run-health-checks/${extensionId}`, {
        method: 'POST',
        headers: {
          'X-API-Key': process.env.NEXT_PUBLIC_AUTOBOLT_API_KEY || ''
        }
      })
      
      setTimeout(fetchExtensionHealth, 3000) // Refresh after health checks complete
    } catch (error) {
      console.error('Failed to run health checks:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'warning': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      case 'offline': return 'bg-gray-500'
      default: return 'bg-gray-400'
    }
  }

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'info': return 'border-blue-200 bg-blue-50'
      case 'warning': return 'border-yellow-200 bg-yellow-50'
      case 'error': return 'border-red-200 bg-red-50'
      case 'critical': return 'border-red-500 bg-red-100'
      default: return 'border-gray-200 bg-gray-50'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  const selectedExtensionData = selectedExtension 
    ? extensionHealth.find(ext => ext.extension_id === selectedExtension)
    : null

  const totalExtensions = extensionHealth.length
  const healthyExtensions = extensionHealth.filter(ext => ext.status === 'healthy').length
  const criticalAlerts = systemAlerts.filter(alert => alert.severity === 'critical' && !alert.resolved).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg">Loading extension health data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Extension Health Monitor</h1>
          <p className="text-gray-600 mt-1">Real-time monitoring of Chrome extension performance and health</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span className="text-sm">Auto-refresh</span>
          </label>
          <select 
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            disabled={!autoRefresh}
            className="text-sm border rounded px-2 py-1"
          >
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={60000}>1m</option>
          </select>
          <Button onClick={fetchExtensionHealth} size="sm">
            Refresh Now
          </Button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Extensions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{totalExtensions}</div>
            <p className="text-xs text-gray-500">Total active</p>
            <div className="text-sm text-green-600 mt-1">
              {healthyExtensions} healthy
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Health Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalExtensions > 0 ? Math.round((healthyExtensions / totalExtensions) * 100) : 0}%
            </div>
            <p className="text-xs text-gray-500">Overall health</p>
            <Progress 
              value={totalExtensions > 0 ? (healthyExtensions / totalExtensions) * 100 : 0} 
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Critical Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${criticalAlerts > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {criticalAlerts}
            </div>
            <p className="text-xs text-gray-500">Unresolved</p>
            <div className="text-sm text-gray-600 mt-1">
              {systemAlerts.filter(a => !a.resolved).length} total alerts
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {extensionHealth.length > 0 ? 
                Math.round(extensionHealth.reduce((sum, ext) => 
                  sum + ext.directory_statistics.average_processing_time_seconds, 0) / extensionHealth.length)
                : 0}s
            </div>
            <p className="text-xs text-gray-500">Avg processing time</p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {systemAlerts.filter(alert => !alert.resolved && alert.severity === 'critical').length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-red-600">Critical Alerts</h2>
          {systemAlerts
            .filter(alert => !alert.resolved && alert.severity === 'critical')
            .map((alert) => (
              <Alert key={alert.alert_id} className={getAlertColor(alert.severity)}>
                <AlertDescription>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{alert.title}</div>
                      <div className="text-sm mt-1">{alert.message}</div>
                      <div className="text-xs text-gray-500 mt-2">
                        Affected: {alert.affected_extensions.join(', ')} • {formatTimestamp(alert.timestamp)}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => resolveAlert(alert.alert_id, 'Manual resolution from monitoring dashboard')}
                    >
                      Resolve
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
        </div>
      )}

      {/* Extension Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Extensions</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {extensionHealth.map((ext) => (
                    <div
                      key={ext.extension_id}
                      className={`p-3 border rounded cursor-pointer transition-colors ${
                        selectedExtension === ext.extension_id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedExtension(ext.extension_id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">Extension {ext.extension_id}</div>
                        <Badge className={getStatusColor(ext.status)}>
                          {ext.status}
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Version: {ext.version}</div>
                        <div>Last heartbeat: {formatTimestamp(ext.last_heartbeat)}</div>
                        <div>Success rate: {ext.directory_statistics.success_rate_percent}%</div>
                      </div>

                      {ext.current_activity.is_processing && (
                        <div className="text-xs text-blue-600 mt-2">
                          Processing: {ext.current_activity.current_directory}
                        </div>
                      )}

                      {ext.recent_errors.length > 0 && (
                        <div className="text-xs text-red-600 mt-2">
                          {ext.recent_errors.length} recent errors
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedExtensionData ? (
            <div className="space-y-6">
              {/* Extension Overview */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Extension {selectedExtensionData.extension_id} - Details</CardTitle>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => runHealthChecks(selectedExtensionData.extension_id)}
                    >
                      Run Health Checks
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => restartExtension(selectedExtensionData.extension_id)}
                      disabled={selectedExtensionData.status === 'offline'}
                    >
                      Restart Extension
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Status</div>
                      <Badge className={getStatusColor(selectedExtensionData.status)}>
                        {selectedExtensionData.status}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Version</div>
                      <div className="font-medium">{selectedExtensionData.version}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Chrome Version</div>
                      <div className="font-medium">{selectedExtensionData.chrome_version}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">OS</div>
                      <div className="font-medium">{selectedExtensionData.os}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {selectedExtensionData.performance_metrics.memory_usage_mb}MB
                      </div>
                      <div className="text-sm text-gray-600">Memory Usage</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {selectedExtensionData.performance_metrics.cpu_usage_percent}%
                      </div>
                      <div className="text-sm text-gray-600">CPU Usage</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {selectedExtensionData.performance_metrics.average_response_time_ms}ms
                      </div>
                      <div className="text-sm text-gray-600">Response Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {selectedExtensionData.directory_statistics.success_rate_percent}%
                      </div>
                      <div className="text-sm text-gray-600">Success Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {selectedExtensionData.directory_statistics.total_processed}
                      </div>
                      <div className="text-sm text-gray-600">Total Processed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {selectedExtensionData.performance_metrics.error_rate_percent}%
                      </div>
                      <div className="text-sm text-gray-600">Error Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Activity */}
              {selectedExtensionData.current_activity.is_processing && (
                <Card>
                  <CardHeader>
                    <CardTitle>Current Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="font-medium">Processing Directory</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-600">Customer</div>
                          <div className="font-medium">{selectedExtensionData.current_activity.current_customer_id}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Directory</div>
                          <div className="font-medium">{selectedExtensionData.current_activity.current_directory}</div>
                        </div>
                      </div>

                      {selectedExtensionData.current_activity.estimated_completion && (
                        <div>
                          <div className="text-sm text-gray-600">Estimated Completion</div>
                          <div className="font-medium">
                            {formatTimestamp(selectedExtensionData.current_activity.estimated_completion)}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Health Checks */}
              <Card>
                <CardHeader>
                  <CardTitle>Health Checks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedExtensionData.health_checks.length > 0 ? (
                      selectedExtensionData.health_checks.map((check) => (
                        <div 
                          key={check.check_id}
                          className={`p-3 border rounded ${
                            check.status === 'pass' ? 'border-green-200 bg-green-50' :
                            check.status === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                            'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{check.check_name}</span>
                            <Badge 
                              className={
                                check.status === 'pass' ? 'bg-green-500' :
                                check.status === 'warning' ? 'bg-yellow-500' :
                                'bg-red-500'
                              }
                            >
                              {check.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-700">{check.details}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Last run: {formatTimestamp(check.last_run)} • Duration: {formatDuration(check.duration_ms)}
                          </div>
                          {check.recommendations && check.recommendations.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs font-medium text-blue-600">Recommendations:</div>
                              <ul className="text-xs text-blue-700 list-disc list-inside">
                                {check.recommendations.map((rec, index) => (
                                  <li key={index}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        <div className="text-2xl mb-2">🔍</div>
                        <p>No health checks available</p>
                        <Button 
                          size="sm" 
                          className="mt-2"
                          onClick={() => runHealthChecks(selectedExtensionData.extension_id)}
                        >
                          Run Health Checks
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Errors */}
              {selectedExtensionData.recent_errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedExtensionData.recent_errors.map((error) => (
                        <div key={error.error_id} className="p-3 border border-red-200 bg-red-50 rounded">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-red-800">{error.error_type}</span>
                            <div className="text-xs text-red-600">
                              {formatTimestamp(error.timestamp)}
                            </div>
                          </div>
                          <div className="text-sm text-red-700">{error.error_message}</div>
                          {error.directory_name && (
                            <div className="text-xs text-red-600 mt-1">
                              Directory: {error.directory_name}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={error.recovery_attempted ? "default" : "secondary"}>
                              {error.recovery_attempted ? 'Recovery Attempted' : 'No Recovery'}
                            </Badge>
                            <Badge variant={error.resolution_status === 'resolved' ? "default" : "secondary"}>
                              {error.resolution_status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-4xl mb-4">👆</div>
                <h3 className="text-lg font-medium">Select an Extension</h3>
                <p className="text-gray-600 mt-2">Choose an extension to view detailed health monitoring</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}