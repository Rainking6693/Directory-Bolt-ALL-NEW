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

export default function AutoBoltMonitoring({ className = '' }) {
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

  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Fetch system metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const [statsResponse, queueResponse] = await Promise.all([
        fetch('/api/autobolt/stats'),
        fetch('/api/autobolt/queue/status')
      ]);

      const stats = await statsResponse.json();
      const queue = await queueResponse.json();

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

      setLastUpdate(new Date());
      setLoading(false);

    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      setLoading(false);
    }
  }, []);

  // Set up real-time polling
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  // Manual refresh
  const handleRefresh = () => {
    setLoading(true);
    fetchMetrics();
  };

  // Export metrics data
  const handleExportMetrics = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      metrics,
      realtimeData
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autobolt-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
          <span>Loading monitoring data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AutoBolt System Monitoring</h1>
          <p className="text-gray-600">Real-time system performance and health metrics</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportMetrics}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
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

      {/* Directory Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Directory Health Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(metrics.directoryHealth).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(metrics.directoryHealth).map(([directory, health]) => (
                <div key={directory} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{directory}</h4>
                    <Badge className={health.status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {health.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Success Rate</span>
                      <span>{(health.successRate * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={health.successRate * 100} className="h-2" />
                    
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Last Success</span>
                      <span>{health.lastSuccess}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Activity className="h-8 w-8 mx-auto mb-2" />
              <p>Directory health data will appear here</p>
              <p className="text-sm">Data is collected during processing</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Alerts */}
      {realtimeData.systemAlerts && realtimeData.systemAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span>System Alerts</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {realtimeData.systemAlerts.map((alert, index) => (
                <div key={index} className={`p-3 rounded-lg border-l-4 ${
                  alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                  alert.severity === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-gray-600">{alert.message}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={
                        alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }>
                        {alert.severity}
                      </Badge>
                      <p className="text-xs text-gray-500">{alert.timestamp}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-gray-500">
        {lastUpdate && (
          <p>Last updated: {lastUpdate.toLocaleTimeString()} | Auto-refresh every 10 seconds</p>
        )}
      </div>
    </div>
  );
}