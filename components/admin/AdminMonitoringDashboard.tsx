/**
 * Admin Monitoring Dashboard
 * Administrative interface for monitoring system management
 * 
 * Features:
 * - System health monitoring
 * - Directory management
 * - Customer monitoring overview
 * - Performance analytics
 * - Alert management
 * 
 * Author: Cora (QA Auditor) + Riley (Frontend Engineer)
 */

import React, { useState, useEffect, Suspense } from 'react'
import { 
    Activity, Users, Database, AlertTriangle, CheckCircle, 
    XCircle, Clock, Settings, BarChart3, TrendingUp, 
    Server, Cpu, HardDrive, Network, RefreshCw, Zap 
} from 'lucide-react'
import SmartInsightsBanner from './SmartInsightsBanner'
import StreamingDataVisualization from './StreamingDataVisualization'

interface SystemMetrics {
    cpu: number
    memory: number
    network: number
    responseTime: number
    uptime: number
    activeConnections: number
}

interface DirectoryStats {
    total: number
    active: number
    monitoring: number
    errors: number
    averageResponseTime: number
}

interface CustomerStats {
    totalCustomers: number
    activeMonitoring: number
    alertsGenerated: number
    complianceRequests: number
}

interface SystemAlert {
    id: string
    type: 'system' | 'directory' | 'customer' | 'compliance'
    severity: 'critical' | 'high' | 'medium' | 'low'
    message: string
    timestamp: string
    resolved: boolean
}

// Premium Loading Components
const MetricCardSkeleton = () => (
    <div className="bg-white overflow-hidden shadow rounded-lg animate-pulse">
        <div className="p-5">
            <div className="flex items-center">
                <div className="flex-shrink-0">
                    <div className="h-6 w-6 bg-gray-300 rounded"></div>
                </div>
                <div className="ml-5 w-0 flex-1">
                    <div className="space-y-2">
                        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                        <div className="h-5 bg-gray-300 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

const StreamingMetricCard = ({ 
    icon: Icon, 
    title, 
    value, 
    color, 
    threshold 
}: { 
    icon: any; 
    title: string; 
    value: number; 
    color: string; 
    threshold?: { warning: number; critical: number } 
}) => {
    const [displayValue, setDisplayValue] = useState(0)
    const [isStreaming, setIsStreaming] = useState(true)

    useEffect(() => {
        setIsStreaming(true)
        const timer = setTimeout(() => {
            setDisplayValue(value)
            setIsStreaming(false)
        }, Math.random() * 500 + 200)

        return () => clearTimeout(timer)
    }, [value])

    const getStatusColor = (val: number) => {
        if (threshold) {
            if (val >= threshold.critical) return 'text-red-600'
            if (val >= threshold.warning) return 'text-volt-600'
        }
        return color || 'text-green-600'
    }

    return (
        <div className="bg-white overflow-hidden shadow rounded-lg relative">
            {isStreaming && (
                <div className="absolute top-2 right-2">
                    <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-blue-500 animate-pulse" />
                        <span className="text-xs text-blue-500">Live</span>
                    </div>
                </div>
            )}
            <div className="p-5">
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <Icon className={`h-6 w-6 ${color || 'text-blue-400'}`} />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                        <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
                            <dd className={`text-lg font-medium transition-all duration-300 ${getStatusColor(displayValue)}`}>
                                {isStreaming ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-4 bg-gray-300 rounded animate-pulse"></div>
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                                    </div>
                                ) : (
                                    typeof value === 'number' && value < 1 ? 
                                        `${(displayValue * 100).toFixed(1)}%` : 
                                        `${displayValue.toFixed(0)}${title.includes('Time') ? 'ms' : ''}`
                                )}
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function AdminMonitoringDashboard() {
    const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null)
    const [directoryStats, setDirectoryStats] = useState<DirectoryStats | null>(null)
    const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null)
    const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTab, setSelectedTab] = useState<'overview' | 'directories' | 'customers' | 'alerts' | 'performance'>('overview')
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [csrfToken, setCsrfToken] = useState<string>('')

    useEffect(() => {
        // Initialize CSRF token
        fetchCSRFToken()
        loadDashboardData()
        
        // Auto-refresh every 30 seconds
        const interval = setInterval(() => {
            if (autoRefresh) {
                loadDashboardData()
            }
        }, 30000)
        
        return () => clearInterval(interval)
    }, [autoRefresh])

    const fetchCSRFToken = async () => {
        try {
            const response = await fetch('/api/csrf-token')
            if (response.ok) {
                const data = await response.json()
                setCsrfToken(data.token)
            }
        } catch (error) {
            console.error('Failed to fetch CSRF token:', error)
        }
    }

    const loadDashboardData = async () => {
        try {
            // Get stored admin auth from localStorage
            const storedAuth = localStorage.getItem('adminAuth')
            
            if (!storedAuth) {
                throw new Error('Admin authentication required')
            }
            
            const headers: HeadersInit = {
                'Authorization': `Bearer ${storedAuth}`
            }

            const [metricsResponse, directoriesResponse, customersResponse, alertsResponse] = await Promise.all([
                fetch('/api/admin/system/metrics', { headers }),
                fetch('/api/admin/directories/stats', { headers }),
                fetch('/api/admin/customers/stats', { headers }),
                fetch('/api/admin/alerts', { headers })
            ])

            if (metricsResponse.ok) {
                const metrics = await metricsResponse.json()
                setSystemMetrics(metrics)
            }

            if (directoriesResponse.ok) {
                const directories = await directoriesResponse.json()
                setDirectoryStats(directories)
            }

            if (customersResponse.ok) {
                const customers = await customersResponse.json()
                setCustomerStats(customers)
            }

            if (alertsResponse.ok) {
                const alerts = await alertsResponse.json()
                setSystemAlerts(alerts.alerts || [])
            }

        } catch (error) {
            console.error('Failed to load dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    const resolveAlert = async (alertId: string) => {
        try {
            // Refresh CSRF token before sensitive operation
            if (!csrfToken) {
                await fetchCSRFToken()
            }

            await fetch(`/api/admin/alerts/${alertId}/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                }
            })
            
            setSystemAlerts(prev => 
                prev.map(alert => 
                    alert.id === alertId ? { ...alert, resolved: true } : alert
                )
            )
        } catch (error) {
            console.error('Failed to resolve alert:', error)
            // Refresh CSRF token on failure (might be expired)
            await fetchCSRFToken()
        }
    }

    const getStatusColor = (value: number, thresholds: { warning: number, critical: number }) => {
        if (value >= thresholds.critical) return 'text-red-600'
        if (value >= thresholds.warning) return 'text-volt-600'
        return 'text-green-600'
    }

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-100 text-red-800 border-red-200'
            case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
            case 'medium': return 'bg-volt-100 text-volt-800 border-volt-200'
            case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
            default: return 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Admin Monitoring Dashboard</h1>
                            <p className="text-gray-600">System monitoring and management</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={autoRefresh}
                                    onChange={(e) => setAutoRefresh(e.target.checked)}
                                    className="mr-2"
                                />
                                <span className="text-sm text-gray-700">Auto-refresh</span>
                            </label>
                            <button
                                onClick={loadDashboardData}
                                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        {[
                            { id: 'overview', name: 'Overview', icon: Activity },
                            { id: 'directories', name: 'Directories', icon: Database },
                            { id: 'customers', name: 'Customers', icon: Users },
                            { id: 'alerts', name: 'Alerts', icon: AlertTriangle },
                            { id: 'performance', name: 'Performance', icon: BarChart3 }
                        ].map(tab => {
                            const Icon = tab.icon
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setSelectedTab(tab.id as any)}
                                    className={`${
                                        selectedTab === tab.id
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                                >
                                    <Icon className="w-4 h-4 mr-2" />
                                    {tab.name}
                                    {tab.id === 'alerts' && systemAlerts.filter(a => !a.resolved).length > 0 && (
                                        <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                            {systemAlerts.filter(a => !a.resolved).length}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </nav>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {selectedTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Smart AI Insights Banner */}
                        <SmartInsightsBanner
                            systemMetrics={systemMetrics}
                            directoryStats={directoryStats}
                            customerStats={customerStats}
                            className="mb-8"
                        />

                        {/* System Health Cards with Streaming */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <Suspense fallback={<MetricCardSkeleton />}>
                                {systemMetrics ? (
                                    <StreamingMetricCard
                                        icon={Cpu}
                                        title="CPU Usage"
                                        value={systemMetrics.cpu}
                                        color="text-blue-400"
                                        threshold={{ warning: 0.7, critical: 0.85 }}
                                    />
                                ) : (
                                    <MetricCardSkeleton />
                                )}
                            </Suspense>

                            <Suspense fallback={<MetricCardSkeleton />}>
                                {systemMetrics ? (
                                    <StreamingMetricCard
                                        icon={HardDrive}
                                        title="Memory Usage"
                                        value={systemMetrics.memory}
                                        color="text-green-400"
                                        threshold={{ warning: 0.75, critical: 0.9 }}
                                    />
                                ) : (
                                    <MetricCardSkeleton />
                                )}
                            </Suspense>

                            <Suspense fallback={<MetricCardSkeleton />}>
                                {systemMetrics ? (
                                    <StreamingMetricCard
                                        icon={Network}
                                        title="Active Connections"
                                        value={systemMetrics.activeConnections}
                                        color="text-purple-400"
                                    />
                                ) : (
                                    <MetricCardSkeleton />
                                )}
                            </Suspense>

                            <Suspense fallback={<MetricCardSkeleton />}>
                                {systemMetrics ? (
                                    <StreamingMetricCard
                                        icon={Clock}
                                        title="Avg Response Time"
                                        value={systemMetrics.responseTime}
                                        color="text-volt-400"
                                        threshold={{ warning: 3000, critical: 5000 }}
                                    />
                                ) : (
                                    <MetricCardSkeleton />
                                )}
                            </Suspense>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {directoryStats && (
                                <div className="bg-white shadow rounded-lg p-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Directory Status</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Total Directories</span>
                                            <span className="text-sm font-medium">{directoryStats.total}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Currently Monitoring</span>
                                            <span className="text-sm font-medium text-green-600">{directoryStats.monitoring}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Errors</span>
                                            <span className="text-sm font-medium text-red-600">{directoryStats.errors}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {customerStats && (
                                <div className="bg-white shadow rounded-lg p-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Monitoring</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Total Customers</span>
                                            <span className="text-sm font-medium">{customerStats.totalCustomers}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Active Monitoring</span>
                                            <span className="text-sm font-medium text-green-600">{customerStats.activeMonitoring}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Alerts Generated</span>
                                            <span className="text-sm font-medium text-volt-600">{customerStats.alertsGenerated}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white shadow rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">System Health</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Overall Status</span>
                                        <span className="inline-flex items-center text-sm font-medium text-green-600">
                                            <CheckCircle className="w-4 h-4 mr-1" />
                                            Healthy
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Uptime</span>
                                        <span className="text-sm font-medium">
                                            {systemMetrics ? `${(systemMetrics.uptime / 3600).toFixed(1)}h` : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Active Alerts</span>
                                        <span className="text-sm font-medium text-red-600">
                                            {systemAlerts.filter(a => !a.resolved).length}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {selectedTab === 'directories' && directoryStats && (
                    <div className="space-y-6">
                        <div className="bg-white shadow rounded-lg">
                            <div className="px-4 py-5 sm:p-6">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Directory Management</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-600">{directoryStats.total}</div>
                                        <div className="text-sm text-gray-600">Total Directories</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-green-600">{directoryStats.active}</div>
                                        <div className="text-sm text-gray-600">Active</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-volt-600">{directoryStats.monitoring}</div>
                                        <div className="text-sm text-gray-600">Monitoring</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-red-600">{directoryStats.errors}</div>
                                        <div className="text-sm text-gray-600">Errors</div>
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Average Response Time</span>
                                        <span className="text-sm font-medium">
                                            {directoryStats.averageResponseTime.toFixed(0)}ms
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {selectedTab === 'customers' && customerStats && (
                    <div className="space-y-6">
                        <div className="bg-white shadow rounded-lg">
                            <div className="px-4 py-5 sm:p-6">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Customer Monitoring Overview</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-600">{customerStats.totalCustomers}</div>
                                        <div className="text-sm text-gray-600">Total Customers</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-green-600">{customerStats.activeMonitoring}</div>
                                        <div className="text-sm text-gray-600">Active Monitoring</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-volt-600">{customerStats.alertsGenerated}</div>
                                        <div className="text-sm text-gray-600">Alerts Generated</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-purple-600">{customerStats.complianceRequests}</div>
                                        <div className="text-sm text-gray-600">Compliance Requests</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {selectedTab === 'alerts' && (
                    <div className="space-y-6">
                        <div className="bg-white shadow rounded-lg">
                            <div className="px-4 py-5 sm:p-6">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">System Alerts</h3>
                                
                                {systemAlerts.length === 0 ? (
                                    <div className="text-center py-8">
                                        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Alerts</h3>
                                        <p className="text-gray-600">All systems are operating normally.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {systemAlerts.map(alert => (
                                            <div
                                                key={alert.id}
                                                className={`p-4 rounded-md border ${getSeverityColor(alert.severity)} ${
                                                    alert.resolved ? 'opacity-50' : ''
                                                }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <div className="flex items-center">
                                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(alert.severity)}`}>
                                                                {alert.severity.toUpperCase()}
                                                            </span>
                                                            <span className="ml-2 text-sm text-gray-500">
                                                                {new Date(alert.timestamp).toLocaleString()}
                                                            </span>
                                                            {alert.resolved && (
                                                                <span className="ml-2 text-xs text-green-600">✓ Resolved</span>
                                                            )}
                                                        </div>
                                                        <h4 className="mt-2 text-lg font-medium text-gray-900">{alert.message}</h4>
                                                        <p className="text-sm text-gray-600 capitalize">Type: {alert.type}</p>
                                                    </div>
                                                    {!alert.resolved && (
                                                        <button
                                                            onClick={() => resolveAlert(alert.id)}
                                                            className="ml-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                                        >
                                                            Resolve
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {selectedTab === 'performance' && systemMetrics && (
                    <div className="space-y-6">
                        {/* Streaming Data Visualization */}
                        <StreamingDataVisualization
                            endpoint="/api/admin/system/metrics"
                            refreshInterval={3000}
                            className="mb-8"
                        />
                        
                        <div className="bg-white shadow rounded-lg">
                            <div className="px-4 py-5 sm:p-6">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Performance Metrics</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="text-md font-medium text-gray-900 mb-3">System Resources</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-sm">
                                                    <span>CPU Usage</span>
                                                    <span>{(systemMetrics.cpu * 100).toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                                    <div
                                                        className={`h-2 rounded-full ${
                                                            systemMetrics.cpu > 0.85 ? 'bg-red-600' :
                                                            systemMetrics.cpu > 0.7 ? 'bg-volt-600' : 'bg-green-600'
                                                        }`}
                                                        style={{ width: `${systemMetrics.cpu * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <div className="flex justify-between text-sm">
                                                    <span>Memory Usage</span>
                                                    <span>{(systemMetrics.memory * 100).toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                                    <div
                                                        className={`h-2 rounded-full ${
                                                            systemMetrics.memory > 0.9 ? 'bg-red-600' :
                                                            systemMetrics.memory > 0.75 ? 'bg-volt-600' : 'bg-green-600'
                                                        }`}
                                                        style={{ width: `${systemMetrics.memory * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h4 className="text-md font-medium text-gray-900 mb-3">Performance Stats</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Response Time</span>
                                                <span className="text-sm font-medium">{systemMetrics.responseTime.toFixed(0)}ms</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Active Connections</span>
                                                <span className="text-sm font-medium">{systemMetrics.activeConnections}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Uptime</span>
                                                <span className="text-sm font-medium">{(systemMetrics.uptime / 3600).toFixed(1)}h</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}