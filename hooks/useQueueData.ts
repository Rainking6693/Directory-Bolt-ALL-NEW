import { useState, useEffect, useCallback } from 'react'
import { QueueData, QueueStats, QueueCustomer } from '../components/staff-dashboard/types/queue.types'

interface UseQueueDataReturn {
  queueData: QueueData | null
  isLoading: boolean
  error: string | null
  refreshData: () => Promise<void>
}

export function useQueueData(): UseQueueDataReturn {
  const [queueData, setQueueData] = useState<QueueData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQueueData = useCallback(async () => {
    try {
      setError(null)
      
      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout
      
      // Fetch queue stats
      const statsResponse = await fetch('/api/autobolt/queue-status', {
        signal: controller.signal
      })
      
      if (!statsResponse.ok) {
        throw new Error(`HTTP ${statsResponse.status}: ${statsResponse.statusText}`)
      }
      
      const statsResult = await statsResponse.json()
      
      if (!statsResult.success) {
        throw new Error(statsResult.error || 'Failed to fetch queue stats')
      }

      // Fetch pending customers
      const customersResponse = await fetch('/api/autobolt/pending-customers?limit=50', {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!customersResponse.ok) {
        throw new Error(`HTTP ${customersResponse.status}: ${customersResponse.statusText}`)
      }
      
      const customersResult = await customersResponse.json()
      
      if (!customersResult.success) {
        throw new Error(customersResult.error || 'Failed to fetch pending customers')
      }

      // Transform API data to match our interface
      const stats: QueueStats = {
        pending: statsResult.data.stats.pending || 0,
        processing: statsResult.data.stats.processing || 0,
        completedToday: statsResult.data.stats.completedToday || 0,
        totalRevenue: statsResult.data.stats.totalRevenue || 0,
        averageWaitTime: statsResult.data.stats.averageWaitTime || 0,
        successRate: statsResult.data.stats.successRate || 0,
        highPriority: statsResult.data.stats.highPriority || 0,
        todaysGoal: 50, // Hard-coded for now
        todaysCompleted: statsResult.data.stats.completedToday || 0
      }

      const customers: QueueCustomer[] = customersResult.data.customers.map((customer: any) => ({
        customerId: customer.customerId,
        businessName: customer.businessName,
        email: customer.email,
        packageType: customer.packageType,
        directoryLimit: customer.directoryLimit,
        priority: customer.priority,
        waitTime: calculateWaitTime(customer.createdAt),
        submissionStatus: customer.submissionStatus,
        createdAt: customer.createdAt,
        purchaseDate: customer.purchaseDate,
        website: customer.website
      }))

      // Sort customers by priority (highest first)
      customers.sort((a, b) => b.priority - a.priority)

      const data: QueueData = {
        stats,
        customers,
        isProcessing: statsResult.data.isProcessing || false,
        nextCustomer: statsResult.data.nextCustomer || null,
        lastUpdated: statsResult.data.lastUpdated || new Date().toISOString()
      }

      setQueueData(data)

    } catch (err) {
      console.error('Error fetching queue data:', err)
      
      // Provide specific error messages
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timeout - please check your connection and try again')
        } else if (err.message.includes('Airtable') || err.message.includes('configuration')) {
          setError('Database configuration issue - using demo data for development')
        } else if (err.message.includes('HTTP 500')) {
          setError('Server error - please try again in a moment')
        } else if (err.message.includes('HTTP 429')) {
          setError('Rate limit exceeded - please wait a moment before refreshing')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to fetch queue data - please try again')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshData = useCallback(async () => {
    await fetchQueueData()
  }, [fetchQueueData])

  // Calculate wait time in hours
  const calculateWaitTime = (createdAt: string): number => {
    const created = new Date(createdAt)
    const now = new Date()
    const diffMs = now.getTime() - created.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    return Math.round(diffHours * 10) / 10 // Round to 1 decimal place
  }

  // Initial data fetch
  useEffect(() => {
    fetchQueueData()
  }, [fetchQueueData])

  return {
    queueData,
    isLoading,
    error,
    refreshData
  }
}