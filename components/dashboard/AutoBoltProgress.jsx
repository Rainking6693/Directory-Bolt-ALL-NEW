/**
 * AutoBolt Progress Tracking Component
 * Real-time directory submission progress for customers
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink, 
  RefreshCw,
  Download,
  AlertCircle
} from 'lucide-react';

export default function AutoBoltProgress({ customerId, className = '' }) {
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Fetch progress data
  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/autobolt/customer/${customerId}`);
      const data = await response.json();

      if (data.success) {
        setProgress(data.customer.progress);
        setResults(data.customer.results || []);
        setLastUpdate(new Date());
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch progress');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Progress fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // Set up polling for real-time updates
  useEffect(() => {
    fetchProgress();

    const pollInterval = setInterval(fetchProgress, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [fetchProgress]);

  // Manual refresh
  const handleRefresh = () => {
    setLoading(true);
    fetchProgress();
  };

  // Export results
  const handleExportResults = () => {
    const csvContent = [
      ['Directory', 'Status', 'Submission URL', 'Timestamp', 'Notes'],
      ...results.map(result => [
        result.directoryName,
        result.status,
        result.submissionUrl || '',
        result.timestamp,
        result.notes || result.error || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autobolt-results-${customerId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !progress) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading progress...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercentage = progress?.total > 0 
    ? Math.round((progress.completed / progress.total) * 100) 
    : 0;

  const successRate = progress?.completed > 0 
    ? Math.round((progress.successful / progress.completed) * 100) 
    : 0;

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Progress Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">
            Directory Submission Progress
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            {results.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExportResults}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{progress?.completed || 0}/{progress?.total || 0} directories</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <div className="text-center text-sm text-gray-600">
                {progressPercentage}% Complete
              </div>
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {progress?.total || 0}
                </div>
                <div className="text-sm text-blue-800">Total Directories</div>
              </div>
              
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {progress?.successful || 0}
                </div>
                <div className="text-sm text-green-800">Successful</div>
              </div>
              
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {progress?.failed || 0}
                </div>
                <div className="text-sm text-red-800">Failed</div>
              </div>
              
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {successRate}%
                </div>
                <div className="text-sm text-purple-800">Success Rate</div>
              </div>
            </div>

            {/* Last Update */}
            {lastUpdate && (
              <div className="text-xs text-gray-500 text-center">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Directory Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Directory Submission Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p>Processing will begin shortly...</p>
              <p className="text-sm">Results will appear here as directories are processed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <div className="font-medium">{result.directoryName}</div>
                      {result.notes && (
                        <div className="text-sm text-gray-600">{result.notes}</div>
                      )}
                      {result.error && (
                        <div className="text-sm text-red-600">{result.error}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(result.status)}>
                      {result.status}
                    </Badge>
                    
                    {result.submissionUrl && result.status === 'success' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(result.submissionUrl, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Status */}
      {progress?.currentDirectory && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm">
                Currently processing: <strong>{progress.currentDirectory}</strong>
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}