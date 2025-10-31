'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface CustomerData {
  id: string
  business_name: string
  email: string
  package_type: string
}

interface JobData {
  id: string
  status: string
  progress_percentage: number
  directories_completed: number
  directories_failed: number
  directories_to_process: number
  created_at: string
  updated_at: string
}

interface SubmissionData {
  id: string
  directory_name: string
  status: string
  submitted_at?: string
  approved_at?: string
  failed_at?: string
  error_message?: string
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
  const [submissions, setSubmissions] = useState<SubmissionData[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    total_submissions: 0,
    completed_submissions: 0,
    failed_submissions: 0,
    pending_submissions: 0,
    success_rate: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const customerId = router.query.customerId as string || localStorage.getItem('customerId')

  useEffect(() => {
    if (!customerId) {
      setError('No customer ID found')
      setLoading(false)
      return
    }

    loadDashboardData()
    setupRealtimeUpdates()
  }, [customerId])

  const loadDashboardData = async () => {
    try {
      const response = await fetch(`/api/customer/dashboard-data?customerId=${customerId}`)
      const data = await response.json()

      if (data.success) {
        setCustomer(data.data.customer)
        setJobs(data.data.jobs)
        setSubmissions(data.data.submissions)
        setStats(data.data.stats)
      } else {
        setError(data.error || 'Failed to load dashboard data')
      }
    } catch (err) {
      setError('Network error loading dashboard data')
      console.error('Dashboard data error:', err)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeUpdates = () => {
    if (!customerId) return

    // Use polling instead of Supabase Realtime (not available yet)
    const pollInterval = setInterval(() => {
      loadDashboardData()
    }, 5000) // Poll every 5 seconds

    return () => {
      clearInterval(pollInterval)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400'
      case 'in_progress': return 'text-blue-400'
      case 'failed': return 'text-red-400'
      case 'pending': return 'text-yellow-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅'
      case 'in_progress': return '🔄'
      case 'failed': return '❌'
      case 'pending': return '⏳'
      default: return '❓'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-secondary-300">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-secondary-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">Error Loading Dashboard</p>
          <p className="text-secondary-300 text-sm mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary-900">
      {/* Header */}
      <div className="bg-secondary-800 border-b border-secondary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Welcome back, {customer?.business_name || 'Customer'}!
              </h1>
              <p className="text-secondary-300 mt-1">
                Track your directory submissions and business growth
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-secondary-400">Package: {customer?.package_type || 'Starter'}</p>
              <p className="text-sm text-secondary-400">Email: {customer?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-secondary-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">📊</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-secondary-300">Total Submissions</p>
                <p className="text-2xl font-bold text-white">{stats.total_submissions}</p>
              </div>
            </div>
          </div>

          <div className="bg-secondary-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">✅</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-secondary-300">Completed</p>
                <p className="text-2xl font-bold text-white">{stats.completed_submissions}</p>
              </div>
            </div>
          </div>

          <div className="bg-secondary-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">⏳</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-secondary-300">Pending</p>
                <p className="text-2xl font-bold text-white">{stats.pending_submissions}</p>
              </div>
            </div>
          </div>

          <div className="bg-secondary-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">📈</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-secondary-300">Success Rate</p>
                <p className="text-2xl font-bold text-white">{stats.success_rate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Current Jobs */}
        {jobs.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Current Jobs</h2>
            <div className="bg-secondary-800 rounded-lg overflow-hidden">
              {jobs.map((job) => (
                <div key={job.id} className="border-b border-secondary-700 last:border-b-0 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-white">Job #{job.id.slice(0, 8)}</h3>
                      <p className="text-sm text-secondary-300">
                        {job.directories_completed} of {job.directories_to_process} directories completed
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${getStatusColor(job.status)}`}>
                        {getStatusIcon(job.status)} {job.status.replace('_', ' ').toUpperCase()}
                      </div>
                      <div className="text-sm text-secondary-400">
                        {job.progress_percentage}% complete
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-secondary-700 rounded-full h-2">
                      <div 
                        className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress_percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Submissions */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Recent Submissions</h2>
          <div className="bg-secondary-800 rounded-lg overflow-hidden">
            {submissions.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-secondary-300">No submissions yet. Your jobs will appear here once processing begins.</p>
              </div>
            ) : (
              <div className="divide-y divide-secondary-700">
                {submissions.slice(0, 10).map((submission) => (
                  <div key={submission.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-white">{submission.directory_name}</h3>
                        <p className="text-sm text-secondary-300">
                          Submitted: {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : 'Not yet'}
                        </p>
                        {submission.error_message && (
                          <p className="text-sm text-red-400 mt-1">{submission.error_message}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${getStatusColor(submission.status)}`}>
                          {getStatusIcon(submission.status)} {submission.status.replace('_', ' ').toUpperCase()}
                        </div>
                        {submission.approved_at && (
                          <div className="text-sm text-green-400">
                            Approved: {new Date(submission.approved_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
