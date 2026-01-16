'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Card } from '../../redesign-v2/components/ui/Card'
import { Badge } from '../../redesign-v2/components/ui/Badge'
import { Button } from '../../redesign-v2/components/ui/Button'

interface CustomerData {
  id: string
  business_name: string
  email: string
  package_type: string
}

interface JobData {
  id: string
  status: string
  directories_to_process: number
  created_at: string
  updated_at: string
}

interface CompletedLog {
  id: string
  directory_name: string
  screenshot_url: string | null
  success: boolean
  timestamp: string | null
}

interface DashboardStats {
  total_submissions: number
  completed_submissions: number
  failed_submissions: number
  pending_submissions: number
  success_rate: number
}

export default function RealTimeCustomerDashboard() {
  const router = useRouter()
  const [customer, setCustomer] = useState<CustomerData | null>(null)
  const [jobs, setJobs] = useState<JobData[]>([])
  const [completedLogs, setCompletedLogs] = useState<CompletedLog[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    total_submissions: 0,
    completed_submissions: 0,
    failed_submissions: 0,
    pending_submissions: 0,
    success_rate: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Get customer ID from router query OR local storage
  const customerId = (router.query.customerId as string) ||
    (typeof window !== 'undefined' ? localStorage.getItem('customerId') : null)

  useEffect(() => {
    if (!router.isReady) return

    if (!customerId) {
      // Allow valid query param ?onboarding=complete to stay, checking auth...
      // but if no ID, show error or redirect
      // Logic moved to DashboardPage wrapper, but double check here
      setLoading(false)
      return
    }

    loadDashboardData()
    const interval = setupRealtimeUpdates()
    return () => clearInterval(interval)
  }, [customerId, router.isReady])

  const loadDashboardData = async () => {
    if (!customerId) return
    try {
      const response = await fetch(`/api/customer/dashboard-data?customerId=${customerId}`)
      const data = await response.json()

      if (data.success) {
        setCustomer(data.data.customer)
        setJobs(data.data.jobs)
        setCompletedLogs(data.data.completed_logs)
        setStats(data.data.stats)
      } else {
        setError(data.error || 'Failed to load dashboard data')
      }
    } catch (err) {
      console.error('Dashboard data error:', err)
      // Don't show critical error for transient network issues
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeUpdates = () => {
    return setInterval(() => {
      loadDashboardData()
    }, 5000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-volt-500"></div>
      </div>
    )
  }

  if (error && !customer) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">Access Problem</h2>
        <p className="text-role-text-secondary mb-6">{error}</p>
        <Button onClick={() => router.push('/customer-login')}>Go to Login</Button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-role-text-primary">
            {customer?.business_name}'s Dashboard
          </h1>
          <p className="text-role-text-secondary">
            {customer?.package_type?.toUpperCase()} Plan • {customer?.email}
          </p>
        </div>
        <div>
          {jobs.some(j => j.status === 'processing' || j.status === 'pending') && (
            <Badge variant="warning" className="animate-pulse">
              ⚡ Submissions in Progress
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card variant="artifact" className="p-6">
          <div className="text-3xl font-black text-white mb-2">{stats.total_submissions}</div>
          <div className="text-sm font-medium text-role-text-secondary">Total Targeted</div>
        </Card>
        <Card variant="artifact" className="p-6 bg-green-900/10 border-green-500/30">
          <div className="text-3xl font-black text-green-400 mb-2">{stats.completed_submissions}</div>
          <div className="text-sm font-medium text-green-200/70">Successful</div>
        </Card>
        <Card variant="artifact" className="p-6">
          <div className="text-3xl font-black text-yellow-400 mb-2">{stats.pending_submissions}</div>
          <div className="text-sm font-medium text-role-text-secondary">In Queue</div>
        </Card>
        <Card variant="artifact" className="p-6">
          <div className="text-3xl font-black text-volt-500 mb-2">{stats.success_rate}%</div>
          <div className="text-sm font-medium text-role-text-secondary">Success Rate</div>
        </Card>
      </div>

      {/* Active Jobs */}
      {jobs.length > 0 && (
        <Card variant="default" className="p-6">
          <h2 className="text-xl font-bold text-role-text-primary mb-4">Active Jobs</h2>
          <div className="space-y-4">
            {jobs.map(job => (
              <div key={job.id} className="flex justify-between items-center p-4 bg-role-bg-secondary rounded-lg border border-role-border-default">
                <div>
                  <div className="font-mono text-sm text-role-text-secondary mb-1">ID: {job.id.slice(0, 8)}...</div>
                  <div className="text-role-text-primary font-medium">Batch Processing</div>
                </div>
                <div className="text-right">
                  <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'warning'}>
                    {job.status.toUpperCase()}
                  </Badge>
                  <div className="text-xs text-role-text-secondary mt-1">
                    Started: {new Date(job.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Completed Submissions Gallery */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-role-text-primary">Submission Evidence</h2>
        {completedLogs.length === 0 ? (
          <Card variant="default" className="p-12 text-center text-role-text-secondary">
            No completed submissions yet. Results will appear here as they finish.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedLogs.map(log => (
              <Card key={log.id} variant="default" className="overflow-hidden group hover:border-volt-500 transition-colors">
                <div className="aspect-video bg-gray-900 relative">
                  {log.screenshot_url ? (
                    <img
                      src={log.screenshot_url}
                      alt={`Proof for ${log.directory_name}`}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setSelectedImage(log.screenshot_url)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      No Screenshot
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant={log.success ? 'success' : 'error'}>
                      {log.success ? 'SUCCESS' : 'FAILED'}
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-role-text-primary mb-1">{log.directory_name}</h3>
                  <div className="text-xs text-role-text-secondary">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown Date'}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedImage(null)}>
          <div className="max-w-5xl w-full max-h-screen">
            <img src={selectedImage} alt="Full size proof" className="w-full h-auto rounded-lg shadow-2xl" />
            <p className="text-center text-white mt-4 text-sm">Click anywhere to close</p>
          </div>
        </div>
      )}
    </div>
  )
}
