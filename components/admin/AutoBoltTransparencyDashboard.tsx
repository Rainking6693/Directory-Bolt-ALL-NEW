/**
 * AutoBolt Transparency Dashboard
 * Real-time monitoring and transparency for AutoBolt operations
 * 
 * Features:
 * - Real-time activity monitoring
 * - Screenshot capture system
 * - Comprehensive log viewer
 * - Success/failure metrics
 * - Customer queue visualization
 * - Admin emergency controls
 * 
 * Author: Ben (Senior Full-Stack Developer)
 */

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { 
    Activity, Camera, FileText, AlertTriangle, CheckCircle, 
    XCircle, Clock, Settings, BarChart3, Users, Database,
    PlayCircle, PauseCircle, Square, RefreshCw, Download,
    Eye, Zap, Shield, Monitor, TrendingUp, AlertCircle,
    Server, Cpu, HardDrive, Network, Bell, Search
} from 'lucide-react'

interface AutoBoltActivity {
    id: string
    timestamp: string
    type: 'customer_processing' | 'directory_submission' | 'system_event' | 'error'
    customerId?: string
    directoryName?: string
    status: 'in_progress' | 'completed' | 'failed' | 'pending'
    message: string
    screenshot?: string
    metadata?: any
}

interface CustomerQueueItem {
    customerId: string
    packageType: string
    submissionStatus: string
    businessName: string
    email: string
    progress: {
        totalDirectories: number
        completed: number
        successful: number
        failed: number
        percentage: number
        currentDirectory?: string
    }
    createdAt: string
    lastUpdated: string
    priority: number
}

interface SystemMetrics {
    customers: {
        pending: number
        processing: number
        completed: number
        total: number
    }
    performance: {
        successRate: number
        averageProcessingTime: number
        totalDirectoriesProcessed: number
        totalSuccessfulSubmissions: number
    }
    system: {
        status: string
        lastUpdate: string
        version: string
    }
}

interface LogEntry {
    id: string
    timestamp: string
    level: 'info' | 'warn' | 'error' | 'debug'
    source: 'autobolt' | 'extension' | 'api' | 'system'
    message: string
    customerId?: string
    directoryName?: string
    data?: any
}

const LoadingSkeleton = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-300 rounded ${className}`}></div>
)

const ActivityIndicator = ({ isActive }: { isActive: boolean }) => (
    <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
        <span className={`text-xs ${isActive ? 'text-green-600' : 'text-gray-500'}`}>
            {isActive ? 'LIVE' : 'IDLE'}
        </span>
    </div>
)

export default function AutoBoltTransparencyDashboard() {
    const [activities, setActivities] = useState<AutoBoltActivity[]>([])
    const [customerQueue, setCustomerQueue] = useState<CustomerQueueItem[]>([])
    const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null)
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTab, setSelectedTab] = useState<'activity' | 'queue' | 'logs' | 'metrics' | 'screenshots'>('activity')
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [systemStatus, setSystemStatus] = useState<'running' | 'paused' | 'stopped'>('running')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)
    const [screenshotUrls, setScreenshotUrls] = useState<string[]>([])
    const [isRecording, setIsRecording] = useState(false)
    
    const refreshInterval = useRef<NodeJS.Timeout | null>(null)
    const activityStream = useRef<EventSource | null>(null)

    useEffect(() => {
        initializeDashboard()
        setupRealTimeStream()
        
        if (autoRefresh) {
            refreshInterval.current = setInterval(() => {
                loadDashboardData()
            }, 5000)
        }

        return () => {
            if (refreshInterval.current) clearInterval(refreshInterval.current)
            if (activityStream.current) activityStream.current.close()
        }
    }, [autoRefresh])

    const initializeDashboard = async () => {
        try {
            await loadDashboardData()
            await loadScreenshots()
        } catch (error) {
            console.error('Failed to initialize dashboard:', error)
        } finally {
            setLoading(false)
        }
    }

    const setupRealTimeStream = () => {
        try {
            activityStream.current = new EventSource('/api/autobolt/stream')
            
            activityStream.current.onmessage = (event) => {
                const activity = JSON.parse(event.data)
                setActivities(prev => [activity, ...prev.slice(0, 99)]) // Keep last 100 activities
                
                // Update customer queue if needed
                if (activity.customerId) {
                    loadCustomerQueue()
                }
            }

            activityStream.current.onerror = (error) => {
                console.error('Activity stream error:', error)
                setTimeout(() => setupRealTimeStream(), 5000) // Reconnect after 5 seconds
            }
        } catch (error) {
            console.error('Failed to setup real-time stream:', error)
        }
    }

    const loadDashboardData = async () => {
        try {
            const [metricsResponse, queueResponse, logsResponse] = await Promise.all([
                fetch('/api/autobolt/stats'),
                fetch('/api/autobolt/queue/pending'),
                fetch('/api/autobolt/logs')
            ])

            if (metricsResponse.ok) {
                const metricsData = await metricsResponse.json()
                setSystemMetrics(metricsData.stats)
            }

            if (queueResponse.ok) {
                const queueData = await queueResponse.json()
                setCustomerQueue(queueData.customers || [])
            }

            if (logsResponse.ok) {
                const logsData = await logsResponse.json()
                setLogs(logsData.logs || [])
            }

        } catch (error) {
            console.error('Failed to load dashboard data:', error)
        }
    }

    const loadCustomerQueue = async () => {
        try {
            const response = await fetch('/api/autobolt/queue/pending')
            if (response.ok) {
                const data = await response.json()
                setCustomerQueue(data.customers || [])
            }
        } catch (error) {
            console.error('Failed to load customer queue:', error)
        }
    }

    const loadScreenshots = async () => {
        try {
            const response = await fetch('/api/autobolt/screenshots')
            if (response.ok) {
                const data = await response.json()
                setScreenshotUrls(data.screenshots || [])
            }
        } catch (error) {
            console.error('Failed to load screenshots:', error)
        }
    }

    const captureScreenshot = async (customerId?: string, directoryName?: string) => {
        try {
            setIsRecording(true)
            const response = await fetch('/api/autobolt/capture-screenshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId, directoryName })
            })

            if (response.ok) {
                const data = await response.json()
                setScreenshotUrls(prev => [data.screenshotUrl, ...prev])
                
                // Add activity log
                const activity: AutoBoltActivity = {
                    id: Date.now().toString(),
                    timestamp: new Date().toISOString(),
                    type: 'system_event',
                    customerId,
                    status: 'completed',
                    message: `Screenshot captured for ${directoryName || 'system'}`,
                    screenshot: data.screenshotUrl
                }
                setActivities(prev => [activity, ...prev])
            }
        } catch (error) {
            console.error('Failed to capture screenshot:', error)
        } finally {
            setIsRecording(false)
        }
    }

    const controlSystem = async (action: 'start' | 'pause' | 'stop' | 'emergency_stop') => {
        try {
            const response = await fetch('/api/autobolt/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            })

            if (response.ok) {
                const newStatus = action === 'start' ? 'running' : 
                                action === 'pause' ? 'paused' : 'stopped'
                setSystemStatus(newStatus)
                
                // Log the action
                const activity: AutoBoltActivity = {
                    id: Date.now().toString(),
                    timestamp: new Date().toISOString(),
                    type: 'system_event',
                    status: 'completed',
                    message: `System ${action} executed by admin`
                }
                setActivities(prev => [activity, ...prev])
            }
        } catch (error) {
            console.error('Failed to control system:', error)
        }
    }

    const exportLogs = async () => {
        try {
            const response = await fetch('/api/autobolt/export-logs')
            if (response.ok) {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `autobolt-logs-${new Date().toISOString().split('T')[0]}.json`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                window.URL.revokeObjectURL(url)
            }
        } catch (error) {
            console.error('Failed to export logs:', error)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-600 bg-green-100'
            case 'in_progress': return 'text-blue-600 bg-blue-100'
            case 'failed': return 'text-red-600 bg-red-100'
            case 'pending': return 'text-yellow-600 bg-yellow-100'
            default: return 'text-gray-600 bg-gray-100'
        }
    }

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'customer_processing': return Users
            case 'directory_submission': return Database
            case 'system_event': return Settings
            case 'error': return AlertTriangle
            default: return Activity
        }
    }

    const filteredActivities = activities.filter(activity => 
        !searchTerm || 
        activity.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.customerId?.includes(searchTerm) ||
        activity.directoryName?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredLogs = logs.filter(log => 
        !searchTerm || 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.customerId?.includes(searchTerm) ||
        log.directoryName?.toLowerCase().includes(searchTerm.toLowerCase())
    )

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
            <div className="bg-white shadow border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <Shield className="w-8 h-8 text-blue-600" />
                                AutoBolt Transparency Dashboard
                            </h1>
                            <p className="text-gray-600 flex items-center gap-2 mt-1">
                                Real-time monitoring and complete visibility
                                <ActivityIndicator isActive={systemStatus === 'running'} />
                            </p>
                        </div>
                        <div className="flex items-center space-x-4">
                            {/* System Status */}
                            <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg">
                                <div className={`w-2 h-2 rounded-full ${
                                    systemStatus === 'running' ? 'bg-green-500' :
                                    systemStatus === 'paused' ? 'bg-yellow-500' : 'bg-red-500'
                                }`}></div>
                                <span className="text-sm font-medium capitalize">{systemStatus}</span>
                            </div>

                            {/* Emergency Controls */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => controlSystem('start')}
                                    disabled={systemStatus === 'running'}
                                    className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                                >
                                    <PlayCircle className="w-4 h-4 mr-1" />
                                    Start
                                </button>
                                <button
                                    onClick={() => controlSystem('pause')}
                                    disabled={systemStatus !== 'running'}
                                    className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400"
                                >
                                    <PauseCircle className="w-4 h-4 mr-1" />
                                    Pause
                                </button>
                                <button
                                    onClick={() => controlSystem('emergency_stop')}
                                    className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                                >
                                    <Square className="w-4 h-4 mr-1" />
                                    Emergency Stop
                                </button>
                            </div>

                            {/* Auto-refresh */}
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={autoRefresh}
                                    onChange={(e) => setAutoRefresh(e.target.checked)}
                                    className="mr-2"
                                />
                                <span className="text-sm text-gray-700">Auto-refresh</span>
                            </label>

                            {/* Refresh Button */}
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
                            { id: 'activity', name: 'Real-Time Activity', icon: Activity },
                            { id: 'queue', name: 'Customer Queue', icon: Users },
                            { id: 'logs', name: 'System Logs', icon: FileText },
                            { id: 'metrics', name: 'Performance Metrics', icon: BarChart3 },
                            { id: 'screenshots', name: 'Screenshots', icon: Camera }
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
                                    {tab.id === 'activity' && activities.length > 0 && (
                                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                            {activities.length}
                                        </span>
                                    )}
                                    {tab.id === 'queue' && customerQueue.length > 0 && (
                                        <span className="ml-2 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                            {customerQueue.length}
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
                {/* Search Bar */}
                <div className="mb-6">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search activities, customers, or logs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* Tab Content */}
                {selectedTab === 'activity' && (
                    <div className="space-y-6">
                        {/* Quick Stats */}
                        {systemMetrics && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-white overflow-hidden shadow rounded-lg">
                                    <div className="p-5">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0">
                                                <Users className="h-6 w-6 text-blue-400" />
                                            </div>
                                            <div className="ml-5 w-0 flex-1">
                                                <dl>
                                                    <dt className="text-sm font-medium text-gray-500 truncate">Processing</dt>
                                                    <dd className="text-lg font-medium text-blue-600">
                                                        {systemMetrics.customers.processing}
                                                    </dd>
                                                </dl>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white overflow-hidden shadow rounded-lg">
                                    <div className="p-5">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0">
                                                <Clock className="h-6 w-6 text-yellow-400" />
                                            </div>
                                            <div className="ml-5 w-0 flex-1">
                                                <dl>
                                                    <dt className="text-sm font-medium text-gray-500 truncate">Queue</dt>
                                                    <dd className="text-lg font-medium text-yellow-600">
                                                        {systemMetrics.customers.pending}
                                                    </dd>
                                                </dl>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white overflow-hidden shadow rounded-lg">
                                    <div className="p-5">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0">
                                                <CheckCircle className="h-6 w-6 text-green-400" />
                                            </div>
                                            <div className="ml-5 w-0 flex-1">
                                                <dl>
                                                    <dt className="text-sm font-medium text-gray-500 truncate">Success Rate</dt>
                                                    <dd className="text-lg font-medium text-green-600">
                                                        {(systemMetrics.performance.successRate * 100).toFixed(1)}%
                                                    </dd>
                                                </dl>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white overflow-hidden shadow rounded-lg">
                                    <div className="p-5">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0">
                                                <TrendingUp className="h-6 w-6 text-purple-400" />
                                            </div>
                                            <div className="ml-5 w-0 flex-1">
                                                <dl>
                                                    <dt className="text-sm font-medium text-gray-500 truncate">Avg Time</dt>
                                                    <dd className="text-lg font-medium text-purple-600">
                                                        {systemMetrics.performance.averageProcessingTime}m
                                                    </dd>
                                                </dl>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Real-time Activity Feed */}
                        <div className="bg-white shadow rounded-lg">
                            <div className="px-4 py-5 sm:p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
                                        <Zap className="w-5 h-5 text-blue-500" />
                                        Live Activity Stream
                                    </h3>
                                    <button
                                        onClick={() => captureScreenshot()}
                                        disabled={isRecording}
                                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100"
                                    >
                                        <Camera className="w-4 h-4 mr-2" />
                                        {isRecording ? 'Recording...' : 'Capture Screenshot'}
                                    </button>
                                </div>
                                
                                <div className="flow-root">
                                    <ul className="-mb-8">
                                        {filteredActivities.length === 0 ? (
                                            <li className="text-center py-8 text-gray-500">
                                                No activities found
                                            </li>
                                        ) : (
                                            filteredActivities.map((activity, index) => {
                                                const Icon = getActivityIcon(activity.type)
                                                return (
                                                    <li key={activity.id}>
                                                        <div className="relative pb-8">
                                                            {index !== filteredActivities.length - 1 && (
                                                                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"></span>
                                                            )}
                                                            <div className="relative flex space-x-3">
                                                                <div>
                                                                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getStatusColor(activity.status)}`}>
                                                                        <Icon className="w-4 h-4" />
                                                                    </span>
                                                                </div>
                                                                <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                                                    <div>
                                                                        <p className="text-sm text-gray-500">
                                                                            {activity.message}
                                                                            {activity.customerId && (
                                                                                <span className="font-medium text-blue-600"> (Customer: {activity.customerId})</span>
                                                                            )}
                                                                            {activity.directoryName && (
                                                                                <span className="font-medium text-green-600"> - {activity.directoryName}</span>
                                                                            )}
                                                                        </p>
                                                                        {activity.screenshot && (
                                                                            <div className="mt-2">
                                                                                <img 
                                                                                    src={activity.screenshot} 
                                                                                    alt="Activity screenshot"
                                                                                    className="w-32 h-20 object-cover rounded border cursor-pointer hover:scale-105 transition-transform"
                                                                                    onClick={() => window.open(activity.screenshot, '_blank')}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                                                        {new Date(activity.timestamp).toLocaleString()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                )
                                            })
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {selectedTab === 'queue' && (
                    <div className="space-y-6">
                        <div className="bg-white shadow rounded-lg">
                            <div className="px-4 py-5 sm:p-6">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Customer Processing Queue</h3>
                                
                                {customerQueue.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">No customers in queue</h3>
                                        <p className="text-gray-600">All customers have been processed or queue is empty.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Package</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Directory</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {customerQueue.map((customer) => (
                                                    <tr key={customer.customerId} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div>
                                                                <div className="text-sm font-medium text-gray-900">{customer.businessName}</div>
                                                                <div className="text-sm text-gray-500">{customer.email}</div>
                                                                <div className="text-xs text-gray-400">ID: {customer.customerId}</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                {customer.packageType}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(customer.submissionStatus)}`}>
                                                                {customer.submissionStatus}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                                                    <div 
                                                                        className="bg-blue-600 h-2 rounded-full" 
                                                                        style={{ width: `${customer.progress.percentage}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-sm text-gray-900">{customer.progress.percentage}%</span>
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {customer.progress.completed}/{customer.progress.totalDirectories} directories
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                            {customer.progress.currentDirectory || 'None'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                            <button
                                                                onClick={() => captureScreenshot(customer.customerId, customer.progress.currentDirectory)}
                                                                className="text-blue-600 hover:text-blue-900 mr-3"
                                                            >
                                                                <Camera className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setSelectedCustomer(customer.customerId)}
                                                                className="text-green-600 hover:text-green-900"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {selectedTab === 'logs' && (
                    <div className="space-y-6">
                        <div className="bg-white shadow rounded-lg">
                            <div className="px-4 py-5 sm:p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900">System Logs</h3>
                                    <button
                                        onClick={exportLogs}
                                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Export Logs
                                    </button>
                                </div>
                                
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    {filteredLogs.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">
                                            No logs found
                                        </div>
                                    ) : (
                                        filteredLogs.map((log) => (
                                            <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                                log.level === 'error' ? 'bg-red-100 text-red-800' :
                                                                log.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                                                                log.level === 'debug' ? 'bg-purple-100 text-purple-800' :
                                                                'bg-blue-100 text-blue-800'
                                                            }`}>
                                                                {log.level.toUpperCase()}
                                                            </span>
                                                            <span className="text-xs text-gray-500">{log.source}</span>
                                                            {log.customerId && (
                                                                <span className="text-xs text-blue-600">Customer: {log.customerId}</span>
                                                            )}
                                                            {log.directoryName && (
                                                                <span className="text-xs text-green-600">{log.directoryName}</span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-900 font-mono">{log.message}</p>
                                                        {log.data && (
                                                            <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
                                                                {JSON.stringify(log.data, null, 2)}
                                                            </pre>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 ml-4">
                                                        {new Date(log.timestamp).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {selectedTab === 'metrics' && systemMetrics && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white shadow rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Statistics</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Total Customers</span>
                                        <span className="text-sm font-medium">{systemMetrics.customers.total}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Pending</span>
                                        <span className="text-sm font-medium text-yellow-600">{systemMetrics.customers.pending}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Processing</span>
                                        <span className="text-sm font-medium text-blue-600">{systemMetrics.customers.processing}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Completed</span>
                                        <span className="text-sm font-medium text-green-600">{systemMetrics.customers.completed}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white shadow rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Success Rate</span>
                                        <span className="text-sm font-medium text-green-600">
                                            {(systemMetrics.performance.successRate * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Average Processing Time</span>
                                        <span className="text-sm font-medium">{systemMetrics.performance.averageProcessingTime} minutes</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Total Directories Processed</span>
                                        <span className="text-sm font-medium">{systemMetrics.performance.totalDirectoriesProcessed}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Successful Submissions</span>
                                        <span className="text-sm font-medium text-green-600">{systemMetrics.performance.totalSuccessfulSubmissions}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white shadow rounded-lg p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-blue-600">{systemMetrics.system.status.toUpperCase()}</div>
                                    <div className="text-sm text-gray-600">System Status</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">{systemMetrics.system.version}</div>
                                    <div className="text-sm text-gray-600">Version</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-sm font-bold text-gray-600">
                                        {new Date(systemMetrics.system.lastUpdate).toLocaleString()}
                                    </div>
                                    <div className="text-sm text-gray-600">Last Update</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {selectedTab === 'screenshots' && (
                    <div className="space-y-6">
                        <div className="bg-white shadow rounded-lg">
                            <div className="px-4 py-5 sm:p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900">Screenshot Gallery</h3>
                                    <button
                                        onClick={() => captureScreenshot()}
                                        disabled={isRecording}
                                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                                    >
                                        <Camera className="w-4 h-4 mr-2" />
                                        {isRecording ? 'Capturing...' : 'Capture Screenshot'}
                                    </button>
                                </div>
                                
                                {screenshotUrls.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">No screenshots captured</h3>
                                        <p className="text-gray-600">Screenshots will appear here as AutoBolt processes customers.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {screenshotUrls.map((url, index) => (
                                            <div key={index} className="relative group">
                                                <img
                                                    src={url}
                                                    alt={`Screenshot ${index + 1}`}
                                                    className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:scale-105 transition-transform"
                                                    onClick={() => window.open(url, '_blank')}
                                                />
                                                <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                                                    Screenshot {index + 1}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}