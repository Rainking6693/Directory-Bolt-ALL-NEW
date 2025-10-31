// Job Progress Monitor Component for Staff Dashboard
// Displays real-time job progress data from the new job queue system

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useNotifications, useApiNotifications } from '../ui/NotificationSystem'

interface JobProgressData {
  id: string
  customer_id: string
  business_name: string
  email: string
  package_type: 'starter' | 'growth' | 'pro'
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  directories_total: number
  directories_completed: number
  directories_failed: number
  progress_percentage: number
  created_at: string
  started_at?: string
  completed_at?: string
  estimated_completion?: string
  results: Array<{
    id: string
    directory_name: string
    submission_status: 'success' | 'failed'
    response_data?: any
    created_at: string
  }>
}

interface JobProgressResponse {
  success: boolean
  data: {
    jobs: JobProgressData[]
    stats: {
      total_jobs: number
      pending_jobs: number
      in_progress_jobs: number
      completed_jobs: number
      failed_jobs: number
      total_directories: number
      completed_directories: number
      failed_directories: number
      success_rate: number
    }
  }
  message?: string
}

export default function JobProgressMonitor() {
  const router = useRouter()
  const [jobData, setJobData] = useState<JobProgressResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedJob, setSelectedJob] = useState<JobProgressData | null>(null)
  const [filteredStatus, setFilteredStatus] = useState<string | null>(null)
  const [pushingJobs, setPushingJobs] = useState<Set<string>>(new Set())
  const { showSuccess, showError, showInfo } = useNotifications()
  const { notifyApiProgress, notifyApiSuccess, notifyApiError } = useApiNotifications()

  useEffect(() => {
    fetchJobProgress()
    const interval = setInterval(fetchJobProgress, 5000) // Update every 5 seconds as specified
    return () => clearInterval(interval)
  }, [])

  const fetchJobProgress = async () => {
    try {
      // Use same-origin cookie; no localStorage token required
      const response = await fetch('/api/staff/jobs/progress', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch job progress: ${response.status}`)
      }
      
      const result: JobProgressResponse = await response.json()
      if (result.success) {
        setJobData(result.data)
        setLastUpdated(new Date())
        setError(null)
      } else {
        throw new Error(result.message || 'Failed to load job progress data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Job progress fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const pushToAutoBolt = async (jobId: string) => {
    // Prevent multiple simultaneous pushes for the same job
    if (pushingJobs.has(jobId)) {
      showInfo('Job is already being pushed to AutoBolt', {
        title: 'Already in Progress',
        autoHide: 3000
      })
      return
    }

    try {
      // Mark job as being pushed
      setPushingJobs(prev => new Set(prev).add(jobId))
      
      // Show progress notification
      const progressId = showInfo('Initiating AutoBolt processing...', {
        title: 'Pushing to AutoBolt',
        autoHide: 2000
      })


      // Get CSRF token (following existing pattern)
      const csrfResponse = await fetch('/api/csrf-token')
      const csrfData = await csrfResponse.json()
      
      if (!csrfData.success) {
        throw new Error('Failed to get CSRF token')
      }
      
      // Show validation progress
      showInfo('Validating job data and preparing for AutoBolt...', {
        title: 'Processing',
        autoHide: 1500
      })
      
      const response = await fetch('/api/staff/jobs/push-to-autobolt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.csrfToken,
          'Origin': window.location.origin
        },
        credentials: 'include',
        body: JSON.stringify({ job_id: jobId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to push to AutoBolt')
      }

      const result = await response.json()
      console.log('✅ Job pushed to AutoBolt:', result)
      
      // Show success with detailed information
      notifyApiSuccess('Job pushed to AutoBolt', [
        `Job ID: ${jobId}`,
        `Business: ${result.data?.business_name || 'Unknown'}`,
        `Package: ${result.data?.package_type || 'Unknown'}`,
        `Directories: ${result.data?.directory_limit || 'Unknown'}`,
        `Priority: P${result.data?.priority_level || 'Unknown'}`,
        `Status: ${result.data?.status || 'queued'}`
      ])
      
      // Refresh job data to show updated status
      await fetchJobProgress()
      
    } catch (err) {
      console.error('Push to AutoBolt error:', err)
      notifyApiError('Push to AutoBolt', err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      // Remove job from pushing set
      setPushingJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-volt-400 bg-volt-400/20'
      case 'in_progress': return 'text-blue-400 bg-blue-400/20'
      case 'completed': return 'text-green-400 bg-green-400/20'
      case 'failed': return 'text-red-400 bg-red-400/20'
      default: return 'text-secondary-400 bg-secondary-400/20'
    }
  }

  const getPackageColor = (packageType: string) => {
    switch (packageType.toLowerCase()) {
      case 'pro': return 'text-purple-400 bg-purple-400/20'
      case 'growth': return 'text-orange-400 bg-orange-400/20'
      case 'starter': return 'text-blue-400 bg-blue-400/20'
      default: return 'text-secondary-400 bg-secondary-400/20'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays}d ago`
    } else if (diffHours > 0) {
      return `${diffHours}h ago`
    } else {
      return `${diffMinutes}m ago`
    }
  }

  const handleStatClick = (status: string) => {
    setFilteredStatus(filteredStatus === status ? null : status)
  }

  const handleJobClick = (job: JobProgressData) => {
    // Open in-place details instead of navigating to a non-existent route
    setSelectedJob(job)
  }

  const getFilteredJobs = () => {
    if (!filteredStatus) return jobData?.jobs || []
    return jobData?.jobs.filter(job => job.status === filteredStatus) || []
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-volt-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-600/10 border border-red-500/20 rounded-xl p-6 text-center">
        <p className="text-red-400 font-medium">Failed to load job progress data</p>
        <p className="text-red-300 text-sm mt-2">{error}</p>
        <button 
          onClick={fetchJobProgress}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!jobData) {
    return (
      <div className="text-center text-secondary-400">
        No job data available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Job Progress Monitor</h2>
        <div className="flex items-center space-x-2 text-secondary-300">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Live'}
          </span>
        </div>
      </div>

      {/* Job Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <button 
          onClick={() => setFilteredStatus(null)}
          className={`bg-secondary-800 rounded-xl p-4 border border-secondary-700 text-center hover:bg-secondary-700 transition-colors cursor-pointer ${
            filteredStatus === null ? 'ring-2 ring-white bg-secondary-700' : ''
          }`}
        >
          <p className="text-2xl font-bold text-white">{jobData.stats.total_jobs}</p>
          <p className="text-secondary-400 text-sm">Total Jobs</p>
        </button>
        <button 
          onClick={() => handleStatClick('pending')}
          className={`bg-secondary-800 rounded-xl p-4 border border-secondary-700 text-center hover:bg-secondary-700 transition-colors cursor-pointer ${
            filteredStatus === 'pending' ? 'ring-2 ring-volt-500 bg-secondary-700' : ''
          }`}
        >
          <p className="text-2xl font-bold text-volt-500">{jobData.stats.pending_jobs}</p>
          <p className="text-secondary-400 text-sm">Pending</p>
        </button>
        <button 
          onClick={() => handleStatClick('in_progress')}
          className={`bg-secondary-800 rounded-xl p-4 border border-secondary-700 text-center hover:bg-secondary-700 transition-colors cursor-pointer ${
            filteredStatus === 'in_progress' ? 'ring-2 ring-blue-500 bg-secondary-700' : ''
          }`}
        >
          <p className="text-2xl font-bold text-blue-400">{jobData.stats.in_progress_jobs}</p>
          <p className="text-secondary-400 text-sm">In Progress</p>
        </button>
        <button 
          onClick={() => handleStatClick('completed')}
          className={`bg-secondary-800 rounded-xl p-4 border border-secondary-700 text-center hover:bg-secondary-700 transition-colors cursor-pointer ${
            filteredStatus === 'completed' ? 'ring-2 ring-green-500 bg-secondary-700' : ''
          }`}
        >
          <p className="text-2xl font-bold text-green-400">{jobData.stats.completed_jobs}</p>
          <p className="text-secondary-400 text-sm">Completed</p>
        </button>
        <button 
          onClick={() => handleStatClick('failed')}
          className={`bg-secondary-800 rounded-xl p-4 border border-secondary-700 text-center hover:bg-secondary-700 transition-colors cursor-pointer ${
            filteredStatus === 'failed' ? 'ring-2 ring-red-500 bg-secondary-700' : ''
          }`}
        >
          <p className="text-2xl font-bold text-red-400">{jobData.stats.failed_jobs}</p>
          <p className="text-secondary-400 text-sm">Failed</p>
        </button>
        <div className="bg-secondary-800 rounded-xl p-4 border border-secondary-700 text-center">
          <p className="text-2xl font-bold text-white">{jobData.stats.total_directories}</p>
          <p className="text-secondary-400 text-sm">Total Dirs</p>
        </div>
        <div className="bg-secondary-800 rounded-xl p-4 border border-secondary-700 text-center">
          <p className="text-2xl font-bold text-green-400">{jobData.stats.completed_directories}</p>
          <p className="text-secondary-400 text-sm">Complete</p>
        </div>
        <div className="bg-secondary-800 rounded-xl p-4 border border-secondary-700 text-center">
          <p className="text-2xl font-bold text-volt-400">{jobData.stats.success_rate}%</p>
          <p className="text-secondary-400 text-sm">Success Rate</p>
        </div>
      </div>

      {/* Job Progress Table */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700">
        <div className="p-6 border-b border-secondary-700">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Active Jobs</h3>
            <div className="flex items-center space-x-4">
              {filteredStatus && (
                <div className="flex items-center space-x-2">
                  <span className="text-secondary-300 text-sm">Filtered by:</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(filteredStatus)}`}>
                    {filteredStatus}
                  </span>
                  <button 
                    onClick={() => setFilteredStatus(null)}
                    className="text-secondary-400 hover:text-white text-sm"
                  >
                    Clear filter
                  </button>
                </div>
              )}
              <p className="text-secondary-400 text-sm">Click on any job to view detailed progress</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-300 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-300 uppercase tracking-wider">
                  Package
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-300 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-300 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-300 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-700">
              {getFilteredJobs().length > 0 ? (
                getFilteredJobs().map((job) => (
                  <tr 
                    key={job.id} 
                    className="hover:bg-secondary-700/50 cursor-pointer transition-colors"
                    onClick={() => handleJobClick(job)}
                  >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-white">{job.business_name}</div>
                      <div className="text-sm text-secondary-400">{job.email}</div>
                      <div className="text-xs text-secondary-500 font-mono">{job.customer_id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPackageColor(job.package_type)}`}>
                      {job.package_type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="flex-1">
                        <div className="w-20 bg-secondary-600 rounded-full h-2">
                          <div 
                            className="bg-volt-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${job.progress_percentage}%` }}
                          ></div>
                        </div>
                      </div>
                      <span className="text-sm text-secondary-300 font-mono min-w-[60px] text-right">
                        {job.directories_completed}/{job.directories_total}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <span className={`font-medium ${
                        job.directories_total > 0 
                          ? (job.directories_completed / job.directories_total) >= 0.8 
                            ? 'text-green-400' 
                            : (job.directories_completed / job.directories_total) >= 0.6 
                            ? 'text-volt-400' 
                            : 'text-red-400'
                          : 'text-secondary-400'
                      }`}>
                        {job.directories_total > 0 
                          ? Math.round((job.directories_completed / job.directories_total) * 100)
                          : 0
                        }%
                      </span>
                      {job.directories_failed > 0 && (
                        <div className="text-xs text-red-400">
                          {job.directories_failed} failed
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-300">
                    {formatTimeAgo(job.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedJob(job)
                        }}
                        className="text-volt-400 hover:text-volt-300 transition-colors"
                      >
                        Details
                      </button>
                      {job.status === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            pushToAutoBolt(job.id)
                          }}
                          disabled={pushingJobs.has(job.id)}
                          className={`${pushingJobs.has(job.id) 
                            ? 'text-gray-400 bg-gray-500/10 cursor-not-allowed' 
                            : 'text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20'
                          } px-3 py-1 rounded text-xs font-medium transition-all duration-200 flex items-center space-x-1`}
                        >
                          {pushingJobs.has(job.id) ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
                              <span>Pushing...</span>
                            </>
                          ) : (
                            <>
                              <span>Push to AutoBolt</span>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-secondary-400">
                    {filteredStatus ? `No jobs with status "${filteredStatus}"` : 'No jobs available'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-secondary-800 rounded-xl p-6 border border-secondary-700 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Job Progress Details</h3>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-secondary-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Job Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-white mb-3">Customer Information</h4>
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-white">{selectedJob.business_name}</p>
                    <p className="text-secondary-300">{selectedJob.email}</p>
                    <p className="text-secondary-400 text-sm font-mono">{selectedJob.customer_id}</p>
                    <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${getPackageColor(selectedJob.package_type)}`}>
                      {selectedJob.package_type.toUpperCase()} Package
                    </span>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-white mb-3">Job Status</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-secondary-400">Status:</span>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedJob.status)}`}>
                        {selectedJob.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary-400">Progress:</span>
                      <span className="text-white font-mono">
                        {selectedJob.directories_completed}/{selectedJob.directories_total}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary-400">Failed:</span>
                      <span className="text-red-400">{selectedJob.directories_failed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary-400">Created:</span>
                      <span className="text-secondary-300 text-sm">
                        {new Date(selectedJob.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Visualization */}
              <div>
                <h4 className="font-medium text-white mb-3">Progress Visualization</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary-400">Overall Progress</span>
                    <span className="text-white font-medium">{selectedJob.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-secondary-600 rounded-full h-4">
                    <div 
                      className="bg-gradient-to-r from-volt-500 to-volt-400 h-4 rounded-full transition-all duration-500"
                      style={{ width: `${selectedJob.progress_percentage}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-secondary-400">
                    <span>0</span>
                    <span>{selectedJob.directories_total}</span>
                  </div>
                </div>
              </div>

              {/* Directory Results */}
              {selectedJob.results.length > 0 && (
                <div>
                  <h4 className="font-medium text-white mb-3">Directory Submission Results</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedJob.results.map((result) => (
                      <div key={result.id} className="flex items-center justify-between p-3 bg-secondary-700 rounded-lg">
                        <span className="text-white text-sm font-medium">{result.directory_name}</span>
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            result.submission_status === 'success' 
                              ? 'text-green-400 bg-green-400/20' 
                              : 'text-red-400 bg-red-400/20'
                          }`}>
                            {result.submission_status}
                          </span>
                          <span className="text-secondary-400 text-xs">
                            {formatTimeAgo(result.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-secondary-700">
                {selectedJob.status === 'pending' && (
                  <button
                    onClick={() => pushToAutoBolt(selectedJob.id)}
                    disabled={pushingJobs.has(selectedJob.id)}
                    className={`${pushingJobs.has(selectedJob.id)
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500'
                    } text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2`}
                  >
                    {pushingJobs.has(selectedJob.id) ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Pushing to AutoBolt...</span>
                      </>
                    ) : (
                      <>
                        <span>Push to AutoBolt</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setSelectedJob(null)}
                  className="border-2 border-secondary-600 hover:border-volt-500 text-secondary-300 hover:text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}