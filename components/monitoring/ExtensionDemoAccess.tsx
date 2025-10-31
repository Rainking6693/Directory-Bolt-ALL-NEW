import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { ScrollArea } from '../ui/scroll-area'
import { Progress } from '../ui/progress'

interface ExtensionSession {
  session_id: string
  extension_id: string
  start_time: string
  end_time?: string
  status: 'active' | 'completed' | 'error' | 'paused'
  customer_id: string
  customer_name: string
  current_directory?: string
  directories_processed: number
  directories_total: number
  screenshots: Screenshot[]
  activity_log: ActivityLogEntry[]
  performance_metrics: PerformanceMetrics
}

interface Screenshot {
  screenshot_id: string
  directory_name: string
  action: string
  timestamp: string
  url: string
  thumbnail_url: string
  description: string
}

interface ActivityLogEntry {
  entry_id: string
  timestamp: string
  action: 'navigate' | 'form_fill' | 'submit' | 'wait' | 'error' | 'captcha'
  directory_name: string
  details: string
  duration_ms: number
  success: boolean
  data?: Record<string, any>
}

interface PerformanceMetrics {
  average_directory_time_ms: number
  success_rate: number
  form_fill_accuracy: number
  captcha_solve_rate: number
  error_rate: number
  total_processing_time_ms: number
}

interface TestMode {
  enabled: boolean
  target_directories: string[]
  test_customer_data: {
    business_name: string
    phone: string
    email: string
    website: string
    description: string
    address: string
  }
}

export default function ExtensionDemoAccess() {
  const [activeSessions, setActiveSessions] = useState<ExtensionSession[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [testMode, setTestMode] = useState<TestMode>({
    enabled: false,
    target_directories: [],
    test_customer_data: {
      business_name: 'Demo Business LLC',
      phone: '555-123-4567',
      email: 'demo@business.com',
      website: 'https://demo-business.com',
      description: 'A demo business for testing directory submissions',
      address: '123 Demo Street, Demo City, DC 12345'
    }
  })
  const [isTestModeActive, setIsTestModeActive] = useState(false)
  const [screenRecording, setScreenRecording] = useState<{
    recording: boolean
    session_id?: string
    recording_url?: string
  }>({ recording: false })

  useEffect(() => {
    fetchActiveSessions()
    const interval = setInterval(fetchActiveSessions, 3000)
    return () => clearInterval(interval)
  }, [])

  const fetchActiveSessions = async () => {
    try {
      const response = await fetch('/api/autobolt/extension-sessions', {
        headers: {
          'X-API-Key': process.env.NEXT_PUBLIC_AUTOBOLT_API_KEY || ''
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setActiveSessions(data.sessions || [])
        }
      }
    } catch (error) {
      console.error('Failed to fetch extension sessions:', error)
    }
  }

  const startTestMode = async () => {
    try {
      setIsTestModeActive(true)
      
      const response = await fetch('/api/autobolt/start-test-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_AUTOBOLT_API_KEY || ''
        },
        body: JSON.stringify({
          target_directories: testMode.target_directories,
          test_customer_data: testMode.test_customer_data,
          enable_recording: true
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          console.log('Test mode started:', data.session_id)
          fetchActiveSessions()
        }
      }
    } catch (error) {
      console.error('Failed to start test mode:', error)
      setIsTestModeActive(false)
    }
  }

  const stopTestMode = async () => {
    try {
      const response = await fetch('/api/autobolt/stop-test-mode', {
        method: 'POST',
        headers: {
          'X-API-Key': process.env.NEXT_PUBLIC_AUTOBOLT_API_KEY || ''
        }
      })
      
      if (response.ok) {
        setIsTestModeActive(false)
        fetchActiveSessions()
      }
    } catch (error) {
      console.error('Failed to stop test mode:', error)
    }
  }

  const startScreenRecording = async (sessionId: string) => {
    try {
      const response = await fetch('/api/autobolt/start-recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_AUTOBOLT_API_KEY || ''
        },
        body: JSON.stringify({ session_id: sessionId })
      })
      
      if (response.ok) {
        setScreenRecording({ recording: true, session_id: sessionId })
      }
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const stopScreenRecording = async () => {
    if (!screenRecording.session_id) return
    
    try {
      const response = await fetch('/api/autobolt/stop-recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_AUTOBOLT_API_KEY || ''
        },
        body: JSON.stringify({ session_id: screenRecording.session_id })
      })
      
      if (response.ok) {
        const data = await response.json()
        setScreenRecording({ 
          recording: false, 
          recording_url: data.recording_url 
        })
      }
    } catch (error) {
      console.error('Failed to stop recording:', error)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'completed': return 'bg-blue-500'
      case 'error': return 'bg-red-500'
      case 'paused': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const selectedSessionData = selectedSession 
    ? activeSessions.find(s => s.session_id === selectedSession)
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Extension Demo Access</h1>
          <p className="text-gray-600 mt-1">Watch AutoBolt in action with live session monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          {!isTestModeActive ? (
            <Button onClick={startTestMode} className="bg-blue-600 hover:bg-blue-700">
              Start Test Mode
            </Button>
          ) : (
            <Button onClick={stopTestMode} variant="outline">
              Stop Test Mode
            </Button>
          )}
          
          {selectedSession && !screenRecording.recording && (
            <Button 
              onClick={() => startScreenRecording(selectedSession)}
              className="bg-red-600 hover:bg-red-700"
            >
              🔴 Record Session
            </Button>
          )}
          
          {screenRecording.recording && (
            <Button 
              onClick={stopScreenRecording}
              variant="outline"
              className="border-red-500 text-red-600"
            >
              ⏹️ Stop Recording
            </Button>
          )}
        </div>
      </div>

      {/* Test Mode Configuration */}
      {!isTestModeActive && (
        <Card>
          <CardHeader>
            <CardTitle>Test Mode Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Target Directories</label>
                <textarea
                  className="w-full p-2 border rounded text-sm"
                  rows={4}
                  placeholder="Enter directory names (one per line)"
                  value={testMode.target_directories.join('\n')}
                  onChange={(e) => setTestMode({
                    ...testMode,
                    target_directories: e.target.value.split('\n').filter(d => d.trim())
                  })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Test Business Data</label>
                <div className="space-y-2">
                  <input
                    className="w-full p-2 border rounded text-sm"
                    placeholder="Business Name"
                    value={testMode.test_customer_data.business_name}
                    onChange={(e) => setTestMode({
                      ...testMode,
                      test_customer_data: {
                        ...testMode.test_customer_data,
                        business_name: e.target.value
                      }
                    })}
                  />
                  <input
                    className="w-full p-2 border rounded text-sm"
                    placeholder="Phone"
                    value={testMode.test_customer_data.phone}
                    onChange={(e) => setTestMode({
                      ...testMode,
                      test_customer_data: {
                        ...testMode.test_customer_data,
                        phone: e.target.value
                      }
                    })}
                  />
                  <input
                    className="w-full p-2 border rounded text-sm"
                    placeholder="Email"
                    value={testMode.test_customer_data.email}
                    onChange={(e) => setTestMode({
                      ...testMode,
                      test_customer_data: {
                        ...testMode.test_customer_data,
                        email: e.target.value
                      }
                    })}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Sessions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeSessions.length > 0 ? (
                  activeSessions.map((session) => (
                    <div
                      key={session.session_id}
                      className={`p-3 border rounded cursor-pointer transition-colors ${
                        selectedSession === session.session_id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedSession(session.session_id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">{session.customer_name}</div>
                        <Badge className={getStatusColor(session.status)}>
                          {session.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        Extension: {session.extension_id}
                      </div>
                      <div className="text-xs text-gray-500">
                        Progress: {session.directories_processed}/{session.directories_total}
                      </div>
                      {session.current_directory && (
                        <div className="text-xs text-blue-600 mt-1">
                          Current: {session.current_directory}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <div className="text-2xl mb-2">🤖</div>
                    <p className="text-sm">No active sessions</p>
                    <p className="text-xs mt-1">Start test mode to see extensions in action</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          {selectedSessionData ? (
            <Tabs defaultValue="live-view" className="w-full">
              <TabsList>
                <TabsTrigger value="live-view">Live View</TabsTrigger>
                <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
                <TabsTrigger value="activity-log">Activity Log</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
              </TabsList>

              <TabsContent value="live-view" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Live Session View - {selectedSessionData.customer_name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-600">Status</div>
                          <Badge className={getStatusColor(selectedSessionData.status)}>
                            {selectedSessionData.status}
                          </Badge>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Runtime</div>
                          <div className="font-medium">
                            {formatDuration(selectedSessionData.performance_metrics.total_processing_time_ms)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Success Rate</div>
                          <div className="font-medium text-green-600">
                            {Math.round(selectedSessionData.performance_metrics.success_rate * 100)}%
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Progress</span>
                          <span>
                            {selectedSessionData.directories_processed}/{selectedSessionData.directories_total}
                          </span>
                        </div>
                        <Progress 
                          value={(selectedSessionData.directories_processed / selectedSessionData.directories_total) * 100} 
                          className="h-2"
                        />
                      </div>

                      {selectedSessionData.current_directory && (
                        <div className="bg-blue-50 p-4 rounded">
                          <div className="text-sm font-medium">Currently Processing:</div>
                          <div className="text-blue-700 text-lg">{selectedSessionData.current_directory}</div>
                        </div>
                      )}

                      {screenRecording.recording && screenRecording.session_id === selectedSessionData.session_id && (
                        <div className="bg-red-50 p-4 rounded border border-red-200">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-red-700 font-medium">Recording in progress...</span>
                          </div>
                        </div>
                      )}

                      {screenRecording.recording_url && (
                        <div className="bg-green-50 p-4 rounded">
                          <div className="text-sm font-medium mb-2">Recording Complete:</div>
                          <Button 
                            onClick={() => window.open(screenRecording.recording_url, '_blank')}
                            size="sm"
                          >
                            View Recording
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="screenshots" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Session Screenshots</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedSessionData.screenshots.length > 0 ? (
                        selectedSessionData.screenshots.map((screenshot) => (
                          <div key={screenshot.screenshot_id} className="border rounded p-2">
                            <img
                              src={screenshot.thumbnail_url}
                              alt={screenshot.description}
                              className="w-full h-32 object-cover rounded cursor-pointer"
                              onClick={() => window.open(screenshot.url, '_blank')}
                            />
                            <div className="mt-2">
                              <div className="text-xs font-medium">{screenshot.directory_name}</div>
                              <div className="text-xs text-gray-500">{screenshot.action}</div>
                              <div className="text-xs text-gray-400">{formatTimestamp(screenshot.timestamp)}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full text-center py-8 text-gray-500">
                          <div className="text-2xl mb-2">📷</div>
                          <p>No screenshots captured yet</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activity-log" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Activity Log</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <div className="space-y-2">
                        {selectedSessionData.activity_log.length > 0 ? (
                          selectedSessionData.activity_log.map((entry) => (
                            <div 
                              key={entry.entry_id}
                              className={`p-3 rounded border-l-4 ${
                                entry.success ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{entry.action}</span>
                                  <span className="text-xs text-gray-500">{entry.directory_name}</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatTimestamp(entry.timestamp)} • {formatDuration(entry.duration_ms)}
                                </div>
                              </div>
                              <div className="text-sm text-gray-700 mt-1">{entry.details}</div>
                              {entry.data && (
                                <details className="mt-2">
                                  <summary className="text-xs text-blue-600 cursor-pointer">View Data</summary>
                                  <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                                    {JSON.stringify(entry.data, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <div className="text-2xl mb-2">📋</div>
                            <p>No activity recorded yet</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatDuration(selectedSessionData.performance_metrics.average_directory_time_ms)}
                        </div>
                        <div className="text-sm text-gray-600">Avg Time/Directory</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {Math.round(selectedSessionData.performance_metrics.form_fill_accuracy * 100)}%
                        </div>
                        <div className="text-sm text-gray-600">Form Fill Accuracy</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {Math.round(selectedSessionData.performance_metrics.captcha_solve_rate * 100)}%
                        </div>
                        <div className="text-sm text-gray-600">CAPTCHA Solve Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {Math.round(selectedSessionData.performance_metrics.error_rate * 100)}%
                        </div>
                        <div className="text-sm text-gray-600">Error Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-700">
                          {formatDuration(selectedSessionData.performance_metrics.total_processing_time_ms)}
                        </div>
                        <div className="text-sm text-gray-600">Total Runtime</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {Math.round(selectedSessionData.performance_metrics.success_rate * 100)}%
                        </div>
                        <div className="text-sm text-gray-600">Overall Success</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-4xl mb-4">👆</div>
                <h3 className="text-lg font-medium">Select a Session</h3>
                <p className="text-gray-600 mt-2">Choose an active session to view detailed monitoring</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}