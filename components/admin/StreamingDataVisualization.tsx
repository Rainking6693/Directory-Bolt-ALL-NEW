/**
 * Streaming Data Visualization Component
 * Real-time data visualization with streaming updates
 * 
 * Features:
 * - Real-time streaming data updates
 * - Interactive charts and metrics
 * - Progressive loading with fallbacks
 * - Premium SaaS-level animations and interactions
 * 
 * Implements $299+ tier patterns:
 * - Live data streaming with visual indicators
 * - Smooth animations and micro-interactions
 * - Context-aware data presentation
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { 
    TrendingUp, TrendingDown, Activity, BarChart3, 
    Zap, Users, Database, Clock, ArrowUp, ArrowDown 
} from 'lucide-react'

interface DataPoint {
    timestamp: Date
    value: number
    label?: string
}

interface StreamingMetric {
    id: string
    name: string
    currentValue: number
    previousValue: number
    dataPoints: DataPoint[]
    unit: string
    target?: number
    status: 'healthy' | 'warning' | 'critical'
}

interface StreamingDataVisualizationProps {
    endpoint: string
    refreshInterval?: number
    maxDataPoints?: number
    className?: string
}

// Simulated real-time data fetcher (replace with actual API calls)
const fetchStreamingData = async (endpoint: string): Promise<StreamingMetric[]> => {
    // In a real implementation, this would be replaced with actual API calls
    const mockData: StreamingMetric[] = [
        {
            id: 'response-time',
            name: 'Avg Response Time',
            currentValue: 180 + Math.random() * 40,
            previousValue: 190 + Math.random() * 30,
            dataPoints: [],
            unit: 'ms',
            target: 200,
            status: 'healthy'
        },
        {
            id: 'active-users',
            name: 'Active Users',
            currentValue: 1200 + Math.floor(Math.random() * 100),
            previousValue: 1180 + Math.floor(Math.random() * 80),
            dataPoints: [],
            unit: 'users',
            status: 'healthy'
        },
        {
            id: 'directory-submissions',
            name: 'Directory Submissions',
            currentValue: 45 + Math.floor(Math.random() * 10),
            previousValue: 42 + Math.floor(Math.random() * 8),
            dataPoints: [],
            unit: '/hour',
            status: 'healthy'
        },
        {
            id: 'error-rate',
            name: 'Error Rate',
            currentValue: 0.8 + Math.random() * 0.4,
            previousValue: 1.0 + Math.random() * 0.3,
            dataPoints: [],
            unit: '%',
            target: 2.0,
            status: 'healthy'
        }
    ]

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300))

    // Add random data points to simulate streaming
    return mockData.map(metric => ({
        ...metric,
        dataPoints: Array.from({ length: 20 }, (_, i) => ({
            timestamp: new Date(Date.now() - (19 - i) * 60000),
            value: metric.currentValue + (Math.random() - 0.5) * metric.currentValue * 0.2
        })),
        status: metric.currentValue > (metric.target || Infinity) ? 'warning' : 'healthy'
    }))
}

const MiniChart = ({ dataPoints, color = 'blue' }: { dataPoints: DataPoint[]; color?: string }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || dataPoints.length === 0) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const { width, height } = canvas
        ctx.clearRect(0, 0, width, height)

        // Calculate scaling
        const values = dataPoints.map(d => d.value)
        const minValue = Math.min(...values)
        const maxValue = Math.max(...values)
        const range = maxValue - minValue || 1

        // Draw line
        ctx.strokeStyle = color === 'blue' ? '#3B82F6' : color === 'green' ? '#10B981' : '#EF4444'
        ctx.lineWidth = 2
        ctx.beginPath()

        dataPoints.forEach((point, index) => {
            const x = (index / (dataPoints.length - 1)) * width
            const y = height - ((point.value - minValue) / range) * height
            
            if (index === 0) {
                ctx.moveTo(x, y)
            } else {
                ctx.lineTo(x, y)
            }
        })

        ctx.stroke()

        // Add gradient fill
        ctx.globalAlpha = 0.1
        ctx.fillStyle = ctx.strokeStyle
        ctx.lineTo(width, height)
        ctx.lineTo(0, height)
        ctx.closePath()
        ctx.fill()
    }, [dataPoints, color])

    return (
        <canvas
            ref={canvasRef}
            width={120}
            height={40}
            className="w-full h-10"
        />
    )
}

const StreamingMetricCard = ({ 
    metric, 
    isStreaming 
}: { 
    metric: StreamingMetric; 
    isStreaming: boolean 
}) => {
    const [displayValue, setDisplayValue] = useState(metric.previousValue)
    const [showChange, setShowChange] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => {
            setDisplayValue(metric.currentValue)
            setShowChange(true)
            setTimeout(() => setShowChange(false), 1000)
        }, Math.random() * 500)

        return () => clearTimeout(timer)
    }, [metric.currentValue])

    const change = metric.currentValue - metric.previousValue
    const changePercent = metric.previousValue ? (change / metric.previousValue) * 100 : 0
    const isPositive = change > 0
    const isImproving = metric.id === 'error-rate' ? change < 0 : change > 0

    const getStatusColor = () => {
        switch (metric.status) {
            case 'healthy': return 'border-green-200 bg-green-50'
            case 'warning': return 'border-volt-200 bg-volt-50'
            case 'critical': return 'border-red-200 bg-red-50'
            default: return 'border-gray-200 bg-gray-50'
        }
    }

    return (
        <div className={`relative border rounded-lg p-4 transition-all duration-300 ${getStatusColor()}`}>
            {/* Streaming Indicator */}
            {isStreaming && (
                <div className="absolute top-2 right-2 flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-xs text-blue-600 font-medium">LIVE</span>
                </div>
            )}

            <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700">{metric.name}</h4>
                    {metric.target && (
                        <span className="text-xs text-gray-500">
                            Target: {metric.target}{metric.unit}
                        </span>
                    )}
                </div>

                {/* Value Display */}
                <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-bold transition-all duration-500 ${
                            showChange ? 'scale-105 text-blue-600' : 'text-gray-900'
                        }`}>
                            {displayValue.toFixed(metric.unit === '%' ? 1 : 0)}
                        </span>
                        <span className="text-sm text-gray-500">{metric.unit}</span>
                    </div>

                    {/* Change Indicator */}
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-1 text-xs font-medium ${
                            isImproving ? 'text-green-600' : 'text-red-600'
                        }`}>
                            {isPositive ? (
                                <ArrowUp className="w-3 h-3" />
                            ) : (
                                <ArrowDown className="w-3 h-3" />
                            )}
                            <span>
                                {Math.abs(changePercent).toFixed(1)}%
                            </span>
                        </div>
                        <span className="text-xs text-gray-500">vs last update</span>
                    </div>
                </div>

                {/* Mini Chart */}
                <div className="h-10">
                    <MiniChart 
                        dataPoints={metric.dataPoints} 
                        color={isImproving ? 'green' : 'red'}
                    />
                </div>
            </div>

            {/* Pulse Animation for Updates */}
            {showChange && (
                <div className="absolute inset-0 border-2 border-blue-300 rounded-lg animate-ping opacity-25" />
            )}
        </div>
    )
}

const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                <div className="space-y-3">
                    <div className="flex justify-between">
                        <div className="h-4 bg-gray-300 rounded w-24" />
                        <div className="h-3 bg-gray-300 rounded w-16" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-8 bg-gray-300 rounded w-20" />
                        <div className="h-3 bg-gray-300 rounded w-16" />
                    </div>
                    <div className="h-10 bg-gray-300 rounded" />
                </div>
            </div>
        ))}
    </div>
)

export default function StreamingDataVisualization({
    endpoint,
    refreshInterval = 5000,
    maxDataPoints = 20,
    className = ''
}: StreamingDataVisualizationProps) {
    const [metrics, setMetrics] = useState<StreamingMetric[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isStreaming, setIsStreaming] = useState(false)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
    const [error, setError] = useState<string | null>(null)

    const fetchData = async () => {
        try {
            setIsStreaming(true)
            const data = await fetchStreamingData(endpoint)
            
            setMetrics(prevMetrics => {
                // Merge new data with existing metrics, maintaining data point history
                return data.map(newMetric => {
                    const existingMetric = prevMetrics.find(m => m.id === newMetric.id)
                    if (existingMetric) {
                        // Add new data point and limit history
                        const updatedDataPoints = [
                            ...existingMetric.dataPoints,
                            {
                                timestamp: new Date(),
                                value: newMetric.currentValue
                            }
                        ].slice(-maxDataPoints)

                        return {
                            ...newMetric,
                            previousValue: existingMetric.currentValue,
                            dataPoints: updatedDataPoints
                        }
                    }
                    return newMetric
                })
            })
            
            setLastUpdate(new Date())
            setError(null)
        } catch (err) {
            setError('Failed to fetch streaming data')
            console.error('Streaming data error:', err)
        } finally {
            setIsLoading(false)
            setIsStreaming(false)
        }
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, refreshInterval)
        return () => clearInterval(interval)
    }, [endpoint, refreshInterval])

    const healthyMetrics = useMemo(() => 
        metrics.filter(m => m.status === 'healthy').length,
        [metrics]
    )

    const criticalMetrics = useMemo(() => 
        metrics.filter(m => m.status === 'critical').length,
        [metrics]
    )

    if (error && metrics.length === 0) {
        return (
            <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
                <div className="text-center">
                    <Activity className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <h3 className="text-lg font-medium text-red-800 mb-1">Streaming Error</h3>
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={fetchData}
                        className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <BarChart3 className="w-6 h-6 text-blue-600" />
                        {isStreaming && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Live Performance Metrics</h3>
                        <p className="text-sm text-gray-600">
                            {isStreaming ? (
                                <span className="flex items-center gap-2">
                                    <Zap className="w-3 h-3 text-blue-500" />
                                    Streaming live data...
                                </span>
                            ) : lastUpdate ? (
                                `Last updated ${lastUpdate.toLocaleTimeString()}`
                            ) : (
                                'Real-time system performance'
                            )}
                        </p>
                    </div>
                </div>

                {/* Status Summary */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-gray-600">{healthyMetrics} Healthy</span>
                    </div>
                    {criticalMetrics > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-red-600">{criticalMetrics} Critical</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Metrics Grid */}
            {isLoading && metrics.length === 0 ? (
                <LoadingSkeleton />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {metrics.map(metric => (
                        <StreamingMetricCard
                            key={metric.id}
                            metric={metric}
                            isStreaming={isStreaming}
                        />
                    ))}
                </div>
            )}

            {/* Connection Status */}
            <div className="flex items-center justify-center py-2">
                <div className={`flex items-center gap-2 text-xs ${
                    isStreaming ? 'text-blue-600' : 'text-gray-500'
                }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                        isStreaming ? 'bg-blue-500 animate-pulse' : 'bg-green-500'
                    }`} />
                    <span>
                        {isStreaming ? 'Streaming...' : 'Connected'}
                    </span>
                </div>
            </div>
        </div>
    )
}