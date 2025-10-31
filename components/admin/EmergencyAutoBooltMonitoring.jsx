/**
 * AutoBolt Emergency Monitoring Dashboard
 * Real-time monitoring and analytics for AutoBolt operations
 * Enhanced with live activity tracking and debugging capabilities
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Activity, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Download,
  Settings,
  Eye,
  Camera,
  Monitor,
  Database,
  Globe,
  Zap,
  Play,
  Pause,
  Square,
  Bug
} from 'lucide-react';

export default function EmergencyAutoBooltMonitoring({ className = '' }) {
  const [metrics, setMetrics] = useState({
    activeCustomers: 0,
    successRate: 0,
    averageProcessingTime: 0,
    directoryHealth: {},
    systemStatus: 'operational'
  });

  const [realtimeData, setRealtimeData] = useState({
    queueSize: 0,
    processingCustomers: [],
    recentCompletions: [],
    systemAlerts: []
  });

  // Enhanced monitoring state
  const [liveActivity, setLiveActivity] = useState({
    currentActivities: [],
    screenshots: [],
    apiResponses: [],
    extensionStatus: 'unknown',
    lastScreenshot: null,
    activeTabs: [],
    processingErrors: []
  });

  const [debugMode, setDebugMode] = useState(false);
  const [watchMode, setWatchMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const websocketRef = useRef(null);
  const screenshotIntervalRef = useRef(null);

  // Enhanced metrics fetching with live activity data
  const fetchMetrics = useCallback(async () => {
    try {
      const [statsResponse, queueResponse, activityResponse] = await Promise.all([
        fetch('/api/autobolt/stats'),
        fetch('/api/autobolt/queue/status'),
        fetch('/api/autobolt/live-activity')
      ]);

      const stats = await statsResponse.json();
      const queue = await queueResponse.json();
      const activity = await activityResponse.json();

      if (stats.success) {
        setMetrics({
          activeCustomers: stats.stats.customers.processing,
          successRate: stats.stats.performance.successRate,
          averageProcessingTime: stats.stats.performance.averageProcessingTime || 0,
          directoryHealth: stats.stats.directoryHealth || {},
          systemStatus: stats.stats.system.status
        });
      }

      if (queue.success) {
        setRealtimeData(prev => ({
          ...prev,
          queueSize: queue.queueSize || 0,
          processingCustomers: queue.processingCustomers || [],
          recentCompletions: queue.recentCompletions || []
        }));
      }

      if (activity.success) {
        setLiveActivity(prev => ({
          ...prev,
          currentActivities: activity.data.currentActivities || [],
          screenshots: activity.data.screenshots || [],
          apiResponses: activity.data.apiResponses || [],
          extensionStatus: activity.data.extensionStatus || 'unknown',
          lastScreenshot: activity.data.lastScreenshot || null,
          activeTabs: activity.data.activeTabs || [],
          processingErrors: activity.data.processingErrors || []
        }));
      }

      setLastUpdate(new Date());
      setLoading(false);

    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      setLoading(false);
    }
  }, []);

  // Enhanced real-time updates with WebSocket
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Update every 5 seconds for emergency monitoring
    
    // Set up WebSocket for real-time updates
    if (window.WebSocket) {
      websocketRef.current = new WebSocket(
        `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/autobolt/websocket`
      );
      
      websocketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'autobolt_activity') {
            setLiveActivity(prev => ({
              ...prev,
              currentActivities: [data.activity, ...prev.currentActivities.slice(0, 49)], // Keep last 50
              lastScreenshot: data.screenshot || prev.lastScreenshot
            }));
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };
    }
    
    return () => {
      clearInterval(interval);
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [fetchMetrics]);

  // Manual refresh
  const handleRefresh = () => {
    setLoading(true);
    fetchMetrics();
  };

  // Enhanced export with all monitoring data
  const handleExportMetrics = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      metrics,
      realtimeData,
      liveActivity,
      debugMode,
      watchMode
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autobolt-emergency-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Toggle debug mode
  const toggleDebugMode = async () => {
    try {
      const response = await fetch('/api/autobolt/debug-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !debugMode })
      });
      
      if (response.ok) {
        setDebugMode(!debugMode);
      }
    } catch (error) {
      console.error('Failed to toggle debug mode:', error);
    }
  };

  // Toggle watch mode for live extension viewing
  const toggleWatchMode = async () => {
    try {
      const response = await fetch('/api/autobolt/watch-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !watchMode })
      });
      
      if (response.ok) {
        setWatchMode(!watchMode);
        
        if (!watchMode) {
          // Start screenshot monitoring
          screenshotIntervalRef.current = setInterval(async () => {
            try {
              const response = await fetch('/api/autobolt/capture-screenshot');
              const data = await response.json();
              if (data.success && data.screenshot) {
                setLiveActivity(prev => ({
                  ...prev,
                  lastScreenshot: data.screenshot,
                  screenshots: [data.screenshot, ...prev.screenshots.slice(0, 9)] // Keep last 10
                }));
              }
            } catch (error) {
              console.error('Screenshot capture failed:', error);
            }
          }, 3000); // Capture every 3 seconds
        } else {
          // Stop screenshot monitoring
          if (screenshotIntervalRef.current) {
            clearInterval(screenshotIntervalRef.current);
          }
        }
      }
    } catch (error) {
      console.error('Failed to toggle watch mode:', error);
    }
  };

  // Emergency stop function
  const emergencyStop = async () => {
    try {
      const response = await fetch('/api/autobolt/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        alert('Emergency stop initiated. All AutoBolt processing has been halted.');
        fetchMetrics(); // Refresh to show updated status
      }
    } catch (error) {
      console.error('Emergency stop failed:', error);
      alert('Emergency stop failed. Please manually intervene.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'operational': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'down': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'operational': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'down': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading && !lastUpdate) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Loading emergency monitoring data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-red-600">AutoBolt Emergency Monitoring</h1>
          <p className="text-gray-600">Real-time system performance and live activity tracking</p>
          <div className="flex items-center space-x-4 mt-2">
            <Badge className={liveActivity.extensionStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
              Extension: {liveActivity.extensionStatus}
            </Badge>
            <Badge className={debugMode ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}>
              Debug: {debugMode ? 'ON' : 'OFF'}
            </Badge>
            <Badge className={watchMode ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}>
              Watch: {watchMode ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant={watchMode ? "destructive" : "outline"} 
            onClick={toggleWatchMode}
            className={watchMode ? "animate-pulse" : ""}
          >
            <Eye className="h-4 w-4 mr-2" />
            {watchMode ? 'Stop Watch' : 'Watch Live'}
          </Button>
          <Button 
            variant={debugMode ? "secondary" : "outline"} 
            onClick={toggleDebugMode}
          >
            <Bug className="h-4 w-4 mr-2" />
            {debugMode ? 'Stop Debug' : 'Debug Mode'}
          </Button>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportMetrics}>
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
          <Button variant="destructive" onClick={emergencyStop}>
            <Square className="h-4 w-4 mr-2" />
            EMERGENCY STOP
          </Button>
        </div>
      </div>

      {/* Emergency Alerts */}
      {liveActivity.processingErrors.length > 0 && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Processing Errors Detected</AlertTitle>
          <AlertDescription>
            {liveActivity.processingErrors.length} errors in the last 10 minutes. 
            <Button variant="link" className="p-0 h-auto" onClick={() => console.log(liveActivity.processingErrors)}>
              View Details
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Enhanced System Status with Live Activity */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">System Overview</TabsTrigger>
          <TabsTrigger value="live" className={liveActivity.currentActivities.length > 0 ? "animate-pulse" : ""}>
            Live Activity ({liveActivity.currentActivities.length})
          </TabsTrigger>
          <TabsTrigger value="screenshots">Screenshots ({liveActivity.screenshots.length})</TabsTrigger>
          <TabsTrigger value="debug">Debug Console</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">System Status</p>
                    <div className="flex items-center space-x-2 mt-2">
                      {getStatusIcon(metrics.systemStatus)}
                      <Badge className={getStatusColor(metrics.systemStatus)}>
                        {metrics.systemStatus}
                      </Badge>
                    </div>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Customers</p>
                    <p className="text-2xl font-bold text-blue-600">{metrics.activeCustomers}</p>
                    <p className="text-xs text-gray-500">Currently processing</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold text-green-600">{(metrics.successRate * 100).toFixed(1)}%</p>
                    <p className="text-xs text-gray-500">Overall performance</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Processing Time</p>
                    <p className="text-2xl font-bold text-purple-600">{metrics.averageProcessingTime}min</p>
                    <p className="text-xs text-gray-500">Per customer</p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Queue Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Processing Queue</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Queue Size</span>
                    <Badge variant="outline">{realtimeData.queueSize} customers</Badge>
                  </div>

                  {realtimeData.processingCustomers.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Currently Processing:</h4>
                      {realtimeData.processingCustomers.map((customer, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div>
                            <p className="font-medium">{customer.businessName}</p>
                            <p className="text-sm text-gray-600">{customer.customerId}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{customer.progress}%</p>
                            <p className="text-xs text-gray-500">{customer.currentDirectory}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <Clock className="h-8 w-8 mx-auto mb-2" />
                      <p>No customers currently processing</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>Recent Completions</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {realtimeData.recentCompletions.length > 0 ? (
                  <div className="space-y-3">
                    {realtimeData.recentCompletions.map((completion, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{completion.businessName}</p>
                          <p className="text-sm text-gray-600">{completion.customerId}</p>
                        </div>
                        <div className="text-right">
                          <Badge className={completion.successRate >= 0.95 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {(completion.successRate * 100).toFixed(1)}%
                          </Badge>
                          <p className="text-xs text-gray-500">{completion.completedAt}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>No recent completions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="live" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  <span>Live AutoBolt Activities</span>
                  <Badge variant="outline">{liveActivity.currentActivities.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {liveActivity.currentActivities.length > 0 ? (
                    liveActivity.currentActivities.map((activity, index) => (
                      <div key={index} className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{activity.action}</p>
                            <p className="text-sm text-gray-600">{activity.directory || activity.target}</p>
                            <p className="text-xs text-gray-500">{activity.customer}</p>
                          </div>
                          <div className="text-right">
                            <Badge className={activity.status === 'success' ? 'bg-green-100 text-green-800' : activity.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                              {activity.status}
                            </Badge>
                            <p className="text-xs text-gray-500">{new Date(activity.timestamp).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        {activity.details && (
                          <p className="text-xs text-gray-600 mt-2">{activity.details}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Activity className="h-8 w-8 mx-auto mb-2" />
                      <p>No live activities detected</p>
                      <p className="text-sm">Extension activities will appear here in real-time</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-purple-600" />
                  <span>Recent API Responses</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {liveActivity.apiResponses.length > 0 ? (
                    liveActivity.apiResponses.map((response, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{response.endpoint}</p>
                            <p className="text-sm text-gray-600">{response.method} - {response.statusCode}</p>
                          </div>
                          <div className="text-right">
                            <Badge className={response.statusCode < 300 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {response.duration}ms
                            </Badge>
                            <p className="text-xs text-gray-500">{new Date(response.timestamp).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        {response.error && (
                          <p className="text-xs text-red-600 mt-2">{response.error}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Database className="h-8 w-8 mx-auto mb-2" />
                      <p>No API responses logged</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="screenshots" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Camera className="h-5 w-5 text-blue-600" />
                <span>Live Extension Screenshots</span>
                {watchMode && <Badge className="bg-green-100 text-green-800 animate-pulse">Recording</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {liveActivity.lastScreenshot ? (
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Latest Screenshot</h4>
                    <img 
                      src={`data:image/png;base64,${liveActivity.lastScreenshot}`} 
                      alt="Latest AutoBolt Extension Screenshot" 
                      className="w-full max-w-2xl border rounded-lg shadow-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">Captured: {new Date().toLocaleTimeString()}</p>
                  </div>
                  
                  {liveActivity.screenshots.length > 1 && (
                    <div>
                      <h4 className="font-medium mb-2">Recent Screenshots</h4>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {liveActivity.screenshots.slice(1).map((screenshot, index) => (
                          <div key={index} className="border rounded-lg p-2">
                            <img 
                              src={`data:image/png;base64,${screenshot}`} 
                              alt={`Screenshot ${index + 2}`} 
                              className="w-full border rounded cursor-pointer hover:scale-105 transition-transform"
                              onClick={() => {
                                // Open in new window for detailed view
                                const newWindow = window.open();
                                newWindow.document.write(`<img src="data:image/png;base64,${screenshot}" style="width:100%;height:auto;">`);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Camera className="h-8 w-8 mx-auto mb-2" />
                  <p>No screenshots available</p>
                  <p className="text-sm">Enable Watch Mode to start capturing extension screenshots</p>
                  <Button className="mt-4" onClick={toggleWatchMode}>
                    <Eye className="h-4 w-4 mr-2" />
                    Start Watching
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debug" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bug className="h-5 w-5 text-red-600" />
                  <span>Debug Console</span>
                  {debugMode && <Badge className="bg-red-100 text-red-800">Active</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                    {liveActivity.processingErrors.length > 0 ? (
                      liveActivity.processingErrors.map((error, index) => (
                        <div key={index} className="mb-2">
                          <span className="text-red-400">[{new Date(error.timestamp).toLocaleTimeString()}]</span>
                          <span className="text-yellow-400"> ERROR:</span>
                          <span className="text-white"> {error.message}</span>
                          {error.stack && (
                            <div className="text-gray-400 text-xs ml-4 mt-1">
                              {error.stack}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400">No errors logged. System operating normally.</div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={() => setLiveActivity(prev => ({ ...prev, processingErrors: [] }))}>
                      Clear Console
                    </Button>
                    <Button size="sm" variant="outline" onClick={toggleDebugMode}>
                      {debugMode ? 'Disable' : 'Enable'} Debug
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Monitor className="h-5 w-5 text-blue-600" />
                  <span>Extension Control</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" className="w-full">
                      <Play className="h-4 w-4 mr-2" />
                      Start Processing
                    </Button>
                    <Button size="sm" variant="outline" className="w-full">
                      <Pause className="h-4 w-4 mr-2" />
                      Pause Processing
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <h4 className="font-medium mb-2">Active Browser Tabs</h4>
                    {liveActivity.activeTabs.length > 0 ? (
                      <div className="space-y-1">
                        {liveActivity.activeTabs.map((tab, index) => (
                          <div key={index} className="text-sm p-2 bg-gray-50 rounded flex items-center justify-between">
                            <div>
                              <p className="font-medium truncate">{tab.title}</p>
                              <p className="text-xs text-gray-500 truncate">{tab.url}</p>
                            </div>
                            <Badge variant="outline">{tab.status}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No active extension tabs</p>
                    )}
                  </div>
                  
                  <Button size="sm" variant="destructive" className="w-full" onClick={emergencyStop}>
                    <Square className="h-4 w-4 mr-2" />
                    Emergency Stop All Activities
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Enhanced Footer */}
      <div className="text-center text-sm text-gray-500 border-t pt-4">
        {lastUpdate && (
          <div className="flex items-center justify-center space-x-4">
            <p>Last updated: {lastUpdate.toLocaleTimeString()}</p>
            <p>Auto-refresh: 5s</p>
            <p>WebSocket: {websocketRef.current?.readyState === 1 ? '🟢 Connected' : '🔴 Disconnected'}</p>
            <p>Live Activities: {liveActivity.currentActivities.length}</p>
            <p>Screenshots: {liveActivity.screenshots.length}</p>
          </div>
        )}
        <p className="mt-2 text-xs">
          Emergency Monitoring Dashboard - Real-time AutoBolt operation visibility
        </p>
      </div>
    </div>
  );
}