/**
 * Customer Data Monitoring Dashboard
 * Real-time customer-facing interface for monitoring their data across directories
 * 
 * Features:
 * - Real-time profile status monitoring
 * - Data integrity tracking
 * - Compliance status display
 * - Alert management
 * - Historical data view
 */

import React, { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, XCircle, Clock, Shield, Eye, Download, Bell } from 'lucide-react'

interface CustomerProfile {
  customerId: string
  businessName: string
  email: string
  profileHealth: {
    totalDirectories: number
    activeProfiles: number
    removedProfiles: number
    pendingProfiles: number
    dataIntegrityScore: number
  }
  lastVerified: string
  alerts: Alert[]
  complianceStatus: {
    gdprCompliant: boolean
    ccpaCompliant: boolean
    deletionRequests: number
    pendingRequests: number
  }
}

interface Alert {
  id: string
  type: 'profile_removal' | 'data_integrity' | 'compliance' | 'verification_error'
  severity: 'critical' | 'high' | 'medium' | 'low'
  message: string
  timestamp: string
  details?: any
  acknowledged: boolean
}

interface DirectoryStatus {
  directoryId: string
  directoryName: string
  status: 'active' | 'removed' | 'pending' | 'error'
  lastChecked: string
  dataIntegrity: number
  issues: string[]
}

export default function CustomerDataDashboard() {
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null)
  const [directoryStatuses, setDirectoryStatuses] = useState<DirectoryStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<'overview' | 'directories' | 'alerts' | 'compliance'>('overview')
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical' | 'unacknowledged'>('all')

  useEffect(() => {
    loadCustomerData()
    
    // Set up real-time updates
    const interval = setInterval(loadCustomerData, 30000) // Update every 30 seconds
    
    // Listen for real-time alerts
    const listener = (event: Event) => {
      handleRealTimeAlert(event as CustomEvent)
    }
    window.addEventListener('customerDataAlert', listener as EventListener)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('customerDataAlert', listener as EventListener)
    }
  }, [])

  const loadCustomerData = async () => {
    try {
      const customerId = getCustomerIdFromUrl() || localStorage.getItem('customerId')
      if (!customerId) {
        throw new Error('Customer ID not found')
      }

      const [profileResponse, directoriesResponse] = await Promise.all([
        fetch(`/api/monitoring/customer/${customerId}/profile`),
        fetch(`/api/monitoring/customer/${customerId}/directories`)
      ])

      if (profileResponse.ok && directoriesResponse.ok) {
        const profileData = await profileResponse.json()
        const directoriesData = await directoriesResponse.json()
        
        setCustomerProfile(profileData.profile)
        setDirectoryStatuses(directoriesData.directories)
      }
    } catch (error) {
      console.error('Failed to load customer data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRealTimeAlert = (event: CustomEvent) => {
    const { customerId, alerts } = event.detail
    
    if (customerProfile && customerProfile.customerId === customerId) {
      setCustomerProfile(prev => prev ? {
        ...prev,
        alerts: [...prev.alerts, ...alerts]
      } : null)
      
      // Show browser notification for critical alerts
      const criticalAlerts = alerts.filter((alert: Alert) => alert.severity === 'critical')
      if (criticalAlerts.length > 0) {
        showBrowserNotification(criticalAlerts[0])
      }
    }
  }

  const showBrowserNotification = (alert: Alert) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('DirectoryBolt Alert', {
        body: alert.message,
        icon: '/favicon.ico',
        tag: alert.id
      })
    }
  }

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await fetch(`/api/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST'
      })
      
      setCustomerProfile(prev => prev ? {
        ...prev,
        alerts: prev.alerts.map(alert => 
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        )
      } : null)
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  const downloadReport = async () => {
    try {
      const response = await fetch(`/api/monitoring/customer/${customerProfile?.customerId}/report`)
      const blob = await response.blob()
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer-data-report-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to download report:', error)
    }
  }

  const getCustomerIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search)
    return params.get('customer')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600'
      case 'removed': return 'text-red-600'
      case 'pending': return 'text-volt-600'
      case 'error': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-5 h-5" />
      case 'removed': return <XCircle className="w-5 h-5" />
      case 'pending': return <Clock className="w-5 h-5" />
      case 'error': return <AlertTriangle className="w-5 h-5" />
      default: return <AlertTriangle className="w-5 h-5" />
    }
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

  const filteredAlerts = customerProfile?.alerts.filter(alert => {
    if (alertFilter === 'critical') return alert.severity === 'critical'
    if (alertFilter === 'unacknowledged') return !alert.acknowledged
    return true
  }) || []

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!customerProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Customer Data Not Found</h2>
          <p className="text-gray-600">Unable to load customer monitoring data.</p>
        </div>
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
              <h1 className="text-3xl font-bold text-gray-900">Data Monitoring Dashboard</h1>
              <p className="text-gray-600">{customerProfile.businessName}</p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={downloadReport}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Refresh Data
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
              { id: 'overview', name: 'Overview', icon: Eye },
              { id: 'directories', name: 'Directories', icon: CheckCircle },
              { id: 'alerts', name: 'Alerts', icon: Bell },
              { id: 'compliance', name: 'Compliance', icon: Shield }
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
                  {tab.id === 'alerts' && filteredAlerts.filter(a => !a.acknowledged).length > 0 && (
                    <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {filteredAlerts.filter(a => !a.acknowledged).length}
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
            {/* Health Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-6 w-6 text-green-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Active Profiles</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {customerProfile.profileHealth.activeProfiles}
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
                      <XCircle className="h-6 w-6 text-red-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Removed Profiles</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {customerProfile.profileHealth.removedProfiles}
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
                      <Shield className="h-6 w-6 text-blue-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Data Integrity</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {Math.round(customerProfile.profileHealth.dataIntegrityScore * 100)}%
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
                      <Bell className="h-6 w-6 text-volt-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Active Alerts</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {customerProfile.alerts.filter(a => !a.acknowledged).length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Alerts */}
            {customerProfile.alerts.length > 0 && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Alerts</h3>
                  <div className="space-y-3">
                    {customerProfile.alerts.slice(0, 3).map(alert => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-md border ${getSeverityColor(alert.severity)}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{alert.message}</p>
                            <p className="text-sm opacity-75">
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </div>
                          {!alert.acknowledged && (
                            <button
                              onClick={() => acknowledgeAlert(alert.id)}
                              className="text-sm underline opacity-75 hover:opacity-100"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'directories' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Directory Status</h3>
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Directory
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data Integrity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Checked
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Issues
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {directoryStatuses.map(directory => (
                      <tr key={directory.directoryId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {directory.directoryName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className={`flex items-center ${getStatusColor(directory.status)}`}>
                            {getStatusIcon(directory.status)}
                            <span className="ml-2 capitalize">{directory.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{ width: `${directory.dataIntegrity * 100}%` }}
                              ></div>
                            </div>
                            <span>{Math.round(directory.dataIntegrity * 100)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(directory.lastChecked).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {directory.issues.length > 0 ? (
                            <span className="text-red-600">{directory.issues.length} issues</span>
                          ) : (
                            <span className="text-green-600">No issues</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'alerts' && (
          <div className="space-y-6">
            {/* Alert Filters */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Alerts</h3>
                  <div className="flex space-x-2">
                    {[
                      { id: 'all', name: 'All' },
                      { id: 'critical', name: 'Critical' },
                      { id: 'unacknowledged', name: 'Unacknowledged' }
                    ].map(filter => (
                      <button
                        key={filter.id}
                        onClick={() => setAlertFilter(filter.id as any)}
                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                          alertFilter === filter.id
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {filter.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Alerts List */}
            <div className="space-y-4">
              {filteredAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={`bg-white shadow rounded-lg border-l-4 ${
                    alert.severity === 'critical' ? 'border-red-500' :
                    alert.severity === 'high' ? 'border-orange-500' :
                    alert.severity === 'medium' ? 'border-volt-500' :
                    'border-blue-500'
                  }`}
                >
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(alert.severity)}`}>
                            {alert.severity.toUpperCase()}
                          </span>
                          <span className="ml-2 text-sm text-gray-500">
                            {new Date(alert.timestamp).toLocaleString()}
                          </span>
                          {alert.acknowledged && (
                            <span className="ml-2 text-xs text-green-600">✓ Acknowledged</span>
                          )}
                        </div>
                        <h4 className="mt-2 text-lg font-medium text-gray-900">{alert.message}</h4>
                        {alert.details && (
                          <div className="mt-2 text-sm text-gray-600">
                            <pre className="whitespace-pre-wrap">{JSON.stringify(alert.details, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                      {!alert.acknowledged && (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="ml-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredAlerts.length === 0 && (
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6 text-center">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Alerts</h3>
                    <p className="text-gray-600">All your data monitoring alerts have been addressed.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'compliance' && (
          <div className="space-y-6">
            {/* Compliance Status */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Compliance Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 w-4 h-4 rounded-full ${
                      customerProfile.complianceStatus.gdprCompliant ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                    <span className="ml-3 text-sm font-medium text-gray-900">GDPR Compliance</span>
                  </div>
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 w-4 h-4 rounded-full ${
                      customerProfile.complianceStatus.ccpaCompliant ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                    <span className="ml-3 text-sm font-medium text-gray-900">CCPA Compliance</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Deletion Requests */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Data Deletion Requests</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Total Requests</dt>
                    <dd className="text-2xl font-bold text-gray-900">
                      {customerProfile.complianceStatus.deletionRequests}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Pending Requests</dt>
                    <dd className="text-2xl font-bold text-gray-900">
                      {customerProfile.complianceStatus.pendingRequests}
                    </dd>
                  </div>
                </div>
                
                {customerProfile.complianceStatus.pendingRequests > 0 && (
                  <div className="mt-4 p-4 bg-volt-50 border border-volt-200 rounded-md">
                    <div className="flex">
                      <Clock className="w-5 h-5 text-volt-400" />
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-volt-800">
                          Pending Deletion Requests
                        </h4>
                        <p className="text-sm text-volt-700 mt-1">
                          You have {customerProfile.complianceStatus.pendingRequests} pending deletion requests. 
                          We're working with directories to fulfill these requests within regulatory timeframes.
                        </p>
                      </div>
                    </div>
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